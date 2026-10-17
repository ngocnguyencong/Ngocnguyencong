import { describe, expect, it } from "vitest";

import { changelogEntries, formatChangelogDate } from "./changelog-entries";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("changelogEntries", () => {
  it("is non-empty and ordered newest first", () => {
    expect(changelogEntries.length).toBeGreaterThan(0);
    const dates = changelogEntries.map((entry) => entry.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("keeps dates unique and ISO-shaped", () => {
    const dates = changelogEntries.map((entry) => entry.date);
    expect(new Set(dates).size).toBe(dates.length);
    for (const date of dates) {
      expect(date).toMatch(ISO_DATE);
      expect(Number.isNaN(Date.parse(`${date}T00:00:00Z`))).toBe(false);
    }
  });

  it("gives every entry a title and at least one outcome bullet", () => {
    for (const entry of changelogEntries) {
      expect(entry.title.trim().length, entry.date).toBeGreaterThan(0);
      expect(entry.points.length, entry.date).toBeGreaterThan(0);
      for (const point of entry.points) {
        expect(point.trim().length, entry.date).toBeGreaterThan(0);
      }
    }
  });

  it("stays demo-clean — no promises, counts, or third-party product names", () => {
    const blob = JSON.stringify(changelogEntries);
    expect(blob).not.toMatch(/trusted by|customers|coming soon|roadmap/i);
    expect(blob).not.toMatch(/supastarter|makerkit|saasframe|shipfast|starterkit/i);
  });
});

describe("formatChangelogDate", () => {
  it("renders a readable English date from the ISO value", () => {
    expect(formatChangelogDate("2026-10-09")).toBe("October 9, 2026");
    expect(formatChangelogDate("2026-09-15")).toBe("September 15, 2026");
  });

  it("localizes the date for non-English app locales", () => {
    expect(formatChangelogDate("2026-10-09", "de")).toBe("9. Oktober 2026");
    expect(formatChangelogDate("2026-10-09", "fr")).toBe("9 octobre 2026");
  });
});
