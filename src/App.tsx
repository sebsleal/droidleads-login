import { useState, useMemo, useEffect, useRef } from "react";
import { Routes, Route, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { BarChart2, Users, CloudLightning, Briefcase, Shield, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider.tsx";
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
  isBusinessEntityLead,
  isNaturalPersonLead,
  cn,
} from "@/lib/utils";
import { useTracking } from "@/lib/useTracking";
import { useStormTracking } from "@/lib/useStormTracking";
import { useCases } from "@/lib/useCases";
import { useToast } from "@/components/Toast";
import type { PageSize } from "@/components/Pagination";
import Header from "@/components/Header";
import KPICards from "@/components/KPICards";
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
import FixtureLegacyCompatPage from "@/components/FixtureLegacyCompatPage";
import FixtureCrossAreaPage from "@/components/FixtureCrossAreaPage";
import FixtureSortNullsPage from "@/components/FixtureSortNullsPage";

const DEFAULT_FILTERS: FilterState = {
  zip: "",
  damageType: "All",
  scoreTier: "All",
  dateRange: "all",
  sortOrder: "newest",
  search: "",
  ownerType: "All",
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

  const ownerType = sp.get("ownerType");
  if (ownerType === "person") f.ownerType = "Person";
  if (ownerType === "business") f.ownerType = "Business";

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
  const { addToast } = useToast();

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
  // ── Effect A: URL Writer ─────────────────────────────────────────────
  // Writes filter/page state to the URL when filters or pagination change.
  // Does NOT depend on searchParams to avoid triggering on URL reads.
  const lastWrittenRef = useRef<string>("");

  useEffect(() => {
    if (activeTab !== "leads") return;

    const params: Record<string, string> = {};
    if (filters.search) params.search = filters.search;
    if (filters.ownerType === "Person") params.ownerType = "person";
    if (filters.ownerType === "Business") params.ownerType = "business";
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

    const nextStr = new URLSearchParams(params).toString();
    if (nextStr === lastWrittenRef.current) return; // Already in sync
    lastWrittenRef.current = nextStr;
    setSearchParams(params, { replace: true });
  }, [activeTab, filters, leadsPage, leadsPageSize, setSearchParams]);

  // ── Effect B: URL Reader ─────────────────────────────────────────────
  // Reads URL params when they change (back/forward, direct navigation, or
  // initial load) and syncs filter/page state. Skips changes written by Effect A.
  useEffect(() => {
    if (activeTab !== "leads") return;

    const currentStr = searchParams.toString();
    // Skip: this change was caused by Effect A writing to the URL.
    if (currentStr === lastWrittenRef.current) return;

    if (!currentStr) {
      // Empty query string — browser back/forward to bare path → restore defaults.
      setFilters(DEFAULT_FILTERS);
      setLeadsPage(1);
      setLeadsPageSize(25);
    } else {
      // URL has params — apply them to UI state.
      const parsed = parseUrlParams(searchParams);
      setFilters(parsed.filters);
      if (parsed.page) setLeadsPage(parsed.page);
      else setLeadsPage(1);
      if (parsed.pageSize) setLeadsPageSize(parsed.pageSize);
    }
  }, [activeTab, searchParams]);

  // Reset leads pagination to page 1 when any filter, search, sort, or page size changes
  useEffect(() => {
    setLeadsPage(1);
  }, [
    filters.zip, filters.damageType, filters.scoreTier, filters.dateRange,
    filters.sortOrder, filters.search, filters.ownerType, filters.hasContact, filters.absenteeOwner,
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
      if (filters.ownerType === "Person" && !isNaturalPersonLead(lead))
        return false;
      if (filters.ownerType === "Business" && !isBusinessEntityLead(lead))
        return false;

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

    addToast({
      type: 'success',
      title: 'Status updated',
      message: `Lead marked as ${status}`,
    });

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
      addToast({
        type: 'success',
        title: 'Case created',
        message: `${newCase.clientName} - ${newCase.lossAddress}`,
      });
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

    addToast({
      type: 'success',
      title: 'Status updated',
      message: `Storm candidate marked as ${status}`,
    });

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
      ? () => {
          downloadStormCandidatesCSV(filteredStormCandidates);
          addToast({
            type: 'success',
            title: 'Export complete',
            message: `${filteredStormCandidates.length} storm candidates exported to CSV`,
          });
        }
      : activeTab === "cases"
        ? undefined
        : () => {
          downloadCSV(filteredLeads);
          addToast({
            type: 'success',
            title: 'Export complete',
            message: `${filteredLeads.length} leads exported to CSV`,
          });
        };

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

  function handleNavClick(path: string) {
    navigate(path);
    setMobileSidebarOpen(false);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Mobile: Hamburger button ── */}
      <div className="lg:hidden fixed top-[56px] left-0 z-50 p-3">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-lg"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Mobile: Sidebar overlay backdrop ── */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile: Sidebar overlay ── */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 z-50 w-[240px] h-full flex flex-col bg-slate-900 border-r border-slate-800",
          "transition-transform duration-200 ease-out",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo + close button */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <span className="text-[15px] font-semibold text-white tracking-tight leading-none">
                Claim Remedy
              </span>
            </div>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2 pl-8 leading-none">
            Lead Intelligence
          </p>
        </div>

        <div className="mx-4 h-px bg-slate-800" />

        {/* Nav */}
        <nav className="flex-1 px-3 pt-4 pb-2 flex flex-col gap-1">
          {navItems.map(({ id, icon: Icon, label, path, count, tooltip }) => (
            <Tooltip key={id} text={tooltip} position="bottom">
              <button
                onClick={() => handleNavClick(path)}
                className={cn(
                  "nav-item",
                  activeTab === id ? "nav-item-active" : "nav-item-inactive",
                )}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {count != null && count > 0 && (
                  <span
                    className={cn(
                      "text-2xs score-number tabular-nums px-1.5 py-0.5 rounded-full",
                      activeTab === id ? "bg-white/10 text-slate-300" : "bg-slate-800 text-slate-500",
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
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="mb-3">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
            <span className="text-xs text-slate-500 leading-none">
              {headerLastUpdated
                ? `Updated ${timeAgo(headerLastUpdated)}`
                : "Syncing..."}
            </span>
          </div>
          <p className="text-xs text-slate-600 pl-4 leading-none">
            {headerTotalCount > 0
              ? `${headerTotalCount.toLocaleString()} ${headerEntityLabel}`
              : "Loading..."}
          </p>
        </div>
      </aside>

      {/* ── Desktop: Sidebar ── */}
      <aside className="hidden lg:flex w-[240px] flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">
        {/* Logo */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <span className="text-[15px] font-semibold text-white tracking-tight leading-none">
              Claim Remedy
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2 pl-8 leading-none">
            Lead Intelligence
          </p>
        </div>

        <div className="mx-4 h-px bg-slate-800" />

        {/* Nav */}
        <nav className="flex-1 px-3 pt-4 pb-2 flex flex-col gap-1">
          {navItems.map(({ id, icon: Icon, label, path, count, tooltip }) => (
            <Tooltip key={id} text={tooltip} position="bottom">
              <button
                onClick={() => handleNavClick(path)}
                className={cn(
                  "nav-item",
                  activeTab === id ? "nav-item-active" : "nav-item-inactive",
                )}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {count != null && count > 0 && (
                  <span
                    className={cn(
                      "text-2xs score-number tabular-nums px-1.5 py-0.5 rounded-full",
                      activeTab === id ? "bg-white/10 text-slate-300" : "bg-slate-800 text-slate-500",
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
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="mb-3">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
            <span className="text-xs text-slate-500 leading-none">
              {headerLastUpdated
                ? `Updated ${timeAgo(headerLastUpdated)}`
                : "Syncing..."}
            </span>
          </div>
          <p className="text-xs text-slate-600 pl-4 leading-none">
            {headerTotalCount > 0
              ? `${headerTotalCount.toLocaleString()} ${headerEntityLabel}`
              : "Loading..."}
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-slate-900">
        <Header
          title={headerTitle}
          totalCount={headerTotalCount}
          onExport={headerExport}
          entityLabel={headerEntityLabel}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1200px] w-full mx-auto px-6 lg:px-8 py-6 lg:py-8">
            {activeTab === "storm-watch" ? (
              <div className="mb-8">
                <StormWatchStatsRow stats={stormStats} />
              </div>
            ) : activeTab === "leads" ? (
              <div className="mb-8">
                <KPICards stats={leadStats} />
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
              <Route
                path="/fixtures/legacy-compat"
                element={<FixtureLegacyCompatPage />}
              />
              <Route
                path="/fixtures/cross-area"
                element={<FixtureCrossAreaPage />}
              />
              <Route
                path="/fixtures/sort-nulls"
                element={<FixtureSortNullsPage />}
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
