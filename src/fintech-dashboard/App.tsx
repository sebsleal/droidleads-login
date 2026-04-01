import { useState } from "react";
import { cn } from "../lib/utils";
import { Sidebar } from "./components/Sidebar";
import { StatCard } from "./components/StatCard";
import { EquityOverview } from "./components/EquityOverview";
import { MonthlyPerformance } from "./components/MonthlyPerformance";
import { AlgorithmStatus } from "./components/AlgorithmStatus";
import { CertificatesProgress } from "./components/CertificatesProgress";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  PieChart,
  BarChart3,
  Headphones,
  Menu,
} from "lucide-react";

const stats = [
  {
    label: "Current balance",
    value: "$1,235,236",
    delta: "+10%",
    deltaPositive: true,
    icon: DollarSign,
  },
  {
    label: "Total profit/loss",
    value: "+$2,156.92",
    delta: "+12%",
    deltaPositive: true,
    icon: TrendingUp,
  },
  {
    label: "Equity",
    value: "$12,701.19",
    delta: "-2%",
    deltaPositive: false,
    icon: PieChart,
  },
  {
    label: "Monthly performance",
    value: "+6.4%",
    delta: "+5%",
    deltaPositive: true,
    icon: BarChart3,
  },
];

function App() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#121214] text-white">
      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar activeItem={activeNav} onNavChange={setActiveNav} />
      </div>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-start justify-between mb-8"
          >
            <div className="flex items-start gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <Menu className="w-5 h-5 text-white/70" />
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Dashboard</h1>
                <p className="text-sm text-white/40 mt-1">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit
                </p>
              </div>
            </div>

            <button
              className={cn(
                "hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white",
                "border border-white/[0.06] transition-all duration-200"
              )}
            >
              <Headphones className="w-4 h-4" />
              <span className="text-sm font-medium">Contact support</span>
            </button>
          </motion.header>

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
              <StatCard key={stat.label} {...stat} className={cn("animation-delay", index * 50)} />
            ))}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-7">
              <EquityOverview />
            </div>
            <div className="xl:col-span-5">
              <MonthlyPerformance />
            </div>
            <div className="xl:col-span-7">
              <AlgorithmStatus />
            </div>
            <div className="xl:col-span-5">
              <CertificatesProgress />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
