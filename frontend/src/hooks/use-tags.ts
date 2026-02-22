import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { tagsApi } from "@/lib/api";
import type { CreateTagRequest, UpdateTagRequest } from "@/lib/api";
import { choreKeys } from "@/hooks/use-chores";

// Query keys
export const tagKeys = {
  all: ["tags"] as const,
  list: () => [...tagKeys.all, "list"] as const,
};

// List all tags (for autocomplete)
export function useTags() {
  return useQuery({
    queryKey: tagKeys.list(),
    queryFn: () => tagsApi.list(),
  });
}

// Create tag mutation
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagRequest) => tagsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

// Update tag mutation (e.g. change color)
export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagRequest }) =>
      tagsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
      // Also invalidate chore queries since tag color may have changed
      queryClient.invalidateQueries({ queryKey: choreKeys.all });
    },
  });
}

// Delete tag mutation
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tagsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
      // Also invalidate chore queries since tags may be removed from chores
      queryClient.invalidateQueries({ queryKey: choreKeys.all });
    },
  });
}
