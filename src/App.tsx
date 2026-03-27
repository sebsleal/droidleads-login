import { useState, useMemo, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { BarChart2, Users, CloudLightning, Briefcase } from "lucide-react";
import type {
  FilterState,
  Lead,
  StormCandidate,
  StormFilterState,
  Case,
  CaseFilterState,
} from "@/types";
import {
  downloadCSV,
  downloadStormCandidatesCSV,
  isWithinDays,
} from "@/lib/utils";
import { useTracking } from "@/lib/useTracking";
import { useStormTracking } from "@/lib/useStormTracking";
import { useCases } from "@/lib/useCases";
import Header from "@/components/Header";
import StatsRow from "@/components/StatsRow";
import FilterBar from "@/components/FilterBar";
import LeadsTable from "@/components/LeadsTable";
import LeadDrawer from "@/components/LeadDrawer";
import Analytics from "@/components/Analytics";
import StormWatchFilters from "@/components/StormWatchFilters";
import Tooltip from "@/components/Tooltip";
import StormWatchStatsRow from "@/components/StormWatchStatsRow";
import StormWatchTable from "@/components/StormWatchTable";
import StormWatchDrawer from "@/components/StormWatchDrawer";
import CasesTable from "@/components/CasesTable";
import CaseFilterBar from "@/components/CaseFilterBar";
import CaseDrawer from "@/components/CaseDrawer";

const DEFAULT_FILTERS: FilterState = {
  zip: "",
  damageType: "All",
  scoreTier: "All",
  dateRange: "all",
  hasContact: false,
  absenteeOwner: false,
  underpaid: false,
  noContractor: false,
  stormFirst: false,
  county: "All",
};

const DEFAULT_STORM_FILTERS: StormFilterState = {
  county: "All",
  eventType: "All",
  femaTagged: "All",
  scoreTier: "All",
  dateRange: "all",
  candidateType: "All",
};

const DEFAULT_CASE_FILTERS: CaseFilterState = {
  search: "",
  statusGroup: "All",
  insuranceCompany: "",
  perilType: "",
  dateRange: "all",
};

export default function App() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [stormFilters, setStormFilters] = useState<StormFilterState>(
    DEFAULT_STORM_FILTERS,
  );
  const [caseFilters, setCaseFilters] =
    useState<CaseFilterState>(DEFAULT_CASE_FILTERS);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedStormCandidate, setSelectedStormCandidate] =
    useState<StormCandidate | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [rawLeads, setRawLeads] = useState<Lead[]>([]);
  const [rawStormCandidates, setRawStormCandidates] = useState<
    StormCandidate[]
  >([]);
  const [lastScraped, setLastScraped] = useState<string | null>(null);
  const [lastStormGenerated, setLastStormGenerated] = useState<string | null>(
    null,
  );

  const { trackingMap, saveTracking, readOnly: leadsReadOnly } = useTracking();
  const {
    trackingMap: stormTrackingMap,
    saveTracking: saveStormTracking,
    readOnly: stormReadOnly,
  } = useStormTracking();
  const { cases, saveCase, readOnly: casesReadOnly } = useCases();

  const navigate = useNavigate();
  const location = useLocation();
  const activeTab =
    location.pathname === "/analytics"
      ? "analytics"
      : location.pathname === "/storm-watch"
        ? "storm-watch"
        : location.pathname === "/cases"
          ? "cases"
          : "leads";

  useEffect(() => {
    const cacheBust = Date.now();
    fetch(`/leads.json?_=${cacheBust}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("no leads.json");
        return response.json();
      })
      .then((data: { leads: Lead[]; lastScraped: string }) => {
        if (data.leads?.length > 0) {
          setRawLeads(data.leads);
          setLastScraped(data.lastScraped);
        }
      })
      .catch(() => {
        // No leads.json available.
      });
  }, []);

  useEffect(() => {
    const cacheBust = Date.now();
    fetch(`/storm_candidates.json?_=${cacheBust}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("no storm_candidates.json");
        return response.json();
      })
      .then((data: { candidates: StormCandidate[]; lastGenerated: string }) => {
        if (Array.isArray(data.candidates)) {
          setRawStormCandidates(data.candidates);
          setLastStormGenerated(data.lastGenerated);
        }
      })
      .catch(() => {
        // No storm_candidates.json available.
      });
  }, []);

  useEffect(() => {
    setSelectedLead(null);
    setSelectedStormCandidate(null);
    setSelectedCase(null);
  }, [location.pathname]);

  const leads = useMemo(() => {
    if (trackingMap.size === 0) return rawLeads;
    return rawLeads.map((lead) => {
      const tracking = trackingMap.get(lead.id);
      if (!tracking) return lead;
      return {
        ...lead,
        status: tracking.status,
        contactedAt: tracking.contacted_at ?? undefined,
        convertedAt: tracking.converted_at ?? undefined,
        claimValue: tracking.claim_value ?? undefined,
        contactMethod: tracking.contact_method ?? undefined,
        notes: tracking.notes ?? undefined,
      };
    });
  }, [rawLeads, trackingMap]);

  const stormCandidates = useMemo(() => {
    if (stormTrackingMap.size === 0) return rawStormCandidates;
    return rawStormCandidates.map((candidate) => {
      const tracking = stormTrackingMap.get(candidate.id);
      if (!tracking) return candidate;
      return {
        ...candidate,
        status: tracking.status,
        notes: tracking.notes ?? candidate.notes,
        contactedAt: tracking.contacted_at ?? undefined,
        permitFiledAt: tracking.permit_filed_at ?? undefined,
        closedAt: tracking.closed_at ?? undefined,
      };
    });
  }, [rawStormCandidates, stormTrackingMap]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filters.zip && !lead.zip.includes(filters.zip)) return false;
      if (
        filters.damageType !== "All" &&
        lead.damageType !== filters.damageType
      )
        return false;
      if (filters.hasContact && !lead.contact) return false;

      if (filters.scoreTier !== "All") {
        if (filters.scoreTier === "High" && lead.score < 85) return false;
        if (
          filters.scoreTier === "Medium" &&
          (lead.score < 70 || lead.score >= 85)
        )
          return false;
        if (filters.scoreTier === "Low" && lead.score >= 70) return false;
      }

      if (filters.dateRange !== "all") {
        const days = parseInt(filters.dateRange, 10);
        if (!isWithinDays(lead.date, days)) return false;
      }

      if (filters.absenteeOwner && !lead.absenteeOwner) return false;
      if (filters.underpaid && !lead.underpaidFlag) return false;
      if (
        filters.noContractor &&
        lead.permitStatus !== "No Contractor" &&
        lead.permitStatus !== "Owner-Builder"
      )
        return false;
      if (filters.stormFirst && lead.sourceDetail !== "storm_first")
        return false;
      if (
        filters.county !== "All" &&
        (lead.county ?? "miami-dade") !== filters.county
      )
        return false;

      return true;
    });
  }, [leads, filters]);

  const stormEventTypes = useMemo(
    () =>
      Array.from(
        new Set(stormCandidates.map((candidate) => candidate.eventType)),
      ).sort(),
    [stormCandidates],
  );

  const filteredStormCandidates = useMemo(() => {
    return stormCandidates.filter((candidate) => {
      if (
        stormFilters.county !== "All" &&
        candidate.county !== stormFilters.county
      )
        return false;
      if (
        stormFilters.eventType !== "All" &&
        candidate.eventType !== stormFilters.eventType
      )
        return false;
      if (
        stormFilters.femaTagged === "Tagged" &&
        !candidate.femaDeclarationNumber
      )
        return false;
      if (
        stormFilters.femaTagged === "Untagged" &&
        candidate.femaDeclarationNumber
      )
        return false;

      if (stormFilters.scoreTier !== "All") {
        if (stormFilters.scoreTier === "High" && candidate.score < 85)
          return false;
        if (
          stormFilters.scoreTier === "Medium" &&
          (candidate.score < 70 || candidate.score >= 85)
        )
          return false;
        if (stormFilters.scoreTier === "Low" && candidate.score >= 70)
          return false;
      }

      if (stormFilters.dateRange !== "all") {
        const days = parseInt(stormFilters.dateRange, 10);
        if (!isWithinDays(candidate.eventDate, days)) return false;
      }

      if (
        stormFilters.candidateType !== "All" &&
        candidate.candidateType !== stormFilters.candidateType
      )
        return false;

      return true;
    });
  }, [stormCandidates, stormFilters]);

  // Case filter options derived from loaded data
  const availableInsurers = useMemo(
    () =>
      Array.from(
        new Set(
          cases.map((c) => c.insuranceCompany).filter(Boolean) as string[],
        ),
      ).sort(),
    [cases],
  );
  const availablePerils = useMemo(
    () =>
      Array.from(
        new Set(cases.map((c) => c.perilType).filter(Boolean) as string[]),
      ).sort(),
    [cases],
  );

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Search
      if (caseFilters.search) {
        const q = caseFilters.search.toLowerCase();
        if (
          !c.clientName.toLowerCase().includes(q) &&
          !c.lossAddress.toLowerCase().includes(q)
        )
          return false;
      }

      // Status group
      if (caseFilters.statusGroup !== "All") {
        if (
          caseFilters.statusGroup === "Open" &&
          !c.statusPhase.startsWith("OpenPhase:")
        )
          return false;
        if (
          caseFilters.statusGroup === "Settled" &&
          c.statusPhase !== "Settled"
        )
          return false;
        if (
          caseFilters.statusGroup === "Litigation" &&
          c.statusPhase !== "Litigation"
        )
          return false;
        if (
          caseFilters.statusGroup === "Closed" &&
          c.statusPhase !== "Closed w/o Pay"
        )
          return false;
      }

      // Insurance company
      if (
        caseFilters.insuranceCompany &&
        c.insuranceCompany !== caseFilters.insuranceCompany
      )
        return false;

      // Peril type
      if (caseFilters.perilType && c.perilType !== caseFilters.perilType)
        return false;

      // Date range (based on date_logged)
      if (caseFilters.dateRange !== "all") {
        const days = parseInt(caseFilters.dateRange, 10);
        if (!isWithinDays(c.dateLogged, days)) return false;
      }

      return true;
    });
  }, [cases, caseFilters]);

  // Keep selectedCase in sync with cases data (e.g. after saveCase)
  const syncedSelectedCase = useMemo(() => {
    if (!selectedCase) return null;
    return cases.find((c) => c.id === selectedCase.id) ?? selectedCase;
  }, [selectedCase, cases]);

  const leadStats = useMemo(
    () => ({
      totalLeads: leads.length,
      highPriority: leads.filter((lead) => lead.score >= 85).length,
      absenteeOwners: leads.filter((lead) => lead.absenteeOwner).length,
      underpaidFlags: leads.filter((lead) => lead.underpaidFlag).length,
    }),
    [leads],
  );

  const stormStats = useMemo(
    () => ({
      totalCandidates: stormCandidates.length,
      highPriority: stormCandidates.filter((candidate) => candidate.score >= 85)
        .length,
      femaTagged: stormCandidates.filter(
        (candidate) => candidate.femaDeclarationNumber,
      ).length,
      areaCandidates: stormCandidates.filter(
        (candidate) => candidate.candidateType === "area",
      ).length,
    }),
    [stormCandidates],
  );

  function handleUpdateStatus(id: string, status: Lead["status"]) {
    const nowIso = new Date().toISOString();
    const current = leads.find((lead) => lead.id === id);
    const patch: Parameters<typeof saveTracking>[1] = { status };

    if (status === "Contacted" && !current?.contactedAt)
      patch.contactedAt = nowIso;
    if (status === "Converted" && !current?.convertedAt)
      patch.convertedAt = nowIso;

    saveTracking(id, patch);

    if (selectedLead?.id === id) {
      setSelectedLead((previous) => {
        if (!previous) return null;
        const next: Lead = { ...previous, status };
        if (patch.contactedAt) next.contactedAt = patch.contactedAt;
        if (patch.convertedAt) next.convertedAt = patch.convertedAt;
        return next;
      });
    }
  }

  function handleUpdateTracking(
    id: string,
    patch: Parameters<typeof saveTracking>[1],
  ) {
    saveTracking(id, patch);
    if (selectedLead?.id === id) {
      setSelectedLead((previous) =>
        previous ? { ...previous, ...patch } : null,
      );
    }
  }

  function handleUpdateStormStatus(
    id: string,
    status: StormCandidate["status"],
  ) {
    const nowIso = new Date().toISOString();
    const current = stormCandidates.find((candidate) => candidate.id === id);
    const patch: Parameters<typeof saveStormTracking>[1] = { status };

    if (status === "Contacted" && !current?.contactedAt)
      patch.contactedAt = nowIso;
    if (status === "Permit Filed" && !current?.permitFiledAt)
      patch.permitFiledAt = nowIso;
    if (status === "Closed" && !current?.closedAt) patch.closedAt = nowIso;

    saveStormTracking(id, patch);

    if (selectedStormCandidate?.id === id) {
      setSelectedStormCandidate((previous) =>
        previous ? { ...previous, ...patch } : null,
      );
    }
  }

  function handleUpdateStormTracking(
    id: string,
    patch: Parameters<typeof saveStormTracking>[1],
  ) {
    saveStormTracking(id, patch);
    if (selectedStormCandidate?.id === id) {
      setSelectedStormCandidate((previous) =>
        previous ? { ...previous, ...patch } : null,
      );
    }
  }

  const headerTotalCount =
    activeTab === "storm-watch"
      ? stormCandidates.length
      : activeTab === "cases"
        ? cases.length
        : leads.length;
  const headerLastUpdated =
    activeTab === "storm-watch" ? lastStormGenerated : lastScraped;
  const headerExport =
    activeTab === "storm-watch"
      ? () => downloadStormCandidatesCSV(filteredStormCandidates)
      : activeTab === "cases"
        ? undefined
        : () => downloadCSV(filteredLeads);
  const headerEntityLabel =
    activeTab === "storm-watch"
      ? "storm candidates"
      : activeTab === "cases"
        ? "cases"
        : "leads";

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Header
        totalCount={headerTotalCount}
        lastScraped={headerLastUpdated}
        onExport={headerExport}
        entityLabel={headerEntityLabel}
      />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="py-6">
          {activeTab === "storm-watch" ? (
            <StormWatchStatsRow stats={stormStats} />
          ) : activeTab === "cases" ? null : (
            <StatsRow stats={leadStats} />
          )}
        </div>

        <div className="flex gap-1 mb-6 border-b border-slate-200">
          <Tooltip
            text="Your permit-based lead list — property owners who recently filed damage permits and may need a licensed public adjuster to maximize their insurance settlement."
            position="bottom"
          >
            <button
              onClick={() => navigate("/")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
                activeTab === "leads"
                  ? "border-navy-900 text-navy-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Users className="w-4 h-4" />
              Leads
            </button>
          </Tooltip>
          <Tooltip
            text="Area-level storm opportunities sourced from NOAA storm events and FEMA disaster declarations. Shows counties and zones recently hit by storms — ideal for proactive outreach before permits are even filed."
            position="bottom"
          >
            <button
              onClick={() => navigate("/storm-watch")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
                activeTab === "storm-watch"
                  ? "border-navy-900 text-navy-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <CloudLightning className="w-4 h-4" />
              Storm Watch
            </button>
          </Tooltip>
          <Tooltip
            text="Active client cases imported from your CRM — track claim status, process milestones, fees collected, and timeline for each case."
            position="bottom"
          >
            <button
              onClick={() => navigate("/cases")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
                activeTab === "cases"
                  ? "border-navy-900 text-navy-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Cases
            </button>
          </Tooltip>
          <Tooltip
            text="Pipeline summary — total leads, high-priority count, absentee owners, underpaid flags, and revenue analytics from your closed cases."
            position="bottom"
          >
            <button
              onClick={() => navigate("/analytics")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
                activeTab === "analytics"
                  ? "border-navy-900 text-navy-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              Analytics
            </button>
          </Tooltip>
        </div>

        <Routes>
          <Route
            path="/"
            element={
              <>
                <FilterBar
                  filters={filters}
                  onChange={setFilters}
                  onClear={() => setFilters(DEFAULT_FILTERS)}
                />
                <div className="mt-4">
                  <LeadsTable
                    leads={filteredLeads}
                    onSelectLead={setSelectedLead}
                    selectedLeadId={selectedLead?.id}
                  />
                </div>
              </>
            }
          />
          <Route
            path="/storm-watch"
            element={
              <>
                <StormWatchFilters
                  filters={stormFilters}
                  eventTypes={stormEventTypes}
                  onChange={setStormFilters}
                  onClear={() => setStormFilters(DEFAULT_STORM_FILTERS)}
                />
                <div className="mt-4">
                  <StormWatchTable
                    candidates={filteredStormCandidates}
                    onSelectCandidate={setSelectedStormCandidate}
                    selectedCandidateId={selectedStormCandidate?.id}
                  />
                </div>
              </>
            }
          />
          <Route
            path="/cases"
            element={
              <>
                <CaseFilterBar
                  filters={caseFilters}
                  onChange={setCaseFilters}
                  onClear={() => setCaseFilters(DEFAULT_CASE_FILTERS)}
                  availableInsurers={availableInsurers}
                  availablePerils={availablePerils}
                />
                <div className="mt-4">
                  <CasesTable
                    cases={filteredCases}
                    onSelectCase={setSelectedCase}
                    selectedCaseId={syncedSelectedCase?.id}
                  />
                </div>
              </>
            }
          />
          <Route
            path="/analytics"
            element={<Analytics leads={leads} cases={cases} />}
          />
        </Routes>
      </main>

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdateStatus={handleUpdateStatus}
          onUpdateTracking={handleUpdateTracking}
          readOnly={leadsReadOnly}
        />
      )}

      {selectedStormCandidate && (
        <StormWatchDrawer
          candidate={selectedStormCandidate}
          onClose={() => setSelectedStormCandidate(null)}
          onUpdateStatus={handleUpdateStormStatus}
          onUpdateTracking={handleUpdateStormTracking}
          readOnly={stormReadOnly}
        />
      )}

      {syncedSelectedCase && (
        <CaseDrawer
          kase={syncedSelectedCase}
          onClose={() => setSelectedCase(null)}
          onSave={saveCase}
          readOnly={casesReadOnly}
        />
      )}
    </div>
  );
}
