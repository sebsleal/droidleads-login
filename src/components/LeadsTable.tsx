import { useState, useCallback } from 'react'
import { Mail, Phone, ChevronRight } from 'lucide-react'
import type { Lead } from '@/types'
import { formatDate, damageTypeColor, cn, displayOwnerName } from '@/lib/utils'
import ScoreBadge from '@/components/ScoreBadge'
import ScoreBreakdownPopover from '@/components/ScoreBreakdownPopover'
import Pagination, { type PageSize } from '@/components/Pagination'
import EmptyState from '@/components/EmptyState'
import TableSkeleton from '@/components/TableSkeleton'

interface LeadsTableProps {
  leads: Lead[]
  totalLeads: number
  currentPage: number
  pageSize: PageSize
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
  onSelectLead: (lead: Lead) => void
  selectedLeadId?: string
  loading?: boolean
}

const STATUS_STYLES: Record<Lead['status'], string> = {
  New: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  Contacted: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  Converted: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  Closed: 'bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700',
}

const TH = 'text-left px-3 py-3 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider'

interface ScorePopoverState {
  lead: Lead
  anchorRect: DOMRect
}

export default function LeadsTable({ leads, totalLeads, currentPage, pageSize, onPageChange, onPageSizeChange, onSelectLead, selectedLeadId, loading }: LeadsTableProps) {
  const [scorePopover, setScorePopover] = useState<ScorePopoverState | null>(null)

  const handleScoreClick = useCallback((e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setScorePopover(prev =>
      prev?.lead.id === lead.id ? null : { lead, anchorRect: rect }
    )
  }, [])

  if (loading) {
    return <TableSkeleton rows={pageSize} columns={9} />
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        title="No leads found"
        description="Try adjusting your filters to see more results."
        icon="search"
      />
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Count bar */}
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-slate-700 flex items-center justify-between bg-zinc-50/50 dark:bg-slate-800/50">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="text-slate-900 dark:text-white font-semibold score-number">{totalLeads.toLocaleString()}</span>
          {' '}{totalLeads === 1 ? 'lead' : 'leads'} found
        </p>
        <p className="text-2xs text-slate-400 dark:text-slate-500 hidden lg:block">Click a row to view details</p>
      </div>

      {/* Desktop table — hidden on mobile, visible on lg+ */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="table-sticky-header">
            <tr className="border-b border-zinc-100 dark:border-slate-700 bg-zinc-50/95 dark:bg-slate-800/95">
              <th className={cn(TH, 'px-5 w-8')}>#</th>
              <th className={TH}>Property Address</th>
              <th className={TH}>Owner</th>
              <th className={TH}>Damage</th>
              <th className={TH}>Score</th>
              <th className={TH}>Date</th>
              <th className={TH}>Contact</th>
              <th className={TH}>Status</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
            {leads.map((lead, idx) => (
              <tr
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={cn(
                  'group transition-all duration-150 cursor-pointer border-l-2 border-transparent',
                  'hover:bg-zinc-50 dark:hover:bg-slate-800/50 hover:border-l-primary-500',
                  selectedLeadId === lead.id && 'bg-primary-50/60 dark:bg-primary-900/20 border-l-primary-500'
                )}
              >
                {/* Index */}
                <td className="px-5 py-3.5 text-slate-400 dark:text-slate-500 text-2xs score-number">
                  {(currentPage - 1) * pageSize + idx + 1}
                </td>

                {/* Address */}
                <td className="px-3 py-3.5">
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                    {lead.propertyAddress}
                  </div>
                  <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lead.city}, FL {lead.zip}
                  </div>
                  {/* Flag pills */}
                  {(() => {
                    const pills: { label: string; color: string }[] = [];
                    if (lead.underpaidFlag) pills.push({ label: 'Underpaid', color: 'bg-red-50 text-red-500 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' });
                    if (lead.absenteeOwner) pills.push({ label: 'Absentee', color: 'bg-amber-50 text-amber-500 border border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' });
                    if (lead.permitStatus === 'Owner-Builder') pills.push({ label: 'Owner-Builder', color: 'bg-blue-50 text-blue-500 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' });
                    if (lead.permitStatus === 'Stalled') pills.push({ label: 'Stalled', color: 'bg-orange-50 text-orange-500 border border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' });
                    if (lead.permitStatus === 'No Contractor') pills.push({ label: 'No Contractor', color: 'bg-blue-50 text-blue-500 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' });
                    if ((lead.roofAge ?? 0) > 15) pills.push({ label: 'Aging Building', color: 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' });
                    if ((lead.priorPermitCount ?? 0) >= 1) pills.push({ label: 'Repeat', color: 'bg-purple-50 text-purple-500 border border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' });
                    if (pills.length === 0) return null;
                    return (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {pills.slice(0, 2).map(p => (
                          <span key={p.label} className={`text-2xs font-medium px-1.5 py-0.5 rounded ${p.color}`}>{p.label}</span>
                        ))}
                        {pills.length > 2 && <span className="text-2xs text-slate-400 dark:text-slate-500">+{pills.length - 2}</span>}
                      </div>
                    );
                  })()}
                </td>

                {/* Owner */}
                <td className="px-3 py-3.5">
                  {(() => {
                    const { display, isPlaceholder } = displayOwnerName(lead.ownerName);
                    return (
                      <span className={isPlaceholder
                        ? 'text-slate-400 dark:text-slate-500 italic text-xs'
                        : 'text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap'
                      }>
                        {display}
                      </span>
                    );
                  })()}
                </td>

                {/* Damage type */}
                <td className="px-3 py-3.5">
                  <span className={cn('badge', damageTypeColor(lead.damageType))}>
                    {lead.damageType}
                  </span>
                </td>

                {/* Score */}
                <td className="px-3 py-3.5">
                  <button
                    onClick={(e) => handleScoreClick(e, lead)}
                    className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
                    title="Click to see score breakdown"
                  >
                    <ScoreBadge score={lead.score} size="sm" />
                  </button>
                </td>

                {/* Date */}
                <td className="px-3 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap score-number">
                  {formatDate(lead.date)}
                </td>

                {/* Contact icons */}
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2">
                    {lead.contact?.email ? (
                      <a
                        href={`mailto:${lead.contact.email}`}
                        title={lead.contact.email}
                        aria-label={lead.contact.email}
                        className="text-primary-400 hover:text-primary-600 dark:text-primary-500 dark:hover:text-primary-400 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    ) : null}
                    {lead.contact?.phone ? (
                      <a
                        href={`tel:${lead.contact.phone}`}
                        title={lead.contact.phone}
                        aria-label={lead.contact.phone}
                        className="text-emerald-400 hover:text-emerald-600 dark:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    ) : null}
                    {!lead.contact?.email && !lead.contact?.phone && (
                      <span className="text-slate-300 dark:text-slate-600 text-2xs">—</span>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="px-3 py-3.5">
                  <span className={cn('badge', STATUS_STYLES[lead.status])}>
                    {lead.status}
                  </span>
                </td>

                {/* Arrow */}
                <td className="px-3 py-3.5">
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 transition-colors transform group-hover:translate-x-0.5" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout — visible on mobile, hidden on lg+ */}
      <div className="lg:hidden divide-y divide-zinc-100 dark:divide-slate-800">
        {leads.map((lead, idx) => {
          const { display: ownerDisplay, isPlaceholder } = displayOwnerName(lead.ownerName);
          return (
            <button
              key={lead.id}
              onClick={() => onSelectLead(lead)}
              className={cn(
                'w-full text-left px-4 py-4 transition-all duration-150',
                'hover:bg-zinc-50 dark:hover:bg-slate-800/50 focus:outline-none active:scale-[0.99]',
                selectedLeadId === lead.id && 'bg-primary-50/60 dark:bg-primary-900/20'
              )}
            >
              {/* Row 1: Address + Score badge */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {lead.propertyAddress}
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lead.city}, FL {lead.zip}
                  </p>
                </div>
                <button
                  onClick={(e) => handleScoreClick(e, lead)}
                  className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
                  title="Click to see score breakdown"
                >
                  <ScoreBadge score={lead.score} size="sm" />
                </button>
              </div>

              {/* Row 2: Owner + Damage type */}
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  'text-xs truncate',
                  isPlaceholder ? 'text-slate-400 dark:text-slate-500 italic' : 'text-slate-700 dark:text-slate-300 font-medium'
                )}>
                  {ownerDisplay}
                </span>
                <span className={cn('badge', damageTypeColor(lead.damageType))}>
                  {lead.damageType}
                </span>
              </div>

              {/* Row 3: Status + Contact icons + Index */}
              <div className="flex items-center justify-between gap-2">
                <span className={cn('badge', STATUS_STYLES[lead.status])}>
                  {lead.status}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {lead.contact?.email ? (
                      <a
                        href={`mailto:${lead.contact.email}`}
                        title={lead.contact.email}
                        aria-label={lead.contact.email}
                        className="text-primary-400 hover:text-primary-600 dark:text-primary-500 dark:hover:text-primary-400 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    ) : null}
                    {lead.contact?.phone ? (
                      <a
                        href={`tel:${lead.contact.phone}`}
                        title={lead.contact.phone}
                        aria-label={lead.contact.phone}
                        className="text-emerald-400 hover:text-emerald-600 dark:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    ) : null}
                    {!lead.contact?.email && !lead.contact?.phone && (
                      <span className="text-slate-300 dark:text-slate-600 text-2xs">—</span>
                    )}
                  </div>
                  <span className="text-slate-400 dark:text-slate-500 text-2xs score-number">
                    {(currentPage - 1) * pageSize + idx + 1}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalLeads}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      {scorePopover && (
        <ScoreBreakdownPopover
          score={scorePopover.lead.score}
          breakdown={scorePopover.lead.scoreBreakdown}
          anchorRect={scorePopover.anchorRect}
          onClose={() => setScorePopover(null)}
        />
      )}
    </div>
  )
}
