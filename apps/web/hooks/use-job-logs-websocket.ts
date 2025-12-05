import { useEffect, useRef, useState, useCallback } from 'react';
import { getAuthHeaders } from '@/lib/api';

interface LogMessage {
  level: string;
  message: string;
  timestamp: string;
  jobId: string;
  stage?: string;
}

interface WebSocketMessage {
  type: 'log' | 'subscribed' | 'unsubscribed' | 'historical-logs' | 'error' | 'job-completed' | 'logs-updated';
  data?: LogMessage | LogMessage[] | { 
    codeGenerationLogs?: LogMessage[] | null; 
    codeVerificationLogs?: LogMessage[] | null;
  };
  jobId?: string;
  message?: string;
}

interface UseJobLogsWebSocketOptions {
  jobId: string | null;
  jobVersion?: number | null;
  enabled?: boolean;
  onLog?: (log: LogMessage) => void;
  onError?: (error: Error) => void;
}

export function useJobLogsWebSocket({
  jobId,
  jobVersion,
  enabled = true,
  onLog,
  onError,
}: UseJobLogsWebSocketOptions) {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const isDisconnectingRef = useRef(false);
  const onLogRef = useRef(onLog);
  const onErrorRef = useRef(onError);
  const enabledRef = useRef(enabled);
  const jobIdRef = useRef(jobId);
  const jobVersionRef = useRef(jobVersion);
  const connectingJobIdRef = useRef<string | null>(null);
  const connectingJobVersionRef = useRef<number | null>(null);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  // Keep refs in sync
  useEffect(() => {
    onLogRef.current = onLog;
  }, [onLog]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    jobIdRef.current = jobId;
  }, [jobId]);

  useEffect(() => {
    jobVersionRef.current = jobVersion;
  }, [jobVersion]);

  const connect = useCallback(async () => {
    const currentJobId = jobIdRef.current;
    const currentJobVersion = jobVersionRef.current;
    const currentEnabled = enabledRef.current;
    
    if (!currentJobId || !currentEnabled || isConnectingRef.current || isDisconnectingRef.current) {
      return;
    }

    // Check if already connected to the same job and version
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const wsJobId = (wsRef.current as WebSocket & { __jobId?: string }).__jobId;
      const wsJobVersion = (wsRef.current as WebSocket & { __jobVersion?: number }).__jobVersion;
      if (wsJobId === currentJobId && wsJobVersion === currentJobVersion) {
        return; // Already connected to same job/version
      }
    }

    // Store the jobId and version we're connecting to
    const connectingJobId = currentJobId;
    const connectingJobVersion = currentJobVersion ?? null;
    connectingJobIdRef.current = connectingJobId;
    connectingJobVersionRef.current = connectingJobVersion;
    isConnectingRef.current = true;

    try {
      // Get auth token to pass as query parameter (WebSocket can't send headers)
      const headers = await getAuthHeaders();
      const token = headers['Authorization']?.replace('Bearer ', '') || '';
      
      // Check if jobId/version changed while we were getting the token
      if (jobIdRef.current !== connectingJobId || jobVersionRef.current !== connectingJobVersion || !enabledRef.current) {
        isConnectingRef.current = false;
        return;
      }
      
      const baseUrl = process.env.NEXT_PUBLIC_SIA_BACKEND_URL || 'http://localhost:3001';
      const queryParams = new URLSearchParams();
      if (token) {
        queryParams.set('token', token);
      }
      if (connectingJobVersion !== null && connectingJobVersion !== undefined) {
        queryParams.set('version', connectingJobVersion.toString());
      }
      const queryString = queryParams.toString();
      const wsUrl = baseUrl.replace(/^http/, 'ws') + `/jobs/${connectingJobId}/logs/stream${queryString ? `?${queryString}` : ''}`;

      const ws = new WebSocket(wsUrl);
      
      // Store jobId and version with the socket to verify it's still valid
      (ws as WebSocket & { __jobId?: string; __jobVersion?: number }).__jobId = connectingJobId;
      (ws as WebSocket & { __jobId?: string; __jobVersion?: number }).__jobVersion = connectingJobVersion ?? undefined;

      ws.onopen = () => {
        // Verify this is still the correct job and version
        if (jobIdRef.current !== connectingJobId || jobVersionRef.current !== connectingJobVersion || !enabledRef.current) {
          console.log('[WebSocket] Connection opened but jobId/version/enabled changed, closing');
          ws.close();
          isConnectingRef.current = false;
          connectingJobIdRef.current = null;
          connectingJobVersionRef.current = null;
          return;
        }
        
        console.log('[WebSocket] Connected to job:', connectingJobId, 'version:', connectingJobVersion);
        isConnectingRef.current = false;
        connectingJobIdRef.current = null;
        connectingJobVersionRef.current = null;
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Subscribe to logs with jobId and version
        const subscribeMessage: { type: 'subscribe'; jobId: string; version?: number } = { 
          type: 'subscribe', 
          jobId: connectingJobId,
        };
        // Include version if it's a number (including 0), only exclude if null or undefined
        if (typeof connectingJobVersion === 'number') {
          subscribeMessage.version = connectingJobVersion;
        }
        
        // Also update the socket's stored version
        (ws as WebSocket & { __jobVersion?: number }).__jobVersion = connectingJobVersion ?? undefined;
        console.log('[WebSocket] Sending subscribe message:', subscribeMessage);
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Received message:', message.type, message);

          // Verify this message is for the current job and version
          if (jobIdRef.current !== connectingJobId || jobVersionRef.current !== connectingJobVersion || !enabledRef.current) {
            console.log('[WebSocket] Ignoring message for different job/version or disabled connection');
            return;
          }

          switch (message.type) {
            case 'subscribed':
              console.log('[WebSocket] Subscribed to logs for job:', message.jobId);
              break;

            case 'unsubscribed': {
              console.log('[WebSocket] Unsubscribed from logs for job:', message.jobId);
              // Clear any pending close timeout since we got the confirmation
              const wsForUnsubscribe = wsRef.current;
              if (wsForUnsubscribe) {
                const closeTimeout = (wsForUnsubscribe as WebSocket & { __closeTimeout?: NodeJS.Timeout }).__closeTimeout;
                if (closeTimeout) {
                  clearTimeout(closeTimeout);
                  delete (wsForUnsubscribe as WebSocket & { __closeTimeout?: NodeJS.Timeout }).__closeTimeout;
                }
              }
              // Close the WebSocket connection after receiving unsubscribed confirmation
              if (wsForUnsubscribe && (wsForUnsubscribe.readyState === WebSocket.OPEN || wsForUnsubscribe.readyState === WebSocket.CONNECTING)) {
                console.log('[WebSocket] Closing connection after unsubscribe confirmation');
                wsForUnsubscribe.close();
              }
              break;
            }

            case 'log':
              if (message.data && !Array.isArray(message.data) && 'level' in message.data && 'message' in message.data) {
                const log = message.data as LogMessage;
                console.log('[WebSocket] Received log:', log);
                // Add new log at the beginning (newest first) and avoid duplicates
                setLogs((prev) => {
                  const key = `${log.timestamp}-${log.message}`;
                  const exists = prev.some(l => `${l.timestamp}-${l.message}` === key);
                  if (exists) {
                    return prev; // Don't add duplicate
                  }
                  // Insert at beginning to maintain newest-first order
                  return [log, ...prev];
                });
                onLogRef.current?.(log);
              }
              break;

            case 'historical-logs':
              if (message.data && Array.isArray(message.data)) {
                console.log('[WebSocket] Received historical logs:', message.data.length, 'logs');
                // Merge with existing logs, avoiding duplicates based on timestamp and message
                setLogs((prev) => {
                  const existingKeys = new Set(prev.map(log => `${log.timestamp}-${log.message}`));
                  const newLogs = (message.data as LogMessage[]).filter((log: LogMessage) => 
                    !existingKeys.has(`${log.timestamp}-${log.message}`)
                  );
                  // Combine and sort by timestamp (newest first)
                  const combined = [...prev, ...newLogs];
                  combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                  return combined;
                });
              } else {
                console.warn('[WebSocket] historical-logs data is not an array:', message.data);
              }
              break;

            case 'logs-updated':
              // Full log updates - could be used to sync full log content
              // Individual logs are handled by 'log' type above
              break;

            case 'error': {
              const error = new Error(message.message || 'WebSocket error');
              console.error('[WebSocket] Error:', error);
              setError(error);
              onErrorRef.current?.(error);
              break;
            }

            case 'job-completed':
              console.log('[WebSocket] Job completed');
              break;

            default:
              console.warn('[WebSocket] Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err, event.data);
        }
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        isConnectingRef.current = false;
        connectingJobIdRef.current = null;
        const wsError = new Error('WebSocket connection error');
        setError(wsError);
        onErrorRef.current?.(wsError);
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Closed:', event.code, event.reason);
        isConnectingRef.current = false;
        connectingJobIdRef.current = null;
        setIsConnected(false);
        
        // Only attempt reconnection if this socket is still the current one
        // (prevents reconnecting after intentional disconnect)
        if (wsRef.current === ws && enabledRef.current && !isDisconnectingRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          wsRef.current = null;
          reconnectAttemptsRef.current += 1;
          const delay = reconnectDelay * reconnectAttemptsRef.current;
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          wsRef.current = null;
          if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            const maxAttemptsError = new Error('Max reconnection attempts reached');
            setError(maxAttemptsError);
            onErrorRef.current?.(maxAttemptsError);
          }
        }
      };

      wsRef.current = ws;
    } catch (err) {
      isConnectingRef.current = false;
      connectingJobIdRef.current = null;
      const connectionError = err instanceof Error ? err : new Error('Failed to create WebSocket');
      setError(connectionError);
      onErrorRef.current?.(connectionError);
    }
  }, []);

  const disconnect = useCallback((force = false) => {
    if (isDisconnectingRef.current && !force) {
      return;
    }

    // Don't disconnect if we're currently connecting to the current jobId/version
    // Unless force is true (e.g., on unmount) or jobId/version changed
    if (!force && isConnectingRef.current && 
        connectingJobIdRef.current === jobIdRef.current && 
        connectingJobVersionRef.current === jobVersionRef.current) {
      return;
    }

    console.log('[WebSocket] Disconnecting, force:', force);
    isDisconnectingRef.current = true;

    // Cancel any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const ws = wsRef.current;
    if (ws) {
      // Only send unsubscribe if WebSocket is open (readyState === WebSocket.OPEN which is 1)
      if (ws.readyState === WebSocket.OPEN) {
        try {
          console.log('[WebSocket] Sending unsubscribe message');
          const currentJobId = jobIdRef.current;
          if (currentJobId) {
            const unsubscribeMessage: { type: 'unsubscribe'; jobId: string; version?: number } = {
              type: 'unsubscribe',
              jobId: currentJobId,
            };
            if (jobVersionRef.current !== null && jobVersionRef.current !== undefined) {
              unsubscribeMessage.version = jobVersionRef.current;
            }
            ws.send(JSON.stringify(unsubscribeMessage));
          }
          // Wait for unsubscribed confirmation before closing, but set a timeout as fallback
          const closeTimeout = setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
              console.log('[WebSocket] Closing connection after unsubscribe timeout (no confirmation received)');
              ws.close();
            }
          }, 500); // 500ms timeout to wait for unsubscribed message
          
          // Store timeout to clear if we get unsubscribed message
          (ws as WebSocket & { __closeTimeout?: NodeJS.Timeout }).__closeTimeout = closeTimeout;
        } catch (error) {
          console.error('[WebSocket] Failed to send unsubscribe:', error);
          // Close immediately if send failed
          if ((ws.readyState as number) !== WebSocket.CLOSED && (ws.readyState as number) !== WebSocket.CLOSING) {
            ws.close();
          }
        }
      } else {
        // Close the connection if not already closed or closing
        if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }

      // Remove event listeners to prevent reconnection callbacks
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.onopen = null;

      wsRef.current = null;
    }

    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
    isDisconnectingRef.current = false;
  }, []);

  useEffect(() => {
    // Update refs immediately
    jobIdRef.current = jobId;
    enabledRef.current = enabled;

    // Connect if enabled
    if (enabled && jobId) {
      connect();
    } else {
      // Disconnect when disabled or no jobId
      disconnect(true);
    }

    // Cleanup: always disconnect on unmount or when dependencies change
    return () => {
      // Only disconnect if this effect's jobId/version/enabled matches current refs
      // This prevents disconnecting a new connection that was just established
      if (jobIdRef.current === jobId && jobVersionRef.current === jobVersion && enabledRef.current === enabled) {
        disconnect(true);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, jobVersion, enabled]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    logs,
    isConnected,
    error,
    clearLogs,
    reconnect: connect,
  };
}

