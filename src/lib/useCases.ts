import { useState, useEffect, useCallback } from "react";
import { browserCanWrite, browserReadOnly, supabase } from "@/lib/supabase";
import type { CaseRecord } from "@/lib/supabase";
import type { Case, CaseStatusPhase } from "@/types";
import { getFixtureCases, addFixtureCase, registerCaseStateSetter } from "@/data/fixtureState";

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

  // Register this hook's setter so fixture cases can update it
  useEffect(() => {
    const unregister = registerCaseStateSetter(setCases);
    return unregister;
  }, []);

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
          const realCases = (data ?? []).map((r) => recordToCase(r as CaseRecord));
          const fixtureCases = getFixtureCases();
          setCases([...fixtureCases, ...realCases]);
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

  const createCase = useCallback(async (caseData: {
    clientName: string;
    lossAddress: string;
    mailingAddress?: string;
    lossDate?: string;
    perilType?: string;
    insuranceCompany?: string;
    phone?: string;
    email?: string;
    claimNumber?: string;
    policyNumber?: string;
    estimatedLoss?: number;
    notes?: string;
  }): Promise<Case | null> => {
    const now = new Date().toISOString();
    const fileNumber = `CRA-${Date.now().toString(36).toUpperCase()}`;

    const newCaseRecord: CaseRecord = {
      id: crypto.randomUUID(),
      file_number: fileNumber,
      client_name: caseData.clientName,
      loss_address: caseData.lossAddress,
      mailing_address: caseData.mailingAddress ?? null,
      loss_date: caseData.lossDate ?? null,
      peril_type: caseData.perilType ?? null,
      insurance_company: caseData.insuranceCompany ?? null,
      policy_number: caseData.policyNumber ?? null,
      claim_number: caseData.claimNumber ?? null,
      phone: caseData.phone ?? null,
      email: caseData.email ?? null,
      status_phase: "OpenPhase: Claim Originated",
      fee_rate: null,
      fee_disbursed: null,
      estimated_loss: caseData.estimatedLoss ?? null,
      date_logged: now,
      lor: false,
      plumbing_invoice: false,
      water_mitigation: false,
      estimate_date: null,
      inspection_date: null,
      srl_date: null,
      cdl1_date: null,
      cdl2_date: null,
      cdl3_date: null,
      notes: caseData.notes ?? null,
      created_at: now,
      updated_at: now,
    };

    const newCase = recordToCase(newCaseRecord);

    if (browserCanWrite && supabase) {
      const { error } = await supabase.from("cases").insert(newCaseRecord);
      if (error) {
        console.warn("[cases] Failed to create case:", error.message);
        return null;
      }
    }

    setCases((prev) => [newCase, ...prev]);
    // Also register in fixture state so fixture-created cases are visible
    // across the app without requiring Supabase writes
    addFixtureCase(newCase);
    return newCase;
  }, []);

  return { cases, saveCase, createCase, loading, readOnly: browserReadOnly };
}
