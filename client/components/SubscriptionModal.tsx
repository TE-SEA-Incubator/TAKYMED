import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Crown, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountType {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
}

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriptionModal({ open, onOpenChange }: SubscriptionModalProps) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<AccountType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [motive, setMotive] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPlans();
      setSelectedPlan(null);
      setMotive("");
    }
  }, [open]);

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/account-types");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.types || []);
      }
    } catch (error) {
      toast.error("Erreur de chargement des formules");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequest = async () => {
    if (!selectedPlan) return;
    if (!user?.id) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/upgrade-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id.toString(),
        },
        body: JSON.stringify({ requestedType: selectedPlan, motive }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        toast.success("Demande de changement de formule envoyée avec succès.");
        onOpenChange(false);
      } else {
        toast.error(data?.error || "Erreur lors de la demande");
      }
    } catch (error) {
      toast.error("Erreur réseau");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  const currentType = String(user.type || "standard").toLowerCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl rounded-3xl p-6 md:p-8">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
              <Crown className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-slate-800">Abonnements & Formules</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium">
                Gérez votre abonnement TAKYMED
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((plan) => {
                const planName = plan.name.toLowerCase();
                // Map API names to local logic
                const isPro = planName === "professionnel" || planName === "pro";
                const isCom = planName === "commercial";
                const isStd = planName === "standard";
                
                const normalizedPlanName = isPro ? "professionnel" : isCom ? "commercial" : isStd ? "standard" : planName;
                const isCurrent = currentType === normalizedPlanName || (currentType === 'pharmacist' && isPro);

                const isSelected = selectedPlan === plan.name;

                return (
                  <div
                    key={plan.id}
                    onClick={() => !isCurrent && setSelectedPlan(plan.name)}
                    className={cn(
                      "relative p-5 rounded-2xl border-2 transition-all text-left",
                      isCurrent
                        ? "border-emerald-200 bg-emerald-50/50 cursor-default"
                        : isSelected
                        ? "border-primary bg-primary/5 cursor-pointer shadow-md scale-[1.02]"
                        : "border-slate-100 bg-white cursor-pointer hover:border-primary/30"
                    )}
                  >
                    {isCurrent && (
                      <div className="absolute top-3 right-3 text-emerald-600 flex items-center gap-1 text-[10px] font-bold uppercase">
                        <CheckCircle2 className="w-4 h-4" /> Actuel
                      </div>
                    )}
                    
                    <h3 className={cn("font-black text-lg", isCurrent ? "text-emerald-800" : "text-slate-800")}>
                      {plan.name}
                    </h3>
                    <p className="text-2xl font-black mt-2 mb-3">
                      {plan.price > 0 ? (
                        <>
                          {plan.price} <span className="text-sm text-slate-500 font-bold">{plan.currency}</span>
                        </>
                      ) : (
                        "Gratuit"
                      )}
                    </p>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      {plan.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {selectedPlan && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-4 pt-4 border-t">
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3 text-amber-800">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-xs font-medium leading-relaxed">
                    Votre demande de passage à la formule <strong>{selectedPlan}</strong> sera transmise à l'administration pour validation.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="motive" className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Message / Justification (Optionnel)
                  </Label>
                  <Input
                    id="motive"
                    placeholder="Ex: Je souhaite gérer plus d'ordonnances..."
                    value={motive}
                    onChange={(e) => setMotive(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>

                <Button 
                  onClick={handleRequest} 
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl font-bold shadow-lg"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  Envoyer la demande
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
