import { Download, Menu } from 'lucide-react'

interface HeaderProps {
  title: string
  eyebrow?: string
  subtitle?: string
  totalCount: number
  onExport?: () => void
  entityLabel?: string
  lastUpdatedLabel?: string
  onMenuClick?: () => void
}

export default function Header({
  title,
  eyebrow,
  subtitle,
  totalCount,
  onExport,
  entityLabel = 'leads',
  lastUpdatedLabel,
  onMenuClick,
}: HeaderProps) {
  return (
    <header className="workspace-header flex h-16 items-center justify-between gap-4 px-4 sm:px-8">
      <div className="flex min-w-0 items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 transition-colors hover:bg-white lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="workspace-eyebrow mb-1">{eyebrow}</div>}
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate font-headline text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              {title}
            </h1>
            {totalCount > 0 && (
              <span className="workspace-count-pill hidden score-number sm:inline-flex">
                {totalCount.toLocaleString()} {entityLabel}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="hidden truncate text-sm text-slate-500 lg:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        {lastUpdatedLabel && (
          <span className="hidden rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-500 sm:inline-flex">
            {lastUpdatedLabel}
          </span>
        )}
        {onExport && (
          <button onClick={onExport} className="btn-secondary px-3 py-2 text-xs sm:px-4 sm:text-sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        )}
      </div>
    </header>
  )
}
