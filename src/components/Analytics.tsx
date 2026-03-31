import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import type { Lead, DamageType, Case } from "@/types";
import companyMetricsData from "@/data/companyMetrics.json";
import { computeAgeDistribution } from "@/utils/ageDistribution";

interface AnalyticsProps {
  leads: Lead[];
  cases?: Case[];
}

const DAMAGE_COLORS: Record<DamageType, string> = {
  "Hurricane/Wind": "#3b82f6",
  "Accidental Discharge": "#14b8a6",
  Flood: "#06b6d4",
  Roof: "#f97316",
  Fire: "#ef4444",
  Structural: "#8b5cf6",
};

const CHART_COLORS = ["#0f1f3d", "#1e3c82", "#3a5ea8", "#5577b5", "#9db0d4"];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs font-semibold text-slate-700 mb-1">{label}</p>
        <p className="text-sm font-bold text-zinc-900">
          {payload[0].value}{" "}
          <span className="font-normal text-slate-400 text-xs">leads</span>
        </p>
      </div>
    );
  }
  return null;
}

function CurrencyTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs font-semibold text-slate-700 mb-1">{label}</p>
        <p className="text-sm font-bold text-emerald-700">
          ${(payload[0].value as number).toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
}

function PctTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs font-semibold text-slate-700 mb-1">{label}</p>
        <p className="text-sm font-bold text-slate-900">
          {payload[0].value}%{" "}
          <span className="font-normal text-slate-400 text-xs">
            litigation rate
          </span>
        </p>
      </div>
    );
  }
  return null;
}

export default function Analytics({
  leads,
  cases: _cases = [],
}: AnalyticsProps) {
  const companyMetrics = companyMetricsData as any;
  const claimsSummary = companyMetrics.claims_summary;
  const workflowSummary = companyMetrics.workflow_summary;
  const hasCompanyMetrics = Boolean(claimsSummary?.record_count);

  // ---------------------------------------------------------------------------
  // Lead charts (existing)
  // ---------------------------------------------------------------------------
  const damageData = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.damageType] = (acc[l.damageType] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const zipData = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.zip] = (acc[l.zip] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([zip, count]) => ({ zip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const COUNTY_LABELS: Record<string, string> = {
    "miami-dade": "Miami-Dade",
    broward: "Broward",
    "palm-beach": "Palm Beach",
  };
  const COUNTY_COLORS: Record<string, string> = {
    "miami-dade": "#0f1f3d",
    broward: "#1e3c82",
    "palm-beach": "#3a5ea8",
  };
  const countyData = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      const key = l.county || "miami-dade";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([county, count]) => ({
      county,
      label: COUNTY_LABELS[county] ?? county,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const scoreRanges = [
    { range: "55-59", min: 55, max: 59 },
    { range: "60-69", min: 60, max: 69 },
    { range: "70-79", min: 70, max: 79 },
    { range: "80-84", min: 80, max: 84 },
    { range: "85-89", min: 85, max: 89 },
    { range: "90-98", min: 90, max: 98 },
  ];
  const scoreData = scoreRanges.map(({ range, min, max }) => ({
    range,
    count: leads.filter((l) => l.score >= min && l.score <= max).length,
  }));

  const statusOrder: Lead["status"][] = [
    "New",
    "Contacted",
    "Converted",
    "Closed",
  ];
  const statusData = statusOrder.map((status) => ({
    status,
    count: leads.filter((l) => l.status === status).length,
  }));
  const STATUS_COLORS: Record<string, string> = {
    New: "#3b82f6",
    Contacted: "#f59e0b",
    Converted: "#10b981",
    Closed: "#94a3b8",
  };

  // -----------------------------------------------------------------------
  // Conversion Funnel Data
  // -----------------------------------------------------------------------
  const funnelOrder = ["New", "Contacted", "Converted"] as const;
  const funnelCounts = funnelOrder.map((status) => ({
    status,
    count: leads.filter((l) => l.status === status).length,
  }));
  const funnelData = funnelCounts.map((item, idx) => {
    const prevCount = idx === 0 ? leads.length : funnelCounts[idx - 1].count;
    const rate = prevCount > 0 ? Math.round((item.count / prevCount) * 100) : 0;
    return { ...item, rate };
  });

  // -----------------------------------------------------------------------
  // Time-to-Contact Metric
  // -----------------------------------------------------------------------
  const timeToContactStats = useMemo(() => {
    const contacted = leads.filter(
      (l) => l.contactedAt && l.date,
    );
    if (contacted.length === 0) return null;
    const durations = contacted.map((l) => {
      const created = new Date(l.date).getTime();
      const contactedAt = new Date(l.contactedAt!).getTime();
      return (contactedAt - created) / (1000 * 60 * 60); // hours
    });
    const avgHours = durations.reduce((s, h) => s + h, 0) / durations.length;
    const avgDays = avgHours / 24;
    const minHours = Math.min(...durations);
    const maxHours = Math.max(...durations);
    return {
      avgHours: Math.round(avgHours * 10) / 10,
      avgDays: Math.round(avgDays * 10) / 10,
      minHours: Math.round(minHours),
      maxHours: Math.round(maxHours),
      count: contacted.length,
    };
  }, [leads]);

  // -----------------------------------------------------------------------
  // Lead Age Distribution
  // -----------------------------------------------------------------------
  const ageData = useMemo(
    () => computeAgeDistribution(leads),
    [leads],
  );

  const companyKpis = useMemo(() => {
    if (!hasCompanyMetrics) return null;

    const totalCases = claimsSummary.record_count as number;
    const settledCount = claimsSummary.status_distribution
      .filter((row: any) => row.status === "Settled")
      .reduce((sum: number, row: any) => sum + row.count, 0);
    const litigationCount = claimsSummary.status_distribution
      .filter((row: any) => row.status === "Litigation")
      .reduce((sum: number, row: any) => sum + row.count, 0);
    const paidCaseCount = claimsSummary.peril_metrics.reduce(
      (sum: number, row: any) => sum + (row.paid_case_count ?? 0),
      0,
    );
    const averagePaidFee =
      paidCaseCount > 0 ? claimsSummary.total_fee_disbursed / paidCaseCount : 0;

    return {
      totalFees: claimsSummary.total_fee_disbursed as number,
      averagePaidFee,
      settledRate: totalCases > 0 ? (settledCount / totalCases) * 100 : 0,
      litigationRate: totalCases > 0 ? (litigationCount / totalCases) * 100 : 0,
      settledCount,
      totalCases,
    };
  }, [claimsSummary, hasCompanyMetrics]);

  const revenueByInsurer = useMemo(() => {
    if (!hasCompanyMetrics) return [];
    return claimsSummary.insurer_metrics
      .filter((row: any) => row.total_fees > 0)
      .map((row: any) => ({
        insurer: row.insurer,
        fees: Math.round(row.total_fees),
      }))
      .sort((a: any, b: any) => b.fees - a.fees)
      .slice(0, 10);
  }, [claimsSummary, hasCompanyMetrics]);

  const avgByPeril = useMemo(() => {
    if (!hasCompanyMetrics) return [];
    return claimsSummary.peril_metrics
      .filter((row: any) => row.sample_size >= 2)
      .map((row: any) => ({
        peril: row.peril,
        avg: Math.round(row.expected_fee_per_case),
        count: row.sample_size,
      }))
      .sort((a: any, b: any) => b.avg - a.avg)
      .slice(0, 8);
  }, [claimsSummary, hasCompanyMetrics]);

  const litigationByInsurer = useMemo(() => {
    if (!hasCompanyMetrics) return [];
    return claimsSummary.insurer_metrics
      .filter((row: any) => row.sample_size >= 2)
      .map((row: any) => ({
        insurer: row.insurer,
        rate: Math.round(row.litigation_rate * 100),
        total: row.sample_size,
      }))
      .sort((a: any, b: any) => b.rate - a.rate)
      .slice(0, 10);
  }, [claimsSummary, hasCompanyMetrics]);

  const monthlyRevenue = useMemo(() => {
    if (!hasCompanyMetrics) return [];
    return claimsSummary.monthly_fees
      .map((row: any) => ({
        month: row.label,
        monthKey: row.month_key,
        fees: Math.round(row.fees),
      }))
      .sort((a: any, b: any) => a.monthKey.localeCompare(b.monthKey))
      .slice(-18);
  }, [claimsSummary, hasCompanyMetrics]);

  const workflowBacklog = useMemo(() => {
    if (!workflowSummary?.backlog_missing_stage) return [];
    return workflowSummary.backlog_missing_stage
      .map((row: any) => ({ stage: row.label, count: row.count }))
      .filter((row: any) => row.count > 0)
      .slice(0, 6);
  }, [workflowSummary]);

  const workflowDurations = useMemo(() => {
    if (!workflowSummary?.stage_durations) return [];
    return workflowSummary.stage_durations
      .map((row: any) => ({
        stage: row.label,
        days: Math.round(row.average_days),
      }))
      .filter((row: any) => row.days > 0);
  }, [workflowSummary]);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Row 1: Damage type + ZIP                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Damage Type */}
        <div className="card px-6 py-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            Leads by Damage Type
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            Distribution across all {leads.length} leads
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={damageData}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="type"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={46}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "#f8fafc" }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {damageData.map((entry) => (
                  <Cell
                    key={entry.type}
                    fill={DAMAGE_COLORS[entry.type as DamageType] ?? "#94a3b8"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
            {damageData.map((d) => (
              <div key={d.type} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{
                    backgroundColor:
                      DAMAGE_COLORS[d.type as DamageType] ?? "#94a3b8",
                  }}
                />
                <span className="text-xs text-slate-500">{d.type}</span>
                <span className="text-xs font-semibold text-slate-700">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Leads by ZIP (Top 5) */}
        <div className="card px-6 py-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            Top ZIP Codes
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            Highest lead concentration areas
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={zipData}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              layout="vertical"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                dataKey="zip"
                type="category"
                tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "#f8fafc" }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {zipData.map((entry, index) => (
                  <Cell
                    key={entry.zip}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 2: County breakdown                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="card px-6 py-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">
          Leads by County
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Coverage across South Florida markets
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={countyData}
            margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {countyData.map((entry) => (
                <Cell
                  key={entry.county}
                  fill={COUNTY_COLORS[entry.county] ?? "#94a3b8"}
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
                style={{
                  backgroundColor: COUNTY_COLORS[d.county] ?? "#94a3b8",
                }}
              />
              <span className="text-xs text-slate-500">{d.label}</span>
              <span className="text-xs font-semibold text-slate-700">
                {d.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 3: Score distribution + Status                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card px-6 py-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            Score Distribution
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            Lead quality breakdown by score range
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={scoreData}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "#f8fafc" }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {scoreData.map((entry) => {
                  const minScore = parseInt(entry.range.split("-")[0]);
                  const color =
                    minScore >= 85
                      ? "#16a34a"
                      : minScore >= 70
                        ? "#d97706"
                        : "#dc2626";
                  return <Cell key={entry.range} fill={color} />;
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

        <div className="card px-6 py-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            Lead Status Breakdown
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            Current pipeline status across all leads
          </p>
          <div className="space-y-4 mt-6">
            {statusData.map((s) => {
              const pct =
                leads.length > 0
                  ? Math.round((s.count / leads.length) * 100)
                  : 0;
              return (
                <div key={s.status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[s.status] }}
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {s.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 score-number">
                        {s.count}
                      </span>
                      <span className="text-xs text-slate-400 score-number w-8 text-right">
                        {pct}%
                      </span>
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
              );
            })}
          </div>
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
                {leads.length > 0
                  ? Math.round(
                      leads.reduce((s, l) => s + l.score, 0) / leads.length,
                    )
                  : 0}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Avg Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 4: Conversion Funnel + Time-to-Contact + Lead Age Distribution   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversion Funnel */}
        <div className="card px-6 py-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            Conversion Funnel
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Stage counts and stage-to-stage rates
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <FunnelChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
                        <p className="text-xs font-semibold text-slate-700 mb-1">
                          {d.status}
                        </p>
                        <p className="text-sm font-bold text-zinc-900">
                          {d.count} leads
                        </p>
                        {d.rate !== undefined && d._idx > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {d.rate}% from previous stage
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Funnel
                dataKey="count"
                data={funnelData.map((d, i) => ({ ...d, _idx: i }))}
                isAnimationActive
              >
                <LabelList
                  position="right"
                  fill="#475569"
                  stroke="none"
                  dataKey="status"
                  fontSize={12}
                />
                <LabelList
                  position="center"
                  fill="#ffffff"
                  stroke="none"
                  dataKey="count"
                  fontSize={13}
                  fontWeight="bold"
                />
                {funnelData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={
                      entry.status === "New"
                        ? "#3b82f6"
                        : entry.status === "Contacted"
                          ? "#f59e0b"
                          : "#10b981"
                    }
                  />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
          {/* Stage-to-stage conversion rates */}
          <div className="mt-3 space-y-2">
            {funnelData.slice(1).map((d) => (
              <div
                key={d.status}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-slate-500">
                  {funnelData[funnelData.findIndex((f) => f.status === d.status) - 1]?.status ?? "New"} → {d.status}
                </span>
                <span className="font-semibold text-slate-700">{d.rate}%</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
              <span className="text-slate-500">Overall New→Converted</span>
              <span className="font-semibold text-emerald-600">
                {funnelData.length > 0
                  ? Math.round((funnelData[funnelData.length - 1].count / funnelData[0].count) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>

        {/* Time-to-Contact */}
        <div className="card px-6 py-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            Time-to-Contact
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            Average days from lead date to first contact
          </p>
          {timeToContactStats ? (
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-900 score-number">
                  {timeToContactStats.avgDays}
                </p>
                <p className="text-sm text-slate-400 mt-1">days avg</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  ({timeToContactStats.avgHours}h)
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-base font-bold text-slate-700 score-number">
                    {timeToContactStats.count}
                  </p>
                  <p className="text-xs text-slate-400">contacted</p>
                </div>
                <div>
                  <p className="text-base font-bold text-emerald-600 score-number">
                    {timeToContactStats.minHours}h
                  </p>
                  <p className="text-xs text-slate-400">fastest</p>
                </div>
                <div>
                  <p className="text-base font-bold text-red-500 score-number">
                    {timeToContactStats.maxHours}h
                  </p>
                  <p className="text-xs text-slate-400">slowest</p>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-500">Contact rate</span>
                  <span className="font-semibold text-slate-700">
                    {leads.length > 0
                      ? Math.round((timeToContactStats.count / leads.length) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{
                      width: `${
                        leads.length > 0
                          ? Math.round((timeToContactStats.count / leads.length) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-slate-400">No contacted leads yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Contact data will appear once leads are marked as contacted
              </p>
            </div>
          )}
        </div>

        {/* Lead Age Distribution */}
        <div className="card px-6 py-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            Lead Age Distribution
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            How long leads have been in the pipeline
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={ageData}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {ageData.map((entry) => {
                  const isFresh = entry.bucket === "0-7d";
                  const isStale = entry.bucket === "60+d";
                  return (
                    <Cell
                      key={entry.bucket}
                      fill={isFresh ? "#10b981" : isStale ? "#ef4444" : "#3a5ea8"}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span className="text-xs text-slate-500">Fresh 0–7d</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-600" />
              <span className="text-xs text-slate-500">8–60d</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              <span className="text-xs text-slate-500">Stale 60+d</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Company Analytics                                                     */}
      {/* ------------------------------------------------------------------ */}
      {hasCompanyMetrics && companyKpis && (
        <>
          {/* Divider */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Company Outcomes
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card px-5 py-4 text-center">
              <p className="text-2xl font-bold text-emerald-700 score-number">
                ${Math.round(companyKpis.totalFees).toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Historical Fees Extracted
              </p>
            </div>
            <div className="card px-5 py-4 text-center">
              <p className="text-2xl font-bold text-slate-900 score-number">
                ${Math.round(companyKpis.averagePaidFee).toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-1">Avg Paid Fee</p>
            </div>
            <div className="card px-5 py-4 text-center">
              <p className="text-2xl font-bold text-slate-900 score-number">
                {Math.round(companyKpis.settledRate)}%
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Settled-like Rate ({companyKpis.settledCount} files)
              </p>
            </div>
            <div className="card px-5 py-4 text-center">
              <p className="text-2xl font-bold text-red-600 score-number">
                {Math.round(companyKpis.litigationRate)}%
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Litigation Rate ({companyKpis.totalCases} files)
              </p>
            </div>
          </div>

          {/* Revenue by insurer + Avg fee by peril */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {revenueByInsurer.length > 0 && (
              <div className="card px-6 py-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-1">
                  Revenue by Insurance Company
                </h2>
                <p className="text-xs text-slate-400 mb-5">
                  Total extracted fees by insurer (top 10)
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={revenueByInsurer}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      dataKey="insurer"
                      type="category"
                      tick={{ fontSize: 11, fill: "#475569" }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip
                      content={<CurrencyTooltip />}
                      cursor={{ fill: "#f8fafc" }}
                    />
                    <Bar dataKey="fees" radius={[0, 6, 6, 0]}>
                      {revenueByInsurer.map((_: unknown, index: number) => (
                        <Cell
                          key={index}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {avgByPeril.length > 0 && (
              <div className="card px-6 py-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-1">
                  Expected Fee by Claim Type
                </h2>
                <p className="text-xs text-slate-400 mb-5">
                  Expected fee per case from historical company outcomes
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={avgByPeril}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      dataKey="peril"
                      type="category"
                      tick={{ fontSize: 11, fill: "#475569" }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip
                      content={<CurrencyTooltip />}
                      cursor={{ fill: "#f8fafc" }}
                    />
                    <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                      {avgByPeril.map((_: unknown, index: number) => (
                        <Cell
                          key={index}
                          fill={
                            [
                              "#14b8a6",
                              "#3b82f6",
                              "#f97316",
                              "#ef4444",
                              "#8b5cf6",
                              "#06b6d4",
                              "#f59e0b",
                              "#10b981",
                            ][index % 8]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Litigation rate by insurer + Monthly revenue trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {litigationByInsurer.length > 0 && (
              <div className="card px-6 py-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-1">
                  Litigation Rate by Insurer
                </h2>
                <p className="text-xs text-slate-400 mb-5">
                  % of cases that went to litigation (min. 2 cases)
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={litigationByInsurer}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <YAxis
                      dataKey="insurer"
                      type="category"
                      tick={{ fontSize: 11, fill: "#475569" }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip
                      content={<PctTooltip />}
                      cursor={{ fill: "#f8fafc" }}
                    />
                    <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
                      {litigationByInsurer.map(
                        (entry: { insurer: string; rate: number }) => (
                          <Cell
                            key={entry.insurer}
                            fill={
                              entry.rate > 50
                                ? "#ef4444"
                                : entry.rate > 20
                                  ? "#f59e0b"
                                  : "#10b981"
                            }
                          />
                        ),
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                    <span className="text-xs text-slate-500">
                      &gt;50% litigation
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                    <span className="text-xs text-slate-500">20–50%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-xs text-slate-500">&lt;20%</span>
                  </div>
                </div>
              </div>
            )}

            {monthlyRevenue.length > 0 && (
              <div className="card px-6 py-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-1">
                  Monthly Revenue Trend
                </h2>
                <p className="text-xs text-slate-400 mb-5">
                  Chronological fee totals by logged month
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={monthlyRevenue}
                    margin={{ top: 0, right: 0, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      angle={-30}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      content={<CurrencyTooltip />}
                      cursor={{ fill: "#f8fafc" }}
                    />
                    <Bar dataKey="fees" radius={[6, 6, 0, 0]} fill="#10b981">
                      {monthlyRevenue.map((_: unknown, index: number) => (
                        <Cell
                          key={index}
                          fill={`hsl(158, ${60 + (index % 3) * 10}%, ${42 + (index % 2) * 8}%)`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {(workflowBacklog.length > 0 || workflowDurations.length > 0) && (
            <>
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Workflow Operations
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {workflowBacklog.length > 0 && (
                  <div className="card px-6 py-5">
                    <h2 className="text-sm font-semibold text-slate-700 mb-1">
                      Backlog by Missing Stage
                    </h2>
                    <p className="text-xs text-slate-400 mb-5">
                      Open workflow rows missing each milestone
                    </p>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={workflowBacklog}
                        layout="vertical"
                        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f1f5f9"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          dataKey="stage"
                          type="category"
                          tick={{ fontSize: 11, fill: "#475569" }}
                          tickLine={false}
                          axisLine={false}
                          width={110}
                        />
                        <Tooltip
                          content={<CustomTooltip />}
                          cursor={{ fill: "#f8fafc" }}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                          {workflowBacklog.map((_: unknown, index: number) => (
                            <Cell
                              key={index}
                              fill={index < 2 ? "#ef4444" : "#f59e0b"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {workflowDurations.length > 0 && (
                  <div className="card px-6 py-5">
                    <h2 className="text-sm font-semibold text-slate-700 mb-1">
                      Average Stage Durations
                    </h2>
                    <p className="text-xs text-slate-400 mb-5">
                      Average days between recorded workflow milestones
                    </p>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={workflowDurations}
                        layout="vertical"
                        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f1f5f9"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          dataKey="stage"
                          type="category"
                          tick={{ fontSize: 11, fill: "#475569" }}
                          tickLine={false}
                          axisLine={false}
                          width={130}
                        />
                        <Tooltip
                          content={<CustomTooltip />}
                          cursor={{ fill: "#f8fafc" }}
                        />
                        <Bar dataKey="days" radius={[0, 6, 6, 0]}>
                          {workflowDurations.map(
                            (_: unknown, index: number) => (
                              <Cell
                                key={index}
                                fill={
                                  ["#1e3c82", "#3a5ea8", "#9db0d4", "#0f1f3d"][
                                    index % 4
                                  ]
                                }
                              />
                            ),
                          )}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
