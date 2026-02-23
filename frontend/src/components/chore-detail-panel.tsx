import { useState } from "react";
import {
  X,
  Pencil,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  Repeat,
  StickyNote,
  History,
  Flame,
  Check,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { tagBadgeStyle } from "@/lib/tag-colors";
import { CompletionHistory } from "@/components/completion-history";
import { useChoreForm } from "@/hooks/use-chore-form";
import { useDeleteChore } from "@/hooks/use-chores";
import { formatCronHuman, formatIntervalHuman } from "@/lib/cron";
import { formatOverdue, formatRelativeTime, formatDateTime, isToday } from "@/lib/date";
import type { ChoreWithDue, Chore } from "@/lib/api";

// ---------------------------------------------------------------------------
// Done button (compact inline version)
// ---------------------------------------------------------------------------

function InlineDoneButton({ onDone }: { onDone: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");

  const handleClick = async () => {
    if (state !== "idle") return;
    setState("loading");
    try {
      await onDone();
      setState("success");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "loading"}
      className={cn(
        "w-full flex items-center justify-center gap-2.5 py-3 rounded-xl",
        "text-sm font-semibold transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "active:scale-[0.98]",
        state === "success"
          ? "bg-success/15 text-success border border-success/30"
          : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md",
      )}
    >
      {state === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === "success" ? (
        <>
          <Check className="h-4 w-4 animate-check-bounce" />
          <span>Done!</span>
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          <span>Mark as Done</span>
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Chore Detail Panel
// ---------------------------------------------------------------------------

interface ChoreDetailPanelProps {
  open: boolean;
  chore: ChoreWithDue | Chore | null;
  onClose: () => void;
  onComplete: (id: string) => Promise<void>;
}

export function ChoreDetailPanel({ open, chore, onClose, onComplete }: ChoreDetailPanelProps) {
  const { openPanelEdit } = useChoreForm();
  const deleteChore = useDeleteChore();

  if (!chore) return null;

  // Type guard for ChoreWithDue
  const hasNextDue = "next_due" in chore && "is_overdue" in chore;
  const isOverdue = hasNextDue ? (chore as ChoreWithDue).is_overdue : false;
  const nextDue = hasNextDue ? (chore as ChoreWithDue).next_due : null;
  const isDueToday = nextDue ? isToday(nextDue) : false;

  const scheduleText =
    chore.schedule_type === "once_in_a_while"
      ? "Once in a while"
      : chore.schedule_type === "interval" && chore.interval_days
        ? formatIntervalHuman(
            chore.interval_days,
            chore.interval_time_hour,
            chore.interval_time_minute,
          )
        : formatCronHuman(chore.cron_schedule ?? "");

  const handleEdit = () => {
    openPanelEdit(chore);
  };

  const handleDelete = async () => {
    try {
      await deleteChore.mutateAsync(chore.id);
      onClose();
      toast.success("Chore deleted");
    } catch {
      toast.error("Failed to delete chore");
    }
  };

  const statusConfig = (() => {
    if (isOverdue && nextDue) {
      return {
        label: formatOverdue(nextDue),
        icon: AlertTriangle,
        badgeClass: "bg-overdue/10 text-overdue border-overdue/20",
      };
    }
    if (isDueToday) {
      return {
        label: "Due today",
        icon: Clock,
        badgeClass: "bg-due-today/10 text-due-today border-due-today/20",
      };
    }
    if (nextDue) {
      return {
        label: formatRelativeTime(nextDue),
        icon: Calendar,
        badgeClass: "bg-upcoming/10 text-upcoming border-upcoming/20",
      };
    }
    return {
      label: "No schedule",
      icon: Calendar,
      badgeClass: "bg-muted text-muted-foreground border-border",
    };
  })();

  const StatusIcon = statusConfig.icon;

  const panelContent = (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-serif font-bold text-lg text-foreground truncate">
            {chore.name}
          </h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleEdit}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              "transition-colors duration-150",
            )}
            aria-label="Edit chore"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              "transition-colors duration-150",
            )}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Schedule subtitle */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {chore.schedule_type === "once_in_a_while" ? (
            <Clock className="h-3.5 w-3.5 shrink-0" />
          ) : chore.schedule_type === "interval" ? (
            <Repeat className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Calendar className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{scheduleText}</span>
        </div>

        {/* Tags */}
        {chore.tags && chore.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chore.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                style={tagBadgeStyle(tag.color, tag.name)}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Status badge */}
        <div
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold",
            statusConfig.badgeClass,
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          <span>{statusConfig.label}</span>
          {isOverdue && <Flame className="h-3 w-3 text-orange-500" />}
        </div>

        {/* Done button */}
        <InlineDoneButton
          onDone={async () => {
            await onComplete(chore.id);
          }}
        />

        {/* Info grid */}
        {(nextDue || chore.last_completed_at) && (
          <div className="grid grid-cols-2 gap-3">
            {nextDue && (
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
                  Next Due
                </p>
                <p className="text-sm font-medium text-foreground">{formatDateTime(nextDue)}</p>
              </div>
            )}
            {chore.last_completed_at && (
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
                  Last Done
                </p>
                <p className="text-sm font-medium text-foreground">
                  {formatRelativeTime(chore.last_completed_at)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {chore.description && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <StickyNote className="h-3 w-3" />
              <span>Notes</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 rounded-lg p-3 border border-border/50">
              {chore.description}
            </p>
          </div>
        )}

        {/* Completion history */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            <History className="h-3 w-3" />
            <span>History</span>
          </div>
          <CompletionHistory choreId={chore.id} compact />
        </div>
      </div>

      {/* Footer with delete */}
      <div className="shrink-0 border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteChore.isPending}
          className={cn(
            "flex items-center justify-center gap-2 w-full py-2 rounded-lg",
            "text-xs font-medium text-muted-foreground",
            "hover:text-destructive hover:bg-destructive/5 transition-colors duration-150",
            deleteChore.isPending && "opacity-50 pointer-events-none",
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>{deleteChore.isPending ? "Deleting..." : "Delete chore"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop panel (inline, 400px wide) */}
      <div
        className={cn(
          "hidden md:block shrink-0 overflow-hidden",
          "transition-all duration-300 ease-in-out",
          open ? "w-[400px]" : "w-0",
        )}
      >
        <div className="w-[400px] h-full">
          {open && panelContent}
        </div>
      </div>

      {/* Mobile panel (full-width overlay) */}
      <div
        className={cn(
          "md:hidden fixed inset-0 top-[52px] z-30",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full pointer-events-none",
        )}
      >
        {open && panelContent}
      </div>
    </>
  );
}
