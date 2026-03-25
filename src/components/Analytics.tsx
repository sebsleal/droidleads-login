import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { Lead, DamageType } from '@/types'

interface AnalyticsProps {
  leads: Lead[]
}

const DAMAGE_COLORS: Record<DamageType, string> = {
  'Hurricane/Wind': '#3b82f6',
  Flood: '#06b6d4',
  Roof: '#f97316',
  Fire: '#ef4444',
  Structural: '#8b5cf6',
}

const CHART_COLORS = [
  '#0f1f3d',
  '#1e3c82',
  '#3a5ea8',
  '#5577b5',
  '#9db0d4',
]

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs font-semibold text-slate-700 mb-1">{label}</p>
        <p className="text-sm font-bold text-navy-900">
          {payload[0].value} <span className="font-normal text-slate-400 text-xs">leads</span>
        </p>
      </div>
    )
  }
  return null
}

export default function Analytics({ leads }: AnalyticsProps) {
  // Leads by damage type
  const damageData = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.damageType] = (acc[l.damageType] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  // Leads by ZIP (top 5)
  const zipData = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.zip] = (acc[l.zip] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([zip, count]) => ({ zip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Leads by county
  const COUNTY_LABELS: Record<string, string> = {
    'miami-dade': 'Miami-Dade',
    'broward':    'Broward',
    'palm-beach': 'Palm Beach',
  }
  const COUNTY_COLORS: Record<string, string> = {
    'miami-dade': '#0f1f3d',
    'broward':    '#1e3c82',
    'palm-beach': '#3a5ea8',
  }
  const countyData = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      const key = l.county || 'miami-dade'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([county, count]) => ({ county, label: COUNTY_LABELS[county] ?? county, count }))
    .sort((a, b) => b.count - a.count)

  // Score distribution buckets
  const scoreRanges = [
    { range: '55-59', min: 55, max: 59 },
    { range: '60-69', min: 60, max: 69 },
    { range: '70-79', min: 70, max: 79 },
    { range: '80-84', min: 80, max: 84 },
    { range: '85-89', min: 85, max: 89 },
    { range: '90-98', min: 90, max: 98 },
  ]

  const scoreData = scoreRanges.map(({ range, min, max }) => ({
    range,
    count: leads.filter((l) => l.score >= min && l.score <= max).length,
  }))

  // Status breakdown
  const statusOrder: Lead['status'][] = ['New', 'Contacted', 'Converted', 'Closed']
  const statusData = statusOrder.map((status) => ({
    status,
    count: leads.filter((l) => l.status === status).length,
  }))

  const STATUS_COLORS: Record<string, string> = {
    New: '#3b82f6',
    Contacted: '#f59e0b',
    Converted: '#10b981',
    Closed: '#94a3b8',
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Damage type + ZIP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Damage Type */}
        <div className="card px-6 py-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Leads by Damage Type</h2>
          <p className="text-xs text-slate-400 mb-5">Distribution across all {leads.length} leads</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={damageData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="type"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={46}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {damageData.map((entry) => (
                  <Cell
                    key={entry.type}
                    fill={DAMAGE_COLORS[entry.type as DamageType] ?? '#94a3b8'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
            {damageData.map((d) => (
              <div key={d.type} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: DAMAGE_COLORS[d.type as DamageType] ?? '#94a3b8' }}
                />
                <span className="text-xs text-slate-500">{d.type}</span>
                <span className="text-xs font-semibold text-slate-700">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leads by ZIP (Top 5) */}
        <div className="card px-6 py-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Top ZIP Codes</h2>
          <p className="text-xs text-slate-400 mb-5">Highest lead concentration areas</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={zipData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                dataKey="zip"
                type="category"
                tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {zipData.map((entry, index) => (
                  <Cell key={entry.zip} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: County breakdown */}
      <div className="card px-6 py-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Leads by County</h2>
        <p className="text-xs text-slate-400 mb-5">Coverage across South Florida markets</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={countyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {countyData.map((entry) => (
                <Cell
                  key={entry.county}
                  fill={COUNTY_COLORS[entry.county] ?? '#94a3b8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
          {countyData.map((d) => (
            <div key={d.county} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: COUNTY_COLORS[d.county] ?? '#94a3b8' }}
              />
              <span className="text-xs text-slate-500">{d.label}</span>
              <span className="text-xs font-semibold text-slate-700">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 3: Score distribution + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score distribution */}
        <div className="card px-6 py-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Score Distribution</h2>
          <p className="text-xs text-slate-400 mb-5">Lead quality breakdown by score range</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {scoreData.map((entry) => {
                  const minScore = parseInt(entry.range.split('-')[0])
                  const color = minScore >= 85 ? '#16a34a' : minScore >= 70 ? '#d97706' : '#dc2626'
                  return <Cell key={entry.range} fill={color} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-600" />
              <span className="text-xs text-slate-500">High ≥85</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
              <span className="text-xs text-slate-500">Medium 70-84</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-600" />
              <span className="text-xs text-slate-500">Low &lt;70</span>
            </div>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card px-6 py-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Lead Status Breakdown</h2>
          <p className="text-xs text-slate-400 mb-5">Current pipeline status across all leads</p>

          <div className="space-y-4 mt-6">
            {statusData.map((s) => {
              const pct = leads.length > 0 ? Math.round((s.count / leads.length) * 100) : 0
              return (
                <div key={s.status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[s.status] }}
                      />
                      <span className="text-sm font-medium text-slate-700">{s.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 score-number">{s.count}</span>
                      <span className="text-xs text-slate-400 score-number w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: STATUS_COLORS[s.status],
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary stats */}
          <div className="mt-8 pt-5 border-t border-slate-100 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 score-number">
                {leads.filter((l) => l.score >= 85).length}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">High Priority</p>
            </div>
            <div className="text-center border-x border-slate-100">
              <p className="text-2xl font-bold text-slate-900 score-number">
                {leads.filter((l) => !!l.contact).length}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Contactable</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 score-number">
                {leads.length > 0 ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Avg Score</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
