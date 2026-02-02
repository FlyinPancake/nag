import { describe, it, expect } from "vitest";

import {
  parseCron,
  buildCron,
  formatCronHuman,
  formatTime,
  intervalToDays,
  daysToInterval,
  formatIntervalHuman,
  formatScheduleHuman,
  getNextOccurrences,
} from "./cron";
import type { Schedule } from "./cron";

describe("parseCron", () => {
  it("should parse hourly schedule", () => {
    const result = parseCron("30 * * * *");
    expect(result.frequency).toBe("hourly");
    expect(result.minute).toBe(30);
  });

  it("should parse daily schedule", () => {
    const result = parseCron("0 9 * * *");
    expect(result.frequency).toBe("daily");
    expect(result.hour).toBe(9);
    expect(result.minute).toBe(0);
  });

  it("should parse weekly schedule with single day", () => {
    const result = parseCron("0 9 * * 1");
    expect(result.frequency).toBe("weekly");
    expect(result.daysOfWeek).toEqual([1]);
    expect(result.hour).toBe(9);
  });

  it("should parse weekly schedule with multiple days", () => {
    const result = parseCron("0 9 * * 1,3,5");
    expect(result.frequency).toBe("weekly");
    expect(result.daysOfWeek).toEqual([1, 3, 5]);
  });

  it("should parse weekly schedule with day range", () => {
    const result = parseCron("0 9 * * 1-5");
    expect(result.frequency).toBe("weekly");
    expect(result.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });

  it("should parse monthly schedule", () => {
    const result = parseCron("0 9 15 * *");
    expect(result.frequency).toBe("monthly");
    expect(result.dayOfMonth).toBe(15);
  });

  it("should return custom for invalid cron format", () => {
    const result = parseCron("invalid");
    expect(result.frequency).toBe("custom");
    expect(result.raw).toBe("invalid");
  });

  it("should return custom for complex schedules", () => {
    const result = parseCron("0 9 15 * 1"); // Both day of month and day of week
    expect(result.frequency).toBe("custom");
  });
});

describe("buildCron", () => {
  it("should build hourly cron expression", () => {
    const result = buildCron({ frequency: "hourly", minute: 15 });
    expect(result).toBe("15 * * * *");
  });

  it("should build daily cron expression", () => {
    const result = buildCron({ frequency: "daily", hour: 14, minute: 30 });
    expect(result).toBe("30 14 * * *");
  });

  it("should build daily cron with default values", () => {
    const result = buildCron({ frequency: "daily" });
    expect(result).toBe("0 9 * * *");
  });

  it("should build weekly cron expression", () => {
    const result = buildCron({
      frequency: "weekly",
      hour: 9,
      minute: 0,
      daysOfWeek: [1, 3, 5],
    });
    expect(result).toBe("0 9 * * 1,3,5");
  });

  it("should build monthly cron expression", () => {
    const result = buildCron({
      frequency: "monthly",
      hour: 10,
      minute: 0,
      dayOfMonth: 15,
    });
    expect(result).toBe("0 10 15 * *");
  });
});

describe("formatCronHuman", () => {
  it("should format hourly schedule", () => {
    expect(formatCronHuman("30 * * * *")).toBe("Every hour at :30");
  });

  it("should format daily schedule in AM", () => {
    expect(formatCronHuman("0 9 * * *")).toBe("Every day at 9:00 AM");
  });

  it("should format daily schedule in PM", () => {
    expect(formatCronHuman("30 14 * * *")).toBe("Every day at 2:30 PM");
  });

  it("should format single day weekly schedule", () => {
    expect(formatCronHuman("0 9 * * 1")).toBe("Every Monday at 9:00 AM");
  });

  it("should format weekdays schedule", () => {
    expect(formatCronHuman("0 9 * * 1,2,3,4,5")).toBe("Weekdays at 9:00 AM");
  });

  it("should format weekends schedule", () => {
    expect(formatCronHuman("0 10 * * 0,6")).toBe("Weekends at 10:00 AM");
  });

  it("should format multiple days weekly schedule", () => {
    expect(formatCronHuman("0 9 * * 1,3,5")).toBe("Mon, Wed, Fri at 9:00 AM");
  });

  it("should format monthly schedule", () => {
    expect(formatCronHuman("0 9 15 * *")).toBe("15th of every month at 9:00 AM");
  });

  it("should format monthly schedule with ordinal suffixes", () => {
    expect(formatCronHuman("0 9 1 * *")).toBe("1st of every month at 9:00 AM");
    expect(formatCronHuman("0 9 2 * *")).toBe("2nd of every month at 9:00 AM");
    expect(formatCronHuman("0 9 3 * *")).toBe("3rd of every month at 9:00 AM");
    expect(formatCronHuman("0 9 21 * *")).toBe("21st of every month at 9:00 AM");
  });

  it("should return raw cron for custom schedules", () => {
    expect(formatCronHuman("invalid")).toBe("invalid");
  });
});

describe("formatTime", () => {
  it("should format AM times correctly", () => {
    expect(formatTime(9, 0)).toBe("9:00 AM");
    expect(formatTime(9, 30)).toBe("9:30 AM");
    expect(formatTime(0, 0)).toBe("12:00 AM");
    expect(formatTime(11, 59)).toBe("11:59 AM");
  });

  it("should format PM times correctly", () => {
    expect(formatTime(12, 0)).toBe("12:00 PM");
    expect(formatTime(14, 30)).toBe("2:30 PM");
    expect(formatTime(23, 59)).toBe("11:59 PM");
  });

  it("should pad single-digit minutes", () => {
    expect(formatTime(9, 5)).toBe("9:05 AM");
  });
});

describe("intervalToDays", () => {
  it("should convert days correctly", () => {
    expect(intervalToDays(5, "days")).toBe(5);
  });

  it("should convert weeks correctly", () => {
    expect(intervalToDays(2, "weeks")).toBe(14);
  });

  it("should convert months correctly", () => {
    expect(intervalToDays(1, "months")).toBe(30);
    expect(intervalToDays(3, "months")).toBe(90);
  });
});

describe("daysToInterval", () => {
  it("should return days for small values", () => {
    expect(daysToInterval(5)).toEqual({ value: 5, unit: "days" });
  });

  it("should convert to weeks when evenly divisible", () => {
    expect(daysToInterval(7)).toEqual({ value: 1, unit: "weeks" });
    expect(daysToInterval(14)).toEqual({ value: 2, unit: "weeks" });
    expect(daysToInterval(21)).toEqual({ value: 3, unit: "weeks" });
  });

  it("should convert to months when evenly divisible", () => {
    expect(daysToInterval(30)).toEqual({ value: 1, unit: "months" });
    expect(daysToInterval(60)).toEqual({ value: 2, unit: "months" });
    expect(daysToInterval(90)).toEqual({ value: 3, unit: "months" });
  });

  it("should prefer months over weeks when both apply", () => {
    // 210 days = 7 months OR 30 weeks, should prefer months
    expect(daysToInterval(210)).toEqual({ value: 7, unit: "months" });
  });

  it("should return days when not evenly divisible", () => {
    expect(daysToInterval(10)).toEqual({ value: 10, unit: "days" });
    expect(daysToInterval(25)).toEqual({ value: 25, unit: "days" });
  });
});

describe("formatIntervalHuman", () => {
  it("should format single day interval", () => {
    expect(formatIntervalHuman(1)).toBe("Every day");
  });

  it("should format multiple days interval", () => {
    expect(formatIntervalHuman(3)).toBe("Every 3 days");
  });

  it("should format single week interval", () => {
    expect(formatIntervalHuman(7)).toBe("Every week");
  });

  it("should format multiple weeks interval", () => {
    expect(formatIntervalHuman(14)).toBe("Every 2 weeks");
  });

  it("should format single month interval", () => {
    expect(formatIntervalHuman(30)).toBe("Every month");
  });

  it("should format multiple months interval", () => {
    expect(formatIntervalHuman(60)).toBe("Every 2 months");
  });

  it("should include time when specified", () => {
    expect(formatIntervalHuman(7, 9, 0)).toBe("Every week at 9:00 AM");
    expect(formatIntervalHuman(1, 14, 30)).toBe("Every day at 2:30 PM");
  });

  it("should handle null time values", () => {
    expect(formatIntervalHuman(7, null, null)).toBe("Every week");
  });
});

describe("formatScheduleHuman", () => {
  it("should format cron schedule", () => {
    const schedule: Schedule = {
      type: "cron",
      cronExpression: "0 9 * * 1",
    };
    expect(formatScheduleHuman(schedule)).toBe("Every Monday at 9:00 AM");
  });

  it("should format interval schedule", () => {
    const schedule: Schedule = {
      type: "interval",
      intervalDays: 7,
      intervalTimeHour: 9,
      intervalTimeMinute: 0,
    };
    expect(formatScheduleHuman(schedule)).toBe("Every week at 9:00 AM");
  });

  it("should format interval schedule without time", () => {
    const schedule: Schedule = {
      type: "interval",
      intervalDays: 14,
    };
    expect(formatScheduleHuman(schedule)).toBe("Every 2 weeks");
  });
});

describe("getNextOccurrences", () => {
  it("should return correct number of occurrences for interval schedule", () => {
    const schedule: Schedule = {
      type: "interval",
      intervalDays: 7,
    };
    const occurrences = getNextOccurrences(schedule, 4);
    expect(occurrences).toHaveLength(4);
  });

  it("should return occurrences with proper spacing for interval schedule", () => {
    const from = new Date("2024-01-01T10:00:00");
    const schedule: Schedule = {
      type: "interval",
      intervalDays: 3,
    };
    const occurrences = getNextOccurrences(schedule, 3, from);

    // Check that occurrences are 3 days apart
    for (let i = 1; i < occurrences.length; i++) {
      const diffMs = occurrences[i].date.getTime() - occurrences[i - 1].date.getTime();
      const diffDays = diffMs / (24 * 60 * 60 * 1000);
      expect(diffDays).toBe(3);
    }
  });

  it("should return occurrences for cron schedule", () => {
    const schedule: Schedule = {
      type: "cron",
      cronExpression: "0 9 * * *", // Daily at 9am
    };
    const occurrences = getNextOccurrences(schedule, 3);
    expect(occurrences).toHaveLength(3);
  });

  it("should include labels for occurrences", () => {
    const schedule: Schedule = {
      type: "interval",
      intervalDays: 1,
    };
    const occurrences = getNextOccurrences(schedule, 2);

    // Each occurrence should have label and relativeLabel
    occurrences.forEach((occ) => {
      expect(occ.label).toBeDefined();
      expect(occ.relativeLabel).toBeDefined();
    });
  });

  it('should label first occurrence as "Today" when due today', () => {
    const now = new Date();
    const schedule: Schedule = {
      type: "interval",
      intervalDays: 1,
      intervalTimeHour: now.getHours() + 1, // 1 hour from now
      intervalTimeMinute: 0,
    };
    const occurrences = getNextOccurrences(schedule, 1, now);

    if (now.getHours() < 23) {
      // Only if there's room for +1 hour today
      expect(occurrences[0].label).toBe("Today");
    }
  });
});
