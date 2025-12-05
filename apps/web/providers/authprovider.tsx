"use client"
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  OrgMemberInfoClass,
  useAuthInfo,
  User,
} from "@propelauth/react";
import { toast } from "react-toastify";
import { setTokenGetter, setUserIdGetter } from "@/lib/api";



interface AuthContextType {
  accessToken: string | null | undefined;
  user: User | null | undefined;
  isLoading: boolean;
  trataClientConfig: TrataClientConfigType;
  refreshToken: () => Promise<void>;
}

export type TrataClientConfigType = {
  accessToken?: string;
  basePath: string;
  headers?: Record<string, string>;
  middleware?: {
    pre?: (context: any) => Promise<any>;
    onError?: (error: any) => Promise<void>;
  };
};

const AuthContext = createContext<AuthContextType>({
  accessToken: null,
  user: {} as User,
  isLoading: true,
  trataClientConfig: {} as TrataClientConfigType,
  refreshToken: async () => { },
});

export const AuthContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const authInfo = useAuthInfo();
  const { userClass, isLoggedIn } = useAuthInfo();
  const [activeOrg, setActiveOrg] = useState<OrgMemberInfoClass | null>(null);

  const [trataClientConfig, setTrataClientConfig] =
    useState<TrataClientConfigType | null>(null);

  useEffect(() => {
    if (userClass && typeof window !== 'undefined') {
      const orgs = userClass.getOrgs();
      if (orgs && orgs.length > 0) {
        // Sort orgs based on name
        orgs.sort((a, b) => a.orgId.localeCompare(b.orgId));

        // Get preferred org from localStorage using user-specific key
        const storageKey = `preferredOrgId_${userClass.userId}`;
        const preferredOrgId = localStorage.getItem(storageKey);

        // Find the preferred org in the available orgs
        const preferredOrg = preferredOrgId
          ? orgs.find((o) => o.orgId === preferredOrgId)
          : null;

        // If preferred org exists and is available, use it
        if (preferredOrg) {
          setActiveOrg((current) => {
            // Only update if it's different to avoid unnecessary re-renders
            if (current?.orgId !== preferredOrg.orgId) {
              return preferredOrg;
            }
            return current;
          });
        }
        // If no preferred org or it's not available, use first org
        else {
          setActiveOrg((current) => {
            // Only update if current org is not in the list or if we don't have one
            const foundActive = current && orgs.find((o) => o.orgId === current.orgId);
            if (foundActive) {
              return current; // Keep current if it's still valid
            } else {
              // Store the default org as preferred with user-specific key
              localStorage.setItem(storageKey, orgs[0].orgId);
              return orgs[0];
            }
          });
        }
      } else {
        // No orgs available, clear activeOrg only if it's not already null
        setActiveOrg((current) => current !== null ? null : current);
      }
    }
  }, [userClass?.userId]); // Only depend on userId, not the entire userClass or activeOrg

  const refreshToken = async () => {
    if (activeOrg) {
      try {
        const token = await authInfo.tokens.getAccessTokenForOrg(
          activeOrg.orgId,
        );
        if (token) {
          setTrataClientConfig(createTrataConfig(token.accessToken));
        }
      } catch (error) {
        console.error("Error refreshing token", error);
        toast.error("Failed to refresh session", {
          toastId: "token-refresh-failed",
        });
      }
    } else {
      console.warn("Cannot refresh token: no active organization");
    }
  };

  useEffect(() => {
    const setupConfig = async () => {
      if (activeOrg) {
        try {
          const token = await authInfo.tokens.getAccessTokenForOrg(
            activeOrg.orgId,
          );
          if (token) {
            setTrataClientConfig(createTrataConfig(token.accessToken));
          }
        } catch (error) {
          console.error("Error setting up config", error);
        }
      }
    };

    setupConfig();
  }, [activeOrg, isLoggedIn]);

  // Helper to check if token needs refresh (5 minutes buffer)
  const shouldRefreshToken = (token: string | null | undefined): boolean => {
    if (!token) {
      return true;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expiryTime = payload.exp * 1000; // convert to milliseconds
      const currentTime = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      return expiryTime - currentTime < fiveMinutes;
    } catch (e) {
      console.error("Error parsing token:", e);
      return true; // refresh token on error to be safe
    }
  };

  // Set up token getter for API calls with automatic refresh
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AuthProvider] Setting up token getter', {
        hasActiveOrg: !!activeOrg,
        activeOrgId: activeOrg?.orgId,
        hasAuthInfo: !!authInfo,
        hasAccessToken: !!authInfo?.accessToken,
      });
    }

    if (authInfo) {
      // Set user ID getter
      setUserIdGetter(() => {
        return authInfo.user?.userId || null;
      });

      let cachedToken: string | null = null;
      let cachedOrgId: string | null = null;

      setTokenGetter(async () => {
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log('[AuthProvider] Token getter called', {
              cachedToken: cachedToken ? 'exists' : 'null',
              cachedOrgId,
              activeOrgId: activeOrg?.orgId,
              hasActiveOrg: !!activeOrg,
            });
          }

          // If user has an org, use org token
          if (activeOrg) {
            // If org changed, clear cache
            if (cachedOrgId !== activeOrg.orgId) {
              if (process.env.NODE_ENV === 'development') {
                console.log('[AuthProvider] Org changed, clearing cache');
              }
              cachedToken = null;
              cachedOrgId = activeOrg.orgId;
            }

            // Check if we have a cached token and if it needs refresh
            if (cachedToken && !shouldRefreshToken(cachedToken)) {
              if (process.env.NODE_ENV === 'development') {
                console.log('[AuthProvider] Using cached org token');
              }
              return cachedToken;
            }

            if (process.env.NODE_ENV === 'development') {
              console.log('[AuthProvider] Fetching fresh org token from PropelAuth');
            }

            // Get fresh token for org (PropelAuth will refresh if needed)
            const tokenData = await authInfo.tokens.getAccessTokenForOrg(
              activeOrg.orgId,
            );

            if (tokenData?.accessToken) {
              cachedToken = tokenData.accessToken;
              cachedOrgId = activeOrg.orgId;
              if (process.env.NODE_ENV === 'development') {
                console.log('[AuthProvider] Org token fetched successfully');
              }
              return cachedToken;
            }

            if (process.env.NODE_ENV === 'development') {
              console.warn('[AuthProvider] No access token in tokenData for org');
            }

            cachedToken = null;
            cachedOrgId = null;
            return null;
          } else {
            // User has no org, use user's access token directly
            if (process.env.NODE_ENV === 'development') {
              console.log('[AuthProvider] No org, using user access token');
            }

            // Check if we have a cached token and if it needs refresh
            if (cachedToken && !shouldRefreshToken(cachedToken)) {
              if (process.env.NODE_ENV === 'development') {
                console.log('[AuthProvider] Using cached user token');
              }
              return cachedToken;
            }

            // Use the user's access token directly (PropelAuth manages refresh)
            const userToken = authInfo.accessToken;

            if (userToken) {
              cachedToken = userToken;
              cachedOrgId = null; // No org for user token
              if (process.env.NODE_ENV === 'development') {
                console.log('[AuthProvider] User token available');
              }
              return userToken;
            }

            if (process.env.NODE_ENV === 'development') {
              console.warn('[AuthProvider] No user access token available');
            }

            cachedToken = null;
            cachedOrgId = null;
            return null;
          }
        } catch (error) {
          console.error("[AuthProvider] Error getting token for API:", error);
          cachedToken = null;
          cachedOrgId = null;
          return null;
        }
      });
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AuthProvider] No authInfo, setting token getter to null');
      }
      setUserIdGetter(() => null);
      setTokenGetter(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrg?.orgId, authInfo?.tokens]);

  const createTrataConfig = (token?: string): TrataClientConfigType => {
    if (!token) {
      console.warn("Creating config without token");
    }

    const config: TrataClientConfigType = {
      basePath: process.env.NEXT_PUBLIC_BACKEND_BASE_URL as string,
      accessToken: token,
      middleware: {
        pre: async (context: { init: { headers: Record<string, string> } }) => {
          // Only refresh if current token is about to expire
          if (activeOrg && token && shouldRefreshToken(token)) {
            const freshToken = await authInfo.tokens.getAccessTokenForOrg(
              activeOrg.orgId,
            );
            if (freshToken) {
              // Update the header with new token
              context.init.headers = {
                ...context.init.headers,
                Authorization: `Bearer ${freshToken.accessToken}`,
                "x-trata-environment": "all",
              };
              // Update the state with new token - this will trigger a re-render with new config
              setTrataClientConfig(createTrataConfig(freshToken.accessToken));
            }
          } else {
            // Use existing token
            context.init.headers = {
              ...context.init.headers,
              Authorization: `Bearer ${token}`,
              "x-trata-environment": "all",
            };
          }
          return context;
        },
        onError: async (error: { response?: { status?: number; data?: { detail?: string } }; message?: string }) => {
          if (error?.response?.status === 401) {
            toast.error(
              error.response?.data?.detail ||
              "Session expired, please login again",
              {
                toastId: "session-expired",
              },
            );
          } else if (error?.message === "Network Error") {
            toast.error(
              error.response?.data?.detail ||
              "Network Error, please try again later",
              {
                toastId: "network-error",
              },
            );
          } else if (error?.response?.status === 403) {
            toast.error(
              error.response?.data?.detail ||
              "You are not authorized to perform this operation",
              {
                toastId: "unauthorized",
              },
            );
          } else if (error?.response?.status === 404) {
            toast.error(
              error.response?.data?.detail ||
              "Request failed with status code 404",
              {
                toastId: "not found",
              },
            );
          } else if (error?.response?.status === 500) {
            toast.error(error.response?.data?.detail || "Internal server error", {
              toastId: "internal-server-error",
            });
          }

          throw error;
        },
      },
    };
    return config;
  };

  return (
    <div>
      <AuthContext.Provider
        value={{
          accessToken: authInfo.accessToken,
          user: authInfo.user,
          trataClientConfig: trataClientConfig || ({} as TrataClientConfigType),
          isLoading: authInfo.loading || !trataClientConfig,
          refreshToken,
        }}
      >
        {children}
      </AuthContext.Provider>
    </div>
  );
};

export const useUserAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthContextProvider");
  }
  return context;
};

// Helper function to get token
export const useGetToken = () => {
  const { accessToken } = useUserAuth();
  return accessToken;
};