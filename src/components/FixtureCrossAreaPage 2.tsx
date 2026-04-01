/**
 * Cross-area validation fixture page — /fixtures/cross-area
 *
 * Isolated validation surface for VAL-CROSS-002, VAL-CROSS-003, and VAL-CROSS-004.
 *
 * VAL-CROSS-002: Shows an enriched lead with EV factor, homestead badge/signal,
 *   and enriched outreach content visible in the drawer/popover.
 *
 * VAL-CROSS-003: Multiple selectable insurer values exercise search + status +
 *   insurer + sort + pagination on desktop.
 *
 * VAL-CROSS-004: The same composed filter behavior is exercisable on mobile viewport.
 *
 * This page does NOT mutate committed production data files. It uses only
 * static fixture data from fixtureCrossArea.ts.
 */
import { useState } from "react";
import { Shield } from "lucide-react";
import type { Lead } from "@/types";
import { fixtureCrossAreaLeads } from "@/data/fixtureCrossArea";
import FilterBar from "@/components/FilterBar";
import LeadsTable from "@/components/LeadsTable";
import LeadDrawer from "@/components/LeadDrawer";
import type { FilterState } from "@/types";

const FIXTURE_FILTERS: FilterState = {
  zip: "",
  damageType: "All",
  scoreTier: "All",
  dateRange: "all",
  sortOrder: "newest",
  search: "",
  hasContact: false,
  absenteeOwner: false,
  underpaid: false,
  noContractor: false,
  stormFirst: false,
  county: "All",
  statusFilter: "All",
  insurerFilter: "",
  femaFilter: "All",
};

const AVAILABLE_INSURERS = [
  "Bankers Insurance Group",
  "Citizens Property Insurance",
  "Florida Peninsula Insurance",
  "People's Trust Insurance",
  "Tower Hill Prime Insurance",
  "Universal Property & Casualty",
];

function useFixtureTracking() {
  return {
    trackingMap: new Map<string, never>(),
    saveTracking: (_id: string, _patch: never) => {},
    readOnly: true,
  };
}

export default function FixtureCrossAreaPage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const [filters, setFilters] = useState<FilterState>(FIXTURE_FILTERS);
  const { readOnly: leadReadOnly } = useFixtureTracking();

  // ── Client-side filtering & sorting (mirrors App.tsx logic) ────────────────
  const filteredLeads = fixtureCrossAreaLeads
    .filter((lead) => {
      // Status filter
      if (filters.statusFilter !== "All" && lead.status !== filters.statusFilter)
        return false;
      // Insurer filter
      if (filters.insurerFilter && lead.insuranceCompany !== filters.insurerFilter)
        return false;
      // Text search
      if (filters.search) {
        const term = filters.search.toLowerCase();
        if (
          !lead.ownerName.toLowerCase().includes(term) &&
          !lead.propertyAddress.toLowerCase().includes(term) &&
          !lead.folioNumber.toLowerCase().includes(term)
        )
          return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (filters.sortOrder) {
        case "score":
          return (b.score ?? 0) - (a.score ?? 0);
        case "assessedValue":
          return (b.assessedValue ?? 0) - (a.assessedValue ?? 0);
        case "permitValue":
          return (b.permitValue ?? 0) - (a.permitValue ?? 0);
        case "oldest":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "newest":
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Minimal header so agent-browser can orient */}
      <div className="bg-[#0f0f11] border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
        <Shield className="w-5 h-5 text-amber-400" />
        <span className="text-sm font-semibold text-white">
          Validation Fixture — Cross-Area Filters
        </span>
        <span className="ml-auto text-xs text-zinc-600 font-mono">
          /fixtures/cross-area
        </span>
      </div>

      {/* Instructional banner */}
      <div className="max-w-5xl mx-auto mt-6 px-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">
            Validation Fixture — Cross-Area Filter Validation
          </p>
          <p className="text-amber-700 mb-3">
            This page loads <strong>57 enriched fixture leads</strong> with EV
            factor, homestead signal, and enriched outreach visible in the drawer.
            Use this surface to exercise all filter combinations, sort, and
            pagination on desktop and mobile.
          </p>
          <div className="grid grid-cols-3 gap-3 text-xs text-amber-800">
            <div className="bg-amber-100/60 rounded-lg p-2">
              <p className="font-semibold">VAL-CROSS-002</p>
              <p className="text-amber-700 mt-0.5">
                Enriched lead with EV factor, homestead badge, and outreach
              </p>
            </div>
            <div className="bg-amber-100/60 rounded-lg p-2">
              <p className="font-semibold">VAL-CROSS-003</p>
              <p className="text-amber-700 mt-0.5">
                6 insurers, status, sort, pagination — page 2 reachable with 25-row page size
              </p>
            </div>
            <div className="bg-amber-100/60 rounded-lg p-2">
              <p className="font-semibold">VAL-CROSS-004</p>
              <p className="text-amber-700 mt-0.5">
                Same filters work on mobile viewport (375×812)
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-amber-800">
            <div className="bg-amber-100/60 rounded-lg p-2">
              <p className="font-semibold">Insurers available</p>
              <p className="text-amber-700 mt-0.5">
                Citizens, Universal Peninsula, Florida Peninsula, Tower Hill,
                Bankers, People's Trust
              </p>
            </div>
            <div className="bg-amber-100/60 rounded-lg p-2">
              <p className="font-semibold">Statuses available</p>
              <p className="text-amber-700 mt-0.5">
                New, Contacted, Converted — mix of all three
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fixture lead list with filter bar */}
      <div className="max-w-7xl mx-auto mt-6 px-6 pb-12">
        <FilterBar
          filters={filters}
          onChange={(f) => {
            setFilters(f);
            setCurrentPage(1); // reset pagination on filter change
          }}
          onClear={() => {
            setFilters(FIXTURE_FILTERS);
            setCurrentPage(1);
          }}
          availableInsurers={AVAILABLE_INSURERS}
        />

        <div className="mt-4">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 bg-white rounded-lg border border-zinc-100">
              <p className="text-sm font-medium">No leads match your current filters</p>
              <p className="text-xs mt-1 text-zinc-400">
                Try adjusting or clearing your filters to see more results.
              </p>
            </div>
          ) : (
            <LeadsTable
              leads={paginatedLeads}
              totalLeads={filteredLeads.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={(p) => {
                setCurrentPage(p);
              }}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              onSelectLead={(lead) => setSelectedLead(lead)}
              selectedLeadId={selectedLead?.id}
              loading={false}
            />
          )}
        </div>
      </div>

      {/* LeadDrawer for selected lead */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdateStatus={() => {}}
          onUpdateTracking={() => {}}
          onConvertToCase={() => {}}
          readOnly={leadReadOnly}
        />
      )}
    </div>
  );
}
