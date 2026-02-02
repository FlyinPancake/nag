// Utility functions for parsing and displaying schedules (cron and interval)

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ============================================================================
// Schedule Types
// ============================================================================

export type ScheduleType = "cron" | "interval";

export interface CronSchedule {
  type: "cron";
  cronExpression: string;
}

export interface IntervalSchedule {
  type: "interval";
  intervalDays: number;
  intervalTimeHour?: number;
  intervalTimeMinute?: number;
}

export type Schedule = CronSchedule | IntervalSchedule;

// ============================================================================
// Interval Schedule Utilities
// ============================================================================

export type IntervalUnit = "days" | "weeks" | "months";

/**
 * Convert interval value and unit to total days
 */
export function intervalToDays(value: number, unit: IntervalUnit): number {
  switch (unit) {
    case "days":
      return value;
    case "weeks":
      return value * 7;
    case "months":
      return value * 30;
  }
}

/**
 * Convert total days to the most appropriate unit and value
 */
export function daysToInterval(days: number): { value: number; unit: IntervalUnit } {
  // Check if it's a clean multiple of months (30 days)
  if (days >= 30 && days % 30 === 0) {
    return { value: days / 30, unit: "months" };
  }
  // Check if it's a clean multiple of weeks (7 days)
  if (days >= 7 && days % 7 === 0) {
    return { value: days / 7, unit: "weeks" };
  }
  // Default to days
  return { value: days, unit: "days" };
}

/**
 * Format an interval schedule as a human-readable string
 */
export function formatIntervalHuman(
  days: number,
  hour?: number | null,
  minute?: number | null
): string {
  const { value, unit } = daysToInterval(days);
  
  let intervalText: string;
  if (value === 1) {
    // "Every day", "Every week", "Every month"
    intervalText = `Every ${unit.slice(0, -1)}`;
  } else {
    // "Every 2 days", "Every 3 weeks", "Every 2 months"
    intervalText = `Every ${value} ${unit}`;
  }
  
  // Add time if specified
  if (hour !== undefined && hour !== null) {
    const timeStr = formatTime(hour, minute ?? 0);
    intervalText += ` at ${timeStr}`;
  }
  
  return intervalText;
}

/**
 * Format a schedule (either cron or interval) as a human-readable string
 */
export function formatScheduleHuman(schedule: Schedule): string {
  if (schedule.type === "cron") {
    return formatCronHuman(schedule.cronExpression);
  } else {
    return formatIntervalHuman(
      schedule.intervalDays,
      schedule.intervalTimeHour,
      schedule.intervalTimeMinute
    );
  }
}

export interface ParsedSchedule {
  frequency: "hourly" | "daily" | "weekly" | "monthly" | "custom";
  hour?: number;
  minute?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  raw: string;
}

/**
 * Parse a cron expression into a more usable format
 * Supports: minute hour dayOfMonth month dayOfWeek
 */
export function parseCron(cron: string): ParsedSchedule {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { frequency: "custom", raw: cron };
  }

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  // Check for weekly schedule (specific days of week)
  if (dayOfMonth === "*" && dayOfWeek !== "*") {
    const days = parseDaysOfWeek(dayOfWeek);
    return {
      frequency: "weekly",
      minute: minute === "*" ? 0 : parseInt(minute, 10),
      hour: hour === "*" ? 9 : parseInt(hour, 10),
      daysOfWeek: days,
      raw: cron,
    };
  }

  // Check for monthly schedule (specific day of month)
  if (dayOfMonth !== "*" && dayOfWeek === "*") {
    return {
      frequency: "monthly",
      minute: minute === "*" ? 0 : parseInt(minute, 10),
      hour: hour === "*" ? 9 : parseInt(hour, 10),
      dayOfMonth: parseInt(dayOfMonth, 10),
      raw: cron,
    };
  }

  // Check for daily schedule
  if (dayOfMonth === "*" && dayOfWeek === "*") {
    if (hour === "*") {
      return {
        frequency: "hourly",
        minute: minute === "*" ? 0 : parseInt(minute, 10),
        raw: cron,
      };
    }
    return {
      frequency: "daily",
      minute: minute === "*" ? 0 : parseInt(minute, 10),
      hour: parseInt(hour, 10),
      raw: cron,
    };
  }

  return { frequency: "custom", raw: cron };
}

function parseDaysOfWeek(field: string): number[] {
  const days: number[] = [];

  // Handle comma-separated values and ranges
  const parts = field.split(",");
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((n) => parseInt(n, 10));
      for (let i = start; i <= end; i++) {
        if (!days.includes(i)) days.push(i);
      }
    } else {
      const day = parseInt(part, 10);
      if (!isNaN(day) && !days.includes(day)) days.push(day);
    }
  }

  return days.sort((a, b) => a - b);
}

/**
 * Format a cron expression as a human-readable string
 */
export function formatCronHuman(cron: string): string {
  const parsed = parseCron(cron);

  switch (parsed.frequency) {
    case "hourly":
      return `Every hour at :${String(parsed.minute).padStart(2, "0")}`;

    case "daily":
      return `Every day at ${formatTime(parsed.hour!, parsed.minute!)}`;

    case "weekly": {
      const days = parsed.daysOfWeek!;
      const time = formatTime(parsed.hour!, parsed.minute!);

      if (days.length === 7) {
        return `Every day at ${time}`;
      }
      if (days.length === 1) {
        return `Every ${DAYS_FULL[days[0]]} at ${time}`;
      }
      if (
        days.length === 5 &&
        days.every((d) => d >= 1 && d <= 5)
      ) {
        return `Weekdays at ${time}`;
      }
      if (
        days.length === 2 &&
        days.includes(0) &&
        days.includes(6)
      ) {
        return `Weekends at ${time}`;
      }
      return `${days.map((d) => DAYS[d]).join(", ")} at ${time}`;
    }

    case "monthly":
      return `${ordinal(parsed.dayOfMonth!)} of every month at ${formatTime(
        parsed.hour!,
        parsed.minute!
      )}`;

    case "custom":
    default:
      return cron;
  }
}

export function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  const displayMinute = String(minute).padStart(2, "0");
  return `${displayHour}:${displayMinute} ${period}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Build a cron expression from schedule components
 */
export function buildCron(schedule: {
  frequency: "hourly" | "daily" | "weekly" | "monthly";
  hour?: number;
  minute?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
}): string {
  const minute = schedule.minute ?? 0;

  switch (schedule.frequency) {
    case "hourly":
      return `${minute} * * * *`;

    case "daily":
      return `${minute} ${schedule.hour ?? 9} * * *`;

    case "weekly":
      const days = schedule.daysOfWeek?.join(",") || "1";
      return `${minute} ${schedule.hour ?? 9} * * ${days}`;

    case "monthly":
      return `${minute} ${schedule.hour ?? 9} ${schedule.dayOfMonth ?? 1} * *`;

    default:
      return "0 9 * * 1"; // Default to Monday 9am
  }
}

// ============================================================================
// Next Occurrences Calculator
// ============================================================================

export interface Occurrence {
  date: Date;
  label: string; // e.g., "Tomorrow", "Mon, Feb 3"
  relativeLabel: string; // e.g., "in 2 days", "in 1 week"
}

/**
 * Calculate the next N occurrences for a schedule
 */
export function getNextOccurrences(
  schedule: Schedule,
  count: number = 4,
  from: Date = new Date()
): Occurrence[] {
  const occurrences: Occurrence[] = [];

  if (schedule.type === "interval") {
    // For interval schedules, occurrences are evenly spaced
    const intervalMs = schedule.intervalDays * 24 * 60 * 60 * 1000;
    let nextDate = new Date(from);

    // Set the time if specified
    if (schedule.intervalTimeHour !== undefined) {
      nextDate.setHours(schedule.intervalTimeHour, schedule.intervalTimeMinute ?? 0, 0, 0);
      // If we've already passed that time today, start from tomorrow
      if (nextDate <= from) {
        nextDate = new Date(nextDate.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    for (let i = 0; i < count; i++) {
      const date = new Date(nextDate.getTime() + i * intervalMs);
      occurrences.push({
        date,
        label: formatDateLabel(date, from),
        relativeLabel: formatRelativeLabel(date, from),
      });
    }
  } else {
    // For cron schedules, we need to parse and calculate
    const parsed = parseCron(schedule.cronExpression);
    let current = new Date(from);

    while (occurrences.length < count) {
      const next = getNextCronOccurrence(parsed, current);
      if (!next) break; // Safety exit

      occurrences.push({
        date: next,
        label: formatDateLabel(next, from),
        relativeLabel: formatRelativeLabel(next, from),
      });

      // Move to the next possible occurrence
      current = new Date(next.getTime() + 60 * 1000); // Add 1 minute to avoid same result
    }
  }

  return occurrences;
}

/**
 * Get the next occurrence for a parsed cron schedule
 */
function getNextCronOccurrence(parsed: ParsedSchedule, from: Date): Date | null {
  const maxIterations = 366; // Max days to search
  let candidate = new Date(from);

  // Set time component
  const hour = parsed.hour ?? 9;
  const minute = parsed.minute ?? 0;

  for (let i = 0; i < maxIterations; i++) {
    candidate.setHours(hour, minute, 0, 0);

    // Check if this candidate matches the schedule
    const dayOfWeek = candidate.getDay();
    const dayOfMonth = candidate.getDate();

    let matches = false;

    switch (parsed.frequency) {
      case "hourly":
        // For hourly, find next hour
        candidate = new Date(from);
        candidate.setMinutes(minute, 0, 0);
        if (candidate <= from) {
          candidate.setHours(candidate.getHours() + 1);
        }
        return candidate;

      case "daily":
        matches = true;
        break;

      case "weekly":
        matches = parsed.daysOfWeek?.includes(dayOfWeek) ?? false;
        break;

      case "monthly":
        matches = dayOfMonth === parsed.dayOfMonth;
        break;

      case "custom":
        // For custom, just return daily as fallback
        matches = true;
        break;
    }

    if (matches && candidate > from) {
      return candidate;
    }

    // Move to next day
    candidate = new Date(candidate);
    candidate.setDate(candidate.getDate() + 1);
  }

  return null;
}

/**
 * Format a date as a friendly label
 */
function formatDateLabel(date: Date, from: Date): string {
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);

  const targetDay = new Date(date);
  targetDay.setHours(0, 0, 0, 0);

  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return DAYS_FULL[date.getDay()];

  // Format as "Mon, Feb 3"
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${DAYS[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Format a relative time label
 */
function formatRelativeLabel(date: Date, from: Date): string {
  const diffMs = date.getTime() - from.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return "now";
  if (diffDays === 1) return "in 1 day";
  if (diffDays < 7) return `in ${diffDays} days`;
  if (diffDays < 14) return "in 1 week";
  if (diffDays < 30) return `in ${Math.floor(diffDays / 7)} weeks`;
  if (diffDays < 60) return "in 1 month";
  return `in ${Math.floor(diffDays / 30)} months`;
}
