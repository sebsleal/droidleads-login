import { cn } from "../lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({ children, className, padding = "md" }: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-white/[0.06] bg-[#1a1a1f]/80",
        "backdrop-blur-sm",
        "shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]",
        "overflow-hidden",
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  children,
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonProps) {
  const variants = {
    primary: cn(
      "bg-blue-600 text-white hover:bg-blue-500",
      "shadow-[0_0_20px_rgba(37,99,235,0.3)]"
    ),
    secondary: cn(
      "bg-white/[0.04] text-white/90 hover:bg-white/[0.08]",
      "border border-white/[0.08]"
    ),
    ghost: "text-white/70 hover:text-white hover:bg-white/[0.04]",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    lg: "h-10 px-5 text-sm",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/30",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
}

export function Dropdown({ trigger, children, align = "right" }: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-48 rounded-lg border border-white/[0.08]",
            "bg-[#1e1e24] shadow-xl backdrop-blur-sm",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03]",
        "px-3 py-2 text-sm text-white placeholder:text-white/30",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30",
        "transition-all duration-200",
        className
      )}
      {...props}
    />
  );
}

import React from "react";
