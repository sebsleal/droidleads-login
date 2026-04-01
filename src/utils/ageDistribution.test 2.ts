import { describe, it, expect } from "vitest";
import { computeAgeDistribution, AGE_BUCKETS } from "./ageDistribution";

/** Helper: build a synthetic lead dated `daysAgo` days from "now". */
function lead(daysAgo: number, now: number = Date.now()): { date: string } {
  const ts = now - daysAgo * 24 * 60 * 60 * 1000;
  return { date: new Date(ts).toISOString() };
}

describe("AGE_BUCKETS", () => {
  it("has four buckets", () => {
    expect(AGE_BUCKETS).toHaveLength(4);
  });

  it("last bucket is 60+d with max = null", () => {
    const last = AGE_BUCKETS[AGE_BUCKETS.length - 1];
    expect(last.label).toBe("60+d");
    expect(last.max).toBeNull();
    expect(last.min).toBe(61);
  });
});

describe("computeAgeDistribution", () => {
  // Pin "now" to midnight UTC so bucket boundaries are deterministic
  const NOW = Date.UTC(2026, 2, 31, 0, 0, 0, 0); // 2026-03-31

  function dist(leads: Array<{ date: string }>) {
    return computeAgeDistribution(leads, NOW);
  }

  function count(label: string, result: ReturnType<typeof dist>) {
    return result.find((r) => r.bucket === label)?.count ?? -1;
  }

  // -------------------------------------------------------------------------
  // 0-7d bucket
  // -------------------------------------------------------------------------
  describe("0-7d bucket", () => {
    it("counts leads from today (0 days ago)", () => {
      const result = dist([lead(0, NOW)]);
      expect(count("0-7d", result)).toBe(1);
    });

    it("counts leads from 7 days ago", () => {
      const result = dist([lead(7, NOW)]);
      expect(count("0-7d", result)).toBe(1);
    });

    it("excludes lead from 8 days ago", () => {
      const result = dist([lead(8, NOW)]);
      expect(count("0-7d", result)).toBe(0);
    });

    it("excludes lead from 1 day ago (still counts — 1 is within 0-7)", () => {
      const result = dist([lead(1, NOW)]);
      expect(count("0-7d", result)).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 8-30d bucket
  // -------------------------------------------------------------------------
  describe("8-30d bucket", () => {
    it("counts lead at exactly 8 days ago", () => {
      const result = dist([lead(8, NOW)]);
      expect(count("8-30d", result)).toBe(1);
    });

    it("counts lead at exactly 30 days ago", () => {
      const result = dist([lead(30, NOW)]);
      expect(count("8-30d", result)).toBe(1);
    });

    it("excludes lead at 7 days ago", () => {
      const result = dist([lead(7, NOW)]);
      expect(count("8-30d", result)).toBe(0);
    });

    it("excludes lead at 31 days ago", () => {
      const result = dist([lead(31, NOW)]);
      expect(count("8-30d", result)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 31-60d bucket
  // -------------------------------------------------------------------------
  describe("31-60d bucket", () => {
    it("counts lead at exactly 31 days ago", () => {
      const result = dist([lead(31, NOW)]);
      expect(count("31-60d", result)).toBe(1);
    });

    it("counts lead at exactly 60 days ago", () => {
      const result = dist([lead(60, NOW)]);
      expect(count("31-60d", result)).toBe(1);
    });

    it("excludes lead at 30 days ago", () => {
      const result = dist([lead(30, NOW)]);
      expect(count("31-60d", result)).toBe(0);
    });

    it("excludes lead at 61 days ago", () => {
      const result = dist([lead(61, NOW)]);
      expect(count("31-60d", result)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 60+d (stale) bucket — the bug fix
  // -------------------------------------------------------------------------
  describe("60+d stale bucket", () => {
    it("counts lead at exactly 61 days ago", () => {
      const result = dist([lead(61, NOW)]);
      expect(count("60+d", result)).toBe(1);
    });

    it("counts lead at 90 days ago", () => {
      const result = dist([lead(90, NOW)]);
      expect(count("60+d", result)).toBe(1);
    });

    it("counts lead at 365 days ago", () => {
      const result = dist([lead(365, NOW)]);
      expect(count("60+d", result)).toBe(1);
    });

    it("excludes lead at exactly 60 days ago", () => {
      const result = dist([lead(60, NOW)]);
      expect(count("60+d", result)).toBe(0);
    });

    it("excludes lead from today", () => {
      const result = dist([lead(0, NOW)]);
      expect(count("60+d", result)).toBe(0);
    });

    it("excludes lead from 7 days ago", () => {
      const result = dist([lead(7, NOW)]);
      expect(count("60+d", result)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Bucket completeness: every lead falls into exactly one bucket
  // -------------------------------------------------------------------------
  describe("bucket completeness", () => {
    it("all 0-day leads are in 0-7d", () => {
      const result = dist([lead(0, NOW)]);
      expect(count("0-7d", result)).toBe(1);
      expect(count("8-30d", result)).toBe(0);
      expect(count("31-60d", result)).toBe(0);
      expect(count("60+d", result)).toBe(0);
    });

    it("all 15-day leads are in 8-30d", () => {
      const result = dist([lead(15, NOW)]);
      expect(count("0-7d", result)).toBe(0);
      expect(count("8-30d", result)).toBe(1);
      expect(count("31-60d", result)).toBe(0);
      expect(count("60+d", result)).toBe(0);
    });

    it("all 45-day leads are in 31-60d", () => {
      const result = dist([lead(45, NOW)]);
      expect(count("0-7d", result)).toBe(0);
      expect(count("8-30d", result)).toBe(0);
      expect(count("31-60d", result)).toBe(1);
      expect(count("60+d", result)).toBe(0);
    });

    it("all 100-day leads are in 60+d", () => {
      const result = dist([lead(100, NOW)]);
      expect(count("0-7d", result)).toBe(0);
      expect(count("8-30d", result)).toBe(0);
      expect(count("31-60d", result)).toBe(0);
      expect(count("60+d", result)).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple leads
  // -------------------------------------------------------------------------
  describe("multiple leads", () => {
    it("distributes 10 mixed-age leads correctly", () => {
      // 3 in 0-7d, 4 in 8-30d, 2 in 31-60d, 1 in 60+d
      const leads = [
        lead(0, NOW), lead(3, NOW), lead(6, NOW),       // 0-7d
        lead(10, NOW), lead(15, NOW), lead(22, NOW), lead(28, NOW), // 8-30d
        lead(35, NOW), lead(55, NOW),                   // 31-60d
        lead(75, NOW),                                    // 60+d
      ];
      const result = dist(leads);
      expect(count("0-7d", result)).toBe(3);
      expect(count("8-30d", result)).toBe(4);
      expect(count("31-60d", result)).toBe(2);
      expect(count("60+d", result)).toBe(1);
    });

    it("all leads from today total to 0-7d", () => {
      const leads = Array.from({ length: 20 }, () => lead(0, NOW));
      const result = dist(leads);
      expect(count("0-7d", result)).toBe(20);
      expect(count("60+d", result)).toBe(0);
    });

    it("all leads 100+ days old total to 60+d", () => {
      const leads = Array.from({ length: 15 }, () => lead(120, NOW));
      const result = dist(leads);
      expect(count("60+d", result)).toBe(15);
      expect(count("0-7d", result)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Empty input
  // -------------------------------------------------------------------------
  it("handles empty array", () => {
    const result = dist([]);
    expect(result).toHaveLength(4);
    for (const r of result) {
      expect(r.count).toBe(0);
    }
  });
});
