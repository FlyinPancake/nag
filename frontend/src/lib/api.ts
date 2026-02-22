import type { components } from "@/generated/api-types";

// Type aliases for convenience
export type Chore = components["schemas"]["ChoreResponse"];
export type ChoreWithDue = components["schemas"]["ChoreWithDueResponse"];
export type Completion = components["schemas"]["CompletionResponse"];
export type Tag = components["schemas"]["TagResponse"];
export type CreateChoreRequest = components["schemas"]["CreateChoreRequest"];
export type UpdateChoreRequest = components["schemas"]["UpdateChoreRequest"];
export type CompleteChoreRequest = components["schemas"]["CompleteChoreRequest"];
export type CreateTagRequest = components["schemas"]["CreateTagRequest"];
export type UpdateTagRequest = components["schemas"]["UpdateTagRequest"];
export type PaginatedChores = components["schemas"]["PaginatedResponse_ChoreResponse"];
export type PaginatedCompletions = components["schemas"]["PaginatedResponse_CompletionResponse"];

// API error type
export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
  ) {
    super(detail || title);
    this.name = "ApiError";
  }
}

// --- Auth-enabled flag ---
// Set once on app init via `setAuthEnabled()`. Controls whether 401 responses
// trigger a redirect to /auth/login.
let _authEnabled = true; // conservative default until config is fetched

export function setAuthEnabled(enabled: boolean) {
  _authEnabled = enabled;
}

export function isAuthEnabled(): boolean {
  return _authEnabled;
}

// Base fetch wrapper with error handling
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  // Redirect to login on 401 Unauthorized (only when auth is enabled)
  if (response.status === 401 && _authEnabled) {
    window.location.href = "/auth/login";
    throw new ApiError(401, "Unauthorized", "Redirecting to login...");
  }

  if (!response.ok) {
    // Try to parse RFC 7807 error response
    try {
      const error = await response.json();
      throw new ApiError(response.status, error.title || response.statusText, error.detail);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(response.status, response.statusText);
    }
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// App config API
export interface AppConfig {
  auth_enabled: boolean;
}

export const configApi = {
  /** Fetch app configuration. Uses raw fetch to avoid the 401 interceptor. */
  get: async (): Promise<AppConfig> => {
    const response = await fetch("/api/config");
    if (!response.ok) {
      throw new ApiError(response.status, "Failed to fetch app config");
    }
    return response.json();
  },
};

// Chores API
export const choresApi = {
  list: async (params?: {
    cursor?: string;
    limit?: number;
    tag?: string;
  }): Promise<PaginatedChores> => {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.tag) searchParams.set("tag", params.tag);
    const query = searchParams.toString();
    return apiFetch<PaginatedChores>(`/api/chores${query ? `?${query}` : ""}`);
  },

  getDue: async (includeUpcoming = true, tag?: string): Promise<ChoreWithDue[]> => {
    const searchParams = new URLSearchParams();
    if (includeUpcoming) searchParams.set("include_upcoming", "true");
    if (tag) searchParams.set("tag", tag);
    const query = searchParams.toString();
    return apiFetch<ChoreWithDue[]>(`/api/chores/due${query ? `?${query}` : ""}`);
  },

  get: async (id: string): Promise<Chore> => {
    return apiFetch<Chore>(`/api/chores/${id}`);
  },

  create: async (data: CreateChoreRequest): Promise<Chore> => {
    return apiFetch<Chore>("/api/chores", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: UpdateChoreRequest): Promise<Chore> => {
    return apiFetch<Chore>(`/api/chores/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    return apiFetch<void>(`/api/chores/${id}`, {
      method: "DELETE",
    });
  },

  complete: async (id: string, data: CompleteChoreRequest = {}): Promise<Completion> => {
    return apiFetch<Completion>(`/api/chores/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  listCompletions: async (
    choreId: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<PaginatedCompletions> => {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    const query = searchParams.toString();
    return apiFetch<PaginatedCompletions>(
      `/api/chores/${choreId}/completions${query ? `?${query}` : ""}`,
    );
  },
};

// Completions API
export const completionsApi = {
  delete: async (id: string): Promise<void> => {
    return apiFetch<void>(`/api/completions/${id}`, {
      method: "DELETE",
    });
  },
};

// Auth API (uses separate fetch to avoid 401 redirect loop)
export interface AuthUser {
  user_id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export const authApi = {
  /** Fetch the current user session. Returns null if not authenticated. */
  me: async (): Promise<AuthUser | null> => {
    const response = await fetch("/auth/me", { credentials: "include" });
    if (response.status === 401) return null;
    if (!response.ok) return null;
    return response.json();
  },
};

// Tags API
export const tagsApi = {
  list: async (): Promise<Tag[]> => {
    return apiFetch<Tag[]>("/api/tags");
  },

  create: async (data: CreateTagRequest): Promise<Tag> => {
    return apiFetch<Tag>("/api/tags", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: UpdateTagRequest): Promise<Tag> => {
    return apiFetch<Tag>(`/api/tags/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    return apiFetch<void>(`/api/tags/${id}`, {
      method: "DELETE",
    });
  },
};
