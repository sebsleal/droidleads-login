import { ChevronRight, Briefcase } from 'lucide-react'
import type { Case } from '@/types'
import { cn } from '@/lib/utils'
import Pagination, { type PageSize } from '@/components/Pagination'
import LoadingSpinner from '@/components/LoadingSpinner'

interface CasesTableProps {
  cases: Case[]
  totalCases: number
  currentPage: number
  pageSize: PageSize
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
  onSelectCase: (c: Case) => void
  selectedCaseId?: string
  loading?: boolean
}

export function caseStatusColor(phase: string): string {
  if (phase === 'Settled') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (phase === 'Litigation') return 'bg-red-100 text-red-800 border-red-200'
  if (phase === 'Appraisal') return 'bg-orange-100 text-orange-800 border-orange-200'
  if (phase === 'Closed w/o Pay') return 'bg-slate-100 text-slate-600 border-slate-200'
  if (phase.startsWith('OpenPhase:')) return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

export function caseStatusLabel(phase: string): string {
  if (phase.startsWith('OpenPhase: ')) return phase.replace('OpenPhase: ', '')
  return phase
}

function perilBadgeColor(peril: string): string {
  const p = peril.toLowerCase()
  if (p.includes('bathroom') || p.includes('accidental') || p.includes('bath')) return 'bg-teal-100 text-teal-800 border-teal-200'
  if (p.includes('hurricane') || p.includes('wind') || p.includes('hail')) return 'bg-blue-100 text-blue-800 border-blue-200'
  if (p.includes('flood')) return 'bg-cyan-100 text-cyan-800 border-cyan-200'
  if (p.includes('fire')) return 'bg-red-100 text-red-800 border-red-200'
  if (p.includes('roof')) return 'bg-orange-100 text-orange-800 border-orange-200'
  if (p.includes('pipe') || p.includes('plumbing') || p.includes('kitchen') || p.includes('laundry')) return 'bg-purple-100 text-purple-800 border-purple-200'
  if (p.includes('ac') || p.includes('a/c')) return 'bg-indigo-100 text-indigo-800 border-indigo-200'
  if (p.includes('collapse') || p.includes('structural')) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

export default function CasesTable({ cases, totalCases, currentPage, pageSize, onPageChange, onPageSizeChange, onSelectCase, selectedCaseId, loading }: CasesTableProps) {
  if (loading) {
    return <LoadingSpinner label="Loading cases..." />
  }

  if (cases.length === 0) {
    return (
      <div className="workspace-panel px-6 py-16 text-center">
        <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">No cases match your filters</p>
        <p className="text-slate-400 text-sm mt-1">Try clearing filters or check back after importing CRM data</p>
      </div>
    )
  }

  return (
    <div className="workspace-panel overflow-hidden">
      {/* Table header */}
      <div className="hidden grid-cols-[2fr_2fr_1.2fr_1.5fr_1fr_1fr_32px] gap-4 border-b border-slate-200/70 bg-slate-50/70 px-5 py-4 lg:grid">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Client</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Property</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Claim Type</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Insurance Co.</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</span>
        <span className="text-right text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Fee Collected</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {cases.map((c) => {
          const isSelected = c.id === selectedCaseId
          return (
            <button
              key={c.id}
              onClick={() => onSelectCase(c)}
              className={cn(
                'group w-full px-5 py-4 text-left transition-colors duration-100',
                'focus:bg-blue-50/50 focus:outline-none hover:bg-slate-50/90',
                isSelected && 'bg-blue-50/60 border-l-2 border-zinc-700',
              )}
            >
              {/* Mobile layout */}
              <div className="lg:hidden">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.clientName}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{c.lossAddress}</p>
                  </div>
                  <span className={cn('badge flex-shrink-0 text-[10px]', caseStatusColor(c.statusPhase))}>
                    {caseStatusLabel(c.statusPhase)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {c.perilType && (
                    <span className={cn('badge text-[10px]', perilBadgeColor(c.perilType))}>
                      {c.perilType}
                    </span>
                  )}
                  {c.feeDisbursed != null && c.feeDisbursed > 0 && (
                    <span className="text-xs text-emerald-700 font-semibold">
                      ${c.feeDisbursed.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Desktop layout */}
              <div className="hidden lg:grid grid-cols-[2fr_2fr_1.2fr_1.5fr_1fr_1fr_32px] gap-4 items-center">
                {/* Client */}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{c.clientName}</p>
                  <p className="text-xs text-slate-400 truncate">#{c.fileNumber}</p>
                </div>

                {/* Property */}
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 truncate">{c.lossAddress}</p>
                  {c.lossDate && (
                    <p className="text-xs text-slate-400 truncate">
                      Loss: {new Date(c.lossDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>

                {/* Claim Type */}
                <div>
                  {c.perilType ? (
                    <span className={cn('badge text-[11px]', perilBadgeColor(c.perilType))}>
                      {c.perilType}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>

                {/* Insurance Company */}
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 truncate">{c.insuranceCompany ?? '—'}</p>
                  {c.claimNumber && (
                    <p className="text-xs text-slate-400 truncate">#{c.claimNumber}</p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <span className={cn('badge text-[11px]', caseStatusColor(c.statusPhase))}>
                    {caseStatusLabel(c.statusPhase)}
                  </span>
                </div>

                {/* Fee Collected */}
                <div className="text-right">
                  {c.feeDisbursed != null && c.feeDisbursed > 0 ? (
                    <span className="text-sm font-semibold text-emerald-700">
                      ${c.feeDisbursed.toLocaleString()}
                    </span>
                  ) : c.estimatedLoss != null && c.feeRate != null ? (
                    <span className="text-xs text-slate-400">
                      ~${Math.round(c.estimatedLoss * c.feeRate).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>

                {/* Chevron */}
                <div className="flex justify-end">
                  <ChevronRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalCases}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  )
}
