import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Schedule, Occurrence } from "@/lib/cron";
import { getNextOccurrences } from "@/lib/cron";

interface SchedulePreviewProps {
  schedule: Schedule | null;
  className?: string;
}

export function SchedulePreview({ schedule, className }: SchedulePreviewProps) {
  if (!schedule) {
    return (
      <div className={cn("rounded-lg bg-muted/50 p-4", className)}>
        <p className="text-sm text-muted-foreground text-center">
          Set a schedule to see upcoming dates
        </p>
      </div>
    );
  }

  const occurrences = getNextOccurrences(schedule, 4);

  if (occurrences.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        <span>Upcoming</span>
      </div>

      <div className="flex items-start justify-center gap-2">
        {occurrences.map((occurrence, index) => (
          <OccurrenceCard
            key={index}
            occurrence={occurrence}
            isFirst={index === 0}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

interface OccurrenceCardProps {
  occurrence: Occurrence;
  isFirst: boolean;
  index: number;
}

function OccurrenceCard({ occurrence, isFirst, index }: OccurrenceCardProps) {
  const date = occurrence.date;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "relative flex flex-col items-center rounded-lg border px-3 py-2 min-w-[4.5rem]",
          "animate-stagger-fade transition-all",
          isFirst
            ? "bg-[var(--color-schedule-type-active)] border-primary/30 shadow-sm"
            : "bg-[var(--color-schedule-card)] border-border/50"
        )}
        style={{ animationDelay: `${index * 75}ms` }}
      >
        {/* "Next" badge for first item */}
        {isFirst && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-primary bg-background px-1.5 rounded">
            Next
          </span>
        )}

        {/* Month */}
        <span className={cn(
          "text-[10px] font-medium uppercase tracking-wide",
          isFirst ? "text-primary" : "text-muted-foreground"
        )}>
          {monthNames[date.getMonth()]}
        </span>

        {/* Day number */}
        <span className={cn(
          "text-lg font-bold leading-tight",
          isFirst ? "text-foreground" : "text-foreground/80"
        )}>
          {date.getDate()}
        </span>

        {/* Day name */}
        <span className={cn(
          "text-[10px]",
          isFirst ? "text-muted-foreground" : "text-muted-foreground/70"
        )}>
          {occurrence.label.includes(",") ? occurrence.label.split(",")[0] : occurrence.label}
        </span>
      </div>

      {/* Relative time label */}
      <span className="text-[10px] text-muted-foreground/70">
        {occurrence.relativeLabel}
      </span>
    </div>
  );
}
