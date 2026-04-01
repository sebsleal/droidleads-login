import { CloudLightning, TrendingUp, Shield, MapPin } from 'lucide-react'
import type { StormStatsData } from '@/types'

interface StormKPICardProps {
  title: string
  value: number
  icon: React.ReactNode
  color: 'blue' | 'emerald' | 'amber' | 'slate'
  subtitle?: string
}

const colorStyles = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-100 dark:border-blue-800',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-100 dark:border-emerald-800',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-100 dark:border-amber-800',
  },
  slate: {
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    text: 'text-slate-700 dark:text-slate-300',
    icon: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-100 dark:border-slate-700',
  },
}

function StormKPICard({ title, value, icon, color, subtitle }: StormKPICardProps) {
  const styles = colorStyles[color]

  return (
    <div className="kpi-card group">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${styles.bg} ${styles.icon} transition-transform group-hover:scale-110 duration-200`}>
          {icon}
        </div>
      </div>

      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
          {title}
        </p>
        <p className="text-3xl font-semibold text-slate-900 dark:text-white score-number tracking-tight">
          {value.toLocaleString()}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

interface StormWatchStatsRowProps {
  stats: StormStatsData
}

export default function StormWatchStatsRow({ stats }: StormWatchStatsRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      <StormKPICard
        title="Total Candidates"
        value={stats.totalCandidates}
        icon={<CloudLightning className="w-5 h-5" />}
        color="blue"
        subtitle="storm opportunities"
      />
      <StormKPICard
        title="High Priority"
        value={stats.highPriority}
        icon={<TrendingUp className="w-5 h-5" />}
        color="emerald"
        subtitle="score ≥ 85"
      />
      <StormKPICard
        title="FEMA Tagged"
        value={stats.femaTagged}
        icon={<Shield className="w-5 h-5" />}
        color="amber"
        subtitle="matched declarations"
      />
      <StormKPICard
        title="Area-Based"
        value={stats.areaCandidates}
        icon={<MapPin className="w-5 h-5" />}
        color="slate"
        subtitle="not verified properties"
      />
    </div>
  )
}
