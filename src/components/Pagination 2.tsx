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
    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 bg-zinc-50/50">
      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-zinc-400">Rows per page</label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          className="text-[12px] text-zinc-600 bg-white border border-zinc-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-zinc-300"
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
        <span className="text-[12px] text-zinc-500 score-number">
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className={cn(
              'p-1 rounded transition-colors',
              currentPage <= 1
                ? 'text-zinc-200 cursor-not-allowed'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className={cn(
              'p-1 rounded transition-colors',
              currentPage >= totalPages
                ? 'text-zinc-200 cursor-not-allowed'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
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
