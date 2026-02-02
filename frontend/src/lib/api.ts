import type { components } from "@/generated/api-types";

// Type aliases for convenience
export type Chore = components["schemas"]["ChoreResponse"];
export type ChoreWithDue = components["schemas"]["ChoreWithDueResponse"];
export type Completion = components["schemas"]["CompletionResponse"];
export type CreateChoreRequest = components["schemas"]["CreateChoreRequest"];
export type UpdateChoreRequest = components["schemas"]["UpdateChoreRequest"];
export type CompleteChoreRequest = components["schemas"]["CompleteChoreRequest"];
export type PaginatedChores = components["schemas"]["PaginatedResponse_ChoreResponse"];
export type PaginatedCompletions = components["schemas"]["PaginatedResponse_CompletionResponse"];

// API error type
export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string
  ) {
    super(detail || title);
    this.name = "ApiError";
  }
}

// Base fetch wrapper with error handling
async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    // Try to parse RFC 7807 error response
    try {
      const error = await response.json();
      throw new ApiError(
        response.status,
        error.title || response.statusText,
        error.detail
      );
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

// Chores API
export const choresApi = {
  list: async (params?: { cursor?: string; limit?: number }): Promise<PaginatedChores> => {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    const query = searchParams.toString();
    return apiFetch<PaginatedChores>(`/api/chores${query ? `?${query}` : ""}`);
  },

  getDue: async (includeUpcoming = true): Promise<ChoreWithDue[]> => {
    const query = includeUpcoming ? "?include_upcoming=true" : "";
    return apiFetch<ChoreWithDue[]>(`/api/chores/due${query}`);
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
    params?: { cursor?: string; limit?: number }
  ): Promise<PaginatedCompletions> => {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    const query = searchParams.toString();
    return apiFetch<PaginatedCompletions>(
      `/api/chores/${choreId}/completions${query ? `?${query}` : ""}`
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
