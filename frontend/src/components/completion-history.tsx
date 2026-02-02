import { Check, Trash2, Loader2, Flame, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompletions, useDeleteCompletion } from "@/hooks/use-chores";
import { formatDateTime, formatRelativeTime } from "@/lib/date";
import { cn } from "@/lib/utils";

interface CompletionHistoryProps {
  choreId: string;
  /** Compact mode for embedding in drawer */
  compact?: boolean;
}

/**
 * Calculate streak from completions
 * A streak is consecutive completions within expected interval
 */
function calculateStreak(completions: Array<{ completed_at: string }>): {
  count: number;
  isActive: boolean;
} {
  if (completions.length === 0) return { count: 0, isActive: false };

  // Simple streak: count recent completions in last 7 days
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let count = 0;
  for (const completion of completions) {
    const completedAt = new Date(completion.completed_at);
    if (completedAt >= sevenDaysAgo) {
      count++;
    } else {
      break;
    }
  }

  // Check if there's a completion in the last 48 hours for "active" status
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const isActive =
    completions.length > 0 && new Date(completions[0].completed_at) >= fortyEightHoursAgo;

  return { count, isActive };
}

/**
 * Generate mini calendar data for last 7 days
 */
function generateMiniCalendar(
  completions: Array<{ completed_at: string }>,
): Array<{ date: Date; hasCompletion: boolean }> {
  const days: Array<{ date: Date; hasCompletion: boolean }> = [];
  const now = new Date();

  // Create set of completion dates (YYYY-MM-DD format)
  const completionDates = new Set(
    completions.map((c) => {
      const d = new Date(c.completed_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );

  // Generate last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    days.push({
      date,
      hasCompletion: completionDates.has(dateKey),
    });
  }

  return days;
}

export function CompletionHistory({ choreId, compact = false }: CompletionHistoryProps) {
  const { data, isLoading } = useCompletions(choreId, { limit: 10 });
  const deleteCompletion = useDeleteCompletion();

  const handleDelete = async (completionId: string) => {
    try {
      await deleteCompletion.mutateAsync({ id: completionId, choreId });
      toast.success("Completion removed");
    } catch {
      toast.error("Failed to remove completion");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Skeleton for streak */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Skeleton for mini calendar */}
        <div className="flex gap-1.5">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-lg" />
          ))}
        </div>
        {/* Skeleton for timeline */}
        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 pl-3">
              <Skeleton className="h-3 w-3 rounded-full shrink-0 mt-1" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const completions = data?.items ?? [];
  const { count: streakCount, isActive: streakActive } = calculateStreak(completions);
  const miniCalendar = generateMiniCalendar(completions);

  if (completions.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-muted/50 mb-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No completions yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Mark this chore as done to start tracking
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Streak indicator */}
      {streakCount > 0 && (
        <div
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-xl",
            streakActive
              ? "bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20"
              : "bg-muted/50",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-full",
              streakActive
                ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white animate-streak-flame"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {streakCount} {streakCount === 1 ? "completion" : "completions"} this week
            </p>
            {streakActive && <p className="text-xs text-muted-foreground">Keep it going!</p>}
          </div>
        </div>
      )}

      {/* Mini calendar heatmap */}
      <div className="flex gap-1.5 justify-between">
        {miniCalendar.map((day, i) => {
          const isToday = i === miniCalendar.length - 1;
          const dayName = day.date.toLocaleDateString("en-US", {
            weekday: "narrow",
          });

          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase">{dayName}</span>
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                  day.hasCompletion
                    ? "bg-success/20 border-2 border-success/40"
                    : "bg-muted/30 border border-border",
                  isToday && !day.hasCompletion && "border-primary/30",
                  day.hasCompletion && "animate-timeline-dot",
                )}
                style={{
                  animationDelay: `${i * 50}ms`,
                }}
              >
                {day.hasCompletion && <Check className="h-3.5 w-3.5 text-success" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline list */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border rounded-full" />

        <div className="space-y-0">
          {completions.slice(0, compact ? 5 : 10).map((completion, index) => (
            <div
              key={completion.id}
              className={cn(
                "flex items-start gap-3 py-2.5 pl-0 group relative",
                "animate-stagger-fade",
              )}
              style={{
                animationDelay: `${index * 60}ms`,
              }}
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  "relative z-10 h-4 w-4 rounded-full shrink-0 mt-0.5",
                  "bg-success/20 border-2 border-success flex items-center justify-center",
                )}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-success" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-8">
                <p className="text-sm font-medium">{formatRelativeTime(completion.completed_at)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(completion.completed_at)}
                </p>
                {completion.notes && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                    "{completion.notes}"
                  </p>
                )}
              </div>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "absolute right-0 top-2 opacity-0 group-hover:opacity-100",
                  "transition-opacity shrink-0 h-7 w-7",
                )}
                onClick={() => handleDelete(completion.id)}
                disabled={deleteCompletion.isPending}
                aria-label="Remove completion"
              >
                {deleteCompletion.isPending && deleteCompletion.variables?.id === completion.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Show more indicator */}
      {completions.length > (compact ? 5 : 10) && (
        <p className="text-xs text-muted-foreground text-center pt-1">
          +{completions.length - (compact ? 5 : 10)} more completions
        </p>
      )}
    </div>
  );
}
