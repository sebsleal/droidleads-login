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
  'Accidental Discharge',
]

const SCORE_TIERS = ['All', 'High', 'Medium', 'Low'] as const
const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
] as const

const COUNTY_OPTIONS = [
  { value: 'All',        label: 'All Counties' },
  { value: 'miami-dade', label: 'Miami-Dade' },
  { value: 'broward',    label: 'Broward' },
  { value: 'palm-beach', label: 'Palm Beach' },
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

interface ToggleProps {
  label: string
  checked: boolean
  onToggle: () => void
  tooltipText: string
  activeColor?: string
}

function Toggle({ label, checked, onToggle, tooltipText, activeColor = 'bg-zinc-900' }: ToggleProps) {
  return (
    <Tooltip text={tooltipText}>
      <label className="flex items-center gap-2 cursor-pointer select-none group">
        <div
          className={cn(
            'relative w-8 h-[18px] rounded-full transition-colors duration-200 flex-shrink-0',
            checked ? activeColor : 'bg-zinc-200'
          )}
          onClick={onToggle}
        >
          <div
            className={cn(
              'absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-200',
              checked ? 'translate-x-[14px]' : 'translate-x-0'
            )}
          />
        </div>
        <span
          className={cn(
            'text-[13px] font-medium transition-colors whitespace-nowrap',
            checked ? 'text-zinc-900' : 'text-zinc-500 group-hover:text-zinc-700'
          )}
        >
          {label}
        </span>
      </label>
    </Tooltip>
  )
}

export default function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  const hasActiveFilters = !isDefaultFilters(filters)

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="bg-white border border-zinc-100 rounded-lg px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">

        {/* ZIP */}
        <div className="flex items-center gap-2">
          <Tooltip text="Filter leads by ZIP code. Only shows properties located in that ZIP.">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-[0.07em] whitespace-nowrap cursor-help">ZIP</label>
          </Tooltip>
          <input
            type="text"
            placeholder="33125"
            maxLength={5}
            value={filters.zip}
            onChange={(e) => update('zip', e.target.value.replace(/\D/g, ''))}
            className="w-24 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] text-zinc-700
                       focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10
                       placeholder:text-zinc-300 transition-colors"
          />
        </div>

        <div className="w-px h-5 bg-zinc-100" />

        {/* Damage */}
        <div className="flex items-center gap-2">
          <Tooltip text="Filter by the type of property damage on the permit — e.g. hurricane wind, flood, roof replacement, fire, or structural.">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-[0.07em] whitespace-nowrap cursor-help">Damage</label>
          </Tooltip>
          <select
            value={filters.damageType}
            onChange={(e) => update('damageType', e.target.value as FilterState['damageType'])}
            className="select-input w-44"
          >
            {DAMAGE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* County */}
        <div className="flex items-center gap-2">
          <Tooltip text="Filter by county. Covers Miami-Dade, Broward (Fort Lauderdale area), and Palm Beach (West Palm Beach area).">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-[0.07em] whitespace-nowrap cursor-help">County</label>
          </Tooltip>
          <select
            value={filters.county}
            onChange={(e) => update('county', e.target.value as FilterState['county'])}
            className="select-input w-36"
          >
            {COUNTY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Score */}
        <div className="flex items-center gap-2">
          <Tooltip text="Filter by lead priority score. High = 85 or above (hottest leads). Medium = 70–84. Low = below 70.">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-[0.07em] whitespace-nowrap cursor-help">Score</label>
          </Tooltip>
          <select
            value={filters.scoreTier}
            onChange={(e) => update('scoreTier', e.target.value as FilterState['scoreTier'])}
            className="select-input w-36"
          >
            {SCORE_TIERS.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All scores' : t === 'High' ? 'High (≥85)' : t === 'Medium' ? 'Medium (70–84)' : 'Low (<70)'}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2">
          <Tooltip text="Filter by when the damage permit was filed. Use shorter ranges to see the most recent opportunities first.">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-[0.07em] whitespace-nowrap cursor-help">Date</label>
          </Tooltip>
          <select
            value={filters.dateRange}
            onChange={(e) => update('dateRange', e.target.value as FilterState['dateRange'])}
            className="select-input w-36"
          >
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-5 bg-zinc-100" />

        {/* Toggles */}
        <Toggle
          label="Has contact"
          checked={filters.hasContact}
          onToggle={() => update('hasContact', !filters.hasContact)}
          tooltipText="Only show leads where we found a phone number or email for the property owner."
        />
        <Toggle
          label="Absentee"
          checked={filters.absenteeOwner}
          onToggle={() => update('absenteeOwner', !filters.absenteeOwner)}
          tooltipText="Only show leads where the owner's mailing address is out of state."
          activeColor="bg-amber-500"
        />
        <Toggle
          label="Underpaid"
          checked={filters.underpaid}
          onToggle={() => update('underpaid', !filters.underpaid)}
          tooltipText="Only show leads where the permit value is below 60% of the ZIP code median — a strong underpayment signal."
          activeColor="bg-red-500"
        />
        <Toggle
          label="No Contractor"
          checked={filters.noContractor}
          onToggle={() => update('noContractor', !filters.noContractor)}
          tooltipText="Only show leads where no licensed contractor is listed on the permit (Owner-Builder or No Contractor status)."
          activeColor="bg-blue-500"
        />
        <Toggle
          label="Pre-Permit"
          checked={filters.stormFirst}
          onToggle={() => update('stormFirst', !filters.stormFirst)}
          tooltipText="Only show storm-first leads — properties in storm-affected areas that have NOT filed a permit yet."
          activeColor="bg-emerald-500"
        />

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="ml-auto flex items-center gap-1 text-[12px] font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
