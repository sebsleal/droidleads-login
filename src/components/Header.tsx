import { Download, Settings } from 'lucide-react'

interface HeaderProps {
  title: string
  totalCount: number
  onExport?: () => void
  entityLabel?: string
  onOpenSettings?: () => void
}

export default function Header({
  title,
  totalCount,
  onExport,
  entityLabel = 'leads',
  onOpenSettings,
}: HeaderProps) {
  return (
    <div className="h-14 flex items-center justify-between px-6 bg-white border-b border-zinc-100 flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-[15px] font-semibold text-zinc-900 tracking-tight">{title}</h1>
        {totalCount > 0 && (
          <span className="text-[12px] text-zinc-400 score-number">
            {totalCount.toLocaleString()} {entityLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        )}

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
        )}
      </div>
    </div>
  )
}
