/**
 * API Error Handler
 *
 * Utility to handle API errors and show appropriate toast messages
 * based on status codes (4xx vs 5xx)
 */

import { toast as showToast } from '@/hooks/use-toast';

export interface ApiError extends Error {
  status?: number;
  statusCode?: number;
  response?: Response;
}

/**
 * Extract status code from various error formats
 */
export function getStatusCode(error: unknown): number | undefined {
  if (!error) return undefined;

  // Check if error has status or statusCode property
  if (typeof error === 'object') {
    const err = error as any;
    if (err.status) return err.status;
    if (err.statusCode) return err.statusCode;
    if (err.response?.status) return err.response.status;
  }

  return undefined;
}

/**
 * Extract error message from various error formats
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred';

  if (typeof error === 'string') return error;

  if (error instanceof Error) return error.message;

  if (typeof error === 'object') {
    const err = error as any;

    // Check various error message locations
    if (err.message) return err.message;
    if (err.error?.message) return err.error.message;
    if (err.error && typeof err.error === 'string') return err.error;

    // Check response body for error messages (common in API responses)
    if (err.response) {
      // Try to parse response as JSON if it's a Response object
      if (err.response.json && typeof err.response.json === 'function') {
        // Response object - can't directly access body, use originalError if available
        if (err.originalError?.message) return err.originalError.message;
        if (err.originalError?.error) return err.originalError.error;
      }
      // Already parsed response object
      if (err.response.error) return err.response.error;
      if (err.response.message) return err.response.message;
    }

    // Check if originalError has details (from SDK wrapper)
    if (err.originalError) {
      if (typeof err.originalError === 'string') return err.originalError;
      if (err.originalError.message) return err.originalError.message;
      if (err.originalError.error) return err.originalError.error;
    }
  }

  return 'An unknown error occurred';
}

/**
 * Show toast message based on error status code
 * - 4xx: Yellow warning toast with actual error message
 * - 5xx: Red destructive toast with generic message
 * - Other: Red destructive toast with error message
 */
export function handleApiError(error: unknown, title?: string): void {
  const status = getStatusCode(error);
  const message = getErrorMessage(error);

  console.error('API Error:', { status, message, error });

  // 4xx errors - client errors (show actual message in yellow/warning)
  if (status && status >= 400 && status < 500) {
    showToast({
      title: title || 'Request Error',
      description: message,
      variant: 'default',
      className: 'border-yellow-500 bg-yellow-50 text-yellow-900',
    });
    return;
  }

  // 5xx errors - server errors (show generic message)
  if (status && status >= 500) {
    showToast({
      title: title || 'Internal Server Error',
      description: 'Internal server error. Please contact support.',
      variant: 'destructive',
    });
    return;
  }

  // Unknown errors or network errors (show actual message)
  showToast({
    title: title || 'Error',
    description: message || 'An error occurred. Please try again.',
    variant: 'destructive',
  });
}

/**
 * Wrap SDK responses to throw proper errors with status codes
 */
export async function handleSdkResponse<T>(response: {
  data?: T;
  error?: unknown;
  response?: Response;
}): Promise<T> {
  if (response.error) {
    // Try to extract error message from the response
    let errorMessage = 'An error occurred';

    // If response exists and has a parseable body, try to get error details
    if (response.response) {
      try {
        const clonedResponse = response.response.clone();
        const errorBody = await clonedResponse.json();
        if (errorBody.error) {
          errorMessage = errorBody.error;
        } else if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // Failed to parse response body, use original error
        errorMessage = getErrorMessage(response.error);
      }
    } else {
      errorMessage = getErrorMessage(response.error);
    }

    const error: any = new Error(errorMessage);
    error.status = response.response?.status;
    error.response = response.response;
    error.originalError = response.error;
    throw error;
  }

  if (!response.data) {
    throw new Error('No data received from server');
  }

  return response.data;
}
