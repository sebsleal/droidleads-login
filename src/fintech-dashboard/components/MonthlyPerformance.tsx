import { useState } from "react";
import { cn } from "../lib/utils";
import { SectionHeader } from "./SectionHeader";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MonthReturn {
  month: string;
  pct: number;
  absolute: string;
  trades: number;
  status: "strong" | "good" | "flat" | "negative";
}

const monthlyData: MonthReturn[] = [
  { month: "January",   pct: 2.1,  absolute: "+$25,840",  trades: 48, status: "good" },
  { month: "February",  pct: 6.1,  absolute: "+$75,340",  trades: 61, status: "strong" },
  { month: "March",     pct: 4.1,  absolute: "+$50,620",  trades: 54, status: "good" },
  { month: "April",     pct: -1.8, absolute: "-$22,230",  trades: 38, status: "negative" },
  { month: "May",       pct: 3.7,  absolute: "+$45,680",  trades: 57, status: "good" },
  { month: "June",      pct: 5.2,  absolute: "+$64,210",  trades: 62, status: "strong" },
];

const avgReturn = (monthlyData.reduce((s, m) => s + m.pct, 0) / monthlyData.length).toFixed(1);
const totalAbsolute = "+$239,460";

const statusStyle: Record<MonthReturn["status"], string> = {
  strong:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  good:     "bg-blue-500/15 text-blue-400 border-blue-500/20",
  flat:     "bg-white/[0.06] text-white/50 border-white/[0.08]",
  negative: "bg-rose-500/15 text-rose-400 border-rose-500/20",
};

const statusLabel: Record<MonthReturn["status"], string> = {
  strong: "Strong",
  good: "Good",
  flat: "Flat",
  negative: "Loss",
};

interface MonthlyPerformanceProps {
  className?: string;
}

export function MonthlyPerformance({ className }: MonthlyPerformanceProps) {
  const [timeRange, setTimeRange] = useState("Last 6 months");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className={cn(
        "relative rounded-xl border border-white/[0.06] bg-[#1a1a1f]/60",
        "backdrop-blur-sm p-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]",
        className
      )}
    >
      <SectionHeader
        title="Monthly returns"
        subtitle="Lorem ipsum dolor sit amet"
        action={{
          label: timeRange,
          options: ["Last 6 months", "Last year", "All time"],
          onSelect: setTimeRange,
        }}
      />

      {/* Summary row */}
      <div className="flex items-center gap-4 mb-4 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
        <div className="flex-1">
          <div className="text-[10px] text-white/35 uppercase tracking-wider">Avg monthly return</div>
          <div className="text-base font-semibold text-emerald-400">+{avgReturn}%</div>
        </div>
        <div className="w-px h-8 bg-white/[0.06]" />
        <div className="flex-1">
          <div className="text-[10px] text-white/35 uppercase tracking-wider">Period total</div>
          <div className="text-base font-semibold text-white">{totalAbsolute}</div>
        </div>
        <div className="w-px h-8 bg-white/[0.06]" />
        <div className="flex-1">
          <div className="text-[10px] text-white/35 uppercase tracking-wider">Win months</div>
          <div className="text-base font-semibold text-white">5 / 6</div>
        </div>
      </div>

      {/* Month rows */}
      <div className="space-y-1.5">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-3 mb-2">
          <span className="col-span-3 text-[10px] text-white/30 uppercase tracking-wider">Month</span>
          <span className="col-span-3 text-[10px] text-white/30 uppercase tracking-wider text-right">Return</span>
          <span className="col-span-4 text-[10px] text-white/30 uppercase tracking-wider text-right">Absolute</span>
          <span className="col-span-2 text-[10px] text-white/30 uppercase tracking-wider text-right">Status</span>
        </div>

        {monthlyData.map((row, i) => (
          <motion.div
            key={row.month}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 + i * 0.06 }}
            className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
          >
            <div className="col-span-3 flex items-center gap-2">
              {row.pct >= 0
                ? <TrendingUp className="w-3 h-3 text-emerald-400/70" />
                : <TrendingDown className="w-3 h-3 text-rose-400/70" />
              }
              <span className="text-xs text-white/80">{row.month.slice(0, 3)}</span>
            </div>

            <div className="col-span-3">
              {/* Return bar */}
              <div className="flex items-center gap-2 justify-end">
                <span className={cn(
                  "text-xs font-semibold",
                  row.pct >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {row.pct > 0 ? "+" : ""}{row.pct}%
                </span>
              </div>
              <div className="h-1 mt-1 bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.abs(row.pct) / 7 * 100}%` }}
                  transition={{ duration: 1, delay: 0.4 + i * 0.08, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    row.pct >= 0
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                      : "bg-gradient-to-r from-rose-500 to-rose-400"
                  )}
                />
              </div>
            </div>

            <div className="col-span-4 text-right">
              <span className={cn(
                "text-xs font-medium",
                row.pct >= 0 ? "text-white/70" : "text-rose-400/70"
              )}>
                {row.absolute}
              </span>
            </div>

            <div className="col-span-2 flex justify-end">
              <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                statusStyle[row.status]
              )}>
                {statusLabel[row.status]}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
