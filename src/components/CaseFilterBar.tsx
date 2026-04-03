import { X, Search } from 'lucide-react'
import type { CaseFilterState } from '@/types'
import { cn } from '@/lib/utils'

interface CaseFilterBarProps {
  filters: CaseFilterState
  onChange: (f: CaseFilterState) => void
  onClear: () => void
  availableInsurers: string[]
  availablePerils: string[]
}

const STATUS_GROUPS = [
  { value: 'All', label: 'All Cases' },
  { value: 'Open', label: 'Open' },
  { value: 'Settled', label: 'Settled' },
  { value: 'Litigation', label: 'Litigation' },
  { value: 'Closed', label: 'Closed w/o Pay' },
] as const

const DATE_RANGES = [
  { value: 'all', label: 'All time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
] as const

const isDefault = (f: CaseFilterState) =>
  f.search === '' &&
  f.statusGroup === 'All' &&
  f.insuranceCompany === '' &&
  f.perilType === '' &&
  f.dateRange === 'all'

export default function CaseFilterBar({ filters, onChange, onClear, availableInsurers, availablePerils }: CaseFilterBarProps) {
  const hasActive = !isDefault(filters)

  function update<K extends keyof CaseFilterState>(key: K, value: CaseFilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="workspace-filter-shell px-4 py-4">
      <div className="flex flex-wrap items-center gap-3">

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search client or address…"
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            className={cn('workspace-input flex-1')}
          />
        </div>

        {/* Status group */}
        <div className="flex items-center gap-2">
          <label className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Status</label>
          <select
            value={filters.statusGroup}
            onChange={(e) => update('statusGroup', e.target.value as CaseFilterState['statusGroup'])}
            className="select-input w-36"
          >
            {STATUS_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>

        {/* Insurance Company */}
        {availableInsurers.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Insurer</label>
            <select
              value={filters.insuranceCompany}
              onChange={(e) => update('insuranceCompany', e.target.value)}
              className="select-input w-44"
            >
              <option value="">All insurers</option>
              {availableInsurers.map((ins) => (
                <option key={ins} value={ins}>{ins}</option>
              ))}
            </select>
          </div>
        )}

        {/* Peril Type */}
        {availablePerils.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Claim Type</label>
            <select
              value={filters.perilType}
              onChange={(e) => update('perilType', e.target.value)}
              className="select-input w-40"
            >
              <option value="">All types</option>
              {availablePerils.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <label className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Date</label>
          <select
            value={filters.dateRange}
            onChange={(e) => update('dateRange', e.target.value as CaseFilterState['dateRange'])}
            className="select-input w-32"
          >
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {hasActive && (
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
