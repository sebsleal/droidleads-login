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
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    icon: 'text-blue-600',
    border: 'border-blue-100',
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    icon: 'text-emerald-600',
    border: 'border-emerald-100',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    icon: 'text-amber-600',
    border: 'border-amber-100',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    icon: 'text-red-600',
    border: 'border-red-100',
  },
}

function KPICard({ title, value, icon, color, subtitle }: KPICardProps) {
  const styles = colorStyles[color]

  return (
    <div className="kpi-card group border border-transparent hover:-translate-y-0.5 hover:border-blue-100/80">
      <div className="mb-4 flex items-start justify-between">
        <div className={`rounded-2xl border p-2.5 ${styles.bg} ${styles.icon} ${styles.border} transition-transform duration-200 group-hover:scale-105`}>
          {icon}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
          {title}
        </p>
        <p className="score-number font-headline text-3xl font-extrabold tracking-tight text-slate-900">
          {value.toLocaleString()}
        </p>
        {subtitle && (
          <p className="mt-2 text-xs font-medium text-slate-500">
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
