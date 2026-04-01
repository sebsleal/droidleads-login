import { cn } from "../lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  icon: LucideIcon;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  deltaPositive,
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "relative rounded-xl border border-white/[0.06] bg-[#1a1a1f]/60",
        "backdrop-blur-sm p-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]",
        "hover:bg-[#1a1a1f]/80 transition-colors duration-200",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 text-white/40">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-semibold text-white tracking-tight">{value}</div>
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            deltaPositive ? "text-emerald-400" : "text-rose-400"
          )}
        >
          {deltaPositive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>{delta}</span>
          <span className="text-white/30 ml-1">from last month</span>
        </div>
      </div>
    </motion.div>
  );
}
