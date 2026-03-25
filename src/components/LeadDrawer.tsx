import { useEffect, useRef, useState } from 'react'
import {
  X,
  MapPin,
  Hash,
  Wrench,
  Calendar,
  CloudLightning,
  Mail,
  Phone,
  Copy,
  Check,
  MessageSquare,
  Home,
  DollarSign,
} from 'lucide-react'
import type { Lead } from '@/types'
import { formatDate, damageTypeColor, cn } from '@/lib/utils'
import ScoreBadge from '@/components/ScoreBadge'

interface LeadDrawerProps {
  lead: Lead
  onClose: () => void
  onUpdateStatus: (id: string, status: Lead['status']) => void
}

const STATUS_OPTIONS: Lead['status'][] = ['New', 'Contacted', 'Closed']

const STATUS_ACTIVE: Record<Lead['status'], string> = {
  New: 'bg-blue-600 text-white border-blue-600',
  Contacted: 'bg-amber-500 text-white border-amber-500',
  Closed: 'bg-slate-400 text-white border-slate-400',
}

const STATUS_INACTIVE = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'

export default function LeadDrawer({ lead, onClose, onUpdateStatus }: LeadDrawerProps) {
  const [copied, setCopied] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Focus trap: focus drawer on open
  useEffect(() => {
    drawerRef.current?.focus()
  }, [lead.id])

  function handleCopy() {
    navigator.clipboard.writeText(lead.outreachMessage).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="drawer-backdrop fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Lead details: ${lead.ownerName}`}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[520px] bg-white shadow-drawer
                   flex flex-col animate-slide-in focus:outline-none overflow-hidden"
      >
        {/* Drawer header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 leading-snug truncate">
                {lead.ownerName}
              </h2>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{lead.propertyAddress}, {lead.city}, FL {lead.zip}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full
                         bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Score + damage type + homestead badge */}
          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            <ScoreBadge score={lead.score} size="md" showLabel />
            <span className={cn('badge', damageTypeColor(lead.damageType))}>
              {lead.damageType}
            </span>
            {lead.homestead === true && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Home className="w-3 h-3" />
                Homestead
              </span>
            )}
            {lead.homestead === false && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
                <Home className="w-3 h-3" />
                Non-Homestead
              </span>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Property details */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Property Details
            </h3>
            <div className="space-y-2.5">
              <DetailRow
                icon={<Hash className="w-4 h-4" />}
                label="Folio Number"
                value={lead.folioNumber}
              />
              <DetailRow
                icon={<Wrench className="w-4 h-4" />}
                label="Permit Type"
                value={lead.permitType}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4" />}
                label="Permit Date"
                value={formatDate(lead.permitDate)}
              />
              <DetailRow
                icon={<CloudLightning className="w-4 h-4" />}
                label="Storm Event"
                value={lead.stormEvent}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4" />}
                label="Lead Date"
                value={formatDate(lead.date)}
              />
              {lead.ownerMailingAddress && lead.ownerMailingAddress !== `${lead.propertyAddress}, ${lead.city}, FL ${lead.zip}` && (
                <DetailRow
                  icon={<MapPin className="w-4 h-4 text-amber-500" />}
                  label="Owner Mailing Address"
                  value={<span className="text-amber-700">{lead.ownerMailingAddress}</span>}
                />
              )}
              {lead.assessedValue && lead.assessedValue > 0 && (
                <DetailRow
                  icon={<DollarSign className="w-4 h-4" />}
                  label="Assessed Value"
                  value={`$${lead.assessedValue.toLocaleString()}`}
                />
              )}
            </div>
          </section>

          {/* Permit Intelligence */}
          {(lead.permitStatus || lead.permitValue || lead.contractorName) && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Permit Intelligence</h3>
              <div className="space-y-1.5 text-sm">
                {lead.permitStatus && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status</span>
                    <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                      lead.permitStatus === 'Owner-Builder' || lead.permitStatus === 'No Contractor' ? 'bg-blue-100 text-blue-700' :
                      lead.permitStatus === 'Stalled' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                    }`}>{lead.permitStatus}</span>
                  </div>
                )}
                {lead.contractorName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contractor</span>
                    <span className="text-slate-800 font-medium text-right max-w-[60%] truncate">{lead.contractorName}</span>
                  </div>
                )}
                {(lead.permitValue ?? 0) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Permit Value</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-800 font-medium">${lead.permitValue!.toLocaleString()}</span>
                      {lead.underpaidFlag && (
                        <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-medium">Likely Underpaid</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Property Intelligence */}
          {(lead.absenteeOwner !== undefined || lead.roofAge !== undefined || (lead.priorPermitCount ?? 0) > 0) && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Property Intelligence</h3>
              <div className="space-y-1.5 text-sm">
                {lead.absenteeOwner !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Owner Occupied</span>
                    {lead.absenteeOwner
                      ? <span className="text-amber-600 font-medium text-xs flex items-center gap-1">⚠ Absentee — out of state</span>
                      : <span className="text-emerald-600 font-medium text-xs">✓ Local owner</span>
                    }
                  </div>
                )}
                {lead.roofAge !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Est. Roof Age</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-800 font-medium">{lead.roofAge} yrs</span>
                      {lead.roofAge > 15 && <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-full">Aging</span>}
                    </div>
                  </div>
                )}
                {(lead.priorPermitCount ?? 0) >= 1 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Prior Permits</span>
                    <span className="text-purple-700 font-medium">{lead.priorPermitCount} prior at this address</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Contact information */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Contact Information
            </h3>
            {lead.contact ? (
              <div className="space-y-2.5">
                {lead.contact.email && (
                  <DetailRow
                    icon={<Mail className="w-4 h-4 text-blue-500" />}
                    label="Email"
                    value={
                      <a
                        href={`mailto:${lead.contact.email}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.contact.email}
                      </a>
                    }
                  />
                )}
                {lead.contact.phone && (
                  <DetailRow
                    icon={<Phone className="w-4 h-4 text-green-500" />}
                    label="Phone"
                    value={
                      <a
                        href={`tel:${lead.contact.phone}`}
                        className="text-green-700 hover:text-green-900 hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.contact.phone}
                      </a>
                    }
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 rounded-lg px-4 py-3">
                <Phone className="w-4 h-4" />
                <span>No contact information available</span>
              </div>
            )}
          </section>

          {/* AI Outreach Message */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" />
                AI Outreach Message
              </h3>
              <button
                onClick={handleCopy}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border transition-all duration-200',
                  copied
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Message
                  </>
                )}
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                {lead.outreachMessage}
              </p>
            </div>
          </section>

          {/* Status selector */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Lead Status
            </h3>
            <div className="flex items-center gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdateStatus(lead.id, s)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-all duration-150',
                    lead.status === s ? STATUS_ACTIVE[s] : STATUS_INACTIVE
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg border border-slate-200 text-sm font-medium
                       text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}

interface DetailRowProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-slate-400 flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-xs text-slate-400 block">{label}</span>
        <span className="text-sm text-slate-800 font-medium">{value}</span>
      </div>
    </div>
  )
}
