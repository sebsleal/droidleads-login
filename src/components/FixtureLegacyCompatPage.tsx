/**
 * Validation fixture page — /fixtures/legacy-compat
 *
 * Isolated validation environment for VAL-CROSS-006 backward-compat verification.
 * Loads pre-seeded legacy leads that predate the EV/scoreBreakdown feature.
 *
 * This page demonstrates that the dashboard renders gracefully when leads lack
 * scoreBreakdown or the EV factor, satisfying the browser-facing assertion:
 * "Leads from leads.json that predate the upgrade (no EV score, no scoreBreakdown
 * EV factor) render in dashboard without errors. Missing scoreBreakdown shows
 * graceful fallback in popover."
 *
 * Key scenarios tested here:
 * - Leads without scoreBreakdown field
 * - Leads with scoreBreakdown but without EV factor
 * - Various other optional fields missing (homestead, assessedValue, contact, etc.)
 */
import { useState } from "react";
import { Shield } from "lucide-react";
import {
  legacyLeadsWithoutBreakdown,
  legacyLeadWithBreakdownNoEV,
} from "@/data/fixtureLegacyCompat";
import type { Lead } from "@/types";
import LeadsTable from "@/components/LeadsTable";
import LeadDrawer from "@/components/LeadDrawer";

function useFixtureTracking() {
  return {
    trackingMap: new Map<string, never>(),
    saveTracking: (_id: string, _patch: never) => {},
    readOnly: true,
  };
}

export default function FixtureLegacyCompatPage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const { readOnly: leadReadOnly } = useFixtureTracking();

  // Combine all legacy fixtures: leads without breakdown + lead with breakdown but no EV
  const fixtureLeads: Lead[] = [
    ...legacyLeadsWithoutBreakdown,
    legacyLeadWithBreakdownNoEV,
  ];

  function handleSelectLead(lead: Lead) {
    setSelectedLead(lead);
  }

  function handleCloseDrawer() {
    setSelectedLead(null);
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Minimal header so agent-browser can orient */}
      <div className="bg-[#0f0f11] border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
        <Shield className="w-5 h-5 text-amber-400" />
        <span className="text-sm font-semibold text-white">
          Validation Fixture — Legacy Backward-Compat
        </span>
        <span className="ml-auto text-xs text-zinc-600 font-mono">
          /fixtures/legacy-compat
        </span>
      </div>

      {/* Instructional banner */}
      <div className="max-w-3xl mx-auto mt-6 px-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Validation Fixture — VAL-CROSS-006 Backward Compatibility</p>
          <p className="text-amber-700">
            This page loads <strong>6 legacy leads</strong> that predate the scoring upgrade.
            These leads have no <code className="bg-amber-100 px-1 rounded">scoreBreakdown</code>{" "}
            field, or have a breakdown without the EV factor. The dashboard should render
            them without console errors, and the score popover should show a graceful fallback
            message when EV data is unavailable.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-amber-800">
            <div className="bg-amber-100/60 rounded-lg p-2">
              <p className="font-semibold">Without breakdown</p>
              <p className="text-amber-700 mt-0.5">5 leads with no scoreBreakdown field</p>
            </div>
            <div className="bg-amber-100/60 rounded-lg p-2">
              <p className="font-semibold">Without EV factor</p>
              <p className="text-amber-700 mt-0.5">1 lead with breakdown but no EV factor</p>
            </div>
            <div className="bg-amber-100/60 rounded-lg p-2">
              <p className="font-semibold">Score popover</p>
              <p className="text-amber-700 mt-0.5">Shows fallback when no breakdown/EV</p>
            </div>
          </div>
        </div>
      </div>

      {/* Fixture lead list */}
      <div className="max-w-7xl mx-auto mt-6 px-6 pb-12">
        <LeadsTable
          leads={fixtureLeads}
          totalLeads={fixtureLeads.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          onSelectLead={handleSelectLead}
          selectedLeadId={selectedLead?.id}
          loading={false}
        />
      </div>

      {/* LeadDrawer for selected legacy lead */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={handleCloseDrawer}
          onUpdateStatus={() => {}}
          onUpdateTracking={() => {}}
          onConvertToCase={() => {}}
          readOnly={leadReadOnly}
        />
      )}
    </div>
  );
}
