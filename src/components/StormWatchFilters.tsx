import { X } from 'lucide-react'
import type { StormFilterState, StormCandidateType } from '@/types'

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
    <div className="card px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">County</label>
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
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Event</label>
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
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">FEMA</label>
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
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Score</label>
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
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Date</label>
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
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Candidate</label>
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
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors ml-auto"
          >
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
