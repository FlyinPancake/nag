import { useQuery } from "@tanstack/react-query";

import { authApi } from "@/lib/api";
import type { AuthUser } from "@/lib/api";
import { useAppConfig } from "@/hooks/use-config";

const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useAuth() {
  const { authEnabled, isLoading: configLoading } = useAppConfig();

  const {
    data: user,
    isLoading: userLoading,
    error,
  } = useQuery<AuthUser | null>({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    // Only poll when auth is enabled and config has been loaded
    enabled: authEnabled && !configLoading,
    // Periodic keep-alive: re-fetches every 5 minutes while tab is active.
    // Each fetch hits GET /auth/me on the backend, which extends the
    // session's OnInactivity expiry window.
    refetchInterval: SESSION_REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    // Don't retry on failure — a 401 just means "not logged in"
    retry: false,
    // Keep previous data while refetching to avoid flicker
    staleTime: SESSION_REFRESH_INTERVAL,
  });

  const isAuthenticated = authEnabled && !!user;
  const isLoading = configLoading || (authEnabled && userLoading);

  const logout = () => {
    window.location.href = "/auth/logout";
  };

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated,
    authEnabled,
    error,
    logout,
  };
}
