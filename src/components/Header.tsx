import { Shield, Download } from 'lucide-react'
import type { Lead } from '@/types'
import { downloadCSV } from '@/lib/utils'

interface HeaderProps {
  leads: Lead[]
  totalToday: number
  lastScraped?: string | null
}

function timeAgo(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  return `${diffDay}d ago`
}

export default function Header({ leads, totalToday, lastScraped }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{ backgroundColor: '#0f1f3d' }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-base leading-tight tracking-tight">
                Claim Remedy Adjusters
              </h1>
              <p className="text-blue-200/70 text-xs leading-tight font-normal">
                Lead Intelligence System
                {lastScraped && (
                  <span className="ml-2 text-blue-200/50">
                    · Updated {timeAgo(lastScraped)}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Today's leads badge — only show when data is loaded */}
            {totalToday > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-400/30">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-300 text-xs font-semibold">
                  {totalToday} leads
                </span>
              </div>
            )}

            {/* Export CSV */}
            <button
              onClick={() => downloadCSV(leads)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20
                         border border-white/10 text-white text-sm font-medium transition-colors duration-150"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Subtle bottom border */}
      <div className="h-px bg-white/10" />
    </header>
  )
}
