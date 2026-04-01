interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
}

export default function TableSkeleton({ 
  rows = 5, 
  columns = 8,
  showHeader = true 
}: TableSkeletonProps) {
  return (
    <div className="card overflow-hidden">
      {/* Header skeleton */}
      {showHeader && (
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-slate-700 flex items-center justify-between">
          <div className="skeleton w-32 h-4" />
          <div className="skeleton w-24 h-4 hidden lg:block" />
        </div>
      )}

      {/* Table header */}
      <div className="hidden lg:block border-b border-zinc-100 dark:border-slate-700">
        <div className="flex px-4 py-3 gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div 
              key={`header-${i}`} 
              className="skeleton h-3 flex-1"
              style={{ opacity: 0.6 - i * 0.05 }}
            />
          ))}
        </div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-zinc-50 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={`row-${rowIndex}`}
            className="flex items-center px-4 py-4 gap-4"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className="skeleton h-4 flex-1"
                style={{ 
                  opacity: 0.5 - colIndex * 0.03,
                  width: colIndex === 0 ? '40px' : 'auto'
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
