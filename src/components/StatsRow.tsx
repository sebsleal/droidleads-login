import { Users, TrendingUp, Star, Phone } from 'lucide-react'
import type { StatsData } from '@/types'
import { cn } from '@/lib/utils'

interface StatsRowProps {
  stats: StatsData
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  subtext?: string
  accent?: 'green' | 'amber' | 'blue' | 'default'
}

function StatCard({ icon, label, value, subtext, accent = 'default' }: StatCardProps) {
  const accentMap = {
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
    default: 'text-slate-600 bg-slate-100',
  }

  return (
    <div className="card px-5 py-4 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', accentMap[accent])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 score-number leading-none">{value}</p>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
      </div>
    </div>
  )
}

export default function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<Users className="w-5 h-5" />}
        label="Total Leads"
        value={stats.totalLeads}
        subtext="in database"
        accent="blue"
      />
      <StatCard
        icon={<Star className="w-5 h-5" />}
        label="High Priority"
        value={stats.highPriority}
        subtext="score ≥ 85"
        accent="green"
      />
      <StatCard
        icon={<TrendingUp className="w-5 h-5" />}
        label="Avg Score"
        value={stats.avgScore}
        subtext="across all leads"
        accent={stats.avgScore >= 85 ? 'green' : stats.avgScore >= 70 ? 'amber' : 'default'}
      />
      <StatCard
        icon={<Phone className="w-5 h-5" />}
        label="Has Contact"
        value={stats.leadsWithContact}
        subtext={stats.totalLeads > 0 ? `${Math.round((stats.leadsWithContact / stats.totalLeads) * 100)}% of total` : 'no leads yet'}
        accent="blue"
      />
    </div>
  )
}
