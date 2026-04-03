import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PageSize = 25 | 50 | 100

interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize: PageSize
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
}

const PAGE_SIZES: PageSize[] = [25, 50, 100]

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  return (
    <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/70 px-5 py-4">
      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Rows</label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-200"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {/* Page indicator and navigation */}
      <div className="flex items-center gap-3">
        <span className="score-number text-[12px] font-medium text-slate-500">
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className={cn(
              'rounded-lg border p-1.5 transition-colors',
              currentPage <= 1
                ? 'cursor-not-allowed border-slate-100 text-slate-200'
                : 'border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700'
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className={cn(
              'rounded-lg border p-1.5 transition-colors',
              currentPage >= totalPages
                ? 'cursor-not-allowed border-slate-100 text-slate-200'
                : 'border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700'
            )}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
