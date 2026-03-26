import { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  text: string
  children: React.ReactNode
  position?: 'top' | 'bottom'
}

export default function Tooltip({ text, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible && wrapperRef.current && tooltipRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      const tip = tooltipRef.current.getBoundingClientRect()
      const scrollY = window.scrollY

      let top = position === 'top'
        ? rect.top + scrollY - tip.height - 8
        : rect.bottom + scrollY + 8

      // Clamp horizontally so tooltip stays in viewport
      let left = rect.left + rect.width / 2 - tip.width / 2
      left = Math.max(8, Math.min(left, window.innerWidth - tip.width - 8))

      setCoords({ top, left })
    }
  }, [visible, position])

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}

      {visible && (
        <div
          ref={tooltipRef}
          style={{ top: coords.top, left: coords.left }}
          className="fixed z-50 max-w-xs rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg pointer-events-none"
        >
          {text}
          {/* Arrow */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent ${
              position === 'top'
                ? 'top-full border-t-4 border-t-slate-800'
                : 'bottom-full border-b-4 border-b-slate-800'
            }`}
          />
        </div>
      )}
    </div>
  )
}
