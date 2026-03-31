import { useState, useEffect, useCallback } from "react";
import { browserCanWrite, browserReadOnly, supabase } from "@/lib/supabase";
import type { CaseRecord } from "@/lib/supabase";
import type { Case, CaseStatusPhase } from "@/types";

type CasePatch = Partial<
  Pick<
    Case,
    | "statusPhase"
    | "feeDisbursed"
    | "estimatedLoss"
    | "feeRate"
    | "lor"
    | "plumbingInvoice"
    | "waterMitigation"
    | "estimateDate"
    | "inspectionDate"
    | "srlDate"
    | "cdl1Date"
    | "cdl2Date"
    | "cdl3Date"
    | "notes"
  >
>;

const MIN_INITIAL_LOADING_MS = 300;

function recordToCase(r: CaseRecord): Case {
  return {
    id: r.id,
    fileNumber: r.file_number,
    clientName: r.client_name,
    lossAddress: r.loss_address,
    mailingAddress: r.mailing_address ?? undefined,
    lossDate: r.loss_date ?? undefined,
    perilType: r.peril_type ?? undefined,
    insuranceCompany: r.insurance_company ?? undefined,
    policyNumber: r.policy_number ?? undefined,
    claimNumber: r.claim_number ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    statusPhase: r.status_phase as CaseStatusPhase,
    feeRate: r.fee_rate ?? undefined,
    feeDisbursed: r.fee_disbursed ?? undefined,
    estimatedLoss: r.estimated_loss ?? undefined,
    dateLogged: r.date_logged,
    lor: r.lor,
    plumbingInvoice: r.plumbing_invoice,
    waterMitigation: r.water_mitigation,
    estimateDate: r.estimate_date ?? undefined,
    inspectionDate: r.inspection_date ?? undefined,
    srlDate: r.srl_date ?? undefined,
    cdl1Date: r.cdl1_date ?? undefined,
    cdl2Date: r.cdl2_date ?? undefined,
    cdl3Date: r.cdl3_date ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function useCases() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all cases on mount
  useEffect(() => {
    let cancelled = false;
    const loadingStart = Date.now();

    const finishLoading = () => {
      const remaining = Math.max(
        0,
        MIN_INITIAL_LOADING_MS - (Date.now() - loadingStart),
      );

      window.setTimeout(() => {
        if (!cancelled) {
          setLoading(false);
        }
      }, remaining);
    };

    if (!supabase) {
      finishLoading();
      return () => {
        cancelled = true;
      };
    }

    supabase
      .from("cases")
      .select("*")
      .order("date_logged", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.warn("[cases] Failed to load cases:", error.message);
          return;
        }

        if (!cancelled) {
          setCases((data ?? []).map((r) => recordToCase(r as CaseRecord)));
        }
      })
      .then(finishLoading, finishLoading);

    return () => {
      cancelled = true;
    };
  }, []);

  // Update a case field. Applies optimistic update immediately, syncs to Supabase.
  const saveCase = useCallback(async (id: string, patch: CasePatch) => {
    if (!browserCanWrite || !supabase) return false;

    // Build DB row from camelCase patch
    const dbPatch: Record<string, unknown> = {};
    if (patch.statusPhase !== undefined)
      dbPatch.status_phase = patch.statusPhase;
    if (patch.feeDisbursed !== undefined)
      dbPatch.fee_disbursed = patch.feeDisbursed ?? null;
    if (patch.estimatedLoss !== undefined)
      dbPatch.estimated_loss = patch.estimatedLoss ?? null;
    if (patch.feeRate !== undefined) dbPatch.fee_rate = patch.feeRate ?? null;
    if (patch.lor !== undefined) dbPatch.lor = patch.lor;
    if (patch.plumbingInvoice !== undefined)
      dbPatch.plumbing_invoice = patch.plumbingInvoice;
    if (patch.waterMitigation !== undefined)
      dbPatch.water_mitigation = patch.waterMitigation;
    if (patch.estimateDate !== undefined)
      dbPatch.estimate_date = patch.estimateDate ?? null;
    if (patch.inspectionDate !== undefined)
      dbPatch.inspection_date = patch.inspectionDate ?? null;
    if (patch.srlDate !== undefined) dbPatch.srl_date = patch.srlDate ?? null;
    if (patch.cdl1Date !== undefined)
      dbPatch.cdl1_date = patch.cdl1Date ?? null;
    if (patch.cdl2Date !== undefined)
      dbPatch.cdl2_date = patch.cdl2Date ?? null;
    if (patch.cdl3Date !== undefined)
      dbPatch.cdl3_date = patch.cdl3Date ?? null;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes ?? null;

    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

    const { error } = await supabase.from("cases").update(dbPatch).eq("id", id);

    if (error) {
      console.warn("[cases] Failed to save case:", error.message);
      // Revert to server state on failure
      const { data } = await supabase
        .from("cases")
        .select("*")
        .eq("id", id)
        .single();
      if (data) {
        setCases((prev) =>
          prev.map((c) => (c.id === id ? recordToCase(data as CaseRecord) : c)),
        );
      }
      return false;
    }
    return true;
  }, []);

  return { cases, saveCase, loading, readOnly: browserReadOnly };
}
