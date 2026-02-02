import { http, HttpResponse } from "msw";

import type {
  Chore,
  ChoreWithDue,
  Completion,
  PaginatedChores,
  PaginatedCompletions,
} from "@/lib/api";

// Mock data factories
export function createMockChore(overrides: Partial<Chore> = {}): Chore {
  return {
    id: "chore-1",
    name: "Test Chore",
    description: null,
    schedule_type: "cron",
    cron_schedule: "0 9 * * 1",
    interval_days: null,
    interval_time_hour: null,
    interval_time_minute: null,
    last_completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockChoreWithDue(overrides: Partial<ChoreWithDue> = {}): ChoreWithDue {
  const baseChore = createMockChore(overrides);
  return {
    ...baseChore,
    next_due: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    is_overdue: false,
    ...overrides,
  };
}

export function createMockCompletion(overrides: Partial<Completion> = {}): Completion {
  return {
    id: "completion-1",
    chore_id: "chore-1",
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    notes: null,
    ...overrides,
  };
}

// Default mock data
const mockChores: Chore[] = [
  createMockChore({ id: "chore-1", name: "Clean kitchen" }),
  createMockChore({
    id: "chore-2",
    name: "Take out trash",
    schedule_type: "interval",
    cron_schedule: null,
    interval_days: 3,
  }),
];

const mockDueChores: ChoreWithDue[] = [
  createMockChoreWithDue({
    id: "chore-1",
    name: "Clean kitchen",
    is_overdue: true,
    next_due: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  }),
  createMockChoreWithDue({
    id: "chore-2",
    name: "Take out trash",
    is_overdue: false,
    next_due: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  }),
];

// MSW request handlers
export const handlers = [
  // List chores
  http.get("/api/chores", () => {
    const response: PaginatedChores = {
      items: mockChores,
      next_cursor: null,
    };
    return HttpResponse.json(response);
  }),

  // Get due chores
  http.get("/api/chores/due", () => {
    return HttpResponse.json(mockDueChores);
  }),

  // Get single chore
  http.get("/api/chores/:id", ({ params }) => {
    const chore = mockChores.find((c) => c.id === params.id);
    if (!chore) {
      return HttpResponse.json(
        { title: "Not Found", status: 404, detail: "Chore not found" },
        { status: 404 },
      );
    }
    return HttpResponse.json(chore);
  }),

  // Create chore
  http.post("/api/chores", async ({ request }) => {
    const body = (await request.json()) as Partial<Chore>;
    const newChore = createMockChore({
      id: `chore-${Date.now()}`,
      ...body,
    });
    return HttpResponse.json(newChore, { status: 201 });
  }),

  // Update chore
  http.put("/api/chores/:id", async ({ params, request }) => {
    const body = (await request.json()) as Partial<Chore>;
    const chore = mockChores.find((c) => c.id === params.id);
    if (!chore) {
      return HttpResponse.json(
        { title: "Not Found", status: 404, detail: "Chore not found" },
        { status: 404 },
      );
    }
    const updatedChore = { ...chore, ...body };
    return HttpResponse.json(updatedChore);
  }),

  // Delete chore
  http.delete("/api/chores/:id", ({ params }) => {
    const chore = mockChores.find((c) => c.id === params.id);
    if (!chore) {
      return HttpResponse.json(
        { title: "Not Found", status: 404, detail: "Chore not found" },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Complete chore
  http.post("/api/chores/:id/complete", ({ params }) => {
    const completion = createMockCompletion({
      id: `completion-${Date.now()}`,
      chore_id: params.id as string,
    });
    return HttpResponse.json(completion, { status: 201 });
  }),

  // List completions
  http.get("/api/chores/:choreId/completions", ({ params }) => {
    const response: PaginatedCompletions = {
      items: [createMockCompletion({ chore_id: params.choreId as string })],
      next_cursor: null,
    };
    return HttpResponse.json(response);
  }),

  // Delete completion
  http.delete("/api/completions/:id", () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
