import { CloudLightning, Star, ShieldAlert, Map } from 'lucide-react'
import type { StormStatsData } from '@/types'
import { cn } from '@/lib/utils'

interface StormWatchStatsRowProps {
  stats: StormStatsData
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  subtext: string
  accent: 'green' | 'amber' | 'blue' | 'red'
}

function StatCard({ icon, label, value, subtext, accent }: StatCardProps) {
  const accentMap = {
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
    red: 'text-red-600 bg-red-50',
  }

  return (
    <div className="card px-5 py-4 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', accentMap[accent])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 score-number leading-none">{value}</p>
        <p className="text-xs text-slate-400 mt-1">{subtext}</p>
      </div>
    </div>
  )
}

export default function StormWatchStatsRow({ stats }: StormWatchStatsRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<CloudLightning className="w-5 h-5" />}
        label="Total Candidates"
        value={stats.totalCandidates}
        subtext="storm-first opportunities"
        accent="blue"
      />
      <StatCard
        icon={<Star className="w-5 h-5" />}
        label="High Priority"
        value={stats.highPriority}
        subtext="score >= 85"
        accent="green"
      />
      <StatCard
        icon={<ShieldAlert className="w-5 h-5" />}
        label="FEMA Tagged"
        value={stats.femaTagged}
        subtext="matched declarations"
        accent="amber"
      />
      <StatCard
        icon={<Map className="w-5 h-5" />}
        label="Area-Based"
        value={stats.areaCandidates}
        subtext="not verified properties"
        accent="red"
      />
    </div>
  )
}
