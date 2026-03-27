import { useState, useEffect, useCallback } from "react";
import { browserCanWrite, browserReadOnly, supabase } from "@/lib/supabase";
import type { TrackingRecord } from "@/lib/supabase";
import type { Lead } from "@/types";

type TrackingPatch = Partial<
  Pick<
    Lead,
    | "status"
    | "contactedAt"
    | "convertedAt"
    | "claimValue"
    | "contactMethod"
    | "notes"
  >
>;

export function useTracking() {
  const [trackingMap, setTrackingMap] = useState<Map<string, TrackingRecord>>(
    new Map(),
  );

  useEffect(() => {
    if (!supabase) return;

    supabase
      .from("leads")
      .select(
        "id,status,contacted_at,converted_at,claim_value,contact_method,notes,updated_at",
      )
      .then(({ data, error }) => {
        if (error) {
          console.warn(
            "[tracking] Failed to load tracking data:",
            error.message,
          );
          return;
        }
        const map = new Map<string, TrackingRecord>();
        for (const row of data ?? []) {
          map.set(row.id, row as TrackingRecord);
        }
        setTrackingMap(map);
      });
  }, []);

  const saveTracking = useCallback(
    async (leadId: string, patch: TrackingPatch) => {
      if (!browserCanWrite || !supabase) {
        return false;
      }

      const dbPatch: Partial<TrackingRecord> = {};
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.contactedAt !== undefined)
        dbPatch.contacted_at = patch.contactedAt ?? null;
      if (patch.convertedAt !== undefined)
        dbPatch.converted_at = patch.convertedAt ?? null;
      if (patch.claimValue !== undefined)
        dbPatch.claim_value = patch.claimValue ?? null;
      if (patch.contactMethod !== undefined)
        dbPatch.contact_method = patch.contactMethod ?? null;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes ?? null;

      setTrackingMap((prev) => {
        const next = new Map(prev);
        const existing = prev.get(leadId);
        next.set(leadId, {
          id: leadId,
          status: dbPatch.status ?? existing?.status ?? "New",
          contacted_at:
            dbPatch.contacted_at !== undefined
              ? dbPatch.contacted_at
              : (existing?.contacted_at ?? null),
          converted_at:
            dbPatch.converted_at !== undefined
              ? dbPatch.converted_at
              : (existing?.converted_at ?? null),
          claim_value:
            dbPatch.claim_value !== undefined
              ? dbPatch.claim_value
              : (existing?.claim_value ?? null),
          contact_method:
            dbPatch.contact_method !== undefined
              ? dbPatch.contact_method
              : (existing?.contact_method ?? null),
          notes:
            dbPatch.notes !== undefined
              ? dbPatch.notes
              : (existing?.notes ?? null),
          updated_at: new Date().toISOString(),
        });
        return next;
      });

      const { error } = await supabase
        .from("leads")
        .update(dbPatch)
        .eq("id", leadId);

      if (error) {
        console.warn("[tracking] Failed to save tracking:", error.message);
        const { data } = await supabase
          .from("leads")
          .select(
            "id,status,contacted_at,converted_at,claim_value,contact_method,notes,updated_at",
          )
          .eq("id", leadId)
          .single();
        if (data) {
          setTrackingMap((prev) => {
            const next = new Map(prev);
            next.set(leadId, data as TrackingRecord);
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
