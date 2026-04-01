/**
 * Validation fixture page — /fixtures/convert-case
 *
 * Isolated validation environment for the Convert-to-Case flow.
 * Loads a pre-seeded Converted lead and auto-opens the conversion modal
 * so agent-browser can observe the full flow without touching real data.
 *
 * Uses the real useCases hook so created cases are visible in the
 * shared Cases view after navigation.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { FIXTURE_CONVERSION_LEAD } from "@/data/fixtureConversionLead";
import type { Lead } from "@/types";
import LeadDrawer from "@/components/LeadDrawer";
import ConvertToCaseModal from "@/components/ConvertToCaseModal";
import { useCases } from "@/lib/useCases";

// Replicate minimal tracking stubs so LeadDrawer status buttons don't crash
function useFixtureTracking() {
  return {
    trackingMap: new Map<string, never>(),
    saveTracking: (_id: string, _patch: never) => {},
    readOnly: true,
  };
}

export default function FixtureConversionPage() {
  const navigate = useNavigate();
  const [fixtureLead] = useState<Lead>(FIXTURE_CONVERSION_LEAD);
  const [showModal, setShowModal] = useState(false);
  const { readOnly: leadReadOnly } = useFixtureTracking();
  const { createCase } = useCases();

  // Auto-open the conversion modal after a brief render delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowModal(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  function handleConvertToCase(_lead: Lead) {
    setShowModal(true);
  }

  async function handleCaseCreate(caseData: {
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
  }) {
    setShowModal(false);
    await createCase(caseData);
    setTimeout(() => {
      navigate("/cases");
    }, 500);
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Minimal header so agent-browser can orient */}
      <div className="bg-[#0f0f11] border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
        <Shield className="w-5 h-5 text-amber-400" />
        <span className="text-sm font-semibold text-white">
          Validation Fixture — Convert-to-Case Flow
        </span>
        <span className="ml-auto text-xs text-zinc-600 font-mono">
          /fixtures/convert-case
        </span>
      </div>

      {/* Instructional banner */}
      <div className="max-w-2xl mx-auto mt-8 px-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Validation Fixture — Isolated Environment</p>
          <p className="text-amber-700">
            This page loads a pre-seeded <strong>Converted</strong> lead with id{" "}
            <code className="bg-amber-100 px-1 rounded">fixture-conversion-lead-001</code>.
            The Convert to Case modal will auto-open. The Cases view is reachable via navigation
            after case creation. No real data is modified.
          </p>
        </div>

        {/* Lead info */}
        <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Fixture Lead</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div>
              <span className="font-medium">Owner:</span> {fixtureLead.ownerName}
            </div>
            <div>
              <span className="font-medium">Address:</span>{" "}
              {fixtureLead.propertyAddress}, {fixtureLead.city}
            </div>
            <div>
              <span className="font-medium">Status:</span>{" "}
              <span className="text-emerald-600 font-semibold">{fixtureLead.status}</span>
            </div>
            <div>
              <span className="font-medium">Score:</span> {fixtureLead.score}
            </div>
            <div>
              <span className="font-medium">FEMA:</span>{" "}
              {fixtureLead.femaDeclarationNumber ?? "none"}
            </div>
            <div>
              <span className="font-medium">Insurer:</span>{" "}
              {fixtureLead.insuranceCompany ?? "none"}
            </div>
          </div>
        </div>
      </div>

      {/* LeadDrawer renders the Convert to Case button */}
      <LeadDrawer
        lead={fixtureLead}
        onClose={() => navigate("/")}
        onUpdateStatus={() => {}}
        onUpdateTracking={() => {}}
        onConvertToCase={handleConvertToCase}
        readOnly={leadReadOnly}
      />

      {/* ConvertToCaseModal pre-filled from fixture lead */}
      {showModal && (
        <ConvertToCaseModal
          lead={fixtureLead}
          onClose={() => setShowModal(false)}
          onConvert={handleCaseCreate}
        />
      )}
    </div>
  );
}
