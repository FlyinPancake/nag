import { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  Clock,
  RefreshCw,
  ChevronDown,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useCreateChore, useUpdateChore } from "@/hooks/use-chores";
import type { Chore, CreateChoreRequest, UpdateChoreRequest } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type SchedulePreset =
  | "daily"
  | "every3days"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "custom";

interface SchedulePresetDef {
  key: SchedulePreset;
  label: string;
  intervalDays: number | null;
  description: string;
}

const SCHEDULE_PRESETS: SchedulePresetDef[] = [
  { key: "daily", label: "Daily", intervalDays: 1, description: "Every day" },
  {
    key: "every3days",
    label: "Every 3 days",
    intervalDays: 3,
    description: "Every 3 days",
  },
  {
    key: "weekly",
    label: "Weekly",
    intervalDays: 7,
    description: "Every week",
  },
  {
    key: "biweekly",
    label: "Biweekly",
    intervalDays: 14,
    description: "Every 2 weeks",
  },
  {
    key: "monthly",
    label: "Monthly",
    intervalDays: 30,
    description: "Every 30 days",
  },
  {
    key: "custom",
    label: "Custom",
    intervalDays: null,
    description: "Custom interval",
  },
];

const DAYS_OF_WEEK = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DAY_FULL_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function computeScheduleSummary(
  preset: SchedulePreset,
  customInterval: number,
  customUnit: "days" | "weeks",
  selectedDays: boolean[],
  timeHour: number,
  timeMinute: number,
): { summary: string; nextDates: Date[] } {
  const timeStr = `${String(timeHour).padStart(2, "0")}:${String(timeMinute).padStart(2, "0")}`;
  let intervalDays: number;
  let summary: string;

  if (preset === "weekly" && selectedDays.some(Boolean)) {
    const dayNames = selectedDays
      .map((sel, i) => (sel ? DAY_FULL_NAMES[i] : null))
      .filter(Boolean);
    summary = `Weekly on ${dayNames.join(", ")} at ${timeStr}`;

    const today = new Date();
    const todayDow = (today.getDay() + 6) % 7; // Monday = 0
    const nextDates: Date[] = [];
    for (let offset = 0; offset < 14 && nextDates.length < 2; offset++) {
      const dow = (todayDow + offset) % 7;
      if (selectedDays[dow]) {
        const d = addDays(today, offset);
        if (offset === 0) {
          const nowMinutes = today.getHours() * 60 + today.getMinutes();
          const schedMinutes = timeHour * 60 + timeMinute;
          if (nowMinutes >= schedMinutes) continue;
        }
        nextDates.push(d);
      }
    }
    return { summary, nextDates };
  }

  if (preset === "custom") {
    intervalDays =
      customUnit === "weeks" ? customInterval * 7 : customInterval;
    const unitLabel =
      customUnit === "weeks"
        ? customInterval === 1
          ? "week"
          : "weeks"
        : customInterval === 1
          ? "day"
          : "days";
    summary = `Every ${customInterval} ${unitLabel} at ${timeStr}`;
  } else {
    const presetDef = SCHEDULE_PRESETS.find((p) => p.key === preset)!;
    intervalDays = presetDef.intervalDays!;
    summary = `${presetDef.description} at ${timeStr}`;
  }

  const today = new Date();
  const next1 = addDays(today, intervalDays);
  const next2 = addDays(today, intervalDays * 2);
  return { summary, nextDates: [next1, next2] };
}

/** Infer the best preset from interval days */
function presetFromDays(days: number): SchedulePreset {
  if (days === 1) return "daily";
  if (days === 3) return "every3days";
  if (days === 7) return "weekly";
  if (days === 14) return "biweekly";
  if (days === 30) return "monthly";
  return "custom";
}

// ---------------------------------------------------------------------------
// Day-of-week picker
// ---------------------------------------------------------------------------

function DayPicker({
  selected,
  onChange,
}: {
  selected: boolean[];
  onChange: (days: boolean[]) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {DAYS_OF_WEEK.map((label, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            const next = [...selected];
            next[i] = !next[i];
            onChange(next);
          }}
          className={cn(
            "w-8 h-8 rounded-full text-xs font-medium transition-all duration-150",
            "flex items-center justify-center",
            "border",
            selected[i]
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground",
          )}
          aria-label={DAY_FULL_NAMES[i]}
          aria-pressed={selected[i]}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule preview card
// ---------------------------------------------------------------------------

function SchedulePreview({
  summary,
  nextDates,
}: {
  summary: string;
  nextDates: Date[];
}) {
  return (
    <div className="bg-background border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">{summary}</span>
      </div>
      {nextDates.length > 0 && (
        <div className="space-y-1">
          {nextDates.map((d, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Calendar className="h-3 w-3" />
              <span>
                {i === 0 ? "Next:" : "Then:"} {formatDate(d)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chore Form Panel
// ---------------------------------------------------------------------------

interface ChoreFormPanelProps {
  open: boolean;
  chore: Chore | null;
  onClose: () => void;
}

export function ChoreFormPanel({ open, chore, onClose }: ChoreFormPanelProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const isEditing = !!chore;

  // Form state
  const [name, setName] = useState("");
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>("daily");
  const [selectedDays, setSelectedDays] = useState<boolean[]>(
    Array(7).fill(false),
  );
  const [customInterval, setCustomInterval] = useState(2);
  const [customUnit, setCustomUnit] = useState<"days" | "weeks">("days");
  const [timeHour, setTimeHour] = useState(9);
  const [timeMinute, setTimeMinute] = useState(0);
  const [notes, setNotes] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const createChore = useCreateChore();
  const updateChore = useUpdateChore();
  const isPending = createChore.isPending || updateChore.isPending;

  // Populate form when editing an existing chore
  useEffect(() => {
    if (chore) {
      setName(chore.name);
      setNotes(chore.description ?? "");
      if (chore.schedule_type === "interval" && chore.interval_days) {
        setSchedulePreset(presetFromDays(chore.interval_days));
        if (presetFromDays(chore.interval_days) === "custom") {
          setCustomInterval(chore.interval_days);
          setCustomUnit("days");
        }
        setTimeHour(chore.interval_time_hour ?? 9);
        setTimeMinute(chore.interval_time_minute ?? 0);
      }
    } else {
      // Reset for new chore
      setName("");
      setSchedulePreset("daily");
      setSelectedDays(Array(7).fill(false));
      setCustomInterval(2);
      setCustomUnit("days");
      setTimeHour(9);
      setTimeMinute(0);
      setNotes("");
      setShowAdvanced(false);
    }
  }, [chore]);

  // Auto-focus name input when panel opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => nameRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Compute schedule preview
  const { summary, nextDates } = useMemo(
    () =>
      computeScheduleSummary(
        schedulePreset,
        customInterval,
        customUnit,
        selectedDays,
        timeHour,
        timeMinute,
      ),
    [schedulePreset, customInterval, customUnit, selectedDays, timeHour, timeMinute],
  );

  // Compute interval days from current form state
  const resolvedIntervalDays = useMemo(() => {
    if (schedulePreset === "custom") {
      return customUnit === "weeks" ? customInterval * 7 : customInterval;
    }
    const presetDef = SCHEDULE_PRESETS.find((p) => p.key === schedulePreset);
    return presetDef?.intervalDays ?? 1;
  }, [schedulePreset, customInterval, customUnit]);

  const canSubmit = name.trim().length > 0 && !isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (isEditing && chore) {
      // Update existing chore
      const data: UpdateChoreRequest = {
        name: name.trim(),
        description: notes.trim() || null,
        schedule: {
          schedule_type: "interval",
          interval_days: resolvedIntervalDays,
          interval_time_hour: timeHour,
          interval_time_minute: timeMinute,
        },
      };
      try {
        await updateChore.mutateAsync({ id: chore.id, data });
        toast.success("Chore updated!");
        onClose();
      } catch {
        toast.error("Failed to update chore");
      }
    } else {
      // Create new chore
      const data: CreateChoreRequest = {
        name: name.trim(),
        description: notes.trim() || null,
        schedule_type: "interval",
        interval_days: resolvedIntervalDays,
        interval_time_hour: timeHour,
        interval_time_minute: timeMinute,
      };
      try {
        await createChore.mutateAsync(data);
        toast.success("Chore created!");
        onClose();
      } catch {
        toast.error("Failed to create chore");
      }
    }
  };

  // The panel itself (shared between desktop inline and mobile overlay)
  const panelContent = (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h2 className="font-serif font-bold text-lg text-foreground">
          {isEditing ? "Edit Chore" : "New Chore"}
        </h2>
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

      {/* Scrollable form body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Name
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Vacuum the living room"
            className={cn(
              "w-full rounded-lg border border-input bg-background px-3 py-2.5",
              "text-sm text-foreground placeholder:text-muted-foreground/60",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "transition-shadow duration-150",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        {/* Schedule */}
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Schedule
          </label>

          {/* Preset pills */}
          <div className="flex flex-wrap gap-1.5">
            {SCHEDULE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => setSchedulePreset(preset.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150",
                  "border",
                  schedulePreset === preset.key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Day picker for weekly */}
          {schedulePreset === "weekly" && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">
                Repeat on
              </span>
              <DayPicker selected={selectedDays} onChange={setSelectedDays} />
            </div>
          )}

          {/* Custom interval */}
          {schedulePreset === "custom" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">
                Every
              </span>
              <input
                type="number"
                min={1}
                max={365}
                value={customInterval}
                onChange={(e) =>
                  setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))
                }
                className={cn(
                  "w-16 rounded-lg border border-input bg-background px-2.5 py-1.5",
                  "text-sm text-foreground text-center",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                )}
              />
              <div className="relative">
                <select
                  value={customUnit}
                  onChange={(e) =>
                    setCustomUnit(e.target.value as "days" | "weeks")
                  }
                  className={cn(
                    "appearance-none rounded-lg border border-input bg-background pl-3 pr-7 py-1.5",
                    "text-sm text-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                    "cursor-pointer",
                  )}
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* Time picker */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>
                Time: {String(timeHour).padStart(2, "0")}:
                {String(timeMinute).padStart(2, "0")}
              </span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  showAdvanced && "rotate-180",
                )}
              />
            </button>
            {showAdvanced && (
              <div className="flex items-center gap-2 pl-5">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={timeHour}
                  onChange={(e) =>
                    setTimeHour(
                      Math.min(23, Math.max(0, parseInt(e.target.value) || 0)),
                    )
                  }
                  className={cn(
                    "w-14 rounded-lg border border-input bg-background px-2 py-1.5",
                    "text-sm text-foreground text-center",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                  )}
                />
                <span className="text-sm text-muted-foreground font-medium">
                  :
                </span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={timeMinute}
                  onChange={(e) =>
                    setTimeMinute(
                      Math.min(
                        59,
                        Math.max(0, parseInt(e.target.value) || 0),
                      ),
                    )
                  }
                  className={cn(
                    "w-14 rounded-lg border border-input bg-background px-2 py-1.5",
                    "text-sm text-foreground text-center",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                  )}
                />
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <StickyNote className="h-3 w-3" />
            Notes
            <span className="font-normal normal-case tracking-normal text-muted-foreground/60">
              (optional)
            </span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any extra details..."
            rows={3}
            className={cn(
              "w-full rounded-lg border border-input bg-background px-3 py-2.5",
              "text-sm text-foreground placeholder:text-muted-foreground/60",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "transition-shadow duration-150 resize-none",
            )}
          />
        </div>

        {/* Preview */}
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Preview
          </label>
          <SchedulePreview summary={summary} nextDates={nextDates} />
        </div>
      </div>

      {/* Fixed footer */}
      <div className="shrink-0 border-t border-border px-5 py-4 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "flex-1 rounded-lg border border-border px-4 py-2.5",
            "text-sm font-medium text-foreground",
            "hover:bg-muted transition-colors duration-150",
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            "flex-1 rounded-lg px-4 py-2.5",
            "text-sm font-medium transition-all duration-150",
            canSubmit
              ? "bg-foreground text-background hover:opacity-90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          {isPending
            ? isEditing
              ? "Updating..."
              : "Creating..."
            : isEditing
              ? "Update Chore"
              : "Create Chore"}
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
