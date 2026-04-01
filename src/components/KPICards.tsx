import { Users, TrendingUp, Building2, AlertTriangle } from 'lucide-react'
import type { StatsData } from '@/types'

interface KPICardProps {
  title: string
  value: number
  icon: React.ReactNode
  color: 'blue' | 'emerald' | 'amber' | 'red'
  trend?: {
    value: number
    label: string
  }
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
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    icon: 'text-red-600 dark:text-red-400',
    border: 'border-red-100 dark:border-red-800',
  },
}

function KPICard({ title, value, icon, color, trend }: KPICardProps) {
  const styles = colorStyles[color]

  return (
    <div className="kpi-card group">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${styles.bg} ${styles.icon} transition-transform group-hover:scale-110 duration-200`}>
          {icon}
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-2xs">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              +{trend.value}%
            </span>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
          {title}
        </p>
        <p className="text-3xl font-semibold text-slate-900 dark:text-white score-number tracking-tight">
          {value.toLocaleString()}
        </p>
        {trend && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {trend.label}
          </p>
        )}
      </div>
    </div>
  )
}

interface KPICardsProps {
  stats: StatsData
}

export default function KPICards({ stats }: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      <KPICard
        title="Total Leads"
        value={stats.totalLeads}
        icon={<Users className="w-5 h-5" />}
        color="blue"
        trend={{ value: 12, label: 'vs last week' }}
      />
      <KPICard
        title="High Priority"
        value={stats.highPriority}
        icon={<TrendingUp className="w-5 h-5" />}
        color="emerald"
        trend={{ value: 8, label: 'score ≥ 85' }}
      />
      <KPICard
        title="Absentee Owners"
        value={stats.absenteeOwners}
        icon={<Building2 className="w-5 h-5" />}
        color="amber"
        trend={{ value: 5, label: 'out-of-state' }}
      />
      <KPICard
        title="Underpaid Flags"
        value={stats.underpaidFlags}
        icon={<AlertTriangle className="w-5 h-5" />}
        color="red"
        trend={{ value: 3, label: 'below ZIP median' }}
      />
    </div>
  )
}
