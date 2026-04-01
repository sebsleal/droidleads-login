import { useState } from "react";
import { cn } from "../lib/utils";
import { SectionHeader } from "./SectionHeader";
import { motion } from "framer-motion";
import { Activity, Pause, CheckCircle2, TrendingDown, Target, Zap } from "lucide-react";

interface Algorithm {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "optimizing";
  returnPct: number;
  winRate: number;
  totalTrades: number;
  drawdown: number;
  openPositions: number;
  color: string;
  accentBg: string;
  accentBorder: string;
}

const algorithms: Algorithm[] = [
  {
    id: "blackbox",
    name: "OnlyBlackBox",
    description: "ML-driven momentum strategy",
    status: "active",
    returnPct: 5.7,
    winRate: 68.4,
    totalTrades: 142,
    drawdown: 3.2,
    openPositions: 5,
    color: "text-blue-400",
    accentBg: "bg-blue-500/10",
    accentBorder: "border-blue-500/20",
  },
  {
    id: "system",
    name: "OnlySystem",
    description: "Mean reversion & arbitrage",
    status: "active",
    returnPct: 3.7,
    winRate: 72.1,
    totalTrades: 98,
    drawdown: 1.8,
    openPositions: 4,
    color: "text-amber-400",
    accentBg: "bg-amber-500/10",
    accentBorder: "border-amber-500/20",
  },
  {
    id: "hedge",
    name: "OnlyHedge",
    description: "Risk-controlled long/short",
    status: "paused",
    returnPct: -0.5,
    winRate: 55.2,
    totalTrades: 64,
    drawdown: 0.5,
    openPositions: 3,
    color: "text-slate-400",
    accentBg: "bg-slate-500/10",
    accentBorder: "border-slate-500/20",
  },
];

const statusIcon = {
  active: <Activity className="w-3 h-3 text-emerald-400" />,
  paused: <Pause className="w-3 h-3 text-amber-400" />,
  optimizing: <Zap className="w-3 h-3 text-blue-400" />,
};

const statusStyle = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  optimizing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

interface AlgorithmStatusProps {
  className?: string;
}

export function AlgorithmStatus({ className }: AlgorithmStatusProps) {
  const [timeRange, setTimeRange] = useState("Last 6 months");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={cn(
        "relative rounded-xl border border-white/[0.06] bg-[#1a1a1f]/60",
        "backdrop-blur-sm p-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]",
        className
      )}
    >
      <SectionHeader
        title="Algorithm-wise performance"
        subtitle="Lorem ipsum dolor sit amet"
        action={{
          label: timeRange,
          options: ["Last 6 months", "Last year", "All time"],
          onSelect: setTimeRange,
        }}
      />

      <div className="space-y-3">
        {algorithms.map((algo, i) => (
          <motion.div
            key={algo.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25 + i * 0.08 }}
            className={cn(
              "rounded-lg border p-4",
              "bg-white/[0.02] hover:bg-white/[0.035] transition-all duration-200",
              algo.accentBorder
            )}
          >
            {/* Top row */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn("text-sm font-semibold", algo.color)}>{algo.name}</span>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded border flex items-center gap-1",
                    statusStyle[algo.status]
                  )}>
                    {statusIcon[algo.status]}
                    {algo.status.charAt(0).toUpperCase() + algo.status.slice(1)}
                  </span>
                </div>
                <span className="text-[11px] text-white/35">{algo.description}</span>
              </div>
              <div className="text-right">
                <div className={cn(
                  "text-base font-bold",
                  algo.returnPct >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {algo.returnPct > 0 ? "+" : ""}{algo.returnPct}%
                </div>
                <div className="text-[10px] text-white/30">6-mo return</div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Win Rate", value: `${algo.winRate}%`, icon: <Target className="w-3 h-3" /> },
                { label: "Trades", value: String(algo.totalTrades), icon: <Activity className="w-3 h-3" /> },
                { label: "Drawdown", value: `-${algo.drawdown}%`, icon: <TrendingDown className="w-3 h-3" /> },
                { label: "Open", value: String(algo.openPositions), icon: <CheckCircle2 className="w-3 h-3" /> },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    "rounded-md px-2.5 py-2 text-center",
                    algo.accentBg
                  )}
                >
                  <div className={cn("flex justify-center mb-1 opacity-60", algo.color)}>
                    {stat.icon}
                  </div>
                  <div className="text-xs font-semibold text-white">{stat.value}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Win rate bar */}
            <div className="mt-3">
              <div className="flex justify-between mb-1">
                <span className="text-[10px] text-white/30">Win rate</span>
                <span className={cn("text-[10px] font-medium", algo.color)}>{algo.winRate}%</span>
              </div>
              <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${algo.winRate}%` }}
                  transition={{ duration: 1.2, delay: 0.5 + i * 0.1, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    algo.id === "blackbox" && "bg-gradient-to-r from-blue-600 to-blue-400",
                    algo.id === "system" && "bg-gradient-to-r from-amber-600 to-amber-400",
                    algo.id === "hedge" && "bg-gradient-to-r from-slate-500 to-slate-400",
                  )}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
