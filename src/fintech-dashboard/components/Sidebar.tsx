import { cn } from "../lib/utils";
import {
  LayoutDashboard,
  Wallet,
  ShoppingCart,
  Award,
  Calendar,
  Users,
  FileText,
  Settings,
  HelpCircle,
  Gift,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, active, badge, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
        "transition-all duration-200 group relative",
        active
          ? "bg-blue-600/15 text-blue-400"
          : "text-white/60 hover:text-white/90 hover:bg-white/[0.04]"
      )}
    >
      <Icon
        className={cn(
          "w-[18px] h-[18px] transition-colors",
          active ? "text-blue-400" : "text-white/50 group-hover:text-white/70"
        )}
      />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-500/20 text-blue-400">
          {badge}
        </span>
      )}
      {active && (
        <motion.div
          layoutId="activeNav"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
    </button>
  );
}

interface SidebarProps {
  activeItem?: string;
  onNavChange?: (id: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "trading", label: "Trading accounts", icon: Wallet },
  { id: "services", label: "Purchase services", icon: ShoppingCart },
  { id: "certificates", label: "Certificates", icon: Award },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "affiliate", label: "Affiliate program", icon: Users },
  { id: "taxation", label: "Taxation guide", icon: FileText },
  { id: "settings", label: "Account settings", icon: Settings },
  { id: "help", label: "Help", icon: HelpCircle },
];

export function Sidebar({ activeItem = "dashboard", onNavChange }: SidebarProps) {
  return (
    <aside className="w-64 h-screen bg-[#16161a] border-r border-white/[0.04] flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <span className="text-white font-bold text-sm">O</span>
        </div>
        <span className="text-white font-semibold text-sm tracking-wide">ONLYGENIUS</span>
        <span className="text-white/30 text-xs">|</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeItem === item.id}
            onClick={() => onNavChange?.(item.id)}
          />
        ))}
      </nav>

      {/* Surprise Box Promo */}
      <div className="px-4 py-3 mx-4 mb-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
        <div className="flex items-center gap-2 mb-1.5">
          <Gift className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-200/90">Surprise box</span>
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-500 text-white">
            New
          </span>
        </div>
      </div>

      {/* Profile Block */}
      <div className="px-4 py-4 border-t border-white/[0.04]">
        <button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-lg">
            PG
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-white/90 group-hover:text-white">
              Pedro Gonzalez
            </div>
            <div className="text-xs text-white/40">User</div>
          </div>
          <ChevronDown className="w-4 h-4 text-white/40" />
        </button>
      </div>
    </aside>
  );
}
