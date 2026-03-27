import { useState, useEffect, useCallback } from "react";
import { browserCanWrite, browserReadOnly, supabase } from "@/lib/supabase";
import type { StormTrackingRecord } from "@/lib/supabase";
import type { StormCandidate } from "@/types";

type StormTrackingPatch = Partial<
  Pick<
    StormCandidate,
    "status" | "notes" | "contactedAt" | "permitFiledAt" | "closedAt"
  >
>;

export function useStormTracking() {
  const [trackingMap, setTrackingMap] = useState<
    Map<string, StormTrackingRecord>
  >(new Map());

  useEffect(() => {
    if (!supabase) return;

    supabase
      .from("storm_tracking")
      .select("*")
      .then(({ data, error }) => {
        if (error) {
          console.warn(
            "[storm-tracking] Failed to load tracking data:",
            error.message,
          );
          return;
        }

        const map = new Map<string, StormTrackingRecord>();
        for (const row of data ?? []) {
          map.set(row.candidate_id, row as StormTrackingRecord);
        }
        setTrackingMap(map);
      });
  }, []);

  const saveTracking = useCallback(
    async (candidateId: string, patch: StormTrackingPatch) => {
      if (!browserCanWrite || !supabase) return false;

      const dbPatch: Partial<StormTrackingRecord> & { candidate_id: string } = {
        candidate_id: candidateId,
      };

      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes ?? null;
      if (patch.contactedAt !== undefined)
        dbPatch.contacted_at = patch.contactedAt ?? null;
      if (patch.permitFiledAt !== undefined)
        dbPatch.permit_filed_at = patch.permitFiledAt ?? null;
      if (patch.closedAt !== undefined)
        dbPatch.closed_at = patch.closedAt ?? null;

      setTrackingMap((prev) => {
        const next = new Map(prev);
        const existing = prev.get(candidateId);
        next.set(candidateId, {
          candidate_id: candidateId,
          status: dbPatch.status ?? existing?.status ?? "Watching",
          notes:
            dbPatch.notes !== undefined
              ? dbPatch.notes
              : (existing?.notes ?? null),
          contacted_at:
            dbPatch.contacted_at !== undefined
              ? dbPatch.contacted_at
              : (existing?.contacted_at ?? null),
          permit_filed_at:
            dbPatch.permit_filed_at !== undefined
              ? dbPatch.permit_filed_at
              : (existing?.permit_filed_at ?? null),
          closed_at:
            dbPatch.closed_at !== undefined
              ? dbPatch.closed_at
              : (existing?.closed_at ?? null),
          updated_at: new Date().toISOString(),
        });
        return next;
      });

      const { error } = await supabase
        .from("storm_tracking")
        .upsert(dbPatch, { onConflict: "candidate_id" });

      if (error) {
        console.warn(
          "[storm-tracking] Failed to save tracking:",
          error.message,
        );
        const { data } = await supabase
          .from("storm_tracking")
          .select("*")
          .eq("candidate_id", candidateId)
          .single();

        if (data) {
          setTrackingMap((prev) => {
            const next = new Map(prev);
            next.set(candidateId, data as StormTrackingRecord);
            return next;
          });
        }
        return false;
      }
      return true;
    },
    [],
  );

  return { trackingMap, saveTracking, readOnly: browserReadOnly };
}
