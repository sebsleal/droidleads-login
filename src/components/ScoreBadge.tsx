import { getScoreTier, scoreTierColors, cn } from '@/lib/utils'

interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export default function ScoreBadge({ score, size = 'md', showLabel = false }: ScoreBadgeProps) {
  const tier = getScoreTier(score)
  const colors = scoreTierColors(tier)

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold border score-number',
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses[size]
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', colors.dot)} />
      {score}
      {showLabel && (
        <span className="ml-0.5 font-normal opacity-75">
          {tier === 'high' ? '· High' : tier === 'medium' ? '· Med' : '· Low'}
        </span>
      )}
    </span>
  )
}
