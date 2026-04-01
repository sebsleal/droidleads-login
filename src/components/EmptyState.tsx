import { SearchX, FileX, Filter } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: 'search' | 'file' | 'filter'
  action?: {
    label: string
    onClick: () => void
  }
}

const icons = {
  search: SearchX,
  file: FileX,
  filter: Filter,
}

export default function EmptyState({
  title = 'No results found',
  description = 'Try adjusting your filters to see more results.',
  icon = 'search',
  action,
}: EmptyStateProps) {
  const Icon = icons[icon]

  return (
    <div className="card flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 btn-secondary text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
