/**
 * Sort-nulls validation fixture page — /fixtures/sort-nulls
 *
 * Isolated validation surface for VAL-DASH-008 and VAL-DASH-010.
 *
 * VAL-DASH-008: Sort by assessed value descending; nulls sort to bottom.
 * VAL-DASH-010: Sort by permit value descending; nulls sort to bottom.
 *
 * This page exercises the FilterBar sort controls with a static fixture dataset
 * that has:
 *   - 5 rows with mixed null/non-null assessedValue (permitValue = null)
 *   - 5 rows with mixed null/non-null permitValue (assessedValue = null)
 *   - 2 rows with both values set
 *
 * This enables deterministic verification of null-bottom sort behavior without
 * depending on the production leads.json dataset.
 *
 * This page does NOT mutate committed production data files.
 */
import { useState } from 'react'
import { Shield } from 'lucide-react'
import type { Lead, FilterState } from '@/types'
import { fixtureSortNullsLeads } from '@/data/fixtureSortNulls'
import FilterBar from '@/components/FilterBar'
import LeadsTable from '@/components/LeadsTable'
import LeadDrawer from '@/components/LeadDrawer'

const FIXTURE_FILTERS: FilterState = {
  zip: '',
  damageType: 'All',
  scoreTier: 'All',
  dateRange: 'all',
  sortOrder: 'newest',
  search: '',
  hasContact: false,
  absenteeOwner: false,
  underpaid: false,
  noContractor: false,
  stormFirst: false,
  county: 'All',
  statusFilter: 'All',
  insurerFilter: '',
  femaFilter: 'All',
}

// Dummy insurer list so the insurer dropdown renders without errors
const DUMMY_INSURERS: string[] = [
  'Citizens Property Insurance',
  'Universal Property & Casualty',
  'Florida Peninsula Insurance',
]

function useFixtureTracking() {
  return {
    trackingMap: new Map<string, never>(),
    saveTracking: (_id: string, _patch: never) => {},
    readOnly: true,
  }
}

export default function FixtureSortNullsPage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25)
  const [filters, setFilters] = useState<FilterState>(FIXTURE_FILTERS)
  const { readOnly: leadReadOnly } = useFixtureTracking()

  // Client-side filtering & sorting — mirrors App.tsx sort logic
  const filteredLeads = fixtureSortNullsLeads
    .filter((lead) => {
      // Text search
      if (filters.search) {
        const term = filters.search.toLowerCase()
        if (
          !lead.ownerName.toLowerCase().includes(term) &&
          !lead.propertyAddress.toLowerCase().includes(term) &&
          !lead.folioNumber.toLowerCase().includes(term)
        )
          return false
      }
      // Status filter
      if (filters.statusFilter !== 'All' && lead.status !== filters.statusFilter)
        return false
      // Insurer filter
      if (filters.insurerFilter && lead.insuranceCompany !== filters.insurerFilter)
        return false
      return true
    })
    .sort((a, b) => {
      switch (filters.sortOrder) {
        case 'score':
          return (b.score ?? 0) - (a.score ?? 0)
        case 'assessedValue': {
          // nulls → bottom (descending)
          const aVal = a.assessedValue ?? -Infinity
          const bVal = b.assessedValue ?? -Infinity
          return bVal - aVal
        }
        case 'permitValue': {
          // nulls → bottom (descending)
          const aVal = a.permitValue ?? -Infinity
          const bVal = b.permitValue ?? -Infinity
          return bVal - aVal
        }
        case 'oldest':
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        case 'newest':
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime()
      }
    })

  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Minimal header so agent-browser can orient */}
      <div className="bg-[#0f0f11] border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
        <Shield className="w-5 h-5 text-amber-400" />
        <span className="text-sm font-semibold text-white">
          Validation Fixture — Sort Nulls
        </span>
        <span className="ml-auto text-xs text-zinc-600 font-mono">
          /fixtures/sort-nulls
        </span>
      </div>

      {/* Instructional banner */}
      <div className="max-w-5xl mx-auto mt-6 px-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">
            Validation Fixture — VAL-DASH-008 &amp; VAL-DASH-010 Null-Bottom Sort
          </p>
          <p className="text-amber-700 mb-3">
            This page loads <strong>12 fixture leads</strong> with mixed null/non-null
            assessedValue and permitValue. Use the Sort dropdown to verify that
            descending sorts place nulls at the bottom.
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs text-amber-800">
            <div className="bg-amber-100/60 rounded-lg p-2">
              <p className="font-semibold">VAL-DASH-008 — Assessed Value Sort</p>
              <p className="text-amber-700 mt-0.5">
                Rows 1–5 have null permitValue. Rows 3 and 5 have null assessedValue.
                Select &quot;Assessed Value (high→low)&quot; — null rows (Carol, Elena) must
                appear last, after Alice (650k), Leo (1200k), David (510k), Karen
                (475k), Bob (420k).
              </p>
            </div>
            <div className="bg-amber-100/60 rounded-lg p-2">
              <p className="font-semibold">VAL-DASH-010 — Permit Value Sort</p>
              <p className="text-amber-700 mt-0.5">
                Rows 6–10 have null assessedValue. Rows 8 and 10 have null permitValue.
                Select &quot;Permit Value (high→low)&quot; — null rows (Henry, Jack) must
                appear last, after Leo (210k), Isabel (125k), Frank (85k), Grace
                (32k).
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs text-amber-800 bg-amber-100/60 rounded-lg p-2">
            <p className="font-semibold">Sort state expected after each sort selection:</p>
            <div className="grid grid-cols-2 gap-x-6 mt-1">
              <div>
                <p className="font-medium text-amber-900">assessedValue sort order:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-amber-700">
                  <li>Alice — 650,000</li>
                  <li>David — 510,000</li>
                  <li>Bob — 420,000</li>
                  <li>Carol — null (bottom)</li>
                  <li>Elena — null (bottom)</li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-amber-900">permitValue sort order:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-amber-700">
                  <li>Leo — 210,000</li>
                  <li>Isabel — 125,000</li>
                  <li>Frank — 85,000</li>
                  <li>Grace — 32,000</li>
                  <li>Henry — null (bottom)</li>
                  <li>Jack — null (bottom)</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixture lead list with filter bar */}
      <div className="max-w-7xl mx-auto mt-6 px-6 pb-12">
        <FilterBar
          filters={filters}
          onChange={(f) => {
            setFilters(f)
            setCurrentPage(1)
          }}
          onClear={() => {
            setFilters(FIXTURE_FILTERS)
            setCurrentPage(1)
          }}
          availableInsurers={DUMMY_INSURERS}
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
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setCurrentPage(1)
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
  )
}
