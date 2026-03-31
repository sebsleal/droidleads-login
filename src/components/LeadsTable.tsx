import { useState, useCallback } from 'react'
import { Mail, Phone, AlertCircle, ChevronRight } from 'lucide-react'
import type { Lead } from '@/types'
import { formatDate, damageTypeColor, cn, displayOwnerName } from '@/lib/utils'
import ScoreBadge from '@/components/ScoreBadge'
import ScoreBreakdownPopover from '@/components/ScoreBreakdownPopover'
import Pagination, { type PageSize } from '@/components/Pagination'
import LoadingSpinner from '@/components/LoadingSpinner'

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
  New: 'bg-blue-50 text-blue-600 border-blue-100',
  Contacted: 'bg-amber-50 text-amber-600 border-amber-100',
  Converted: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  Closed: 'bg-zinc-100 text-zinc-400 border-zinc-200',
}

const TH = 'text-left px-3 py-2.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.08em]'

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
    return <LoadingSpinner label="Loading leads..." />
  }

  if (leads.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-8 h-8 text-zinc-200 mb-3" />
        <p className="text-zinc-500 font-medium text-[14px]">No leads found</p>
        <p className="text-zinc-400 text-[13px] mt-1">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Count bar */}
      <div className="px-4 py-2.5 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
        <p className="text-[13px] text-zinc-500">
          <span className="text-zinc-900 font-semibold score-number">{totalLeads.toLocaleString()}</span>
          {' '}{totalLeads === 1 ? 'lead' : 'leads'} found
        </p>
        <p className="text-[11px] text-zinc-300 hidden lg:block">Click a row to view details</p>
      </div>

      {/* Desktop table — hidden on mobile, visible on lg+ */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/40">
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
          <tbody className="divide-y divide-zinc-50">
            {leads.map((lead, idx) => (
              <tr
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={cn(
                  'table-row-hover group',
                  selectedLeadId === lead.id && 'bg-blue-50/50'
                )}
              >
                {/* Index */}
                <td className="px-5 py-3 text-zinc-300 text-[11px] score-number">
                  {(currentPage - 1) * pageSize + idx + 1}
                </td>

                {/* Address */}
                <td className="px-3 py-3">
                  <div className="text-[13px] font-medium text-zinc-900 truncate max-w-[200px]">
                    {lead.propertyAddress}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {lead.city}, FL {lead.zip}
                  </div>
                  {/* Flag pills */}
                  {(() => {
                    const pills: { label: string; color: string }[] = [];
                    if (lead.underpaidFlag) pills.push({ label: 'Underpaid', color: 'bg-red-50 text-red-500 border border-red-100' });
                    if (lead.absenteeOwner) pills.push({ label: 'Absentee', color: 'bg-amber-50 text-amber-500 border border-amber-100' });
                    if (lead.permitStatus === 'Owner-Builder') pills.push({ label: 'Owner-Builder', color: 'bg-blue-50 text-blue-500 border border-blue-100' });
                    if (lead.permitStatus === 'Stalled') pills.push({ label: 'Stalled', color: 'bg-orange-50 text-orange-500 border border-orange-100' });
                    if (lead.permitStatus === 'No Contractor') pills.push({ label: 'No Contractor', color: 'bg-blue-50 text-blue-500 border border-blue-100' });
                    if ((lead.roofAge ?? 0) > 15) pills.push({ label: 'Aging Building', color: 'bg-zinc-100 text-zinc-500 border border-zinc-200' });
                    if ((lead.priorPermitCount ?? 0) >= 1) pills.push({ label: 'Repeat', color: 'bg-purple-50 text-purple-500 border border-purple-100' });
                    if (pills.length === 0) return null;
                    return (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {pills.slice(0, 2).map(p => (
                          <span key={p.label} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${p.color}`}>{p.label}</span>
                        ))}
                        {pills.length > 2 && <span className="text-[10px] text-zinc-400">+{pills.length - 2}</span>}
                      </div>
                    );
                  })()}
                </td>

                {/* Owner */}
                <td className="px-3 py-3">
                  {(() => {
                    const { display, isPlaceholder } = displayOwnerName(lead.ownerName);
                    return (
                      <span className={isPlaceholder
                        ? 'text-zinc-300 italic text-[12px]'
                        : 'text-[13px] font-medium text-zinc-700 whitespace-nowrap'
                      }>
                        {display}
                      </span>
                    );
                  })()}
                </td>

                {/* Damage type */}
                <td className="px-3 py-3">
                  <span className={cn('badge', damageTypeColor(lead.damageType))}>
                    {lead.damageType}
                  </span>
                </td>

                {/* Score */}
                <td className="px-3 py-3">
                  <button
                    onClick={(e) => handleScoreClick(e, lead)}
                    className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
                    title="Click to see score breakdown"
                  >
                    <ScoreBadge score={lead.score} size="sm" />
                  </button>
                </td>

                {/* Date */}
                <td className="px-3 py-3 text-[12px] text-zinc-400 whitespace-nowrap score-number">
                  {formatDate(lead.date)}
                </td>

                {/* Contact icons */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    {lead.contact?.email ? (
                      <a
                        href={`mailto:${lead.contact.email}`}
                        title={lead.contact.email}
                        aria-label={lead.contact.email}
                        className="text-blue-300 hover:text-blue-500 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                    {lead.contact?.phone ? (
                      <a
                        href={`tel:${lead.contact.phone}`}
                        title={lead.contact.phone}
                        aria-label={lead.contact.phone}
                        className="text-emerald-400 hover:text-emerald-600 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                    {!lead.contact?.email && !lead.contact?.phone && (
                      <span className="text-zinc-200 text-[11px]">—</span>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="px-3 py-3">
                  <span className={cn('badge', STATUS_STYLES[lead.status])}>
                    {lead.status}
                  </span>
                </td>

                {/* Arrow */}
                <td className="px-3 py-3">
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-200 group-hover:text-zinc-400 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout — visible on mobile, hidden on lg+ */}
      <div className="lg:hidden divide-y divide-zinc-50">
        {leads.map((lead, idx) => {
          const { display: ownerDisplay, isPlaceholder } = displayOwnerName(lead.ownerName);
          return (
            <button
              key={lead.id}
              onClick={() => onSelectLead(lead)}
              className={cn(
                'w-full text-left px-4 py-3.5 transition-colors duration-100',
                'hover:bg-zinc-50/80 focus:outline-none',
                selectedLeadId === lead.id && 'bg-blue-50/50'
              )}
            >
              {/* Row 1: Address + Score badge */}
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-zinc-900 truncate">
                    {lead.propertyAddress}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
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
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn(
                  'text-[12px] truncate',
                  isPlaceholder ? 'text-zinc-300 italic' : 'text-zinc-700 font-medium'
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
                  <div className="flex items-center gap-1">
                    {lead.contact?.email ? (
                      <a
                        href={`mailto:${lead.contact.email}`}
                        title={lead.contact.email}
                        aria-label={lead.contact.email}
                        className="text-blue-300 hover:text-blue-500 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                    {lead.contact?.phone ? (
                      <a
                        href={`tel:${lead.contact.phone}`}
                        title={lead.contact.phone}
                        aria-label={lead.contact.phone}
                        className="text-emerald-400 hover:text-emerald-600 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                    {!lead.contact?.email && !lead.contact?.phone && (
                      <span className="text-zinc-200 text-[11px]">—</span>
                    )}
                  </div>
                  <span className="text-zinc-300 text-[11px] score-number">
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
