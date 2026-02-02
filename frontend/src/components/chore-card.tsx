import { AlertCircle, Clock, Calendar, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DoneButton } from "@/components/done-button";
import { formatCronHuman, formatIntervalHuman } from "@/lib/cron";
import { formatOverdue, formatRelativeTime, isToday, isTomorrow } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { ChoreWithDue } from "@/lib/api";

interface ChoreCardProps {
  chore: ChoreWithDue;
  onComplete: (id: string) => Promise<void>;
  onClick?: () => void;
}

export function ChoreCard({ chore, onComplete, onClick }: ChoreCardProps) {
  const { is_overdue, next_due } = chore;
  const isDueToday = next_due && isToday(next_due);
  const isDueTomorrow = next_due && isTomorrow(next_due);

  // Determine status for styling
  const status = is_overdue ? "overdue" : isDueToday ? "dueToday" : "upcoming";

  // Format the due text
  const getDueText = () => {
    if (is_overdue && next_due) {
      return formatOverdue(next_due);
    }
    if (isDueToday) {
      return "Due today";
    }
    if (isDueTomorrow) {
      return "Tomorrow";
    }
    if (next_due) {
      return formatRelativeTime(next_due);
    }
    return "No schedule";
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer",
        "border-l-4",
        status === "overdue" && "border-l-overdue",
        status === "dueToday" && "border-l-due-today",
        status === "upcoming" && "border-l-border"
      )}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left side: chore info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {chore.name}
              </h3>
              <Badge
                variant={
                  status === "overdue"
                    ? "overdue"
                    : status === "dueToday"
                    ? "dueToday"
                    : "secondary"
                }
                className="shrink-0"
              >
                {status === "overdue" && (
                  <AlertCircle className="h-3 w-3 mr-1" />
                )}
                {status === "dueToday" && <Clock className="h-3 w-3 mr-1" />}
                {getDueText()}
              </Badge>
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {chore.schedule_type === "interval" ? (
                <Repeat className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Calendar className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">
                {chore.schedule_type === "interval" && chore.interval_days
                  ? formatIntervalHuman(
                      chore.interval_days,
                      chore.interval_time_hour,
                      chore.interval_time_minute
                    )
                  : formatCronHuman(chore.cron_schedule ?? "")}
              </span>
            </div>

            {chore.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-1">
                {chore.description}
              </p>
            )}
          </div>

          {/* Right side: done button */}
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <DoneButton onDone={() => onComplete(chore.id)} />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Skeleton loader for chore cards
export function ChoreCardSkeleton() {
  return (
    <Card className="border-l-4 border-l-border">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-32 bg-muted rounded animate-pulse-soft" />
              <div className="h-5 w-20 bg-muted rounded-full animate-pulse-soft" />
            </div>
            <div className="h-4 w-40 bg-muted rounded animate-pulse-soft" />
          </div>
          <div className="h-9 w-[72px] bg-muted rounded-lg animate-pulse-soft" />
        </div>
      </div>
    </Card>
  );
}
