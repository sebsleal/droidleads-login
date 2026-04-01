import { cn } from "../lib/utils";
import { ChevronDown } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    options?: string[];
    onSelect?: (option: string) => void;
  };
  className?: string;
}

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(action?.options?.[0] || action?.label);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("flex items-start justify-between mb-4", className)}>
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium",
              "bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white/90",
              "border border-white/[0.06] transition-all duration-200"
            )}
          >
            {selectedOption}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
          </button>
          {isOpen && action.options && (
            <div className="absolute right-0 mt-2 w-40 rounded-lg border border-white/[0.08] bg-[#1e1e24] shadow-xl z-50 overflow-hidden">
              {action.options.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setSelectedOption(option);
                    action.onSelect?.(option);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-xs transition-colors",
                    option === selectedOption
                      ? "bg-blue-500/10 text-blue-400"
                      : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
