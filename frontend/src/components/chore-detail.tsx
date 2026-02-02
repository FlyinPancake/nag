import {
  Pencil,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  Repeat,
  StickyNote,
  History,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { DoneButton } from "@/components/done-button";
import { CompletionHistory } from "@/components/completion-history";
import { CollapsibleSection } from "@/components/collapsible-section";
import { useChoreForm } from "@/hooks/use-chore-form";
import { useDeleteChore } from "@/hooks/use-chores";
import { formatCronHuman, formatIntervalHuman } from "@/lib/cron";
import { formatOverdue, formatRelativeTime, formatDateTime, isToday } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { ChoreWithDue, Chore } from "@/lib/api";

interface ChoreDetailProps {
  chore: ChoreWithDue | Chore | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (id: string) => Promise<void>;
}

export function ChoreDetail({ chore, open, onOpenChange, onComplete }: ChoreDetailProps) {
  const { openEdit } = useChoreForm();
  const deleteChore = useDeleteChore();

  if (!chore) return null;

  // Type guard for ChoreWithDue
  const hasNextDue = "next_due" in chore && "is_overdue" in chore;
  const isOverdue = hasNextDue ? chore.is_overdue : false;
  const nextDue = hasNextDue ? chore.next_due : null;
  const isDueToday = nextDue ? isToday(nextDue) : false;

  const getStatusConfig = () => {
    if (isOverdue && nextDue) {
      return {
        label: formatOverdue(nextDue),
        icon: AlertTriangle,
        className:
          "bg-gradient-to-r from-destructive/15 to-orange-500/15 text-destructive border-destructive/30 animate-pulse-glow",
        style: { "--glow-color": "oklch(0.577 0.245 27 / 0.3)" } as React.CSSProperties,
      };
    }
    if (isDueToday) {
      return {
        label: "Due today",
        icon: Clock,
        className:
          "bg-gradient-to-r from-warning/15 to-amber-500/15 text-warning-foreground border-warning/30",
        style: {},
      };
    }
    if (nextDue) {
      return {
        label: formatRelativeTime(nextDue),
        icon: Calendar,
        className: "bg-primary/10 text-primary border-primary/20",
        style: {},
      };
    }
    return {
      label: "No schedule",
      icon: Calendar,
      className: "bg-muted text-muted-foreground border-border",
      style: {},
    };
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  const handleEdit = () => {
    onOpenChange(false);
    setTimeout(() => openEdit(chore), 200);
  };

  const handleDelete = async () => {
    try {
      await deleteChore.mutateAsync(chore.id);
      onOpenChange(false);
      toast.success("Chore deleted");
    } catch {
      toast.error("Failed to delete chore");
    }
  };

  const scheduleText =
    chore.schedule_type === "interval" && chore.interval_days
      ? formatIntervalHuman(
          chore.interval_days,
          chore.interval_time_hour,
          chore.interval_time_minute,
        )
      : formatCronHuman(chore.cron_schedule ?? "");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-8">
          {/* Header section */}
          <DrawerHeader className="px-0 pt-2 pb-4 text-center">
            <DrawerTitle className="text-2xl font-bold tracking-tight">{chore.name}</DrawerTitle>
            <DrawerDescription className="flex items-center justify-center gap-1.5 mt-1">
              {chore.schedule_type === "interval" ? (
                <Repeat className="h-3.5 w-3.5" />
              ) : (
                <Calendar className="h-3.5 w-3.5" />
              )}
              <span>{scheduleText}</span>
            </DrawerDescription>
          </DrawerHeader>

          {/* Hero Done Button */}
          <div className="mb-6">
            <DoneButton
              variant="hero"
              onDone={async () => {
                await onComplete(chore.id);
              }}
            />
          </div>

          {/* Status Badge - Bold & Prominent */}
          <div
            className={cn(
              "flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl border mb-6",
              "transition-all",
              status.className,
            )}
            style={status.style}
          >
            <StatusIcon className="h-5 w-5" />
            <span className="font-semibold">{status.label}</span>
            {isOverdue && <Flame className="h-4 w-4 text-orange-500" />}
          </div>

          {/* Status details */}
          {(nextDue || chore.last_completed_at) && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {nextDue && (
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Next Due
                  </p>
                  <p className="text-sm font-medium">{formatDateTime(nextDue)}</p>
                </div>
              )}
              {chore.last_completed_at && (
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Last Done
                  </p>
                  <p className="text-sm font-medium">
                    {formatRelativeTime(chore.last_completed_at)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Collapsible sections */}
          <div className="space-y-3">
            {/* Notes section - open by default if notes exist */}
            {chore.description && (
              <CollapsibleSection
                title="Notes"
                icon={<StickyNote className="h-4 w-4" />}
                defaultOpen={true}
              >
                <p className="text-sm text-muted-foreground leading-relaxed">{chore.description}</p>
              </CollapsibleSection>
            )}

            {/* History section - collapsed by default */}
            <CollapsibleSection
              title="Completion History"
              icon={<History className="h-4 w-4" />}
              defaultOpen={false}
            >
              <CompletionHistory choreId={chore.id} compact />
            </CollapsibleSection>
          </div>

          {/* Secondary actions */}
          <div className="flex gap-3 mt-8 pt-4 border-t">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
