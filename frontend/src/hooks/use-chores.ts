import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { choresApi, completionsApi } from "@/lib/api";
import type {
  CreateChoreRequest,
  UpdateChoreRequest,
  CompleteChoreRequest,
} from "@/lib/api";

// Query keys
export const choreKeys = {
  all: ["chores"] as const,
  lists: () => [...choreKeys.all, "list"] as const,
  list: (params?: { cursor?: string; limit?: number }) =>
    [...choreKeys.lists(), params] as const,
  due: (includeUpcoming?: boolean) =>
    [...choreKeys.all, "due", { includeUpcoming }] as const,
  details: () => [...choreKeys.all, "detail"] as const,
  detail: (id: string) => [...choreKeys.details(), id] as const,
  completions: (choreId: string, params?: { cursor?: string; limit?: number }) =>
    [...choreKeys.all, "completions", choreId, params] as const,
};

// List all chores
export function useChores(params?: { cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: choreKeys.list(params),
    queryFn: () => choresApi.list(params),
  });
}

// Get due/overdue chores
export function useDueChores(includeUpcoming = true) {
  return useQuery({
    queryKey: choreKeys.due(includeUpcoming),
    queryFn: () => choresApi.getDue(includeUpcoming),
    // Refetch every 5 minutes to keep due status fresh
    refetchInterval: 5 * 60 * 1000,
  });
}

// Get single chore
export function useChore(id: string) {
  return useQuery({
    queryKey: choreKeys.detail(id),
    queryFn: () => choresApi.get(id),
    enabled: !!id,
  });
}

// Create chore mutation
export function useCreateChore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateChoreRequest) => choresApi.create(data),
    onSuccess: () => {
      // Invalidate all chore lists
      queryClient.invalidateQueries({ queryKey: choreKeys.lists() });
      queryClient.invalidateQueries({ queryKey: choreKeys.all });
    },
  });
}

// Update chore mutation
export function useUpdateChore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateChoreRequest }) =>
      choresApi.update(id, data),
    onSuccess: (updatedChore) => {
      // Update the specific chore in cache
      queryClient.setQueryData(choreKeys.detail(updatedChore.id), updatedChore);
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: choreKeys.lists() });
      queryClient.invalidateQueries({ queryKey: choreKeys.all });
    },
  });
}

// Delete chore mutation
export function useDeleteChore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => choresApi.delete(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: choreKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: choreKeys.lists() });
      queryClient.invalidateQueries({ queryKey: choreKeys.all });
    },
  });
}

// Complete chore mutation
export function useCompleteChore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data = {} }: { id: string; data?: CompleteChoreRequest }) =>
      choresApi.complete(id, data),
    onSuccess: (completion) => {
      // Invalidate the specific chore to refresh last_completed_at
      queryClient.invalidateQueries({
        queryKey: choreKeys.detail(completion.chore_id),
      });
      // Invalidate completions list for this chore
      queryClient.invalidateQueries({
        queryKey: choreKeys.completions(completion.chore_id),
      });
      // Invalidate due chores list (order may change)
      queryClient.invalidateQueries({ queryKey: choreKeys.all });
    },
  });
}

// List completions for a chore
export function useCompletions(
  choreId: string,
  params?: { cursor?: string; limit?: number }
) {
  return useQuery({
    queryKey: choreKeys.completions(choreId, params),
    queryFn: () => choresApi.listCompletions(choreId, params),
    enabled: !!choreId,
  });
}

// Delete completion mutation
export function useDeleteCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, choreId }: { id: string; choreId: string }) =>
      completionsApi.delete(id).then(() => choreId),
    onSuccess: (choreId) => {
      // Invalidate completions for this chore
      queryClient.invalidateQueries({
        queryKey: choreKeys.completions(choreId),
      });
      // Invalidate the chore detail (last_completed_at may change)
      queryClient.invalidateQueries({
        queryKey: choreKeys.detail(choreId),
      });
      // Invalidate due chores
      queryClient.invalidateQueries({ queryKey: choreKeys.all });
    },
  });
}
