import { AlertCircle, ChevronRight, MapPin, ShieldAlert } from 'lucide-react'
import type { StormCandidate, StormWatchStatus } from '@/types'
import { COUNTY_LABELS } from '@/types'
import { cn, formatDate } from '@/lib/utils'
import ScoreBadge from '@/components/ScoreBadge'
import Pagination, { type PageSize } from '@/components/Pagination'
import LoadingSpinner from '@/components/LoadingSpinner'

interface StormWatchTableProps {
  candidates: StormCandidate[]
  totalCandidates: number
  currentPage: number
  pageSize: PageSize
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
  onSelectCandidate: (candidate: StormCandidate) => void
  selectedCandidateId?: string
  loading?: boolean
}

const STATUS_STYLES: Record<StormWatchStatus, string> = {
  Watching: 'bg-slate-100 text-slate-700 border-slate-200',
  Researching: 'bg-blue-50 text-blue-700 border-blue-200',
  'Outreach Ready': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  'Permit Filed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Closed: 'bg-slate-100 text-slate-500 border-slate-200',
}

export default function StormWatchTable({
  candidates,
  totalCandidates,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelectCandidate,
  selectedCandidateId,
  loading,
}: StormWatchTableProps) {
  if (loading) {
    return <LoadingSpinner label="Loading storm candidates..." />
  }

  if (candidates.length === 0) {
    return (
      <div className="workspace-panel flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-slate-500 font-medium">No storm candidates yet</p>
        <p className="text-slate-400 text-sm mt-1">
          Run <code>python3 generate_storm_candidates.py</code> to refresh Storm Watch.
        </p>
      </div>
    )
  }

  return (
    <div className="workspace-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-slate-50/70 px-5 py-4">
        <p className="text-sm font-medium text-slate-500">
          <span className="score-number font-semibold text-slate-900">{totalCandidates}</span>{' '}
          {totalCandidates === 1 ? 'candidate' : 'candidates'} found
        </p>
        <p className="hidden text-2xs font-medium uppercase tracking-[0.18em] text-slate-400 lg:block">Area opportunities stay separate from permit leads</p>
      </div>

      {/* Desktop table — hidden on mobile, visible on lg+ */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200/70">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-6">
                #
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Location
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Storm Event
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Candidate
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Score
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                FEMA
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Event Date
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Status
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.map((candidate, index) => (
              <tr
                key={candidate.id}
                onClick={() => onSelectCandidate(candidate)}
                className={cn(
                  'workspace-row-hover group',
                  selectedCandidateId === candidate.id && 'bg-blue-50/60 border-l-2 border-blue-500',
                )}
              >
                <td className="px-5 py-3.5 text-slate-300 text-xs score-number">{(currentPage - 1) * pageSize + index + 1}</td>

                <td className="px-3 py-3.5">
                  <div className="max-w-[220px] truncate font-semibold text-slate-900">
                    {candidate.locationLabel}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>
                      {COUNTY_LABELS[candidate.county]}
                      {candidate.city ? `, ${candidate.city}` : ''}
                      {candidate.zip ? ` ${candidate.zip}` : ''}
                    </span>
                  </div>
                </td>

                <td className="px-3 py-3.5">
                  <div className="font-medium text-slate-700 max-w-[240px] truncate">{candidate.stormEvent}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{candidate.eventType}</div>
                </td>

                <td className="px-3 py-3.5">
                  <span className={cn(
                    'badge',
                    candidate.candidateType === 'area'
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  )}>
                    {candidate.candidateType === 'area' ? 'Area-based' : 'Property-based'}
                  </span>
                </td>

                <td className="px-3 py-3.5">
                  <ScoreBadge score={candidate.score} size="sm" />
                </td>

                <td className="px-3 py-3.5">
                  {candidate.femaDeclarationNumber ? (
                    <div className="flex items-center gap-1.5 text-orange-700 font-medium">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span className="whitespace-nowrap">{candidate.femaDeclarationNumber}</span>
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs">-</span>
                  )}
                </td>

                <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">
                  {formatDate(candidate.eventDate)}
                </td>

                <td className="px-3 py-3.5">
                  <span className={cn('badge', STATUS_STYLES[candidate.status])}>
                    {candidate.status}
                  </span>
                </td>

                <td className="px-3 py-3.5">
                  <ChevronRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout — visible on mobile, hidden on lg+ */}
      <div className="lg:hidden divide-y divide-slate-100">
        {candidates.map((candidate) => (
          <button
            key={candidate.id}
            onClick={() => onSelectCandidate(candidate)}
            className={cn(
              'w-full text-left px-4 py-3.5 transition-colors duration-100',
              'hover:bg-slate-50/80 focus:outline-none',
              selectedCandidateId === candidate.id && 'bg-blue-50/50',
            )}
          >
            {/* Row 1: Location + Score badge */}
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-slate-900 truncate">
                  {candidate.locationLabel}
                </p>
                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span>
                    {COUNTY_LABELS[candidate.county]}
                    {candidate.city ? `, ${candidate.city}` : ''}
                    {candidate.zip ? ` ${candidate.zip}` : ''}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <ScoreBadge score={candidate.score} size="sm" />
              </div>
            </div>

            {/* Row 2: Storm event + Candidate type */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-slate-700 truncate">
                  {candidate.stormEvent}
                </p>
                <p className="text-[11px] text-slate-400">{candidate.eventType}</p>
              </div>
              <span className={cn(
                'badge flex-shrink-0',
                candidate.candidateType === 'area'
                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200',
              )}>
                {candidate.candidateType === 'area' ? 'Area-based' : 'Property-based'}
              </span>
            </div>

            {/* Row 3: Status + FEMA + Date + Index */}
            <div className="flex items-center justify-between gap-2">
              <span className={cn('badge', STATUS_STYLES[candidate.status])}>
                {candidate.status}
              </span>
              <div className="flex items-center gap-3">
                {candidate.femaDeclarationNumber ? (
                  <div className="flex items-center gap-1 text-orange-700 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span className="whitespace-nowrap text-[11px]">{candidate.femaDeclarationNumber}</span>
                  </div>
                ) : null}
                <span className="text-slate-400 text-[11px] score-number">
                  {formatDate(candidate.eventDate)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalCandidates}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  )
}
