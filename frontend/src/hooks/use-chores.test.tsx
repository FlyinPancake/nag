import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import {
  useChores,
  useDueChores,
  useChore,
  useCreateChore,
  useUpdateChore,
  useDeleteChore,
  useCompleteChore,
  useCompletions,
  useDeleteCompletion,
  choreKeys,
} from "./use-chores";
import { createWrapper } from "@/test/test-utils";

describe("choreKeys", () => {
  it("should generate correct query keys", () => {
    expect(choreKeys.all).toEqual(["chores"]);
    expect(choreKeys.lists()).toEqual(["chores", "list"]);
    expect(choreKeys.list({ cursor: "abc", limit: 10 })).toEqual([
      "chores",
      "list",
      { cursor: "abc", limit: 10 },
    ]);
    expect(choreKeys.due(true)).toEqual(["chores", "due", { includeUpcoming: true }]);
    expect(choreKeys.details()).toEqual(["chores", "detail"]);
    expect(choreKeys.detail("123")).toEqual(["chores", "detail", "123"]);
    expect(choreKeys.completions("123")).toEqual(["chores", "completions", "123", undefined]);
  });
});

describe("useChores", () => {
  it("should fetch chores list", async () => {
    const { result } = renderHook(() => useChores(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.items[0].name).toBe("Clean kitchen");
  });

  it("should fetch chores with pagination params", async () => {
    const { result } = renderHook(() => useChores({ limit: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items).toBeDefined();
  });
});

describe("useDueChores", () => {
  it("should fetch due chores", async () => {
    const { result } = renderHook(() => useDueChores(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].is_overdue).toBe(true);
    expect(result.current.data?.[1].is_overdue).toBe(false);
  });
});

describe("useChore", () => {
  it("should fetch a single chore", async () => {
    const { result } = renderHook(() => useChore("chore-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.name).toBe("Clean kitchen");
  });

  it("should not fetch when id is empty", () => {
    const { result } = renderHook(() => useChore(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useCreateChore", () => {
  it("should create a new chore", async () => {
    const { result } = renderHook(() => useCreateChore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: "New Chore",
      schedule_type: "cron",
      cron_schedule: "0 9 * * 1",
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.name).toBe("New Chore");
  });
});

describe("useUpdateChore", () => {
  it("should update a chore", async () => {
    const { result } = renderHook(() => useUpdateChore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: "chore-1",
      data: { name: "Updated Chore" },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.name).toBe("Updated Chore");
  });
});

describe("useDeleteChore", () => {
  it("should delete a chore", async () => {
    const { result } = renderHook(() => useDeleteChore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("chore-1");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});

describe("useCompleteChore", () => {
  it("should complete a chore", async () => {
    const { result } = renderHook(() => useCompleteChore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "chore-1" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.chore_id).toBe("chore-1");
  });

  it("should complete a chore with notes", async () => {
    const { result } = renderHook(() => useCompleteChore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: "chore-1",
      data: { notes: "Completed with extra effort" },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});

describe("useCompletions", () => {
  it("should fetch completions for a chore", async () => {
    const { result } = renderHook(() => useCompletions("chore-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].chore_id).toBe("chore-1");
  });

  it("should not fetch when choreId is empty", () => {
    const { result } = renderHook(() => useCompletions(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useDeleteCompletion", () => {
  it("should delete a completion", async () => {
    const { result } = renderHook(() => useDeleteCompletion(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "completion-1", choreId: "chore-1" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
