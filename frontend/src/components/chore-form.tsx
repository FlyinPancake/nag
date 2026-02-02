import { useState, useCallback } from "react";
import { Loader2, Sparkles, Pencil, StickyNote, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { ScheduleBuilder } from "@/components/schedule-builder";
import { cn } from "@/lib/utils";
import type { Chore, CreateChoreRequest, UpdateChoreRequest } from "@/lib/api";
import type { Schedule } from "@/lib/cron";

interface ChoreFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chore?: Chore | null;
  onSubmit: (data: CreateChoreRequest | UpdateChoreRequest) => Promise<void>;
}

/**
 * Convert a Chore to a Schedule object for the ScheduleBuilder
 */
function choreToSchedule(chore: Chore | null | undefined): Schedule {
  if (!chore) {
    // Default to weekly interval schedule
    return { type: "interval", intervalDays: 7, intervalTimeHour: 9, intervalTimeMinute: 0 };
  }

  if (chore.schedule_type === "interval" && chore.interval_days != null) {
    return {
      type: "interval",
      intervalDays: chore.interval_days,
      intervalTimeHour: chore.interval_time_hour ?? undefined,
      intervalTimeMinute: chore.interval_time_minute ?? undefined,
    };
  }

  return {
    type: "cron",
    cronExpression: chore.cron_schedule ?? "0 9 * * 1",
  };
}

/**
 * Convert a Schedule to API request format
 */
function scheduleToRequest(schedule: Schedule): Partial<CreateChoreRequest> {
  if (schedule.type === "cron") {
    return {
      schedule_type: "cron",
      cron_schedule: schedule.cronExpression,
    };
  } else {
    return {
      schedule_type: "interval",
      interval_days: schedule.intervalDays,
      interval_time_hour: schedule.intervalTimeHour,
      interval_time_minute: schedule.intervalTimeMinute,
    };
  }
}

/**
 * Check if two schedules are equal
 */
function schedulesEqual(a: Schedule, b: Schedule): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "cron" && b.type === "cron") {
    return a.cronExpression === b.cronExpression;
  }
  if (a.type === "interval" && b.type === "interval") {
    return (
      a.intervalDays === b.intervalDays &&
      a.intervalTimeHour === b.intervalTimeHour &&
      a.intervalTimeMinute === b.intervalTimeMinute
    );
  }
  return false;
}

export function ChoreForm({
  open,
  onOpenChange,
  chore,
  onSubmit,
}: ChoreFormProps) {
  const isEditing = !!chore;
  const [name, setName] = useState(chore?.name ?? "");
  const [description, setDescription] = useState(chore?.description ?? "");
  const [schedule, setSchedule] = useState<Schedule>(choreToSchedule(chore));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDescription, setShowDescription] = useState(!!chore?.description);

  const handleScheduleChange = useCallback((newSchedule: Schedule) => {
    setSchedule(newSchedule);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        // Build update request with only changed fields
        const originalSchedule = choreToSchedule(chore);
        const scheduleChanged = !schedulesEqual(schedule, originalSchedule);

        const updateRequest: UpdateChoreRequest = {
          name: name.trim() !== chore.name ? name.trim() : undefined,
          description:
            description.trim() !== (chore.description ?? "")
              ? description.trim() || null
              : undefined,
          schedule: scheduleChanged
            ? (scheduleToRequest(schedule) as UpdateChoreRequest["schedule"])
            : undefined,
        };

        await onSubmit(updateRequest);
      } else {
        const createRequest: CreateChoreRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          ...scheduleToRequest(schedule),
        } as CreateChoreRequest;

        await onSubmit(createRequest);
      }
      onOpenChange(false);
      // Reset form
      if (!isEditing) {
        setName("");
        setDescription("");
        setSchedule({ type: "interval", intervalDays: 7, intervalTimeHour: 9, intervalTimeMinute: 0 });
        setShowDescription(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when opening with new/different chore
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setName(chore?.name ?? "");
      setDescription(chore?.description ?? "");
      setSchedule(choreToSchedule(chore));
      setShowDescription(!!chore?.description);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-6">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Pencil className="h-5 w-5 text-muted-foreground" />
                  Edit Chore
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-primary" />
                  New Chore
                </>
              )}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing
                ? "Update your chore details and schedule."
                : "Add a new recurring chore to your list."}
            </DrawerDescription>
          </DrawerHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-muted-foreground">
                What needs to be done?
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Vacuum living room"
                className="text-base"
                autoFocus
              />
            </div>

            {/* Collapsible Description */}
            <div className="space-y-2">
              {!showDescription ? (
                <button
                  type="button"
                  onClick={() => setShowDescription(true)}
                  className={cn(
                    "flex items-center gap-2 text-sm text-muted-foreground",
                    "hover:text-foreground transition-colors"
                  )}
                >
                  <StickyNote className="h-4 w-4" />
                  <span>Add notes</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="animate-slide-up-reveal">
                  <Label htmlFor="description" className="text-muted-foreground flex items-center gap-1.5">
                    <StickyNote className="h-3.5 w-3.5" />
                    Notes
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Any reminders or details..."
                    rows={2}
                    className="mt-2"
                  />
                </div>
              )}
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">When?</Label>
              <ScheduleBuilder value={schedule} onChange={handleScheduleChange} />
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-destructive animate-pop-in">{error}</p>
            )}

            {/* Submit button */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="flex-1 gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isEditing ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isEditing ? "Save Changes" : "Create Chore"}
              </Button>
            </div>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
