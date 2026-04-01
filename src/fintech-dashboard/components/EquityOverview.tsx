import { useState } from "react";
import { cn } from "../lib/utils";
import { SectionHeader } from "./SectionHeader";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface MetricRow {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaPositive?: boolean;
  width?: number;
}

const equityMetrics: MetricRow[] = [
  { label: "Account Balance", value: "$1,235,236", sub: "Available cash", delta: "+10%", deltaPositive: true, width: 88 },
  { label: "Unrealized P&L", value: "+$18,420.00", sub: "Open positions", delta: "+4.2%", deltaPositive: true, width: 72 },
  { label: "Used Margin", value: "$64,800.00", sub: "Leverage 1:20", delta: "5.2%", deltaPositive: false, width: 52 },
  { label: "Available Margin", value: "$1,170,436", sub: "Free collateral", delta: "+94.8%", deltaPositive: true, width: 94 },
  { label: "Open Positions", value: "12", sub: "Across 3 strategies", delta: "+3", deltaPositive: true, width: 60 },
  { label: "Total Exposure", value: "$312,400", sub: "Portfolio value at risk", delta: "+8.1%", deltaPositive: true, width: 65 },
];

const activityItems = [
  { symbol: "EUR/USD", action: "BUY", size: "2.00 lots", time: "09:41 AM", pnl: "+$340", positive: true },
  { symbol: "GBP/JPY", action: "SELL", size: "1.50 lots", time: "09:28 AM", pnl: "-$124", positive: false },
  { symbol: "NASDAQ", action: "BUY", size: "0.50 lots", time: "09:12 AM", pnl: "+$892", positive: true },
  { symbol: "GOLD", action: "BUY", size: "3.00 lots", time: "08:55 AM", pnl: "+$218", positive: true },
];

interface EquityOverviewProps {
  className?: string;
}

export function EquityOverview({ className }: EquityOverviewProps) {
  const [timeRange, setTimeRange] = useState("Last 6 months");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={cn(
        "relative rounded-xl border border-white/[0.06] bg-[#1a1a1f]/60",
        "backdrop-blur-sm p-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]",
        className
      )}
    >
      <SectionHeader
        title="Equity overview"
        subtitle="Lorem ipsum dolor sit amet"
        action={{
          label: timeRange,
          options: ["Last 6 months", "Last year", "All time"],
          onSelect: setTimeRange,
        }}
      />

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {equityMetrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 + i * 0.04 }}
            className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]"
          >
            <div className="flex items-start justify-between mb-1.5">
              <span className="text-[11px] text-white/40 leading-tight">{metric.label}</span>
              {metric.delta && (
                <span className={cn(
                  "text-[10px] font-medium flex items-center gap-0.5",
                  metric.deltaPositive ? "text-emerald-400" : "text-rose-400"
                )}>
                  {metric.deltaPositive
                    ? <ArrowUpRight className="w-2.5 h-2.5" />
                    : <ArrowDownRight className="w-2.5 h-2.5" />
                  }
                  {metric.delta}
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-white mb-1">{metric.value}</div>
            <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${metric.width}%` }}
                transition={{ duration: 1.2, delay: 0.4 + i * 0.05, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full",
                  metric.deltaPositive
                    ? "bg-gradient-to-r from-blue-500 to-blue-400"
                    : "bg-gradient-to-r from-rose-500 to-rose-400"
                )}
              />
            </div>
            <div className="text-[10px] text-white/25 mt-1">{metric.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-3">
          Recent Activity
        </div>
        <div className="space-y-1.5">
          {activityItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.5 + i * 0.06 }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                item.positive ? "bg-emerald-400" : "bg-rose-400"
              )} />
              <span className="text-xs font-semibold text-white w-16">{item.symbol}</span>
              <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                item.action === "BUY"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-rose-500/10 text-rose-400"
              )}>
                {item.action}
              </span>
              <span className="text-xs text-white/40 flex-1">{item.size}</span>
              <span className="text-[11px] text-white/30">{item.time}</span>
              <span className={cn(
                "text-xs font-semibold w-16 text-right",
                item.positive ? "text-emerald-400" : "text-rose-400"
              )}>
                {item.pnl}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
