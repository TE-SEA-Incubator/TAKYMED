import { cn } from "@/lib/utils";
import Logo from "@/components/Logo1";

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
  showLogo?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  showLogo = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative mb-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl md:rounded-[2.5rem] md:p-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-secondary/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4 md:items-center md:gap-5">
          {showLogo && <Logo size="small" className="hidden shrink-0 sm:block" />}
          <div className="min-w-0 space-y-2">
            {badge && (
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                {badge}
              </span>
            )}
            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="max-w-2xl text-sm font-medium text-muted-foreground md:text-base">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
