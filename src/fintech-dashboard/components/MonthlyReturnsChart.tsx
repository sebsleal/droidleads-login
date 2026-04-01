import { useState } from "react";
import { cn } from "../lib/utils";
import { SectionHeader } from "./SectionHeader";
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
import { motion } from "framer-motion";

const data = [
  { month: "Jan", value: 2.1, color: "#3b82f6" },
  { month: "Feb", value: 5.1, color: "#22c55e" },
  { month: "Mar", value: 3.3, color: "#f97316" },
  { month: "Apr", value: 4.3, color: "#eab308" },
  { month: "May", value: 2.1, color: "#ec4899" },
  { month: "Jun", value: 3.5, color: "#a855f7" },
];

interface MonthlyReturnsChartProps {
  className?: string;
}

export function MonthlyReturnsChart({ className }: MonthlyReturnsChartProps) {
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
        subtitle="Performance by month"
        action={{
          label: timeRange,
          options: ["Last 6 months", "Last year", "Last 3 years"],
          onSelect: setTimeRange,
        }}
      />

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              tickFormatter={(value) => `+${value}%`}
              dx={-10}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.02)" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border border-white/[0.08] bg-[#1e1e24] px-3 py-2 shadow-xl">
                      <p className="text-xs text-white/60">{payload[0].payload.month}</p>
                      <p className="text-sm font-semibold text-white">
                        +{payload[0].value}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={1000}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
