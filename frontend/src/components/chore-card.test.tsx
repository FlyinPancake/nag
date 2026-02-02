import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ChoreCard, ChoreCardSkeleton } from "./chore-card";
import { render, screen, userEvent } from "@/test/test-utils";
import { createMockChoreWithDue } from "@/test/mocks/handlers";

describe("ChoreCard", () => {
  const mockOnComplete = vi.fn().mockResolvedValue(undefined);
  const mockOnClick = vi.fn();

  beforeEach(() => {
    // Mock current time for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render chore name", () => {
    const chore = createMockChoreWithDue({ name: "Clean the kitchen" });

    render(
      <ChoreCard
        chore={chore}
        onComplete={mockOnComplete}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText("Clean the kitchen")).toBeInTheDocument();
  });

  it("should render chore description when present", () => {
    const chore = createMockChoreWithDue({
      name: "Clean the kitchen",
      description: "Wipe down counters and mop floor",
    });

    render(
      <ChoreCard
        chore={chore}
        onComplete={mockOnComplete}
        onClick={mockOnClick}
      />
    );

    expect(
      screen.getByText("Wipe down counters and mop floor")
    ).toBeInTheDocument();
  });

  it("should display overdue status for overdue chores", () => {
    const chore = createMockChoreWithDue({
      name: "Overdue task",
      is_overdue: true,
      next_due: new Date("2024-06-14T12:00:00").toISOString(),
    });

    render(
      <ChoreCard
        chore={chore}
        onComplete={mockOnComplete}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText("1 day overdue")).toBeInTheDocument();
  });

  it("should display 'Due today' for chores due today", () => {
    const chore = createMockChoreWithDue({
      name: "Today task",
      is_overdue: false,
      next_due: new Date("2024-06-15T18:00:00").toISOString(),
    });

    render(
      <ChoreCard
        chore={chore}
        onComplete={mockOnComplete}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText("Due today")).toBeInTheDocument();
  });

  it("should display 'Tomorrow' for chores due tomorrow", () => {
    const chore = createMockChoreWithDue({
      name: "Tomorrow task",
      is_overdue: false,
      next_due: new Date("2024-06-16T12:00:00").toISOString(),
    });

    render(
      <ChoreCard
        chore={chore}
        onComplete={mockOnComplete}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
  });

  it("should display relative time for future chores", () => {
    const chore = createMockChoreWithDue({
      name: "Future task",
      is_overdue: false,
      next_due: new Date("2024-06-18T12:00:00").toISOString(),
    });

    render(
      <ChoreCard
        chore={chore}
        onComplete={mockOnComplete}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText(/in \d+ days/)).toBeInTheDocument();
  });

  it("should display schedule for cron-based chores", () => {
    const chore = createMockChoreWithDue({
      name: "Weekly task",
      schedule_type: "cron",
      cron_schedule: "0 9 * * 1",
    });

    render(
      <ChoreCard
        chore={chore}
        onComplete={mockOnComplete}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText(/Monday/i)).toBeInTheDocument();
  });

  it("should display schedule for interval-based chores", () => {
    const chore = createMockChoreWithDue({
      name: "Interval task",
      schedule_type: "interval",
      cron_schedule: null,
      interval_days: 7,
      interval_time_hour: 9,
      interval_time_minute: 0,
    });

    render(
      <ChoreCard
        chore={chore}
        onComplete={mockOnComplete}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText(/Every week/i)).toBeInTheDocument();
  });

  it("should call onClick when card is clicked", async () => {
    const chore = createMockChoreWithDue({ name: "Clickable task" });

    const { container } = render(
      <ChoreCard
        chore={chore}
        onComplete={mockOnComplete}
        onClick={mockOnClick}
      />
    );

    const card = container.querySelector(".cursor-pointer");
    if (card) {
      card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("should render without onClick handler", () => {
    const chore = createMockChoreWithDue({ name: "No click handler" });

    render(<ChoreCard chore={chore} onComplete={mockOnComplete} />);

    expect(screen.getByText("No click handler")).toBeInTheDocument();
  });

  it("should render Done button", () => {
    const chore = createMockChoreWithDue({ name: "Task with done button" });

    render(
      <ChoreCard
        chore={chore}
        onComplete={mockOnComplete}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
  });
});

describe("ChoreCardSkeleton", () => {
  it("should render skeleton loader", () => {
    const { container } = render(<ChoreCardSkeleton />);

    // Check for skeleton elements (divs with animate-pulse-soft class)
    const skeletonElements = container.querySelectorAll(".animate-pulse-soft");
    expect(skeletonElements.length).toBeGreaterThan(0);
  });
});
