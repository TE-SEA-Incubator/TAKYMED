import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Crown, Shield, Users, ArrowRightLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface AccountType {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  maxOrdonnances: number | null;
  maxRappels: number | null;
}

export default function Upgrade() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccountTypes() {
      try {
        const res = await fetch("/api/admin/settings", {
          headers: { "x-user-id": user?.id?.toString() || "" }
        });
        if (res.ok) {
          const data = await res.json();
          setAccountTypes(data.types || []);
        }
      } catch (error) {
        console.error("Failed to fetch account types:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAccountTypes();
  }, []);

  // Map type name to internal ID
  const getTypeInternalId = (name: string): string => {
    const map: Record<string, string> = {
      "Standard": "standard",
      "Professionnel": "professional",
      "Pharmacien": "pharmacist",
      "Administrateur": "admin"
    };
    return map[name] || name.toLowerCase();
  };

  // Get icon for type
  const getTypeIcon = (name: string) => {
    switch (name) {
      case "Standard": return <Users className="w-8 h-8" />;
      case "Pro": return <Shield className="w-8 h-8" />;
      case "Commercial": return <ArrowRightLeft className="w-8 h-8" />;
      default: return <Users className="w-8 h-8" />;
    }
  };

  // Get color for type
  const getTypeColor = (name: string) => {
    switch (name) {
      case "Standard": return "bg-blue-500";
      case "Pro": return "bg-purple-500";
      case "Commercial": return "bg-orange-500";
      default: return "bg-slate-500";
    }
  };

  // Get features based on type
  const getTypeFeatures = (type: AccountType) => {
    const baseFeatures = [
      "Création d'ordonnances",
      "Calendrier des prises",
      "Notifications in-app"
    ];

    if (type.name === "Standard") {
      return [
        ...baseFeatures,
        type.maxOrdonnances ? `${type.maxOrdonnances} ordonnance(s) maximum` : "Ordonnances limitées",
        type.maxRappels ? `${type.maxRappels} rappel(s) maximum` : "Rappels limités",
        "Support basique"
      ];
    }

    if (type.name === "Pro") {
      return [
        "Ordonnances illimitées",
        "Notifications SMS/WhatsApp",
        "Statistiques d'observance",
        "Suivi des pharmacies",
        "Gestion de pharmacie",
        "Rapports détaillés",
        "Support prioritaire 24/7"
      ];
    }

    if (type.name === "Commercial") {
      return [
        "Inscription de nouveaux clients",
        "Validation de comptes via PIN",
        "Gestion d'ordonnances clients",
        "Tableau de bord dédié",
        "Suivi des commissions (bientôt)",
        "Outils marketing"
      ];
    }

    return baseFeatures;
  };

  // Format price
  const formatPrice = (type: AccountType) => {
    if (type.name === "Commercial") return t('upgrade.freeOnRequest');
    if (type.price === 0) return t('upgrade.free');
    return `${type.price.toLocaleString()} ${type.currency}/mois`;
  };

  const [motive, setMotive] = useState("");
  const [showMotiveDialog, setShowMotiveDialog] = useState(false);
  const [pendingUpgradeType, setPendingUpgradeType] = useState<string | null>(null);

  const handleUpgrade = (typeName: string) => {
    if (!user) {
      toast.error(t('upgrade.mustBeLogged'));
      return;
    }

    if (typeName === "Administrateur") {
      toast.error(t('upgrade.notAccessible'));
      return;
    }

    if (typeName === "Commercial") {
      setPendingUpgradeType(typeName);
      setShowMotiveDialog(true);
      return;
    }

    // Find the plan and redirect to checkout
    const plan = accountTypes.find(t => t.name === typeName);
    if (plan && plan.price > 0) {
      navigate(`/checkout?plan=${plan.id}`);
    } else if (plan && plan.price === 0) {
      // Free plan - direct upgrade
      submitUpgradeRequest(typeName);
    }
  };

  const submitUpgradeRequest = (typeName: string, motiveText?: string) => {
    if (!user?.id) return;
    fetch("/api/auth/upgrade-request", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-user-id": user.id.toString()
      },
      body: JSON.stringify({ requestedType: typeName, motive: motiveText })
    }).then(res => res.json())
      .then(data => {
        if (data.success) {
          toast.success(typeName === "Commercial" ? t('upgrade.requestSent') : t('upgrade.updateSuccess'));
          if (typeName !== "Commercial") window.location.reload();
          setShowMotiveDialog(false);
          setMotive("");
        } else {
          toast.error(data.error || t('upgrade.updateError'));
        }
      })
      .catch(() => toast.error(t('upgrade.updateError')));
  };

  // Get current user type name
  const userTypeName = user?.type === "standard" ? "Standard" :
                       user?.type === "professional" || user?.type === "pharmacist" ? "Pro" :
                       user?.type === "admin" ? "Administrateur" : "Standard";

  const currentTypeId = accountTypes.find(t => t.name === userTypeName)?.id || 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-emerald-50 flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-t-transparent rounded-full animate-spin border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-emerald-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Crown className="w-4 h-4" />
            {t('upgrade.boostExperience')}
          </div>
          <h1 className="text-4xl font-black mb-4">{t('upgrade.chooseFormula')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('upgrade.unlockPotential')}
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {accountTypes.filter(t => t.name !== "Administrateur").map((type, index) => {
            const isCurrent = type.name === userTypeName;
            const isPopular = type.name === "Professionnel";
            const features = getTypeFeatures(type);
            
            return (
              <Card
                key={type.id}
                className={`relative transition-all duration-300 hover:shadow-xl ${
                  isPopular ? 'ring-2 ring-primary shadow-lg' : 'hover:scale-102'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge className="bg-primary text-white px-4 py-1 rounded-full text-xs font-bold shadow-md">
                      {t('upgrade.popular')}
                    </Badge>
                  </div>
                )}

                <CardHeader className={cn("text-center pb-4", isPopular && "pt-8")}>
                  <div className={`w-16 h-16 rounded-2xl ${getTypeColor(type.name)} text-white flex items-center justify-center mx-auto mb-4`}>
                    {getTypeIcon(type.name)}
                  </div>
                  <CardTitle className="text-2xl font-bold">{type.name}</CardTitle>
                  <CardDescription className="text-3xl font-black text-primary mt-2">
                    {formatPrice(type)}
                  </CardDescription>
                  {type.description && (
                    <p className="text-sm text-muted-foreground mt-2">{type.description}</p>
                  )}
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    {features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-green-600" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className={`w-full rounded-xl h-12 font-bold ${
                      isCurrent
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-100 cursor-not-allowed'
                        : isPopular
                        ? 'bg-primary hover:bg-primary/90 shadow-lg'
                        : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                    disabled={isCurrent}
                    onClick={() => handleUpgrade(type.name)}
                  >
                    {isCurrent ? (
                      t('upgrade.currentFormula')
                    ) : type.id > currentTypeId ? (
                      <>
                        {t('upgrade.upgradeNow')}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    ) : (
                      t('upgrade.chooseThisFormula')
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 bg-white p-8 rounded-3xl shadow-sm border">
          <h2 className="text-2xl font-bold text-center mb-8">{t('upgrade.faqTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t('upgrade.faq1Q')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('upgrade.faq1A')}
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">{t('upgrade.faq2Q')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('upgrade.faq2A')}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t('upgrade.faq3Q')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('upgrade.faq3A')}
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">{t('upgrade.faq4Q')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('upgrade.faq4A')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Motive Dialog */}
      <Dialog open={showMotiveDialog} onOpenChange={setShowMotiveDialog}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t('upgrade.commercialTitle')}</DialogTitle>
            <DialogDescription>
              {t('upgrade.commercialDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder={t('upgrade.commercialPlaceholder')} 
              value={motive}
              onChange={(e) => setMotive(e.target.value)}
              className="min-h-[120px] rounded-2xl border-slate-200 focus:ring-orange-500"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowMotiveDialog(false)}
              className="rounded-xl"
            >
              {t('upgrade.cancel')}
            </Button>
            <Button 
              disabled={!motive.trim()} 
              onClick={() => submitUpgradeRequest("Commercial", motive)}
              className="rounded-xl bg-orange-500 hover:bg-orange-600 font-bold"
            >
              {t('upgrade.sendRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
