import { useEffect, useRef, useState } from 'react'
import {
  X,
  MapPin,
  Calendar,
  CloudLightning,
  ShieldAlert,
  FileText,
  Target,
  MessageSquare,
  Map,
} from 'lucide-react'
import type { StormCandidate, StormWatchStatus } from '@/types'
import { COUNTY_LABELS } from '@/types'
import { cn, formatDate } from '@/lib/utils'
import ScoreBadge from '@/components/ScoreBadge'

type TrackingPatch = Partial<Pick<StormCandidate, 'status' | 'notes' | 'contactedAt' | 'permitFiledAt' | 'closedAt'>>

interface StormWatchDrawerProps {
  candidate: StormCandidate
  onClose: () => void
  onUpdateStatus: (id: string, status: StormWatchStatus) => void
  onUpdateTracking?: (id: string, patch: TrackingPatch) => void
}

const STATUS_OPTIONS: StormWatchStatus[] = [
  'Watching',
  'Researching',
  'Outreach Ready',
  'Contacted',
  'Permit Filed',
  'Closed',
]

const STATUS_ACTIVE: Record<StormWatchStatus, string> = {
  Watching: 'bg-slate-700 text-white border-slate-700',
  Researching: 'bg-blue-600 text-white border-blue-600',
  'Outreach Ready': 'bg-indigo-600 text-white border-indigo-600',
  Contacted: 'bg-amber-500 text-white border-amber-500',
  'Permit Filed': 'bg-emerald-600 text-white border-emerald-600',
  Closed: 'bg-slate-400 text-white border-slate-400',
}

const STATUS_INACTIVE = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'

export default function StormWatchDrawer({
  candidate,
  onClose,
  onUpdateStatus,
  onUpdateTracking,
}: StormWatchDrawerProps) {
  const [notesValue, setNotesValue] = useState(candidate.notes ?? '')
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNotesValue(candidate.notes ?? '')
  }, [candidate.id, candidate.notes])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    drawerRef.current?.focus()
  }, [candidate.id])

  const hasPreciseLocation = Boolean(candidate.city || candidate.zip)

  return (
    <>
      <div
        className="drawer-backdrop fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Storm Watch details: ${candidate.locationLabel}`}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[520px] bg-white shadow-drawer
                   flex flex-col animate-slide-in focus:outline-none overflow-hidden"
      >
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 leading-snug truncate">
                {candidate.locationLabel}
              </h2>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  {COUNTY_LABELS[candidate.county]}
                  {candidate.city ? `, ${candidate.city}` : ''}
                  {candidate.zip ? ` ${candidate.zip}` : ''}
                </span>
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

          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            <ScoreBadge score={candidate.score} size="md" showLabel />
            <span className={cn(
              'badge',
              candidate.candidateType === 'area'
                ? 'bg-sky-50 text-sky-700 border-sky-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200',
            )}>
              {candidate.candidateType === 'area' ? 'Area-based candidate' : 'Property candidate'}
            </span>
            {candidate.femaDeclarationNumber && (
              <span className="badge bg-orange-50 text-orange-700 border-orange-200">
                FEMA {candidate.femaDeclarationNumber}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {candidate.candidateType === 'area' && (
            <section className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <Map className="w-4 h-4 text-sky-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-sky-900">Area-based opportunity</p>
                  <p className="text-sm text-sky-800 mt-1">
                    This record represents an impacted area, not a verified property lead. Use it to guide research,
                    canvassing, and later property-level enrichment.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Storm Details
            </h3>
            <div className="space-y-2.5">
              <DetailRow
                icon={<CloudLightning className="w-4 h-4" />}
                label="Storm Event"
                value={candidate.stormEvent}
              />
              <DetailRow
                icon={<FileText className="w-4 h-4" />}
                label="Event Type"
                value={candidate.eventType}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4" />}
                label="Event Date"
                value={formatDate(candidate.eventDate)}
              />
              <DetailRow
                icon={<MapPin className="w-4 h-4" />}
                label="County"
                value={COUNTY_LABELS[candidate.county]}
              />
              <DetailRow
                icon={<MapPin className="w-4 h-4" />}
                label="City / ZIP"
                value={
                  hasPreciseLocation
                    ? `${candidate.city || 'Unknown'}${candidate.zip ? ` ${candidate.zip}` : ''}`
                    : 'Not available on this area-level candidate'
                }
              />
              <DetailRow
                icon={<ShieldAlert className="w-4 h-4 text-orange-500" />}
                label="FEMA"
                value={
                  candidate.femaDeclarationNumber
                    ? `${candidate.femaDeclarationNumber}${candidate.femaIncidentType ? ` · ${candidate.femaIncidentType}` : ''}`
                    : 'No FEMA declaration match'
                }
              />
              <DetailRow
                icon={<FileText className="w-4 h-4" />}
                label="Source"
                value={candidate.source}
              />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Narrative
            </h3>
            <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-4">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {candidate.narrative || 'No NOAA narrative was available for this event.'}
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Score
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-slate-400" />
                <ScoreBadge score={candidate.score} size="sm" />
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {candidate.scoreReasoning}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Tracking
            </h3>
            <div className="space-y-3">
              {candidate.contactedAt && (
                <DetailRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Contacted At"
                  value={formatDate(candidate.contactedAt)}
                />
              )}
              {candidate.permitFiledAt && (
                <DetailRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Permit Filed At"
                  value={formatDate(candidate.permitFiledAt)}
                />
              )}
              {candidate.closedAt && (
                <DetailRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Closed At"
                  value={formatDate(candidate.closedAt)}
                />
              )}

              <div className="flex items-start gap-3">
                <span className="mt-2 text-slate-400 flex-shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-400 block mb-1">Notes</span>
                  <textarea
                    rows={4}
                    placeholder="Add Storm Watch notes..."
                    value={notesValue}
                    onChange={(event) => setNotesValue(event.target.value)}
                    onBlur={() => onUpdateTracking?.(candidate.id, { notes: notesValue.trim() })}
                    className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5
                               resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Workflow Status
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => onUpdateStatus(candidate.id, status)}
                  className={cn(
                    'py-2 rounded-lg text-sm font-medium border transition-all duration-150',
                    candidate.status === status ? STATUS_ACTIVE[status] : STATUS_INACTIVE,
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </section>
        </div>

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
