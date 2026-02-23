import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Check } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useDueChores, useCompleteChore } from "@/hooks/use-chores";
import { useChoreForm } from "@/hooks/use-chore-form";
import { formatCronHuman, formatIntervalHuman } from "@/lib/cron";
import { formatOverdue, formatRelativeTime, isToday, isTomorrow } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { tagBadgeStyle, tagDotStyle, resolveTagColorKey } from "@/lib/tag-colors";
import type { ChoreWithDue, Tag } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dueLabel(c: ChoreWithDue): string {
  if (c.is_overdue && c.next_due) return formatOverdue(c.next_due);
  if (c.next_due && isToday(c.next_due)) return "Due today";
  if (c.next_due && isTomorrow(c.next_due)) return "Tomorrow";
  if (c.next_due) return formatRelativeTime(c.next_due);
  if (c.schedule_type === "once_in_a_while") return "Whenever";
  return "No schedule";
}

function schedLabel(c: ChoreWithDue): string {
  if (c.schedule_type === "once_in_a_while") {
    return "Once in a while";
  }
  if (c.schedule_type === "interval" && c.interval_days) {
    return formatIntervalHuman(
      c.interval_days,
      c.interval_time_hour,
      c.interval_time_minute,
    );
  }
  return formatCronHuman(c.cron_schedule ?? "");
}

type ChoreStatus = "overdue" | "today" | "upcoming";

function choreStatus(c: ChoreWithDue): ChoreStatus {
  if (c.is_overdue) return "overdue";
  if (c.next_due && isToday(c.next_due)) return "today";
  return "upcoming";
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: ChoreStatus;
  title: string;
  emptyText: string;
  dotClass: string;
  headerBorderClass: string;
  dueBadgeClass: string;
}

const COLUMNS: ColumnDef[] = [
  {
    key: "overdue",
    title: "Overdue",
    emptyText: "All caught up",
    dotClass: "bg-overdue",
    headerBorderClass: "border-b-overdue",
    dueBadgeClass: "bg-overdue/10 text-overdue",
  },
  {
    key: "today",
    title: "Today",
    emptyText: "Nothing due today",
    dotClass: "bg-due-today",
    headerBorderClass: "border-b-due-today",
    dueBadgeClass: "bg-due-today/10 text-due-today",
  },
  {
    key: "upcoming",
    title: "Upcoming",
    emptyText: "Nothing ahead",
    dotClass: "bg-upcoming",
    headerBorderClass: "border-b-upcoming",
    dueBadgeClass: "bg-upcoming/10 text-upcoming",
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

interface ChoreCardProps {
  chore: ChoreWithDue;
  status: ChoreStatus;
  dueBadgeClass: string;
  onComplete: (id: string) => Promise<void>;
  onClick: () => void;
}

function TriageCard({ chore, dueBadgeClass, onComplete, onClick }: ChoreCardProps) {
  const [completing, setCompleting] = useState(false);

  const handleCheck = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (completing) return;
    setCompleting(true);
    try {
      await onComplete(chore.id);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div
      className="group bg-card border border-border rounded-lg p-3.5 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 animate-stagger-fade"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-snug text-foreground truncate">
            {chore.name}
          </div>
        </div>
        <button
          onClick={handleCheck}
          disabled={completing}
          className={cn(
            "w-7 h-7 rounded-full border-[1.5px] border-border shrink-0",
            "flex items-center justify-center transition-all duration-200",
            "text-transparent hover:border-upcoming hover:text-upcoming hover:bg-upcoming/10",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            completing && "opacity-50 pointer-events-none",
          )}
        >
          <Check className="h-3 w-3" />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <span className="truncate">{schedLabel(chore)}</span>
        <span
          className={cn(
            "font-semibold px-1.5 py-0.5 rounded-full text-[0.68rem] shrink-0",
            dueBadgeClass,
          )}
        >
          {dueLabel(chore)}
        </span>
      </div>
      {chore.tags && chore.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {chore.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full border px-1.5 py-0 text-[0.6rem] font-semibold"
              style={tagBadgeStyle(tag.color, tag.name)}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
      {chore.description && (
        <p className="mt-2 text-xs text-muted-foreground italic truncate">
          {chore.description}
        </p>
      )}
    </div>
  );
}

function ColumnSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b-2 border-border">
        <Skeleton className="w-2.5 h-2.5 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <div className="ml-auto">
          <Skeleton className="h-3 w-4" />
        </div>
      </div>
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function HomePage() {
  const { openCreate, openDetail } = useChoreForm();
  const { data: chores, isLoading, error } = useDueChores(true);
  const completeChore = useCompleteChore();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const handleComplete = async (id: string) => {
    const chore = chores?.find((c) => c.id === id);
    try {
      await completeChore.mutateAsync({ id });
      toast.success(`${chore?.name ?? "Chore"} completed!`, {
        action: {
          label: "Add note",
          onClick: () => {
            toast.info("Note feature coming soon!");
          },
        },
      });
    } catch {
      toast.error("Failed to complete chore");
    }
  };

  // Collect unique tags from all loaded chores
  const allTags = useMemo(() => {
    const tagMap = new Map<string, Tag>();
    for (const c of chores ?? []) {
      for (const t of c.tags ?? []) {
        tagMap.set(t.id, t);
      }
    }
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [chores]);

  // Filter chores by selected tag, then group into columns
  const filteredChores = useMemo(() => {
    if (!selectedTag) return chores ?? [];
    return (chores ?? []).filter((c) =>
      c.tags?.some((t) => t.name === selectedTag),
    );
  }, [chores, selectedTag]);

  // Group chores into columns
  const grouped: Record<ChoreStatus, ChoreWithDue[]> = {
    overdue: [],
    today: [],
    upcoming: [],
  };
  for (const c of filteredChores) {
    grouped[choreStatus(c)].push(c);
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          Failed to load chores. Please try again.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col md:flex-row md:items-start gap-7 md:gap-4">
        <div className="md:flex-1">
          <ColumnSkeleton />
        </div>
        <div className="md:flex-1">
          <ColumnSkeleton />
        </div>
        <div className="md:flex-1">
          <ColumnSkeleton />
        </div>
      </div>
    );
  }

  const hasChores = (chores?.length ?? 0) > 0;

  if (!hasChores) {
    return <EmptyState onAction={openCreate} />;
  }

  return (
    <div className="space-y-4">
      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border",
              selectedTag === null
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:bg-secondary",
            )}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() =>
                setSelectedTag(selectedTag === tag.name ? null : tag.name)
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border",
                selectedTag === tag.name
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:bg-secondary",
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={tagDotStyle(resolveTagColorKey(tag.color, tag.name))}
              />
              {tag.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start gap-7 md:gap-4">
      {COLUMNS.map((col) => {
        const items = grouped[col.key];
        return (
          <div key={col.key} className="md:flex-1 min-w-0">
            {/* Column header */}
            <div
              className={cn(
                "flex items-center gap-2 mb-3 pb-2.5 border-b-2",
                col.headerBorderClass,
              )}
            >
              <span className={cn("w-2.5 h-2.5 rounded-full", col.dotClass)} />
              <span className="font-serif font-bold text-sm text-foreground">
                {col.title}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            {items.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground italic font-serif">
                {col.emptyText}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((c) => (
                  <TriageCard
                    key={c.id}
                    chore={c}
                    status={col.key}
                    dueBadgeClass={col.dueBadgeClass}
                    onComplete={handleComplete}
                    onClick={() => openDetail(c)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
