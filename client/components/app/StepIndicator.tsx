import { cn } from "@/lib/utils";
import { Check, ChevronRight } from "lucide-react";

export interface StepItem {
  id: number;
  label: string;
}

interface StepIndicatorProps {
  steps: StepItem[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  return (
    <div className={cn("mb-8 overflow-x-auto pb-1", className)}>
      <div className="flex min-w-max items-center gap-2 md:gap-3">
        {steps.map((step, index) => {
          const isComplete = currentStep > step.id;
          const isActive = currentStep === step.id;

          return (
            <div key={step.id} className="flex items-center gap-2 md:gap-3">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-2xl px-3 py-2 transition-all md:px-4",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : isComplete
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-white text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                    isActive
                      ? "bg-white/20"
                      : isComplete
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100",
                  )}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className="whitespace-nowrap text-sm font-semibold">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
