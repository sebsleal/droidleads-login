import { X } from 'lucide-react'
import type { StormFilterState, StormCandidateType } from '@/types'
import Tooltip from './Tooltip'

interface StormWatchFiltersProps {
  filters: StormFilterState
  eventTypes: string[]
  onChange: (filters: StormFilterState) => void
  onClear: () => void
}

const SCORE_TIERS = ['All', 'High', 'Medium', 'Low'] as const
const DATE_RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
] as const
const CANDIDATE_TYPES: Array<StormCandidateType | 'All'> = ['All', 'area', 'property']

const isDefaultFilters = (filters: StormFilterState) =>
  filters.county === 'All' &&
  filters.eventType === 'All' &&
  filters.femaTagged === 'All' &&
  filters.scoreTier === 'All' &&
  filters.dateRange === 'all' &&
  filters.candidateType === 'All'

export default function StormWatchFilters({
  filters,
  eventTypes,
  onChange,
  onClear,
}: StormWatchFiltersProps) {
  const hasActiveFilters = !isDefaultFilters(filters)

  function update<K extends keyof StormFilterState>(key: K, value: StormFilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="workspace-filter-shell px-4 py-4">
      <div className="flex flex-wrap items-center gap-3">

        <div className="flex items-center gap-2">
          <Tooltip text="Filter storm opportunities by county — Miami-Dade, Broward (Fort Lauderdale area), or Palm Beach (West Palm Beach area).">
            <label className="cursor-help whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">County</label>
          </Tooltip>
          <select
            value={filters.county}
            onChange={(e) => update('county', e.target.value as StormFilterState['county'])}
            className="select-input w-36"
          >
            <option value="All">All Counties</option>
            <option value="miami-dade">Miami-Dade</option>
            <option value="broward">Broward</option>
            <option value="palm-beach">Palm Beach</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip text="Filter by the type of storm event recorded by NOAA — e.g. Hurricane, Flood, Tornado, High Wind, Hail. Different event types have different claim profiles.">
            <label className="cursor-help whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Event</label>
          </Tooltip>
          <select
            value={filters.eventType}
            onChange={(e) => update('eventType', e.target.value)}
            className="select-input w-44"
          >
            <option value="All">All event types</option>
            {eventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip text="Filter by FEMA disaster declaration status. 'FEMA tagged' means the storm area has an active federal disaster declaration — these areas have the strongest claim eligibility and highest payout potential.">
            <label className="cursor-help whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">FEMA</label>
          </Tooltip>
          <select
            value={filters.femaTagged}
            onChange={(e) => update('femaTagged', e.target.value as StormFilterState['femaTagged'])}
            className="select-input w-40"
          >
            <option value="All">All candidates</option>
            <option value="Tagged">FEMA tagged only</option>
            <option value="Untagged">No FEMA match</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip text="Filter by opportunity score. High = 85 or above (most severe events, FEMA-matched, recent). Medium = 70–84. Low = below 70. Score factors in storm severity, FEMA status, recency, reported damage, and geographic spread.">
            <label className="cursor-help whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Score</label>
          </Tooltip>
          <select
            value={filters.scoreTier}
            onChange={(e) => update('scoreTier', e.target.value as StormFilterState['scoreTier'])}
            className="select-input w-36"
          >
            {SCORE_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tier === 'All' ? 'All scores' : tier === 'High' ? 'High (>=85)' : tier === 'Medium' ? 'Medium (70-84)' : 'Low (<70)'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip text="Filter by when the storm event occurred. Use shorter ranges to focus on the most recent and actionable opportunities.">
            <label className="cursor-help whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Date</label>
          </Tooltip>
          <select
            value={filters.dateRange}
            onChange={(e) => update('dateRange', e.target.value as StormFilterState['dateRange'])}
            className="select-input w-40"
          >
            {DATE_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip text="Area-based candidates cover a whole county or zone hit by a storm — good for broad outreach. Property-based candidates target specific parcels with confirmed damage. Most Storm Watch data is currently area-based.">
            <label className="cursor-help whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Candidate</label>
          </Tooltip>
          <select
            value={filters.candidateType}
            onChange={(e) => update('candidateType', e.target.value as StormFilterState['candidateType'])}
            className="select-input w-40"
          >
            {CANDIDATE_TYPES.map((candidateType) => (
              <option key={candidateType} value={candidateType}>
                {candidateType === 'All'
                  ? 'All candidates'
                  : candidateType === 'area'
                    ? 'Area-based'
                    : 'Property-based'}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-800"
          >
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
