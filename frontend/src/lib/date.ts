// Date formatting utilities

/**
 * Format a date as a relative time string (e.g., "3 days ago", "in 2 hours")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Future dates
  if (diffMs > 0) {
    if (diffMins < 60) {
      return diffMins === 1 ? "in 1 minute" : `in ${diffMins} minutes`;
    }
    if (diffHours < 24) {
      return diffHours === 1 ? "in 1 hour" : `in ${diffHours} hours`;
    }
    if (diffDays === 1) {
      return "Tomorrow";
    }
    if (diffDays < 7) {
      return `in ${diffDays} days`;
    }
    if (diffDays < 14) {
      return "in 1 week";
    }
    return formatDate(d);
  }

  // Past dates
  const absDiffMins = Math.abs(diffMins);
  const absDiffHours = Math.abs(diffHours);
  const absDiffDays = Math.abs(diffDays);

  if (absDiffMins < 60) {
    if (absDiffMins < 1) return "just now";
    return absDiffMins === 1 ? "1 minute ago" : `${absDiffMins} minutes ago`;
  }
  if (absDiffHours < 24) {
    return absDiffHours === 1 ? "1 hour ago" : `${absDiffHours} hours ago`;
  }
  if (absDiffDays === 1) {
    return "Yesterday";
  }
  if (absDiffDays < 7) {
    return `${absDiffDays} days ago`;
  }
  if (absDiffDays < 14) {
    return "1 week ago";
  }
  return formatDate(d);
}

/**
 * Format overdue duration (e.g., "3 days overdue")
 */
export function formatOverdue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  if (diffMs <= 0) return "not overdue";

  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return diffMins === 1 ? "1 min overdue" : `${diffMins} mins overdue`;
  }
  if (diffHours < 24) {
    return diffHours === 1 ? "1 hour overdue" : `${diffHours} hours overdue`;
  }
  if (diffDays === 1) {
    return "1 day overdue";
  }
  return `${diffDays} days overdue`;
}

/**
 * Format a date in a readable format
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Format a date with time
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date is tomorrow
 */
export function isTomorrow(date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
  );
}
