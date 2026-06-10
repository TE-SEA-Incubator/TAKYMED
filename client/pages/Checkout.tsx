import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, Smartphone, Lock, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface AccountType {
  id: number;
  name: string;
  price: number;
  currency: string;
}

export default function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<AccountType | null>(null);
  const [countries, setCountries] = useState<{ code: string, name: string, dialCode: string, flag: string }[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("CM");

  // Orange Money form state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const planId = searchParams.get("plan");

  useEffect(() => {
    async function fetchAccountTypes() {
      try {
        const res = await fetch("/api/admin/settings", {
          headers: { "x-user-id": user?.id?.toString() || "" }
        });
        if (res.ok) {
          const data = await res.json();
          setAccountTypes(data.types || []);
          // Find selected plan
          if (planId) {
            const plan = data.types?.find((t: AccountType) => t.id === parseInt(planId));
            if (plan) setSelectedPlan(plan);
          }
        }
      } catch (error) {
        console.error("Failed to fetch account types:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAccountTypes();

    async function fetchCountries() {
      try {
        const res = await fetch('/api/countries');
        if (res.ok) {
          const data = await res.json();
          setCountries(data.countries || []);
        }
      } catch (err) {
        console.error("Erreur lors du chargement des pays:", err);
      }
    }
    fetchCountries();
  }, [planId]);

  const formatPrice = (type: AccountType) => {
    if (!type.price || type.price === 0) return "Gratuit";
    return `${type.price.toLocaleString()} ${type.currency || 'FCFA'}/mois`;
  };

  const handleSendOtp = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error("Numéro de téléphone invalide");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/payments/send-otp", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": user?.id?.toString() || ""
        },
        body: JSON.stringify({
          phoneNumber,
          amount: selectedPlan?.price
        })
      });

      if (res.ok) {
        toast.success("Code OTP envoyé par SMS");
        setOtpSent(true);
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de l'envoi du code");
      }
    } catch (error) {
      console.error("OTP error:", error);
      toast.error("Erreur lors de l'envoi du code");
    } finally {
      setProcessing(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpSent(false);
    setOtpCode("");
    await handleSendOtp();
  };

  const handlePayment = async () => {
    if (!otpCode || otpCode.length < 6) {
      toast.error("Code OTP invalide");
      return;
    }
    if (!selectedPlan) {
      toast.error("Aucun plan sélectionné");
      return;
    }

    setProcessing(true);

    try {
      const res = await fetch("/api/payments/process", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": user?.id?.toString() || ""
        },
        body: JSON.stringify({
          userId: user?.id,
          planId: selectedPlan.id,
          phoneNumber,
          otpCode,
          amount: selectedPlan.price,
          method: "orange_money"
        })
      });

      if (res.ok) {
        toast.success("Paiement réussi ! Votre compte a été mis à niveau.");
        setTimeout(() => {
          navigate("/dashboard");
        }, 1500);
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors du paiement");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Erreur lors du traitement du paiement");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!selectedPlan) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>Aucun plan sélectionné</CardTitle>
            <CardDescription>Veuillez choisir une formule pour continuer</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/upgrade">
              <Button className="w-full rounded-xl">Choisir une formule</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/upgrade" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-primary mb-4">
            <ArrowLeft className="w-4 h-4" />
            Retour aux formules
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Finaliser votre commande</h1>
          <p className="text-slate-500">Paiement sécurisé pour votre abonnement</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Payment Form */}
          <Card className="shadow-lg border-0">
            <CardHeader className="border-b bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Orange Money</CardTitle>
                  <CardDescription>Paiement mobile sécurisé via Orange Money</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-7 space-y-7">
              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Numéro Orange Money</Label>
                <div className="flex gap-3">
                  <Select
                    value={selectedCountry}
                    onValueChange={(code) => {
                      setSelectedCountry(code);
                      const country = countries.find(c => c.code === code);
                      if (country) {
                        const phoneWithoutCode = phoneNumber.replace(/^\+\d+/, '');
                        setPhoneNumber(country.dialCode + phoneWithoutCode);
                      }
                    }}
                  >
                    <SelectTrigger className="w-32 h-14 rounded-2xl border bg-white px-3 text-base font-bold focus:ring-2 focus:ring-primary outline-none">
                      <SelectValue placeholder="Pays" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl max-h-60">
                      {countries.map(c => (
                        <SelectItem key={c.code} value={c.code} className="rounded-xl">
                          <span className="flex items-center gap-2">
                            <span className="text-lg">{c.flag}</span>
                            <span className="font-bold">{c.dialCode}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Smartphone className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="phoneNumber"
                      placeholder="6XX XXX XXX"
                      size={15}
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^[0-9+]+$/.test(val)) {
                          setPhoneNumber(val);
                        }
                      }}
                      className="pl-12 h-14 rounded-2xl text-2xl font-mono tracking-widest bg-white border-slate-200 focus-visible:ring-primary w-auto min-w-[15ch] flex-1"
                      maxLength={15}
                    />
                  </div>
                </div>
              </div>

              {/* OTP Code */}
              {otpSent && (
                <div className="space-y-2">
                  <Label htmlFor="otpCode">Code OTP reçu</Label>
                  <Input
                    id="otpCode"
                    placeholder="Entrez le code à 6 chiffres"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    maxLength={6}
                    className="h-12 rounded-xl text-lg font-mono"
                  />
                </div>
              )}

              {/* Send OTP Button */}
              {!otpSent ? (
                <Button
                  className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handleSendOtp}
                  disabled={processing || !phoneNumber}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    "Envoyer le code OTP"
                  )}
                </Button>
              ) : (
                <Button
                  className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handleResendOtp}
                  disabled={processing}
                  variant="outline"
                >
                  Renvoyer le code
                </Button>
              )}

              {/* Submit Button */}
              {otpSent && (
                <Button
                  className="w-full h-14 rounded-xl text-lg font-bold bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handlePayment}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Traitement en cours...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5 mr-2" />
                      Confirmer le paiement {formatPrice(selectedPlan)}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Order Summary */}
          <div className="space-y-6">
            <Card className="shadow-lg border-0">
              <CardHeader className="border-b bg-slate-50/50">
                <CardTitle>Récapitulatif de commande</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Formule</span>
                  <span className="font-bold text-lg">{selectedPlan.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Prix</span>
                  <span className="font-bold text-lg text-primary">{formatPrice(selectedPlan)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Durée</span>
                  <span className="font-medium">1 mois</span>
                </div>
                <hr className="border-slate-200" />
                <div className="flex items-center justify-between text-lg">
                  <span className="font-bold">Total</span>
                  <span className="font-black text-primary">{formatPrice(selectedPlan)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Features Included */}
            <Card className="shadow-lg border-0 bg-primary text-white">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-lg">Ce qui est inclus :</h3>
                <ul className="space-y-3">
                  {selectedPlan.name === "Pro" && (
                    <>
                      <li className="flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        Ordonnances illimitées
                      </li>
                      <li className="flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        Notifications SMS/WhatsApp
                      </li>
                      <li className="flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        Statistiques d'observance
                      </li>
                      <li className="flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        Gestion de pharmacie
                      </li>
                      <li className="flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        Support prioritaire 24/7
                      </li>
                    </>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
