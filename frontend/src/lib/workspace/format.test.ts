import { describe, expect, it } from "vitest";

import {
  displayName,
  formatDay,
  formatMessageTime,
  historyGroup,
  initials,
} from "@/lib/workspace/format";

const now = new Date("2026-11-07T12:00:00Z");

describe("historyGroup", () => {
  it("groups by calendar day", () => {
    expect(historyGroup("2026-11-07T01:00:00Z", now)).toBe("Today");
    expect(historyGroup("2026-11-06T23:00:00Z", now)).toBe("Yesterday");
    expect(historyGroup("2026-11-03T12:00:00Z", now)).toBe("Previous 7 days");
    expect(historyGroup("2026-01-01T12:00:00Z", now)).toBe("Older");
  });

  it("treats invalid and future dates predictably", () => {
    expect(historyGroup("nonsense", now)).toBe("Older");
    expect(historyGroup("2026-11-09T12:00:00Z", now)).toBe("Today");
  });
});

describe("formatMessageTime / formatDay", () => {
  it("formats a time of day", () => {
    expect(formatMessageTime("2026-11-07T09:05:00Z")).toMatch(/9:05/);
    expect(formatMessageTime("invalid")).toBe("");
  });

  it("omits the year for the current year and includes it otherwise", () => {
    expect(formatDay("2026-01-05T10:00:00Z", now)).toBe("Jan 5");
    expect(formatDay("2025-01-05T10:00:00Z", now)).toBe("Jan 5, 2025");
    expect(formatDay("invalid", now)).toBe("Unknown");
  });
});

describe("displayName / initials", () => {
  it("prefers a trimmed full name and falls back to a capitalised local part", () => {
    expect(displayName(" Ada Lovelace ", "ada@example.com")).toBe("Ada Lovelace");
    expect(displayName("   ", "ada@example.com")).toBe("Ada");
    expect(displayName(null, "@example.com")).toBe("There");
  });

  it("derives at most two initials", () => {
    expect(initials("Ada Lovelace", "ada@example.com")).toBe("AL");
    expect(initials(null, "ada@example.com")).toBe("AE");
    expect(initials(" ", "@")).toBe("N");
  });
});
