import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "success" | "warning" | "danger" | "muted";
  hint?: string;
  className?: string;
}

const toneStyles = {
  default: "bg-white text-slate-900",
  primary: "bg-primary/5 text-primary",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  muted: "bg-slate-900 text-white",
};

const iconToneStyles = {
  default: "bg-slate-100 text-slate-600",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-emerald-600",
  warning: "bg-amber-100 text-amber-600",
  danger: "bg-red-100 text-red-600",
  muted: "bg-white/10 text-white",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-white/70 p-5 shadow-sm transition-all hover:shadow-md",
        toneStyles[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[11px] font-bold uppercase tracking-[0.18em]",
              tone === "muted" ? "text-slate-400" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
          {hint && (
            <p
              className={cn(
                "mt-1 text-xs",
                tone === "muted" ? "text-slate-400" : "text-muted-foreground",
              )}
            >
              {hint}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              iconToneStyles[tone],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
