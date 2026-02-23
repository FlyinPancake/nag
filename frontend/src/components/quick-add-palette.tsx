import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Calendar,
  Clock,
  ChevronDown,
  X,
  Zap,
  StickyNote,
  CornerDownLeft,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useCreateChore } from "@/hooks/use-chores";
import type { CreateChoreRequest } from "@/lib/api";

// ---------------------------------------------------------------------------
// Schedule types & keyword detection
// ---------------------------------------------------------------------------

type SchedulePreset = "daily" | "weekly" | "monthly" | "custom";

interface DetectedSchedule {
  preset: SchedulePreset;
  intervalDays?: number;
  label: string;
  matchedText: string;
}

function detectSchedule(input: string): DetectedSchedule | null {
  const lower = input.toLowerCase();

  // "every N days" / "every N day"
  const intervalMatch = lower.match(/every\s+(\d+)\s+days?/);
  if (intervalMatch) {
    const n = parseInt(intervalMatch[1], 10);
    return {
      preset: "custom",
      intervalDays: n,
      label: `Every ${n} day${n === 1 ? "" : "s"}`,
      matchedText: intervalMatch[0],
    };
  }

  // daily
  if (/\b(daily|every\s*day)\b/.test(lower)) {
    const match = lower.match(/\b(daily|every\s*day)\b/);
    return {
      preset: "daily",
      intervalDays: 1,
      label: "Daily",
      matchedText: match?.[0] ?? "daily",
    };
  }

  // weekly
  if (/\b(weekly|every\s*week)\b/.test(lower)) {
    const match = lower.match(/\b(weekly|every\s*week)\b/);
    return {
      preset: "weekly",
      intervalDays: 7,
      label: "Weekly",
      matchedText: match?.[0] ?? "weekly",
    };
  }

  // monthly
  if (/\b(monthly|every\s*month)\b/.test(lower)) {
    const match = lower.match(/\b(monthly|every\s*month)\b/);
    return {
      preset: "monthly",
      intervalDays: 30,
      label: "Monthly",
      matchedText: match?.[0] ?? "monthly",
    };
  }

  return null;
}

function stripScheduleKeyword(input: string, matchedText: string): string {
  const idx = input.toLowerCase().indexOf(matchedText.toLowerCase());
  if (idx === -1) return input;
  const before = input.slice(0, idx);
  const after = input.slice(idx + matchedText.length);
  return (before + after).replace(/\s{2,}/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Schedule dropdown
// ---------------------------------------------------------------------------

interface ScheduleDropdownProps {
  label: string;
  onChange: (preset: SchedulePreset, days: number, label: string) => void;
}

const SCHEDULE_OPTIONS: { preset: SchedulePreset; days: number; label: string }[] = [
  { preset: "daily", days: 1, label: "Daily" },
  { preset: "weekly", days: 7, label: "Weekly" },
  { preset: "monthly", days: 30, label: "Monthly" },
  { preset: "custom", days: 3, label: "Every 3 days" },
  { preset: "custom", days: 14, label: "Every 2 weeks" },
];

function ScheduleDropdown({ label, onChange }: ScheduleDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 border rounded-full px-4 py-2 md:px-3 md:py-1 text-sm md:text-xs font-medium",
          "transition-colors hover:bg-secondary text-foreground",
        )}
      >
        <Calendar className="h-4 w-4 md:h-3 md:w-3" />
        <span>{label}</span>
        <ChevronDown className="h-4 w-4 md:h-3 md:w-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-card border rounded-lg shadow-lg py-1 z-50 min-w-[160px] animate-pop-in">
          {SCHEDULE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                onChange(opt.preset, opt.days, opt.label);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-2.5 md:py-1.5 text-sm md:text-xs transition-colors hover:bg-secondary",
                opt.label === label && "font-semibold text-foreground bg-secondary/50",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time picker (native)
// ---------------------------------------------------------------------------

interface TimePickerProps {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}

function TimePicker({ hour, minute, onChange }: TimePickerProps) {
  return (
    <div className="flex items-center gap-1.5 border rounded-full px-3 py-1.5 md:px-2.5 md:py-0.5">
      <Clock className="h-4 w-4 md:h-3 md:w-3 text-muted-foreground shrink-0" />
      <input
        type="time"
        value={`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`}
        onChange={(e) => {
          const [h, m] = e.target.value.split(":").map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            onChange(h, m);
          }
        }}
        className={cn(
          "bg-transparent border-none outline-none",
          "text-sm md:text-xs font-medium text-foreground",
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Add Palette
// ---------------------------------------------------------------------------

interface QuickAddPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAddPalette({ open, onClose }: QuickAddPaletteProps) {
  const [rawInput, setRawInput] = useState("");
  const [intervalDays, setIntervalDays] = useState(7);
  const [scheduleLabel, setScheduleLabel] = useState("Weekly");
  const [timeHour, setTimeHour] = useState(9);
  const [timeMinute, setTimeMinute] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [detected, setDetected] = useState<DetectedSchedule | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const createChore = useCreateChore();

  // Focus input when palette opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Keyword detection on input change
  const handleInputChange = useCallback((value: string) => {
    setRawInput(value);
    const result = detectSchedule(value);
    setDetected(result);
    if (result) {
      setScheduleLabel(result.label);
      if (result.intervalDays) {
        setIntervalDays(result.intervalDays);
      }
    }
  }, []);

  const cleanName = useMemo(() => {
    if (detected) {
      return stripScheduleKeyword(rawInput, detected.matchedText);
    }
    return rawInput.trim();
  }, [rawInput, detected]);

  const resetForm = useCallback(() => {
    setRawInput("");
    setDetected(null);
    setIntervalDays(7);
    setScheduleLabel("Weekly");
    setTimeHour(9);
    setTimeMinute(0);
    setShowNotes(false);
    setNotes("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!cleanName) return;

    // Build the CreateChoreRequest
    const request: CreateChoreRequest = {
      name: cleanName,
      description: notes.trim() || null,
      schedule_type: "interval",
      interval_days: intervalDays,
      interval_time_hour: timeHour,
      interval_time_minute: timeMinute,
    };

    try {
      await createChore.mutateAsync(request);
      toast.success(`"${cleanName}" created!`);
      resetForm();
      onClose();
    } catch {
      toast.error("Failed to create chore");
    }
  }, [cleanName, notes, intervalDays, timeHour, timeMinute, createChore, resetForm, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  if (!open) return null;

  return (
    <>
      {/* Subtle overlay */}
      <div
        className="fixed inset-0 z-40 bg-foreground/5 transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Vignette at top */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-32 bg-gradient-to-b from-foreground/[0.03] to-transparent"
        aria-hidden
      />

      {/* Palette card */}
      <div
        className={cn(
          "fixed z-50 left-1/2 -translate-x-1/2",
          "top-4 sm:top-8",
          "w-[calc(100%-2rem)] max-w-lg",
          "bg-card rounded-2xl shadow-2xl border p-4",
          "animate-slide-up-reveal",
        )}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-due-today" />
            <span className="font-medium">Quick Add</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 bg-secondary text-muted-foreground rounded px-1.5 py-0.5 text-[0.6rem] font-mono border">
              Esc
            </kbd>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 md:p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-5 w-5 md:h-4 md:w-4" />
          </button>
        </div>

        {/* Main input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={rawInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='What needs doing? (e.g., "Vacuum weekly")'
            className={cn(
              "w-full bg-transparent border-none outline-none",
              "text-lg font-mono text-foreground placeholder:text-muted-foreground/50",
              "py-2",
            )}
          />
        </div>

        {/* Detected schedule badge */}
        {detected && (
          <div className="flex items-center gap-2 mt-1 mb-2 animate-pop-in">
            <span className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
              <Calendar className="h-3 w-3" />
              {detected.label} detected
            </span>
            {cleanName && (
              <span className="text-xs text-muted-foreground">
                &rarr; &ldquo;{cleanName}&rdquo;
              </span>
            )}
          </div>
        )}

        {/* Separator */}
        <div className="border-t my-2" />

        {/* Compact controls row */}
        <div className="flex items-center gap-2 flex-wrap">
          <ScheduleDropdown
            label={scheduleLabel}
            onChange={(_preset, days, label) => {
              setIntervalDays(days);
              setScheduleLabel(label);
            }}
          />
          <TimePicker
            hour={timeHour}
            minute={timeMinute}
            onChange={(h, m) => {
              setTimeHour(h);
              setTimeMinute(m);
            }}
          />
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className={cn(
              "flex items-center gap-1.5 border rounded-full px-4 py-2 md:px-3 md:py-1 text-sm md:text-xs font-medium",
              "transition-colors hover:bg-secondary",
              showNotes ? "text-foreground bg-secondary/50" : "text-muted-foreground",
            )}
          >
            <StickyNote className="h-4 w-4 md:h-3 md:w-3" />
            <span>{showNotes ? "Notes" : "+ Notes"}</span>
          </button>

          {/* Spacer + submit hint */}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <CornerDownLeft className="h-3 w-3" />
              Enter to create
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!cleanName || createChore.isPending}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-5 py-2 md:px-4 md:py-1 text-sm md:text-xs font-semibold",
                "transition-colors",
                cleanName && !createChore.isPending
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              {createChore.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>

        {/* Notes textarea */}
        {showNotes && (
          <div className="mt-3 animate-pop-in">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={2}
              className={cn(
                "w-full bg-secondary/30 border rounded-lg px-3 py-2 text-base md:text-sm",
                "text-foreground placeholder:text-muted-foreground/50",
                "outline-none focus:ring-1 focus:ring-ring resize-none",
              )}
            />
          </div>
        )}
      </div>
    </>
  );
}
