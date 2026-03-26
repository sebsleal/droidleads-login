import { ChevronRight, Briefcase } from 'lucide-react'
import type { Case } from '@/types'
import { cn } from '@/lib/utils'

interface CasesTableProps {
  cases: Case[]
  onSelectCase: (c: Case) => void
  selectedCaseId?: string
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

export default function CasesTable({ cases, onSelectCase, selectedCaseId }: CasesTableProps) {
  if (cases.length === 0) {
    return (
      <div className="card px-6 py-16 text-center">
        <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">No cases match your filters</p>
        <p className="text-slate-400 text-sm mt-1">Try clearing filters or check back after importing CRM data</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Table header */}
      <div className="hidden lg:grid grid-cols-[2fr_2fr_1.2fr_1.5fr_1fr_1fr_32px] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Client</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Property</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Claim Type</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Insurance Co.</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">Fee Collected</span>
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
                'w-full text-left px-5 py-4 transition-colors duration-100',
                'hover:bg-slate-50/80 focus:outline-none focus:bg-blue-50/50',
                isSelected && 'bg-blue-50/60 border-l-2 border-navy-700',
              )}
            >
              {/* Mobile layout */}
              <div className="lg:hidden">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.clientName}</p>
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
                  <p className="text-sm font-semibold text-slate-900 truncate">{c.clientName}</p>
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
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer count */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
        <p className="text-xs text-slate-400">
          {cases.length} {cases.length === 1 ? 'case' : 'cases'}
        </p>
      </div>
    </div>
  )
}
