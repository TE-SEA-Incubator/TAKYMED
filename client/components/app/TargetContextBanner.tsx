import { User, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface TargetContextBannerProps {
  mode: "self" | "client";
  clientName?: string;
  clientPhone?: string;
  actorName?: string;
  className?: string;
}

export function TargetContextBanner({
  mode,
  clientName,
  clientPhone,
  actorName,
  className,
}: TargetContextBannerProps) {
  const navigate = useNavigate();
  const isClient = mode === "client";

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 rounded-[1.5rem] border p-4 md:flex-row md:items-center md:justify-between",
        isClient
          ? "border-primary/20 bg-primary/[0.04]"
          : "border-secondary/20 bg-secondary/[0.05]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            isClient ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary",
          )}
        >
          {isClient ? <Users className="h-5 w-5" /> : <User className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {isClient ? "Ordonnance pour un client" : "Rappel personnel"}
          </p>
          <p className="mt-1 text-base font-bold text-slate-900">
            {isClient ? clientName || "Client" : actorName || "Mon compte"}
          </p>
          {isClient && clientPhone && (
            <p className="mt-0.5 text-sm text-muted-foreground">{clientPhone}</p>
          )}
          {!isClient && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ce rappel sera créé sur votre propre compte commercial.
            </p>
          )}
        </div>
      </div>

      {isClient && (
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => navigate("/commercial")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour clients
        </Button>
      )}
    </div>
  );
}
