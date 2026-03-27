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
} from "recharts";
import type { Lead, DamageType, Case } from "@/types";
import companyMetricsData from "@/data/companyMetrics.json";

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
