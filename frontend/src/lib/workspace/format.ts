const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export type HistoryGroup = "Today" | "Yesterday" | "Previous 7 days" | "Older";

/** Group a thread by calendar day, not by a rolling 24-hour window. */
export function historyGroup(iso: string, now = new Date()): HistoryGroup {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Older";
  }
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days <= 0) {
    return "Today";
  }
  if (days === 1) {
    return "Yesterday";
  }
  if (days < 7) {
    return "Previous 7 days";
  }
  return "Older";
}

export const HISTORY_GROUP_ORDER: HistoryGroup[] = [
  "Today",
  "Yesterday",
  "Previous 7 days",
  "Older",
];

export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDay(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

export function displayName(fullName: string | null, email: string): string {
  const trimmed = fullName?.trim();
  if (trimmed) {
    return trimmed;
  }
  const local = email.split("@")[0] || "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function initials(fullName: string | null, email: string): string {
  const source = fullName?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  return letters.join("") || "N";
}
