import { useState, useMemo, useEffect, useRef } from "react";
import { Routes, Route, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { BarChart2, Users, CloudLightning, Briefcase, Shield } from "lucide-react";
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
  cn,
} from "@/lib/utils";
import { useTracking } from "@/lib/useTracking";
import { useStormTracking } from "@/lib/useStormTracking";
import { useCases } from "@/lib/useCases";
import type { PageSize } from "@/components/Pagination";
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
import ConvertToCaseModal from "@/components/ConvertToCaseModal";
import FixtureConversionPage from "@/components/FixtureConversionPage";

const DEFAULT_FILTERS: FilterState = {
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

const MIN_INITIAL_LOADING_MS = 300;

// ── URL Param Helpers ────────────────────────────────────────────────────────

function parseUrlParams(
  sp: URLSearchParams,
): {
  filters: FilterState;
  page?: number;
  pageSize?: PageSize;
} {
  const f: FilterState = { ...DEFAULT_FILTERS };

  const search = sp.get("search");
  if (typeof search === "string" && search.trim()) f.search = search.trim();

  const sort = sp.get("sort");
  if (sort === "oldest" || sort === "score" || sort === "assessedValue" || sort === "permitValue")
    f.sortOrder = sort;

  const status = sp.get("status");
  if (status === "New" || status === "Contacted" || status === "Converted" || status === "Closed")
    f.statusFilter = status;

  const insurer = sp.get("insurer");
  if (typeof insurer === "string" && insurer.trim()) f.insurerFilter = insurer.trim();

  const fema = sp.get("fema");
  if (fema === "Tagged" || fema === "Untagged") f.femaFilter = fema;

  const zip = sp.get("zip");
  if (typeof zip === "string" && /^\d{1,5}$/.test(zip)) f.zip = zip;

  const damage = sp.get("damage");
  if (
    damage === "Hurricane/Wind" ||
    damage === "Flood" ||
    damage === "Roof" ||
    damage === "Fire" ||
    damage === "Structural" ||
    damage === "Accidental Discharge"
  )
    f.damageType = damage;

  const tier = sp.get("tier");
  if (tier === "High" || tier === "Medium" || tier === "Low") f.scoreTier = tier;

  const days = sp.get("days");
  if (days === "7" || days === "30" || days === "90") f.dateRange = days;

  const county = sp.get("county");
  if (county === "miami-dade" || county === "broward" || county === "palm-beach") f.county = county;

  if (sp.get("hasContact") === "1") f.hasContact = true;
  if (sp.get("absentee") === "1") f.absenteeOwner = true;
  if (sp.get("underpaid") === "1") f.underpaid = true;
  if (sp.get("noContractor") === "1") f.noContractor = true;
  if (sp.get("stormFirst") === "1") f.stormFirst = true;

  let page: number | undefined;
  const pageStr = sp.get("page");
  if (pageStr) {
    const n = parseInt(pageStr, 10);
    if (!isNaN(n) && n >= 1) page = n;
  }

  let pageSize: PageSize | undefined;
  const sizeStr = sp.get("size");
  if (sizeStr === "25" || sizeStr === "50" || sizeStr === "100") pageSize = Number(sizeStr) as PageSize;

  return { filters: f, page, pageSize };
}

function timeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

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
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [caseToOpen, setCaseToOpen] = useState<Case | null>(null);
  const [rawLeads, setRawLeads] = useState<Lead[]>([]);
  const [rawStormCandidates, setRawStormCandidates] = useState<
    StormCandidate[]
  >([]);
  const [lastScraped, setLastScraped] = useState<string | null>(null);
  const [lastStormGenerated, setLastStormGenerated] = useState<string | null>(
    null,
  );
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isLoadingStorm, setIsLoadingStorm] = useState(true);

  // Pagination state for all three tables
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsPageSize, setLeadsPageSize] = useState<PageSize>(25);
  const [stormPage, setStormPage] = useState(1);
  const [stormPageSize, setStormPageSize] = useState<PageSize>(25);
  const [casesPage, setCasesPage] = useState(1);
  const [casesPageSize, setCasesPageSize] = useState<PageSize>(25);

  const {
    trackingMap,
    saveTracking,
    readOnly: leadReadOnly,
  } = useTracking();
  const {
    trackingMap: stormTrackingMap,
    saveTracking: saveStormTracking,
    readOnly: stormReadOnly,
  } = useStormTracking();
  const { cases, saveCase, createCase, loading: isLoadingCases, readOnly: caseReadOnly } = useCases();

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab =
    location.pathname === "/analytics"
      ? "analytics"
      : location.pathname === "/storm-watch"
        ? "storm-watch"
        : location.pathname === "/cases"
          ? "cases"
          : "leads";

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
          setIsLoadingLeads(false);
        }
      }, remaining);
    };

    const cacheBust = Date.now();
    fetch(`/leads.json?_=${cacheBust}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("no leads.json");
        return response.json();
      })
      .then((data: { leads: Lead[]; lastScraped: string }) => {
        if (!cancelled && data.leads?.length > 0) {
          setRawLeads(data.leads);
          setLastScraped(data.lastScraped);
        }
      })
      .catch(() => {
        // No leads.json available.
      })
      .finally(finishLoading);

    return () => {
      cancelled = true;
    };
  }, []);

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
          setIsLoadingStorm(false);
        }
      }, remaining);
    };

    const cacheBust = Date.now();
    fetch(`/storm_candidates.json?_=${cacheBust}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("no storm_candidates.json");
        return response.json();
      })
      .then((data: { candidates: StormCandidate[]; lastGenerated: string }) => {
        if (!cancelled && Array.isArray(data.candidates)) {
          setRawStormCandidates(data.candidates);
          setLastStormGenerated(data.lastGenerated);
        }
      })
      .catch(() => {
        // No storm_candidates.json available.
      })
      .finally(finishLoading);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedLead(null);
    setSelectedStormCandidate(null);
    setSelectedCase(null);
  }, [location.pathname]);

  // ── URL State Sync ──────────────────────────────────────────────────────────
  // Track the last search params string we set ourselves (to skip self-triggered syncs).
  const lastParamsRef = useRef<string>("");

  // Single effect: handles both reading URL params (back/forward/direct nav) and
  // writing filter/page state to the URL when it changes.
  useEffect(() => {
    if (activeTab !== "leads") return;

    const params: Record<string, string> = {};
    if (filters.search) params.search = filters.search;
    if (filters.sortOrder !== "newest") params.sort = filters.sortOrder;
    if (filters.statusFilter !== "All") params.status = filters.statusFilter;
    if (filters.insurerFilter) params.insurer = filters.insurerFilter;
    if (filters.femaFilter !== "All") params.fema = filters.femaFilter;
    if (filters.zip) params.zip = filters.zip;
    if (filters.damageType !== "All") params.damage = filters.damageType;
    if (filters.scoreTier !== "All") params.tier = filters.scoreTier;
    if (filters.dateRange !== "all") params.days = filters.dateRange;
    if (filters.county !== "All") params.county = filters.county;
    if (filters.hasContact) params.hasContact = "1";
    if (filters.absenteeOwner) params.absentee = "1";
    if (filters.underpaid) params.underpaid = "1";
    if (filters.noContractor) params.noContractor = "1";
    if (filters.stormFirst) params.stormFirst = "1";
    if (leadsPage !== 1) params.page = String(leadsPage);
    if (leadsPageSize !== 25) params.size = String(leadsPageSize);

    const nextParams = new URLSearchParams(params);
    const nextStr = nextParams.toString();

    if (nextStr === lastParamsRef.current) {
      // Params match what we set last time — URL is already correct, but
      // if the URL has params we haven't applied yet, apply them now.
      const currentStr = searchParams.toString();
      if (currentStr && currentStr !== lastParamsRef.current) {
        const parsed = parseUrlParams(searchParams);
        setFilters(parsed.filters);
        if (parsed.page) setLeadsPage(parsed.page);
        else setLeadsPage(1);
        if (parsed.pageSize) setLeadsPageSize(parsed.pageSize);
        lastParamsRef.current = currentStr;
      }
      return;
    }

    // Params differ from what we last set. Two possibilities:
    // 1. User changed a filter → nextStr != currentStr → write to URL.
    // 2. URL changed externally (back/forward) → nextStr == currentStr
    //    and currentStr != lastParamsRef → read from URL.
    if (nextStr === searchParams.toString()) {
      // URL already matches desired state — just record it and skip writing.
      lastParamsRef.current = nextStr;
      return;
    }

    // User changed a filter — write to URL.
    lastParamsRef.current = nextStr;
    setSearchParams(params, { replace: true });
  }, [activeTab, filters, leadsPage, leadsPageSize, searchParams, setSearchParams]);

  // Reset leads pagination to page 1 when any filter, search, sort, or page size changes
  useEffect(() => {
    setLeadsPage(1);
  }, [
    filters.zip, filters.damageType, filters.scoreTier, filters.dateRange,
    filters.sortOrder, filters.search, filters.hasContact, filters.absenteeOwner,
    filters.underpaid, filters.noContractor, filters.stormFirst, filters.county,
    filters.statusFilter, filters.insurerFilter, filters.femaFilter, leadsPageSize,
  ]);

  // Reset storm pagination to page 1 when any storm filter or page size changes
  useEffect(() => {
    setStormPage(1);
  }, [
    stormFilters.county, stormFilters.eventType, stormFilters.femaTagged,
    stormFilters.scoreTier, stormFilters.dateRange, stormFilters.candidateType,
    stormPageSize,
  ]);

  // Reset cases pagination to page 1 when any case filter or page size changes
  useEffect(() => {
    setCasesPage(1);
  }, [
    caseFilters.search, caseFilters.statusGroup, caseFilters.insuranceCompany,
    caseFilters.perilType, caseFilters.dateRange, casesPageSize,
  ]);

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
    const searchTerm = filters.search.trim().toLowerCase();

    return leads.filter((lead) => {
      // Text search — case-insensitive partial match on ownerName, propertyAddress, folioNumber
      if (searchTerm) {
        const matchesOwner = lead.ownerName?.toLowerCase().includes(searchTerm);
        const matchesAddress = lead.propertyAddress?.toLowerCase().includes(searchTerm);
        const matchesFolio = lead.folioNumber?.toLowerCase().includes(searchTerm);
        if (!matchesOwner && !matchesAddress && !matchesFolio) return false;
      }

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

      // Status filter
      if (filters.statusFilter !== "All" && lead.status !== filters.statusFilter)
        return false;

      // Insurer filter
      if (filters.insurerFilter && lead.insuranceCompany !== filters.insurerFilter)
        return false;

      // FEMA filter
      if (filters.femaFilter === "Tagged" && !lead.femaDeclarationNumber)
        return false;
      if (filters.femaFilter === "Untagged" && lead.femaDeclarationNumber)
        return false;

      return true;
    }).sort((a, b) => {
      switch (filters.sortOrder) {
        case "score": {
          // High → low; nulls to bottom
          const aScore = a.score ?? -Infinity;
          const bScore = b.score ?? -Infinity;
          return bScore - aScore;
        }
        case "assessedValue": {
          // High → low; nulls to bottom
          const aVal = a.assessedValue ?? -Infinity;
          const bVal = b.assessedValue ?? -Infinity;
          return bVal - aVal;
        }
        case "permitValue": {
          // High → low; nulls to bottom
          const aVal = a.permitValue ?? -Infinity;
          const bVal = b.permitValue ?? -Infinity;
          return bVal - aVal;
        }
        case "oldest": {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        case "newest":
        default: {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
      }
    });
  }, [leads, filters]);

  // Paginated lead slices
  const paginatedLeads = useMemo(() => {
    const start = (leadsPage - 1) * leadsPageSize;
    return filteredLeads.slice(start, start + leadsPageSize);
  }, [filteredLeads, leadsPage, leadsPageSize]);

  const availableLeadInsurers = useMemo(
    () =>
      Array.from(
        new Set(
          leads.map((l) => l.insuranceCompany).filter(Boolean) as string[],
        ),
      ).sort(),
    [leads],
  );

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

  // Paginated storm candidate slices
  const paginatedStormCandidates = useMemo(() => {
    const start = (stormPage - 1) * stormPageSize;
    return filteredStormCandidates.slice(start, start + stormPageSize);
  }, [filteredStormCandidates, stormPage, stormPageSize]);

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
      if (caseFilters.search) {
        const q = caseFilters.search.toLowerCase();
        if (
          !c.clientName.toLowerCase().includes(q) &&
          !c.lossAddress.toLowerCase().includes(q)
        )
          return false;
      }

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

      if (
        caseFilters.insuranceCompany &&
        c.insuranceCompany !== caseFilters.insuranceCompany
      )
        return false;

      if (caseFilters.perilType && c.perilType !== caseFilters.perilType)
        return false;

      if (caseFilters.dateRange !== "all") {
        const days = parseInt(caseFilters.dateRange, 10);
        if (!isWithinDays(c.dateLogged, days)) return false;
      }

      return true;
    });
  }, [cases, caseFilters]);

  // Paginated case slices
  const paginatedCases = useMemo(() => {
    const start = (casesPage - 1) * casesPageSize;
    return filteredCases.slice(start, start + casesPageSize);
  }, [filteredCases, casesPage, casesPageSize]);

  const syncedSelectedCase = useMemo(() => {
    if (caseToOpen) return caseToOpen;
    if (!selectedCase) return null;
    return cases.find((c) => c.id === selectedCase.id) ?? selectedCase;
  }, [caseToOpen, selectedCase, cases]);

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

  function handleConvertToCase(lead: Lead) {
    setConvertingLead(lead);
  }

  async function handleCaseCreate(caseData: Parameters<typeof createCase>[0]) {
    const newCase = await createCase(caseData);
    setConvertingLead(null);
    if (newCase) {
      setCaseToOpen(newCase);
      navigate("/cases");
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

  const headerTitle =
    activeTab === "storm-watch"
      ? "Storm Watch"
      : activeTab === "cases"
        ? "Cases"
        : activeTab === "analytics"
          ? "Analytics"
          : "Leads";

  const navItems = [
    {
      id: "leads" as const,
      icon: Users,
      label: "Leads",
      path: "/",
      count: leads.length,
      tooltip: "Your permit-based lead list — property owners who recently filed damage permits.",
    },
    {
      id: "storm-watch" as const,
      icon: CloudLightning,
      label: "Storm Watch",
      path: "/storm-watch",
      count: stormCandidates.length,
      tooltip: "Area-level storm opportunities sourced from NOAA events and FEMA declarations.",
    },
    {
      id: "cases" as const,
      icon: Briefcase,
      label: "Cases",
      path: "/cases",
      count: cases.length,
      tooltip: "Active client cases — track claim status, milestones, and fees.",
    },
    {
      id: "analytics" as const,
      icon: BarChart2,
      label: "Analytics",
      path: "/analytics",
      count: null,
      tooltip: "Pipeline summary and revenue analytics from closed cases.",
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-[212px] flex-shrink-0 flex flex-col bg-[#0f0f11] border-r border-white/[0.06]">
        {/* Logo */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <Shield className="w-[18px] h-[18px] text-amber-400 flex-shrink-0" />
            <span className="text-[13px] font-semibold text-white tracking-tight leading-none">
              Claim Remedy
            </span>
          </div>
          <p className="text-[11px] text-zinc-600 mt-1.5 pl-[26px] leading-none">
            Lead Intelligence
          </p>
        </div>

        <div className="mx-4 h-px bg-white/[0.06]" />

        {/* Nav */}
        <nav className="flex-1 px-2 pt-3 pb-2 flex flex-col gap-0.5">
          {navItems.map(({ id, icon: Icon, label, path, count, tooltip }) => (
            <Tooltip key={id} text={tooltip} position="bottom">
              <button
                onClick={() => navigate(path)}
                className={cn(
                  "nav-item",
                  activeTab === id ? "nav-item-active" : "nav-item-inactive",
                )}
              >
                <Icon className="w-[15px] h-[15px] flex-shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {count != null && count > 0 && (
                  <span
                    className={cn(
                      "text-[11px] score-number tabular-nums",
                      activeTab === id ? "text-zinc-400" : "text-zinc-700",
                    )}
                  >
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            </Tooltip>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
            <span className="text-[11px] text-zinc-600 leading-none">
              {headerLastUpdated
                ? `Updated ${timeAgo(headerLastUpdated)}`
                : "Syncing..."}
            </span>
          </div>
          <p className="text-[11px] text-zinc-700 pl-[14px] leading-none">
            {headerTotalCount > 0
              ? `${headerTotalCount.toLocaleString()} ${headerEntityLabel}`
              : "Loading..."}
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        <Header
          title={headerTitle}
          totalCount={headerTotalCount}
          onExport={headerExport}
          entityLabel={headerEntityLabel}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1200px] w-full mx-auto px-6 py-6">
            {activeTab === "storm-watch" ? (
              <div className="mb-6">
                <StormWatchStatsRow stats={stormStats} />
              </div>
            ) : activeTab === "leads" ? (
              <div className="mb-6">
                <StatsRow stats={leadStats} />
              </div>
            ) : null}

            <Routes>
              <Route
                path="/"
                element={
                  <>
                    <FilterBar
                      filters={filters}
                      onChange={setFilters}
                      onClear={() => setFilters(DEFAULT_FILTERS)}
                      availableInsurers={availableLeadInsurers}
                    />
                    <div className="mt-4">
                      {filteredLeads.length === 0 && leads.length > 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                          <p className="text-sm font-medium">No leads match your current filters</p>
                          <p className="text-xs mt-1 text-zinc-400">Try adjusting or clearing your filters to see more results.</p>
                        </div>
                      ) : (
                        <LeadsTable
                          leads={paginatedLeads}
                          totalLeads={filteredLeads.length}
                          currentPage={leadsPage}
                          pageSize={leadsPageSize}
                          onPageChange={setLeadsPage}
                          onPageSizeChange={setLeadsPageSize}
                          onSelectLead={setSelectedLead}
                          selectedLeadId={selectedLead?.id}
                          loading={isLoadingLeads}
                        />
                      )}
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
                        candidates={paginatedStormCandidates}
                        totalCandidates={filteredStormCandidates.length}
                        currentPage={stormPage}
                        pageSize={stormPageSize}
                        onPageChange={setStormPage}
                        onPageSizeChange={setStormPageSize}
                        onSelectCandidate={setSelectedStormCandidate}
                        selectedCandidateId={selectedStormCandidate?.id}
                        loading={isLoadingStorm}
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
                        cases={paginatedCases}
                        totalCases={filteredCases.length}
                        currentPage={casesPage}
                        pageSize={casesPageSize}
                        onPageChange={setCasesPage}
                        onPageSizeChange={setCasesPageSize}
                        onSelectCase={setSelectedCase}
                        selectedCaseId={syncedSelectedCase?.id}
                        loading={isLoadingCases}
                      />
                    </div>
                  </>
                }
              />
              <Route
                path="/analytics"
                element={<Analytics leads={leads} cases={cases} />}
              />
              <Route
                path="/fixtures/convert-case"
                element={<FixtureConversionPage />}
              />
            </Routes>
          </div>
        </div>
      </div>

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdateStatus={handleUpdateStatus}
          onUpdateTracking={handleUpdateTracking}
          onConvertToCase={handleConvertToCase}
          readOnly={leadReadOnly}
        />
      )}

      {convertingLead && (
        <ConvertToCaseModal
          lead={convertingLead}
          onClose={() => setConvertingLead(null)}
          onConvert={handleCaseCreate}
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
          onClose={() => {
            setSelectedCase(null);
            setCaseToOpen(null);
          }}
          onSave={saveCase}
          readOnly={caseReadOnly}
        />
      )}
    </div>
  );
}
