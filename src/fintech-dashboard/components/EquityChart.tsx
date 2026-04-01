import { useState } from "react";
import { cn } from "../lib/utils";
import { SectionHeader } from "./SectionHeader";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";

const data = [
  { month: "Jan", value: 120000 },
  { month: "Feb", value: 280000 },
  { month: "Mar", value: 450000 },
  { month: "Apr", value: 180000 },
  { month: "May", value: 320000 },
  { month: "Jun", value: 380000 },
];

interface EquityChartProps {
  className?: string;
}

export function EquityChart({ className }: EquityChartProps) {
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
        subtitle="Portfolio performance tracking"
        action={{
          label: timeRange,
          options: ["Last 6 months", "Last year", "Last 3 years", "All time"],
          onSelect: setTimeRange,
        }}
      />

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.03)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
              tickFormatter={(value) => `${value / 1000}K`}
              dx={-10}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border border-white/[0.08] bg-[#1e1e24] px-3 py-2 shadow-xl">
                      <p className="text-xs text-white/60">{payload[0].payload.month}</p>
                      <p className="text-sm font-semibold text-white">
                        ${(payload[0].value as number).toLocaleString()}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="url(#equityGradient)"
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
