import type { StormStatsData } from '@/types'

interface StormWatchStatsRowProps {
  stats: StormStatsData
}

interface StatItemProps {
  label: string
  value: number
  subtext: string
  valueColor?: string
}

function StatItem({ label, value, subtext, valueColor = 'text-zinc-900' }: StatItemProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-[0.07em]">{label}</p>
      <p className={`text-2xl font-semibold score-number leading-none ${valueColor}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-[12px] text-zinc-400 mt-0.5">{subtext}</p>
    </div>
  )
}

export default function StormWatchStatsRow({ stats }: StormWatchStatsRowProps) {
  return (
    <div className="flex items-center gap-8 px-1 pb-6 border-b border-zinc-100">
      <StatItem
        label="Total Candidates"
        value={stats.totalCandidates}
        subtext="storm opportunities"
      />
      <div className="w-px h-10 bg-zinc-100" />
      <StatItem
        label="High Priority"
        value={stats.highPriority}
        subtext="score ≥ 85"
        valueColor="text-emerald-600"
      />
      <div className="w-px h-10 bg-zinc-100" />
      <StatItem
        label="FEMA Tagged"
        value={stats.femaTagged}
        subtext="matched declarations"
        valueColor="text-amber-600"
      />
      <div className="w-px h-10 bg-zinc-100" />
      <StatItem
        label="Area-Based"
        value={stats.areaCandidates}
        subtext="not verified properties"
      />
    </div>
  )
}
