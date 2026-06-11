import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "neutral";

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

const toneClass: Record<StatusTone, string> = {
  success: "bg-emerald-500/10 text-emerald-700",
  warning: "bg-amber-500/10 text-amber-700",
  neutral: "bg-slate-500/10 text-slate-600",
};

export function StatusBadge({ label, tone = "neutral", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
        toneClass[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
