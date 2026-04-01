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
} from "recharts";
import { motion } from "framer-motion";

const data = [
  { name: "OnlyBlackBox", value1: 5.7, value2: 3.2, value3: 1.8 },
  { name: "OnlySystem", value1: 3.7, value2: 2.7, value3: 1.6 },
  { name: "OnlyHedge", value1: 2.7, value2: 1.6, value3: 0.5 },
];

interface AlgorithmPerformanceChartProps {
  className?: string;
}

export function AlgorithmPerformanceChart({ className }: AlgorithmPerformanceChartProps) {
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
        subtitle="Strategy comparison by returns"
      />

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            barGap={8}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.03)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
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
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border border-white/[0.08] bg-[#1e1e24] px-3 py-2 shadow-xl">
                      <p className="text-xs text-white/60 mb-1">{label}</p>
                      {payload.map((entry, idx) => (
                        <p key={idx} className="text-xs font-medium" style={{ color: entry.color }}>
                          {entry.name}: +{entry.value}%
                        </p>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="value1"
              name="Primary"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              animationDuration={1200}
            />
            <Bar
              dataKey="value2"
              name="Secondary"
              fill="#eab308"
              radius={[4, 4, 0, 0]}
              animationDuration={1200}
              animationBegin={200}
            />
            <Bar
              dataKey="value3"
              name="Tertiary"
              fill="#6b7280"
              radius={[4, 4, 0, 0]}
              animationDuration={1200}
              animationBegin={400}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
