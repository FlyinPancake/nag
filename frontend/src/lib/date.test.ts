import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  formatRelativeTime,
  formatOverdue,
  formatDate,
  formatDateTime,
  isToday,
  isTomorrow,
} from "./date";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    // Mock current time to 2024-06-15 12:00:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("future dates", () => {
    it("should format minutes in the future", () => {
      expect(formatRelativeTime(new Date("2024-06-15T12:01:00"))).toBe(
        "in 1 minute"
      );
      expect(formatRelativeTime(new Date("2024-06-15T12:30:00"))).toBe(
        "in 30 minutes"
      );
    });

    it("should format hours in the future", () => {
      expect(formatRelativeTime(new Date("2024-06-15T13:00:00"))).toBe(
        "in 1 hour"
      );
      expect(formatRelativeTime(new Date("2024-06-15T15:00:00"))).toBe(
        "in 3 hours"
      );
    });

    it("should format tomorrow", () => {
      expect(formatRelativeTime(new Date("2024-06-16T12:00:00"))).toBe(
        "Tomorrow"
      );
    });

    it("should format days in the future", () => {
      expect(formatRelativeTime(new Date("2024-06-18T12:00:00"))).toBe(
        "in 3 days"
      );
    });

    it("should format weeks in the future", () => {
      expect(formatRelativeTime(new Date("2024-06-22T12:00:00"))).toBe(
        "in 1 week"
      );
    });

    it("should format as date for far future", () => {
      expect(formatRelativeTime(new Date("2024-06-30T12:00:00"))).toBe(
        "Jun 30"
      );
    });
  });

  describe("past dates", () => {
    it("should format just now", () => {
      expect(formatRelativeTime(new Date("2024-06-15T11:59:30"))).toBe(
        "just now"
      );
    });

    it("should format minutes ago", () => {
      expect(formatRelativeTime(new Date("2024-06-15T11:59:00"))).toBe(
        "1 minute ago"
      );
      expect(formatRelativeTime(new Date("2024-06-15T11:30:00"))).toBe(
        "30 minutes ago"
      );
    });

    it("should format hours ago", () => {
      expect(formatRelativeTime(new Date("2024-06-15T11:00:00"))).toBe(
        "1 hour ago"
      );
      expect(formatRelativeTime(new Date("2024-06-15T09:00:00"))).toBe(
        "3 hours ago"
      );
    });

    it("should format yesterday", () => {
      expect(formatRelativeTime(new Date("2024-06-14T12:00:00"))).toBe(
        "Yesterday"
      );
    });

    it("should format days ago", () => {
      expect(formatRelativeTime(new Date("2024-06-12T12:00:00"))).toBe(
        "3 days ago"
      );
    });

    it("should format weeks ago", () => {
      expect(formatRelativeTime(new Date("2024-06-08T12:00:00"))).toBe(
        "1 week ago"
      );
    });

    it("should format as date for far past", () => {
      expect(formatRelativeTime(new Date("2024-06-01T12:00:00"))).toBe("Jun 1");
    });
  });

  it("should accept string dates", () => {
    expect(formatRelativeTime("2024-06-16T12:00:00")).toBe("Tomorrow");
  });
});

describe("formatOverdue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "not overdue" for future dates', () => {
    expect(formatOverdue(new Date("2024-06-16T12:00:00"))).toBe("not overdue");
  });

  it("should format minutes overdue", () => {
    expect(formatOverdue(new Date("2024-06-15T11:59:00"))).toBe("1 min overdue");
    expect(formatOverdue(new Date("2024-06-15T11:30:00"))).toBe(
      "30 mins overdue"
    );
  });

  it("should format hours overdue", () => {
    expect(formatOverdue(new Date("2024-06-15T11:00:00"))).toBe(
      "1 hour overdue"
    );
    expect(formatOverdue(new Date("2024-06-15T09:00:00"))).toBe(
      "3 hours overdue"
    );
  });

  it("should format days overdue", () => {
    expect(formatOverdue(new Date("2024-06-14T12:00:00"))).toBe(
      "1 day overdue"
    );
    expect(formatOverdue(new Date("2024-06-12T12:00:00"))).toBe(
      "3 days overdue"
    );
  });

  it("should accept string dates", () => {
    expect(formatOverdue("2024-06-14T12:00:00")).toBe("1 day overdue");
  });
});

describe("formatDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should format date without year for current year", () => {
    const result = formatDate(new Date("2024-06-20"));
    expect(result).toBe("Jun 20");
  });

  it("should format date with year for different year", () => {
    const result = formatDate(new Date("2023-06-20"));
    expect(result).toBe("Jun 20, 2023");
  });

  it("should accept string dates", () => {
    const result = formatDate("2024-06-20");
    expect(result).toBe("Jun 20");
  });
});

describe("formatDateTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should format date and time without year for current year", () => {
    const result = formatDateTime(new Date("2024-06-20T14:30:00"));
    expect(result).toMatch(/Jun 20/);
    expect(result).toMatch(/2:30/);
    expect(result).toMatch(/PM/);
  });

  it("should format date and time with year for different year", () => {
    const result = formatDateTime(new Date("2023-06-20T14:30:00"));
    expect(result).toMatch(/Jun 20, 2023/);
    expect(result).toMatch(/2:30/);
  });

  it("should accept string dates", () => {
    const result = formatDateTime("2024-06-20T14:30:00");
    expect(result).toMatch(/Jun 20/);
  });
});

describe("isToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return true for today", () => {
    expect(isToday(new Date("2024-06-15T00:00:00"))).toBe(true);
    expect(isToday(new Date("2024-06-15T23:59:59"))).toBe(true);
  });

  it("should return false for other days", () => {
    expect(isToday(new Date("2024-06-14T12:00:00"))).toBe(false);
    expect(isToday(new Date("2024-06-16T12:00:00"))).toBe(false);
  });

  it("should accept string dates", () => {
    expect(isToday("2024-06-15T12:00:00")).toBe(true);
    expect(isToday("2024-06-14T12:00:00")).toBe(false);
  });
});

describe("isTomorrow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return true for tomorrow", () => {
    expect(isTomorrow(new Date("2024-06-16T00:00:00"))).toBe(true);
    expect(isTomorrow(new Date("2024-06-16T23:59:59"))).toBe(true);
  });

  it("should return false for other days", () => {
    expect(isTomorrow(new Date("2024-06-15T12:00:00"))).toBe(false);
    expect(isTomorrow(new Date("2024-06-17T12:00:00"))).toBe(false);
  });

  it("should accept string dates", () => {
    expect(isTomorrow("2024-06-16T12:00:00")).toBe(true);
    expect(isTomorrow("2024-06-15T12:00:00")).toBe(false);
  });
});
