import { useState } from "react";
import { cn } from "../lib/utils";
import { SectionHeader } from "./SectionHeader";
import { motion } from "framer-motion";
import { CheckCircle2, HelpCircle, Download } from "lucide-react";

interface ProgressItem {
  label: string;
  progress: number;
  target: string;
  status: "complete" | "in-progress" | "pending";
}

interface DownloadItem {
  label: string;
  filename: string;
}

const progressData: ProgressItem[] = [
  { label: "Phase 1 Target (10%)", progress: 100, target: "100%", status: "complete" },
  { label: "Phase 2 Target (5%)", progress: 75, target: "75%", status: "in-progress" },
  { label: "Issued certificates", progress: 60, target: "60%", status: "in-progress" },
];

const downloads: DownloadItem[] = [
  { label: "Download OnlyGenius Phase 1.pdf", filename: "OnlyGenius_Phase1.pdf" },
  { label: "Download Prop Firm Cert.jpg", filename: "PropFirm_Cert.jpg" },
];

interface CertificatesProgressProps {
  className?: string;
}

export function CertificatesProgress({ className }: CertificatesProgressProps) {
  const [timeRange, setTimeRange] = useState("Last 6 month");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className={cn(
        "relative rounded-xl border border-white/[0.06] bg-[#1a1a1f]/60",
        "backdrop-blur-sm p-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]",
        className
      )}
    >
      <SectionHeader
        title="Certificates progress tracker"
        subtitle="Payment status overview for last 6 months"
        action={{
          label: timeRange,
          options: ["Last 6 month", "Last year", "All time"],
          onSelect: setTimeRange,
        }}
      />

      <div className="space-y-5">
        <div className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Certificate status
        </div>

        {progressData.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{item.target}</span>
                {item.status === "complete" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                {item.status === "in-progress" && (
                  <HelpCircle className="w-4 h-4 text-blue-400" />
                )}
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.progress}%` }}
                transition={{ duration: 1, delay: 0.5 + index * 0.1, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full",
                  item.status === "complete" ? "bg-emerald-500" : "bg-blue-500"
                )}
              />
            </div>
          </motion.div>
        ))}

        <div className="pt-4 border-t border-white/[0.04] space-y-2">
          {downloads.map((download, index) => (
            <motion.button
              key={download.filename}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg",
                "text-sm text-white/70 hover:text-white/90",
                "bg-white/[0.02] hover:bg-white/[0.05]",
                "border border-white/[0.04] hover:border-white/[0.08]",
                "transition-all duration-200 group"
              )}
            >
              <Download className="w-4 h-4 text-white/40 group-hover:text-blue-400 transition-colors" />
              <span>{download.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
