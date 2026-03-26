import { X } from 'lucide-react'
import type { FilterState, DamageType } from '@/types'
import { cn } from '@/lib/utils'
import Tooltip from './Tooltip'

interface FilterBarProps {
  filters: FilterState
  onChange: (f: FilterState) => void
  onClear: () => void
}

const DAMAGE_TYPES: Array<DamageType | 'All'> = [
  'All',
  'Hurricane/Wind',
  'Flood',
  'Roof',
  'Fire',
  'Structural',
]

const SCORE_TIERS = ['All', 'High', 'Medium', 'Low'] as const
const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
] as const

const COUNTY_OPTIONS = [
  { value: 'All',         label: 'All Counties' },
  { value: 'miami-dade',  label: 'Miami-Dade' },
  { value: 'broward',     label: 'Broward' },
  { value: 'palm-beach',  label: 'Palm Beach' },
] as const

const isDefaultFilters = (f: FilterState) =>
  f.zip === '' &&
  f.damageType === 'All' &&
  f.scoreTier === 'All' &&
  f.dateRange === 'all' &&
  !f.hasContact &&
  !f.absenteeOwner &&
  !f.underpaid &&
  !f.noContractor &&
  !f.stormFirst &&
  f.county === 'All'

export default function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  const hasActiveFilters = !isDefaultFilters(filters)

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="card px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3">

        {/* ZIP */}
        <div className="flex items-center gap-2">
          <Tooltip text="Filter leads by ZIP code. Only shows properties located in that ZIP.">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap cursor-help underline decoration-dotted decoration-slate-400">ZIP</label>
          </Tooltip>
          <input
            type="text"
            placeholder="e.g. 33125"
            maxLength={5}
            value={filters.zip}
            onChange={(e) => update('zip', e.target.value.replace(/\D/g, ''))}
            className={cn(
              'w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700',
              'shadow-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20',
              'placeholder:text-slate-400 transition-colors'
            )}
          />
        </div>

        {/* Damage type */}
        <div className="flex items-center gap-2">
          <Tooltip text="Filter by the type of property damage on the permit — e.g. hurricane wind, flood, roof replacement, fire, or structural.">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap cursor-help underline decoration-dotted decoration-slate-400">Damage</label>
          </Tooltip>
          <select
            value={filters.damageType}
            onChange={(e) => update('damageType', e.target.value as FilterState['damageType'])}
            className="select-input w-44"
          >
            {DAMAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* County */}
        <div className="flex items-center gap-2">
          <Tooltip text="Filter by county. Covers Miami-Dade, Broward (Fort Lauderdale area), and Palm Beach (West Palm Beach area).">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap cursor-help underline decoration-dotted decoration-slate-400">County</label>
          </Tooltip>
          <select
            value={filters.county}
            onChange={(e) => update('county', e.target.value as FilterState['county'])}
            className="select-input w-36"
          >
            {COUNTY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Score tier */}
        <div className="flex items-center gap-2">
          <Tooltip text="Filter by lead priority score. High = 85 or above (hottest leads). Medium = 70–84. Low = below 70. Score is calculated from damage type, FEMA match, permit status, and owner signals.">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap cursor-help underline decoration-dotted decoration-slate-400">Score</label>
          </Tooltip>
          <select
            value={filters.scoreTier}
            onChange={(e) => update('scoreTier', e.target.value as FilterState['scoreTier'])}
            className="select-input w-36"
          >
            {SCORE_TIERS.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All scores' : t === 'High' ? 'High (≥85)' : t === 'Medium' ? 'Medium (70-84)' : 'Low (<70)'}
              </option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <Tooltip text="Filter by when the damage permit was filed. Use shorter ranges to see the most recent opportunities first.">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap cursor-help underline decoration-dotted decoration-slate-400">Date</label>
          </Tooltip>
          <select
            value={filters.dateRange}
            onChange={(e) => update('dateRange', e.target.value as FilterState['dateRange'])}
            className="select-input w-36"
          >
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Has contact toggle */}
        <Tooltip text="Only show leads where we found a phone number or email for the property owner — so you can reach out immediately.">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={filters.hasContact}
                onChange={(e) => update('hasContact', e.target.checked)}
              />
              <div className={cn(
                'w-9 h-5 rounded-full border-2 transition-colors duration-200',
                filters.hasContact
                  ? 'bg-navy-900 border-navy-900'
                  : 'bg-slate-200 border-slate-200'
              )} />
              <div className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
                filters.hasContact ? 'translate-x-4' : 'translate-x-0'
              )} />
            </div>
            <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Has contact</span>
          </label>
        </Tooltip>

        {/* Absentee Owner */}
        <Tooltip text="Only show leads where the owner's mailing address is out of state. Absentee owners often haven't started repairs and are more likely to need a public adjuster — and everything can be handled remotely.">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={filters.absenteeOwner}
              onClick={() => onChange({ ...filters, absenteeOwner: !filters.absenteeOwner })}
              className={`w-9 h-5 rounded-full border-2 transition-colors ${filters.absenteeOwner ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300'}`}
            >
              <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${filters.absenteeOwner ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-slate-600">Absentee</span>
          </label>
        </Tooltip>

        {/* Underpaid */}
        <Tooltip text="Only show leads where the permit value is below 60% of the ZIP code median — a strong signal the insurance payout may have been too low. These owners may not realize they were shortchanged.">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={filters.underpaid}
              onClick={() => onChange({ ...filters, underpaid: !filters.underpaid })}
              className={`w-9 h-5 rounded-full border-2 transition-colors ${filters.underpaid ? 'bg-red-500 border-red-500' : 'bg-white border-slate-300'}`}
            >
              <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${filters.underpaid ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-slate-600">Underpaid</span>
          </label>
        </Tooltip>

        {/* No Contractor */}
        <Tooltip text="Only show leads where no licensed contractor is listed on the permit (Owner-Builder or No Contractor status). These owners are likely navigating the insurance claim on their own and may need help.">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={filters.noContractor}
              onClick={() => onChange({ ...filters, noContractor: !filters.noContractor })}
              className={`w-9 h-5 rounded-full border-2 transition-colors ${filters.noContractor ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`}
            >
              <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${filters.noContractor ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-slate-600">No Contractor</span>
          </label>
        </Tooltip>

        {/* Pre-Permit */}
        <Tooltip text="Only show storm-first leads — properties in storm-affected areas that have NOT filed a permit yet. These are the highest-urgency opportunities: the owner may not have even started the claims process.">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={filters.stormFirst}
              onClick={() => onChange({ ...filters, stormFirst: !filters.stormFirst })}
              className={`w-9 h-5 rounded-full border-2 transition-colors ${filters.stormFirst ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}
            >
              <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${filters.stormFirst ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-slate-600">Pre-Permit</span>
          </label>
        </Tooltip>

        {/* Clear filters */}
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
