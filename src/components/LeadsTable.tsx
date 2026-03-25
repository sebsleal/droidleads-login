import { Mail, Phone, AlertCircle, ChevronRight } from 'lucide-react'
import type { Lead } from '@/types'
import { formatDate, damageTypeColor, cn } from '@/lib/utils'
import ScoreBadge from '@/components/ScoreBadge'

interface LeadsTableProps {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
  selectedLeadId?: string
}

const STATUS_STYLES: Record<Lead['status'], string> = {
  New: 'bg-blue-50 text-blue-700 border-blue-200',
  Contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  Closed: 'bg-slate-100 text-slate-500 border-slate-200',
}

export default function LeadsTable({ leads, onSelectLead, selectedLeadId }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-slate-500 font-medium">No leads yet</p>
        <p className="text-slate-400 text-sm mt-1">Run the scheduled task to pull fresh leads from Miami-Dade</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Table header row + result count */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          <span className="text-navy-900 font-bold score-number">{leads.length}</span>{' '}
          {leads.length === 1 ? 'lead' : 'leads'} found
        </p>
        <p className="text-xs text-slate-400">Click a row to view details</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-6">
                #
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Property Address
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Owner Name
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Damage Type
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Score
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Date
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Contact
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Status
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {leads.map((lead, idx) => (
              <tr
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={cn(
                  'table-row-hover group',
                  selectedLeadId === lead.id && 'bg-blue-50/60'
                )}
              >
                {/* Index */}
                <td className="px-5 py-3.5 text-slate-300 text-xs score-number">
                  {idx + 1}
                </td>

                {/* Address */}
                <td className="px-3 py-3.5">
                  <div className="font-medium text-slate-900 truncate max-w-[200px]">
                    {lead.propertyAddress}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {lead.city}, FL {lead.zip}
                  </div>
                  {/* Flag pills */}
                  {(() => {
                    const pills: { label: string; color: string }[] = [];
                    if (lead.underpaidFlag) pills.push({ label: 'Underpaid', color: 'bg-red-100 text-red-700 border border-red-200' });
                    if (lead.absenteeOwner) pills.push({ label: 'Absentee', color: 'bg-amber-100 text-amber-700 border border-amber-200' });
                    if (lead.permitStatus === 'Owner-Builder') pills.push({ label: 'Owner-Builder', color: 'bg-blue-100 text-blue-700 border border-blue-200' });
                    if (lead.permitStatus === 'Stalled') pills.push({ label: 'Stalled', color: 'bg-orange-100 text-orange-700 border border-orange-200' });
                    if (lead.permitStatus === 'No Contractor') pills.push({ label: 'No Contractor', color: 'bg-blue-100 text-blue-700 border border-blue-200' });
                    if ((lead.roofAge ?? 0) > 15) pills.push({ label: 'Aging Roof', color: 'bg-slate-100 text-slate-600 border border-slate-200' });
                    if ((lead.priorPermitCount ?? 0) >= 1) pills.push({ label: 'Repeat', color: 'bg-purple-100 text-purple-700 border border-purple-200' });
                    if (pills.length === 0) return null;
                    return (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {pills.slice(0, 2).map(p => (
                          <span key={p.label} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${p.color}`}>{p.label}</span>
                        ))}
                        {pills.length > 2 && <span className="text-[10px] text-slate-400">+{pills.length - 2}</span>}
                      </div>
                    );
                  })()}
                </td>

                {/* Owner */}
                <td className="px-3 py-3.5">
                  <span className="font-medium text-slate-700 whitespace-nowrap">{lead.ownerName}</span>
                </td>

                {/* Damage type */}
                <td className="px-3 py-3.5">
                  <span className={cn('badge', damageTypeColor(lead.damageType))}>
                    {lead.damageType}
                  </span>
                </td>

                {/* Score */}
                <td className="px-3 py-3.5">
                  <ScoreBadge score={lead.score} size="sm" />
                </td>

                {/* Date */}
                <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">
                  {formatDate(lead.date)}
                </td>

                {/* Contact icons */}
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {lead.contact?.email && (
                      <span title={lead.contact.email} className="text-blue-400 hover:text-blue-600">
                        <Mail className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {lead.contact?.phone && (
                      <span title={lead.contact.phone} className="text-green-500 hover:text-green-700">
                        <Phone className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {!lead.contact && (
                      <span className="text-slate-300 text-xs">—</span>
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
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
