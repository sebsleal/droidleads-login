import { X, Search } from 'lucide-react'
import type { FilterState, DamageType } from '@/types'
import { cn } from '@/lib/utils'
import Tooltip from './Tooltip'

interface FilterBarProps {
  filters: FilterState
  onChange: (f: FilterState) => void
  onClear: () => void
  availableInsurers?: string[]
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
  f.sortOrder === 'newest' &&
  f.search === '' &&
  f.ownerType === 'All' &&
  !f.hasContact &&
  !f.absenteeOwner &&
  !f.underpaid &&
  !f.noContractor &&
  !f.stormFirst &&
  f.county === 'All' &&
  f.statusFilter === 'All' &&
  f.insurerFilter === '' &&
  f.femaFilter === 'All'

interface ToggleProps {
  label: string
  checked: boolean
  onToggle: () => void
  tooltipText: string
  activeColor?: string
}

function Toggle({ label, checked, onToggle, tooltipText, activeColor = 'bg-zinc-800 dark:bg-zinc-700' }: ToggleProps) {
  return (
    <Tooltip text={tooltipText}>
      <label className="flex items-center gap-1.5 cursor-pointer select-none group">
        <div
          className={cn(
            'relative w-7 h-[16px] rounded-full transition-colors duration-200 flex-shrink-0',
            checked ? activeColor : 'bg-zinc-200 dark:bg-slate-600'
          )}
          onClick={onToggle}
        >
          <div
            className={cn(
              'absolute top-[2px] left-[2px] w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200',
              checked ? 'translate-x-[11px]' : 'translate-x-0'
            )}
          />
        </div>
        <span
          className={cn(
            'text-[12px] font-medium transition-colors whitespace-nowrap',
            checked ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-slate-400 group-hover:text-zinc-600 dark:group-hover:text-slate-300'
          )}
        >
          {label}
        </span>
      </label>
    </Tooltip>
  )
}

function FilterLabel({ text, tooltip }: { text: string; tooltip: string }) {
  return (
    <Tooltip text={tooltip}>
      <span className="text-[10px] font-semibold text-zinc-400 dark:text-slate-400 uppercase tracking-[0.08em] whitespace-nowrap cursor-help">
        {text}
      </span>
    </Tooltip>
  )
}

export default function FilterBar({ filters, onChange, onClear, availableInsurers = [] }: FilterBarProps) {
  const hasActiveFilters = !isDefaultFilters(filters)

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-zinc-100 dark:border-slate-700 rounded-lg divide-y divide-zinc-50 dark:divide-slate-700">
      {/* Row 1: search + dropdowns */}
      <div className="px-4 py-2.5 flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2">
          <FilterLabel text="Search" tooltip="Search leads by owner name, property address, or folio number." />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Owner, address, folio…"
              value={filters.search}
              onChange={(e) => update('search', e.target.value)}
              className="w-52 rounded-md border border-zinc-200 dark:border-slate-600 bg-zinc-50 dark:bg-slate-700 pl-8 pr-2.5 py-1 text-[13px] text-zinc-700 dark:text-slate-200
                         focus:bg-white dark:focus:bg-slate-700 focus:border-zinc-400 dark:focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-slate-500/20
                         placeholder:text-zinc-300 dark:placeholder:text-slate-500 transition-colors"
            />
          </div>
        </div>

        <div className="w-px h-4 bg-zinc-100 dark:bg-slate-700 flex-shrink-0" />

        {/* ZIP */}
        <div className="flex items-center gap-2">
          <FilterLabel text="ZIP" tooltip="Filter leads by ZIP code. Only shows properties in that ZIP." />
          <input
            type="text"
            placeholder="33125"
            maxLength={5}
            value={filters.zip}
            onChange={(e) => update('zip', e.target.value.replace(/\D/g, ''))}
            className="w-20 rounded-md border border-zinc-200 dark:border-slate-600 bg-zinc-50 dark:bg-slate-700 px-2.5 py-1 text-[13px] text-zinc-700 dark:text-slate-200
                       focus:bg-white dark:focus:bg-slate-700 focus:border-zinc-400 dark:focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-slate-500/20
                       placeholder:text-zinc-300 dark:placeholder:text-slate-500 transition-colors"
          />
        </div>

        <div className="w-px h-4 bg-zinc-100 dark:bg-slate-700 flex-shrink-0" />

        <div className="flex items-center gap-2">
          <FilterLabel text="Damage" tooltip="Filter by the type of property damage on the permit." />
          <select
            value={filters.damageType}
            onChange={(e) => update('damageType', e.target.value as FilterState['damageType'])}
            className="select-input w-40"
          >
            {DAMAGE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FilterLabel text="County" tooltip="Filter by county — Miami-Dade, Broward, or Palm Beach." />
          <select
            value={filters.county}
            onChange={(e) => update('county', e.target.value as FilterState['county'])}
            className="select-input w-32"
          >
            {COUNTY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FilterLabel text="Owner Type" tooltip="Filter out business, government, and institutional owners when you only want actual people." />
          <select
            value={filters.ownerType}
            onChange={(e) => update('ownerType', e.target.value as FilterState['ownerType'])}
            className="select-input w-36"
          >
            <option value="All">All owners</option>
            <option value="Person">People only</option>
            <option value="Business">Businesses only</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FilterLabel text="Status" tooltip="Filter leads by tracking status — New, Contacted, Converted, or Closed." />
          <select
            value={filters.statusFilter}
            onChange={(e) => update('statusFilter', e.target.value as FilterState['statusFilter'])}
            className="select-input w-32"
          >
            <option value="All">All statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Converted">Converted</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FilterLabel text="Insurer" tooltip="Filter leads by insurance company." />
          <select
            value={filters.insurerFilter}
            onChange={(e) => update('insurerFilter', e.target.value)}
            className="select-input w-44"
          >
            <option value="">All insurers</option>
            {availableInsurers.map((ins) => (
              <option key={ins} value={ins}>{ins}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FilterLabel text="FEMA" tooltip="Filter by FEMA disaster declaration status — Tagged (has declaration) or Untagged." />
          <select
            value={filters.femaFilter}
            onChange={(e) => update('femaFilter', e.target.value as FilterState['femaFilter'])}
            className="select-input w-32"
          >
            <option value="All">All</option>
            <option value="Tagged">Tagged</option>
            <option value="Untagged">Untagged</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FilterLabel text="Score" tooltip="Filter by lead priority score. High ≥ 85, Medium 70–84, Low < 70." />
          <select
            value={filters.scoreTier}
            onChange={(e) => update('scoreTier', e.target.value as FilterState['scoreTier'])}
            className="select-input w-32"
          >
            <option value="All">All scores</option>
            <option value="High">High (≥ 85)</option>
            <option value="Medium">Medium (70–84)</option>
            <option value="Low">Low (&lt; 70)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FilterLabel text="Date" tooltip="Filter by permit filing date. Use shorter ranges to see the most recent leads first." />
          <select
            value={filters.dateRange}
            onChange={(e) => update('dateRange', e.target.value as FilterState['dateRange'])}
            className="select-input w-32"
          >
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FilterLabel text="Sort" tooltip="Sort leads by date, score, assessed value, or permit value." />
          <select
            value={filters.sortOrder}
            onChange={(e) => update('sortOrder', e.target.value as FilterState['sortOrder'])}
            className="select-input w-44"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="score">Score (high→low)</option>
            <option value="assessedValue">Assessed Value (high→low)</option>
            <option value="permitValue">Permit Value (high→low)</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="ml-auto flex items-center gap-1 text-[11px] font-medium text-zinc-400 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Row 2: toggles */}
      <div className="px-4 py-2.5 flex items-center gap-5 flex-wrap">
        <Toggle
          label="Has contact"
          checked={filters.hasContact}
          onToggle={() => update('hasContact', !filters.hasContact)}
          tooltipText="Only show leads where we found a phone number or email for the property owner."
        />
        <Toggle
          label="Absentee owner"
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
          label="No contractor"
          checked={filters.noContractor}
          onToggle={() => update('noContractor', !filters.noContractor)}
          tooltipText="Only show leads where no licensed contractor is listed (Owner-Builder or No Contractor status)."
          activeColor="bg-blue-500"
        />
        <Toggle
          label="Pre-permit"
          checked={filters.stormFirst}
          onToggle={() => update('stormFirst', !filters.stormFirst)}
          tooltipText="Only show storm-first leads — properties in storm-affected areas that have not yet filed a permit."
          activeColor="bg-emerald-500"
        />
      </div>
    </div>
  )
}
