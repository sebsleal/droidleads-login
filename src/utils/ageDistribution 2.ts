/**
 * Pure utility for computing lead-age distribution buckets.
 * Exported solely for deterministic unit testing — the same logic is
 * inlined in Analytics.tsx for the runtime chart.
 *
 * Bucket semantics (exclusive upper bound, no overlaps):
 *   [0-7d]   →  0 days ago ≤ daysAgo ≤  7 days ago
 *   [8-30d]  →  8 days ago ≤ daysAgo ≤ 30 days ago
 *   [31-60d] → 31 days ago ≤ daysAgo ≤ 60 days ago
 *   [60+d]   → 61 days ago ≤ daysAgo            (stale, open-ended)
 *
 * The stale bucket (60+d) was previously implemented with `Infinity`,
 * which produced `cutoff = now - Infinity = -Infinity` and the filter
 * `d <= -Infinity` was always false — the bucket always returned 0.
 * The fix replaces `max: Infinity` with `max: null` and routes through an
 * explicit stale-lead branch that computes a real timestamp cutoff.
 */

export interface AgeBucket {
  label: string;
  min: number; // inclusive lower bound in days
  /** Inclusive upper bound in days, or null for the open-ended 60+d stale bucket */
  max: number | null;
}

export const AGE_BUCKETS: AgeBucket[] = [
  { label: "0-7d", min: 0, max: 7 },
  { label: "8-30d", min: 8, max: 30 },
  { label: "31-60d", min: 31, max: 60 },
  // max = null is the sentinel for the open-ended stale bucket (61+ days)
  // Previously used max: Infinity which broke bucket arithmetic (cutoff = -Infinity)
  { label: "60+d", min: 61, max: null },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AgeBucketResult {
  bucket: string;
  count: number;
}

/**
 * Returns the count of leads in each age bucket.
 *
 * For bounded buckets (0-7d, 8-30d, 31-60d):
 *   cutoffMax = now - max * MS_PER_DAY   (older boundary — newer leads are AFTER this)
 *   cutoffMin = now - (min-1) * MS_PER_DAY (newer boundary — older leads are BEFORE this)
 *   A lead ts is in the bucket when: cutoffMax ≤ ts ≤ cutoffMin
 *
 * For the open-ended stale bucket (60+d, max = null):
 *   staleCutoff = now - 61 * MS_PER_DAY
 *   A lead is stale when: ts ≤ staleCutoff  (61 or more days old)
 *   This replaces the buggy Infinity arithmetic that produced -Infinity.
 */
export function computeAgeDistribution(
  leads: Array<{ date: string }>,
  now: number = Date.now(),
): AgeBucketResult[] {
  return AGE_BUCKETS.map((bucket) => {
    let count: number;

    if (bucket.max === null) {
      // ── Stale-lead branch: 61+ days ──────────────────────────────────
      // Fix: explicitly check daysAgo >= 61 instead of Infinity arithmetic.
      //   daysAgo >= 61  ⟺  ts = now - daysAgo*MS ≤ now - 61*MS = staleCutoff
      const staleCutoff = now - 61 * MS_PER_DAY;
      count = leads.filter((l) => new Date(l.date).getTime() <= staleCutoff).length;
    } else {
      // ── Bounded bucket ────────────────────────────────────────────────
      const cutoffMax = now - bucket.max * MS_PER_DAY;       // older boundary
      const cutoffMin = now - (bucket.min - 1) * MS_PER_DAY; // newer boundary
      count = leads.filter((l) => {
        const ts = new Date(l.date).getTime();
        // The 0-7d bucket (min=0) is inclusive on both ends.
        // All other bounded buckets use an exclusive upper bound to avoid
        // off-by-one overlaps at bucket boundaries (e.g. day-7 in both 0-7d and 8-30d).
        if (bucket.min === 0) {
          return ts >= cutoffMax && ts <= cutoffMin;
        }
        return ts >= cutoffMax && ts < cutoffMin;
      }).length;
    }

    return { bucket: bucket.label, count };
  });
}

