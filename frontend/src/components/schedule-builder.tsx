import { useState, useEffect } from "react";
import { Calendar, Clock, RefreshCw, ChevronDown, ChevronUp, Zap, Settings2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SchedulePreview } from "@/components/schedule-preview";
import {
  parseCron,
  buildCron,
  formatCronHuman,
  formatIntervalHuman,
  daysToInterval,
  intervalToDays,
  type Schedule,
  type ScheduleType,
  type IntervalUnit,
} from "@/lib/cron";
import { cn } from "@/lib/utils";

type CronFrequency = "hourly" | "daily" | "weekly" | "monthly";

const DAYS = [
  { value: "0", label: "S", full: "Sunday" },
  { value: "1", label: "M", full: "Monday" },
  { value: "2", label: "T", full: "Tuesday" },
  { value: "3", label: "W", full: "Wednesday" },
  { value: "4", label: "T", full: "Thursday" },
  { value: "5", label: "F", full: "Friday" },
  { value: "6", label: "S", full: "Saturday" },
];

// Quick presets for common schedules
const PRESETS = [
  {
    id: "daily",
    label: "Daily",
    schedule: { type: "cron" as const, cronExpression: "0 9 * * *" },
  },
  {
    id: "weekly",
    label: "Weekly",
    schedule: { type: "cron" as const, cronExpression: "0 9 * * 1" },
  },
  {
    id: "biweekly",
    label: "Biweekly",
    schedule: {
      type: "interval" as const,
      intervalDays: 14,
      intervalTimeHour: 9,
      intervalTimeMinute: 0,
    },
  },
  {
    id: "monthly",
    label: "Monthly",
    schedule: { type: "cron" as const, cronExpression: "0 9 1 * *" },
  },
];

export interface ScheduleBuilderProps {
  value: Schedule;
  onChange: (schedule: Schedule) => void;
}

export function ScheduleBuilder({ value, onChange }: ScheduleBuilderProps) {
  // Expanded/collapsed state
  const [isExpanded, setIsExpanded] = useState(false);

  // Schedule type (cron or interval)
  const [scheduleType, setScheduleType] = useState<ScheduleType>(value.type);

  // Cron state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cronFrequency, setCronFrequency] = useState<CronFrequency>("weekly");
  const [selectedDays, setSelectedDays] = useState<string[]>(["1"]);
  const [cronHour, setCronHour] = useState(9);
  const [cronMinute, setCronMinute] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [customCron, setCustomCron] = useState(
    value.type === "cron" ? value.cronExpression : "0 9 * * 1",
  );

  // Interval state
  const [intervalValue, setIntervalValue] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>("weeks");
  const [intervalHour, setIntervalHour] = useState<number | undefined>(9);
  const [intervalMinute, setIntervalMinute] = useState<number | undefined>(0);
  const [showIntervalTime, setShowIntervalTime] = useState(true);

  // Active preset tracking
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Parse initial value
  useEffect(() => {
    if (value.type === "cron") {
      const parsed = parseCron(value.cronExpression);
      if (parsed.frequency !== "custom") {
        setCronFrequency(parsed.frequency);
        if (parsed.hour !== undefined) setCronHour(parsed.hour);
        if (parsed.minute !== undefined) setCronMinute(parsed.minute);
        if (parsed.daysOfWeek) {
          setSelectedDays(parsed.daysOfWeek.map(String));
        }
        if (parsed.dayOfMonth) setDayOfMonth(parsed.dayOfMonth);
      } else {
        setShowAdvanced(true);
      }
      setCustomCron(value.cronExpression);
    } else {
      const { value: v, unit } = daysToInterval(value.intervalDays);
      setIntervalValue(v);
      setIntervalUnit(unit);
      if (value.intervalTimeHour !== undefined) {
        setShowIntervalTime(true);
        setIntervalHour(value.intervalTimeHour);
        setIntervalMinute(value.intervalTimeMinute ?? 0);
      } else {
        setShowIntervalTime(false);
        setIntervalHour(undefined);
        setIntervalMinute(undefined);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build and emit schedule when cron settings change
  useEffect(() => {
    if (scheduleType !== "cron" || showAdvanced) return;

    const cron = buildCron({
      frequency: cronFrequency,
      hour: cronHour,
      minute: cronMinute,
      daysOfWeek: cronFrequency === "weekly" ? selectedDays.map(Number) : undefined,
      dayOfMonth: cronFrequency === "monthly" ? dayOfMonth : undefined,
    });

    setCustomCron(cron);
    onChange({ type: "cron", cronExpression: cron });
    setActivePreset(null); // Clear preset when manually editing
  }, [
    scheduleType,
    cronFrequency,
    cronHour,
    cronMinute,
    selectedDays,
    dayOfMonth,
    showAdvanced,
    onChange,
  ]);

  // Emit schedule when interval settings change
  useEffect(() => {
    if (scheduleType !== "interval") return;

    const days = intervalToDays(intervalValue, intervalUnit);
    onChange({
      type: "interval",
      intervalDays: days,
      intervalTimeHour: showIntervalTime ? intervalHour : undefined,
      intervalTimeMinute: showIntervalTime ? intervalMinute : undefined,
    });
    setActivePreset(null); // Clear preset when manually editing
  }, [
    scheduleType,
    intervalValue,
    intervalUnit,
    intervalHour,
    intervalMinute,
    showIntervalTime,
    onChange,
  ]);

  // Handle preset selection
  const handlePresetSelect = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setActivePreset(presetId);

    if (preset.schedule.type === "cron") {
      setScheduleType("cron");
      const parsed = parseCron(preset.schedule.cronExpression);
      setCronFrequency(parsed.frequency as CronFrequency);
      if (parsed.hour !== undefined) setCronHour(parsed.hour);
      if (parsed.minute !== undefined) setCronMinute(parsed.minute);
      if (parsed.daysOfWeek) setSelectedDays(parsed.daysOfWeek.map(String));
      if (parsed.dayOfMonth) setDayOfMonth(parsed.dayOfMonth);
      setCustomCron(preset.schedule.cronExpression);
      setShowAdvanced(false);
    } else {
      setScheduleType("interval");
      const { value: v, unit } = daysToInterval(preset.schedule.intervalDays);
      setIntervalValue(v);
      setIntervalUnit(unit);
      if (preset.schedule.intervalTimeHour !== undefined) {
        setShowIntervalTime(true);
        setIntervalHour(preset.schedule.intervalTimeHour);
        setIntervalMinute(preset.schedule.intervalTimeMinute ?? 0);
      }
    }

    onChange(preset.schedule);
  };

  // Handle schedule type change
  const handleScheduleTypeChange = (newType: ScheduleType) => {
    setScheduleType(newType);
    setActivePreset(null);
    if (newType === "cron") {
      onChange({ type: "cron", cronExpression: customCron });
    } else {
      const days = intervalToDays(intervalValue, intervalUnit);
      onChange({
        type: "interval",
        intervalDays: days,
        intervalTimeHour: showIntervalTime ? intervalHour : undefined,
        intervalTimeMinute: showIntervalTime ? intervalMinute : undefined,
      });
    }
  };

  const handleAdvancedChange = (newCron: string) => {
    setCustomCron(newCron);
    setActivePreset(null);
    onChange({ type: "cron", cronExpression: newCron });
  };

  const toggleDay = (dayValue: string) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayValue)) {
        // Don't allow deselecting last day
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== dayValue);
      }
      return [...prev, dayValue];
    });
  };

  // Preview text
  const previewText =
    scheduleType === "cron"
      ? formatCronHuman(customCron)
      : formatIntervalHuman(
          intervalToDays(intervalValue, intervalUnit),
          showIntervalTime ? intervalHour : undefined,
          showIntervalTime ? intervalMinute : undefined,
        );

  // Current schedule for preview
  const currentSchedule: Schedule =
    scheduleType === "cron"
      ? { type: "cron", cronExpression: customCron }
      : {
          type: "interval",
          intervalDays: intervalToDays(intervalValue, intervalUnit),
          intervalTimeHour: showIntervalTime ? intervalHour : undefined,
          intervalTimeMinute: showIntervalTime ? intervalMinute : undefined,
        };

  return (
    <div className="space-y-4">
      {/* Quick Presets - Always visible */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          <span>Quick presets</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetSelect(preset.id)}
              className={cn(
                "px-4 py-2.5 md:px-3 md:py-1.5 rounded-full text-sm font-medium transition-all",
                "border hover:border-primary/50",
                activePreset === preset.id
                  ? "bg-[var(--color-preset-active)] border-primary/30 text-foreground"
                  : "bg-[var(--color-preset-bg)] border-border/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Preview - Always visible */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border p-3",
          "bg-[var(--color-schedule-card)]",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {scheduleType === "cron" ? (
            <Calendar className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <RefreshCw className="h-4 w-4 text-primary shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{previewText}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center gap-1 px-3 py-2 md:px-2 md:py-1 rounded-md text-sm md:text-xs font-medium",
            "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            "transition-colors shrink-0",
          )}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {isExpanded ? "Less" : "Customize"}
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Expanded Builder Section */}
      {isExpanded && (
        <div className="space-y-4 animate-slide-up-reveal">
          {/* Schedule Type Cards */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleScheduleTypeChange("interval")}
              className={cn(
                "flex items-center gap-2 rounded-lg p-3 border-2 transition-all text-left",
                scheduleType === "interval"
                  ? "bg-[var(--color-schedule-type-active)] border-[var(--color-schedule-type-border)]"
                  : "bg-[var(--color-schedule-type-bg)] border-border/50 hover:border-border",
              )}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4 shrink-0",
                  scheduleType === "interval" ? "text-primary" : "text-muted-foreground",
                )}
              />
              <div className="min-w-0">
                <span
                  className={cn(
                    "text-sm font-semibold block",
                    scheduleType === "interval" ? "text-primary" : "text-foreground",
                  )}
                >
                  Interval
                </span>
                <span className="text-xs text-muted-foreground">On completion</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleScheduleTypeChange("cron")}
              className={cn(
                "flex items-center gap-2 rounded-lg p-3 border-2 transition-all text-left",
                scheduleType === "cron"
                  ? "bg-[var(--color-schedule-type-active)] border-[var(--color-schedule-type-border)]"
                  : "bg-[var(--color-schedule-type-bg)] border-border/50 hover:border-border",
              )}
            >
              <Calendar
                className={cn(
                  "h-4 w-4 shrink-0",
                  scheduleType === "cron" ? "text-primary" : "text-muted-foreground",
                )}
              />
              <div className="min-w-0">
                <span
                  className={cn(
                    "text-sm font-semibold block",
                    scheduleType === "cron" ? "text-primary" : "text-foreground",
                  )}
                >
                  Fixed
                </span>
                <span className="text-xs text-muted-foreground">Same days</span>
              </div>
            </button>
          </div>

          {/* Cron Builder */}
          {scheduleType === "cron" && (
            <div className="space-y-3">
              {!showAdvanced && (
                <>
                  {/* Frequency selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Repeat</Label>
                    <Select
                      value={cronFrequency}
                      onValueChange={(v) => setCronFrequency(v as CronFrequency)}
                    >
                      <SelectTrigger className="bg-background h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Every hour</SelectItem>
                        <SelectItem value="daily">Every day</SelectItem>
                        <SelectItem value="weekly">Every week</SelectItem>
                        <SelectItem value="monthly">Every month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Day picker for weekly */}
                  {cronFrequency === "weekly" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Days</Label>
                      <div className="flex justify-start gap-1">
                        {DAYS.map((day) => {
                          const isSelected = selectedDays.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleDay(day.value)}
                              title={day.full}
                              className={cn(
                                "w-10 h-10 md:w-8 md:h-8 rounded-full text-sm md:text-xs font-semibold transition-all",
                                "border focus:outline-none focus:ring-2 focus:ring-primary/50",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border hover:border-primary/50",
                              )}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Day of month for monthly */}
                  {cronFrequency === "monthly" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">On day</Label>
                      <Select
                        value={String(dayOfMonth)}
                        onValueChange={(v) => setDayOfMonth(Number(v))}
                      >
                        <SelectTrigger className="w-20 bg-background h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                            <SelectItem key={day} value={String(day)}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Time selector (not for hourly) */}
                  {cronFrequency !== "hourly" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Time
                      </Label>
                      <input
                        type="time"
                        value={`${String(cronHour).padStart(2, "0")}:${String(cronMinute).padStart(2, "0")}`}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map(Number);
                          if (!isNaN(h) && !isNaN(m)) {
                            setCronHour(h);
                            setCronMinute(m);
                          }
                        }}
                        className={cn(
                          "rounded-lg border border-input bg-background px-3 py-2 h-9",
                          "text-base md:text-sm text-foreground",
                          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                        )}
                      />
                    </div>
                  )}

                  {/* Minute selector for hourly */}
                  {cronFrequency === "hourly" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">At minute</Label>
                      <Select
                        value={String(cronMinute)}
                        onValueChange={(v) => setCronMinute(Number(v))}
                      >
                        <SelectTrigger className="w-20 bg-background h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 15, 30, 45].map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              :{String(m).padStart(2, "0")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              {/* Advanced/Custom cron input */}
              {showAdvanced && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cron expression</Label>
                  <Input
                    value={customCron}
                    onChange={(e) => handleAdvancedChange(e.target.value)}
                    placeholder="0 9 * * 1"
                    className="font-mono bg-background h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Format: minute hour day-of-month month day-of-week
                  </p>
                </div>
              )}

              {/* Toggle advanced */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full justify-center gap-1 text-sm md:text-xs text-muted-foreground hover:text-foreground h-11 md:h-8"
              >
                {showAdvanced ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Visual builder
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Cron expression
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Interval Builder */}
          {scheduleType === "interval" && (
            <div className="space-y-3">
              {/* Interval value and unit */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Repeat every</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={intervalUnit === "months" ? 12 : intervalUnit === "weeks" ? 52 : 365}
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 bg-background h-9"
                  />
                  <Select
                    value={intervalUnit}
                    onValueChange={(v) => setIntervalUnit(v as IntervalUnit)}
                  >
                    <SelectTrigger className="w-24 bg-background h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">{intervalValue === 1 ? "day" : "days"}</SelectItem>
                      <SelectItem value="weeks">
                        {intervalValue === 1 ? "week" : "weeks"}
                      </SelectItem>
                      <SelectItem value="months">
                        {intervalValue === 1 ? "month" : "months"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Timer resets when you complete the chore
                </p>
              </div>

              {/* Optional reminder time */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showIntervalTime}
                    onChange={(e) => setShowIntervalTime(e.target.checked)}
                    className="h-5 w-5 md:h-3.5 md:w-3.5 rounded border-border accent-primary"
                  />
                  <span className="text-sm md:text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-4 w-4 md:h-3 md:w-3" />
                    Remind at specific time
                  </span>
                </label>

                {showIntervalTime && (
                  <div className="pl-5">
                    <input
                      type="time"
                      value={`${String(intervalHour ?? 9).padStart(2, "0")}:${String(intervalMinute ?? 0).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        if (!isNaN(h) && !isNaN(m)) {
                          setIntervalHour(h);
                          setIntervalMinute(m);
                        }
                      }}
                      className={cn(
                        "rounded-lg border border-input bg-background px-3 py-2 h-9",
                        "text-base md:text-sm text-foreground",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Visual Timeline Preview */}
          <SchedulePreview schedule={currentSchedule} />
        </div>
      )}
    </div>
  );
}
