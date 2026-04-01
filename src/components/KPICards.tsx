import { Users, TrendingUp, Building2, AlertTriangle } from 'lucide-react'
import type { StatsData } from '@/types'

interface KPICardProps {
  title: string
  value: number
  icon: React.ReactNode
  color: 'blue' | 'emerald' | 'amber' | 'red'
  subtitle?: string
}

const colorStyles = {
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    icon: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    icon: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    icon: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  red: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    icon: 'text-rose-400',
    border: 'border-rose-500/20',
  },
}

function KPICard({ title, value, icon, color, subtitle }: KPICardProps) {
  const styles = colorStyles[color]

  return (
    <div className="kpi-card group">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${styles.bg} ${styles.icon} transition-transform group-hover:scale-110 duration-200`}>
          {icon}
        </div>
      </div>

      <div>
        <p className="text-sm text-white/40 font-medium mb-1">
          {title}
        </p>
        <p className="text-3xl font-semibold text-white score-number tracking-tight">
          {value.toLocaleString()}
        </p>
        {subtitle && (
          <p className="text-xs text-white/25 mt-1">
            {subtitle}
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
        subtitle="in database"
      />
      <KPICard
        title="High Priority"
        value={stats.highPriority}
        icon={<TrendingUp className="w-5 h-5" />}
        color="emerald"
        subtitle="score ≥ 85"
      />
      <KPICard
        title="Absentee Owners"
        value={stats.absenteeOwners}
        icon={<Building2 className="w-5 h-5" />}
        color="amber"
        subtitle="out-of-state mailing"
      />
      <KPICard
        title="Underpaid Flags"
        value={stats.underpaidFlags}
        icon={<AlertTriangle className="w-5 h-5" />}
        color="red"
        subtitle="below ZIP median"
      />
    </div>
  )
}
