import { Download } from 'lucide-react'

interface HeaderProps {
  title: string
  totalCount: number
  onExport?: () => void
  entityLabel?: string
}

export default function Header({
  title,
  totalCount,
  onExport,
  entityLabel = 'leads',
}: HeaderProps) {
  return (
    <div className="h-14 flex items-center justify-between px-6 bg-[#16161a] border-b border-white/[0.04] flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-[15px] font-semibold text-white tracking-tight">{title}</h1>
        {totalCount > 0 && (
          <span className="text-[12px] text-white/30 score-number">
            {totalCount.toLocaleString()} {entityLabel}
          </span>
        )}
      </div>

      {onExport && (
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 text-[13px] font-medium text-white/40 hover:text-white/80 transition-colors duration-150"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      )}
    </div>
  )
}
