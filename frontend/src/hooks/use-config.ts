import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { configApi, setAuthEnabled } from "@/lib/api";
import type { AppConfig } from "@/lib/api";

/**
 * Fetch and cache app configuration from `/api/config`.
 *
 * On success, synchronises the module-level `authEnabled` flag in the API
 * layer so that the 401 redirect interceptor is disabled when auth is off.
 */
export function useAppConfig() {
  const { data: config, isLoading } = useQuery<AppConfig>({
    queryKey: ["config"],
    queryFn: configApi.get,
    staleTime: Infinity, // config doesn't change at runtime
    retry: 2,
  });

  // Sync the module-level flag whenever config arrives
  useEffect(() => {
    if (config) {
      setAuthEnabled(config.auth_enabled);
    }
  }, [config]);

  return {
    config: config ?? null,
    authEnabled: config?.auth_enabled ?? true, // conservative default
    isLoading,
  };
}
