import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "md" | "lg" | "xl" | "2xl" | "full";
}

const maxWidthClass = {
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  "2xl": "max-w-7xl",
  full: "max-w-none",
};

export function PageShell({
  children,
  className,
  maxWidth = "xl",
}: PageShellProps) {
  return (
    <div
      className={cn(
        "min-h-[calc(100vh-4rem)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/[0.06] via-slate-50 to-slate-50 pb-24 md:pb-12",
        className,
      )}
    >
      <div
        className={cn(
          "container mx-auto px-4 py-6 md:py-10 animate-in fade-in duration-500",
          maxWidthClass[maxWidth],
        )}
      >
        {children}
      </div>
    </div>
  );
}
