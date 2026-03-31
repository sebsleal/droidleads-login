import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { ScoreBreakdown } from '@/types'
import { getScoreTier, scoreTierColors, cn } from '@/lib/utils'

interface ScoreBreakdownPopoverProps {
  score: number
  breakdown: ScoreBreakdown | undefined
  onClose: () => void
  anchorRect: DOMRect
}

export default function ScoreBreakdownPopover({
  score,
  breakdown,
  onClose,
  anchorRect,
}: ScoreBreakdownPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const tier = getScoreTier(score)
  const colors = scoreTierColors(tier)
  const isExpectedValueFactor = (label: string) => /(^|\b)(ev|expected value)(\b|$)/i.test(label)
  const expectedValueFactor = breakdown?.factors.find((factor) => isExpectedValueFactor(factor.label))
  const orderedFactors = breakdown
    ? breakdown.factors.filter((factor) => factor !== expectedValueFactor)
    : []

  // Position the popover below (or above) the anchor
  const viewportH = window.innerHeight
  const popoverH = 320
  const spaceBelow = viewportH - anchorRect.bottom
  const top = spaceBelow > popoverH + 8
    ? anchorRect.bottom + window.scrollY + 6
    : anchorRect.top + window.scrollY - popoverH - 6
  const left = Math.min(
    anchorRect.left + window.scrollX,
    window.innerWidth - 320 - 16
  )

  return (
    <div
      ref={ref}
      style={{ top, left, width: 304 }}
      className="fixed z-50 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className={cn('px-4 py-3 flex items-center justify-between', colors.bg)}>
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', colors.dot)} />
          <span className={cn('font-bold score-number text-lg', colors.text)}>{score}</span>
          <span className={cn('text-xs font-medium opacity-70', colors.text)}>
            {tier === 'high' ? 'High Priority' : tier === 'medium' ? 'Medium Priority' : 'Low Priority'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 transition-colors p-0.5 rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 max-h-64 overflow-y-auto">
        {!breakdown ? (
          <p className="text-zinc-400 text-[12px]">No breakdown available — lead predates this feature. Score will update on next scraper run.</p>
        ) : (
          <div className="space-y-1">
            {/* Base row */}
            <div className="flex items-center justify-between py-1.5 border-b border-zinc-50">
              <span className="text-[12px] text-zinc-500">Base score</span>
              <span className="text-[12px] font-semibold text-zinc-400 score-number">+{breakdown.base}</span>
            </div>

            {expectedValueFactor ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 mt-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">EV factor</p>
                    <p className="text-[12px] font-medium text-emerald-900 leading-tight mt-0.5">{expectedValueFactor.label}</p>
                  </div>
                  <span className={cn(
                    'text-[12px] font-bold score-number shrink-0',
                    expectedValueFactor.delta > 0 ? 'text-emerald-700' : 'text-red-500'
                  )}>
                    {expectedValueFactor.delta > 0 ? '+' : ''}{expectedValueFactor.delta}
                  </span>
                </div>
                {expectedValueFactor.note && (
                  <p className="text-[10px] text-emerald-800/80 leading-snug mt-1.5">{expectedValueFactor.note}</p>
                )}
              </div>
            ) : null}

            {/* Factor rows */}
            {orderedFactors.map((f, i) => (
              <div key={`${f.label}-${i}`} className="py-1.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-zinc-700 leading-tight">{f.label}</p>
                  {f.note && (
                    <p className="text-[10px] text-zinc-400 leading-snug mt-0.5">{f.note}</p>
                  )}
                </div>
                <span className={cn(
                  'text-[12px] font-bold score-number shrink-0',
                  f.delta > 0 ? 'text-emerald-600' : 'text-red-500'
                )}>
                  {f.delta > 0 ? '+' : ''}{f.delta}
                </span>
              </div>
            ))}

            {!expectedValueFactor ? (
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 mt-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">EV factor</p>
                <p className="text-[12px] text-zinc-500 mt-1">Expected value data is not available for this lead yet.</p>
              </div>
            ) : null}

            {/* Total */}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-zinc-100">
              <span className="text-[12px] font-semibold text-zinc-600">Total score</span>
              <span className={cn('text-[13px] font-bold score-number', colors.text)}>{breakdown.total}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
