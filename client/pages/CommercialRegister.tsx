import { useState, useMemo, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Table,
  User,
  Clock,
  ChevronRight,
  Info,
  Calendar,
  Stethoscope,
  Pill,
  Save,
  Phone,
  UserPlus,
  Check,
  Loader2,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/app/PageShell";
import { PageHeader } from "@/components/app/PageHeader";
import { StepIndicator } from "@/components/app/StepIndicator";
import { MedicationEntry, DoseSchedule, FrequencyType } from "@shared/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function CommercialRegister() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [pinCode, setPinCode] = useState("");
  const [registeredClientId, setRegisteredClientId] = useState<number | null>(null);

  // Step 1: Client Info
  const [clientInfo, setClientInfo] = useState({
    name: "",
    phone: "",
  });

  // Step 2: Prescription details (mirrors Prescription.tsx)
  const [patient, setPatient] = useState({
    title: "",
    categorieAge: "adulte",
    weight: 0,
    startDate: (() => {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${now.getFullYear()}-${month}-${day}`;
    })()
  });

  const [categories, setCategories] = useState<{ id: number, name: string, description: string, considerWeight: boolean }[]>([]);
  const [medications, setMedications] = useState<MedicationEntry[]>([
    {
      id: "1",
      name: "",
      frequencyType: "1x",
      times: ["08:00"],
      durationDays: 1,
      doseValue: 1,
      unit: "comprimé"
    }
  ]);
  const [countries, setCountries] = useState<{ code: string, name: string, dialCode: string, flag: string }[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("CM");

  const [dbMedications, setDbMedications] = useState<{ id: number, name: string }[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [customDates, setCustomDates] = useState<Record<number, string>>({});
  const [applyCustomReminderHours, setApplyCustomReminderHours] = useState(false);

  // Step 3: Schedule preview
  const [scheduleState, setScheduleState] = useState<DoseSchedule[]>([]);

  const getDefaultTimesForFrequency = (frequencyType: FrequencyType): string[] => {
    if (frequencyType === "1x") return ["08:00"];
    if (frequencyType === "2x") return ["08:00", "20:00"];
    if (frequencyType === "3x") return ["08:00", "14:00", "20:00"];
    if (frequencyType === "4x") return ["00:00", "06:00", "12:00", "18:00"];
    return [];
  };


  const getEffectiveMedicationForSave = (m: MedicationEntry) => {
    if (!applyCustomReminderHours) {
      return {
        ...m,
        times: getDefaultTimesForFrequency(m.frequencyType),
        intervalHours: m.frequencyType === "interval" ? 6 : undefined,
      };
    }

    return {
      ...m,
      times: m.times,
      intervalHours: m.frequencyType === "interval" ? (m.intervalHours || 6) : undefined,
    };
  };

  useEffect(() => {
    async function fetchMeds() {
      try {
        const res = await fetch('https://dev.takymed.comhttps://dev.takymed.com/api/medications');
        if (res.ok) {
          const data = await res.json();
          setDbMedications(data.medications);
        }
      } catch (err) {
        console.error("Erreur lors du chargement des médicaments:", err);
      }
    }

    async function fetchInteractions() {
      try {
        const res = await fetch('https://dev.takymed.comhttps://dev.takymed.com/api/medications/interactions');
        if (res.ok) {
          const data = await res.json();
          setInteractions(data.interactions);
        }
      } catch (err) {
        console.error("Erreur lors du chargement des interactions:", err);
      }
    }

    async function fetchCategories() {
      try {
        const res = await fetch('https://dev.takymed.comhttps://dev.takymed.com/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories);
        }
      } catch (err) {
        console.error("Erreur chargement catégories:", err);
      }
    }

    async function fetchCountries() {
      try {
        const res = await fetch('https://dev.takymed.comhttps://dev.takymed.com/api/countries');
        if (res.ok) {
          const data = await res.json();
          setCountries(data.countries);
        }
      } catch (err) {
        console.error("Erreur chargement pays:", err);
      }
    }

    fetchMeds();
    fetchInteractions();
    fetchCategories();
    fetchCountries();
  }, []);

  useEffect(() => {
    if (step === 3) {
      const computed: DoseSchedule[] = [];
      medications.forEach(m => {
        if (!m.name || m.frequencyType === 'prn') return;
        const effectiveMedication = getEffectiveMedicationForSave(m);
        for (let day = 1; day <= m.durationDays; day++) {
          if (effectiveMedication.frequencyType === 'interval' && effectiveMedication.intervalHours) {
            let hour = 0;
            while (hour < 24) {
              computed.push({
                medicationId: effectiveMedication.id, medicationName: effectiveMedication.name,
                clientName: clientInfo.name, patientId: 0,
                dose: effectiveMedication.doseValue, unit: effectiveMedication.unit,
                time: `${hour.toString().padStart(2, '0')}:00`,
                day, statusReminderSent: false, statusTaken: false
              });
              hour += effectiveMedication.intervalHours;
            }
          } else {
            effectiveMedication.times.forEach(timeStr => {
              computed.push({
                medicationId: effectiveMedication.id, medicationName: effectiveMedication.name,
                clientName: clientInfo.name, patientId: 0,
                dose: effectiveMedication.doseValue, unit: effectiveMedication.unit,
                time: timeStr, day,
                statusReminderSent: false, statusTaken: false
              });
            });
          }
        }
      });
      setScheduleState(computed);
    }
  }, [step, medications, clientInfo.name, applyCustomReminderHours]);

  const getDateForDay = (day: number): string => {
    if (customDates[day]) return customDates[day];
    const baseDate = new Date(patient.startDate);
    baseDate.setDate(baseDate.getDate() + day - 1);
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(baseDate.getDate()).padStart(2, '0');
    return `${baseDate.getFullYear()}-${month}-${dayOfMonth}`;
  };

  const formatDateShort = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const handleDateChange = (day: number, newDate: string) => {
    const updatedDates: Record<number, string> = { ...customDates, [day]: newDate };
    const maxDay = Math.max(...medications.map(m => m.durationDays));
    const baseDate = new Date(newDate);
    for (let d = day + 1; d <= maxDay; d++) {
      const nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + (d - day));
      updatedDates[d] = nextDate.toISOString().split('T')[0];
    }
    setCustomDates(updatedDates);
  };

  const addMedication = () => {
    setMedications([...medications, {
      id: Math.random().toString(36).substr(2, 9),
      name: "", frequencyType: "1x", times: ["08:00"],
      durationDays: 1, doseValue: 1, unit: "comprimé"
    }]);
  };

  const removeMedication = (id: string) => {
    setMedications(medications.filter(m => m.id !== id));
  };

  const updateMedication = (id: string, updates: Partial<MedicationEntry>) => {
    setMedications(medications.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const detectedInteractions = useMemo(() => {
    const clashes: any[] = [];
    const names = medications.map(m => m.name.toLowerCase()).filter(Boolean);
    interactions.forEach(inter => {
      const m1 = inter.med1Name.toLowerCase();
      const m2 = inter.med2Name.toLowerCase();
      if (names.includes(m1) && names.includes(m2)) clashes.push(inter);
    });
    return clashes;
  }, [medications, interactions]);

  const handleNextStep = async () => {
    if (step === 1) {
      if (!clientInfo.name.trim()) { toast.error("Le nom du client est requis."); return; }
      if (!clientInfo.phone.trim()) { toast.error("Le numéro de téléphone est requis."); return; }
      if (!user?.id) { toast.error("Vous devez être connecté"); return; }

      try {
        const dialCode = countries.find(c => c.code === selectedCountry)?.dialCode || "+237";
        const fullPhone = `${dialCode}${clientInfo.phone.replace(/\s+/g, '')}`;
        const res = await fetch(
          `https://dev.takymed.com/api/commercial/check-client?commercialId=${user.id}&name=${encodeURIComponent(clientInfo.name.trim())}&phone=${encodeURIComponent(fullPhone)}`,
          { headers: { "x-user-id": user.id.toString() } }
        );
        if (res.ok) {
          const availability = await res.json();
          if (!availability.available) {
            toast.error(availability.errors?.[0] || "Ce client ne peut pas être inscrit.");
            return;
          }
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || "Impossible de vérifier la disponibilité du client.");
          return;
        }
      } catch (error) {
        console.error("Vérification client:", error);
        toast.error("Impossible de vérifier la disponibilité du client.");
        return;
      }

      setPatient(prev => ({ ...prev, title: clientInfo.name.trim() }));
      setStep(2);
    } else if (step === 2) {
      if (medications.some(m => !m.name)) { toast.error("Veuillez remplir le nom de tous les médicaments."); return; }
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    if (!user) { toast.error("Vous devez être connecté"); return; }
    setIsSubmitting(true);
    try {
      const dialCode = countries.find(c => c.code === selectedCountry)?.dialCode || "+237";
      const fullPhone = `${dialCode}${clientInfo.phone.replace(/\s+/g, '')}`;

      const res = await fetch("https://dev.takymed.comhttps://dev.takymed.com/api/commercial/register-client", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": user.id.toString()
        },
        body: JSON.stringify({
          commercialId: user.id,
          clientPhone: fullPhone,
          clientName: clientInfo.name,
          startDate: patient.startDate,
          prescription: {
            title: patient.title || "Ordonnance initiale",
            weight: patient.weight,
            categorieAge: patient.categorieAge,
            medications: medications.map(m => ({
              ...getEffectiveMedicationForSave(m),
              name: m.name,
            }))
          }
        })
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 409) {
          throw new Error(err.error || "Ce client existe déjà dans le système.");
        }
        throw new Error(err.error || "Erreur lors de l'inscription");
      }

      const data = await res.json().catch(() => ({}));
      setRegisteredClientId(data.clientId || null);
      toast.success("Client inscrit ! Demandez-lui son PIN pour finaliser.");
      setStep(4);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidatePin = async () => {
    if (!pinCode.trim()) { toast.error("Veuillez entrer le code PIN."); return; }
    setIsSubmitting(true);
    try {
      const dialCode = countries.find(c => c.code === selectedCountry)?.dialCode || "+237";
      const fullPhone = `${dialCode}${clientInfo.phone.replace(/\s+/g, '')}`;

      const res = await fetch("https://dev.takymed.comhttps://dev.takymed.com/api/commercial/validate-client", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": user?.id?.toString() || ""
        },
        body: JSON.stringify({
          commercialId: user?.id,
          clientPhone: fullPhone,
          clientId: registeredClientId,
          pin: pinCode
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "PIN invalide");
      }

      toast.success("Client validé avec succès ! Le compte est maintenant actif.");
      setTimeout(() => navigate("/commercial"), 1500);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || user.type !== 'commercial') {
    return <div className="p-10 text-center">Accès non autorisé</div>;
  }

  const registrationSteps = [
    { id: 1, label: "Client" },
    { id: 2, label: "Médicaments" },
    { id: 3, label: "Calendrier" },
    { id: 4, label: "Validation PIN" },
  ];

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        badge="Inscription client"
        title="Nouveau client commercial"
        subtitle="Enregistrez un patient, configurez sa première ordonnance et validez son compte par PIN."
        actions={
          <Button
            variant="outline"
            className="h-11 rounded-2xl"
            onClick={() => navigate("/commercial")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour tableau de bord
          </Button>
        }
      />

      <StepIndicator steps={registrationSteps} currentStep={step} />

        {/* ========== STEP 1: Client Info ========== */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 rounded-3xl shadow-sm border space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <UserPlus className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Informations du Client</h2>
              </div>
              <p className="text-muted-foreground text-sm">
                Renseignez les informations du nouveau client. Un PIN de validation lui sera envoyé par SMS.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Nom complet <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      value={clientInfo.name}
                      onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                      placeholder="Nom du client"
                      className="rounded-2xl h-14 pl-12 text-lg"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Numéro de téléphone <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2">
                    <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                      <SelectTrigger className="w-28 h-14 rounded-2xl border bg-white px-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none">
                        <SelectValue placeholder="Pays" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl max-h-[300px] overflow-y-auto">
                        {countries.map((c, idx) => (
                          <SelectItem key={`country-${idx}`} value={c.code} className="rounded-xl">
                            <span className="flex items-center gap-2">
                              <span className="text-lg">{c.flag}</span>
                              <span className="font-bold">{c.dialCode}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        value={clientInfo.phone}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || /^[0-9]+$/.test(val)) {
                            setClientInfo({ ...clientInfo, phone: val });
                          }
                        }}
                        placeholder="6XX XXX XXX"
                        className="rounded-2xl h-14 pl-12 text-lg font-mono tracking-wider"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Après l'inscription, le client recevra un PIN par SMS. Ce PIN devra être communiqué
                  à l'agent commercial pour valider le compte.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button size="lg" className="rounded-2xl h-14 px-12 text-lg font-bold shadow-xl shadow-primary/20" onClick={handleNextStep}>
                Suivant : Ordonnance
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* ========== STEP 2: Medications (same as Prescription.tsx) ========== */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Patient / Prescription Header */}
            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-3xl shadow-sm border space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <Stethoscope className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Ordonnance pour {clientInfo.name}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label>Titre de l'ordonnance</Label>
                  <Input
                    value={patient.title}
                    onChange={(e) => setPatient({ ...patient, title: e.target.value })}
                    placeholder="Ex: Traitement Paludisme"
                    className="rounded-2xl h-14 text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <select
                    title="Sélectionner la catégorie d'âge"
                    className="w-full h-14 rounded-2xl border bg-slate-50 px-4 text-base font-medium focus-visible:ring-2 ring-primary/20 outline-none"
                    value={patient.categorieAge}
                    onChange={(e) => setPatient({ ...patient, categorieAge: e.target.value })}
                  >
                    {categories
                      .sort((a, b) => {
                        const order = ["adulte", "enfant", "bébé"];
                        const indexA = order.indexOf(a.name.toLowerCase());
                        const indexB = order.indexOf(b.name.toLowerCase());
                        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
                      })
                      .map(cat => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)} {cat.description ? `(${cat.description})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Input
                    type="date"
                    value={patient.startDate}
                    onChange={(e) => setPatient({ ...patient, startDate: e.target.value })}
                    className="rounded-2xl h-14 text-lg"
                  />
                </div>
              </div>
            </div>

            {/* Interactions Warning */}
            {detectedInteractions.length > 0 && (
              <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                {detectedInteractions.map((inter, idx) => (
                  <div key={idx} className={cn(
                    "p-4 rounded-3xl border flex items-start gap-4 shadow-sm",
                    inter.riskLevel === 'critique' ? "bg-red-50 border-red-200 text-red-900" :
                    inter.riskLevel === 'eleve' ? "bg-orange-50 border-orange-200 text-orange-900" :
                    "bg-amber-50 border-amber-200 text-amber-900"
                  )}>
                    <AlertTriangle className="w-6 h-6 shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-bold flex items-center gap-2">
                         Risque d'Incompatibilité : {inter.med1Name} & {inter.med2Name}
                         <span className={cn(
                           "px-2 py-0.5 rounded-full text-[10px] uppercase font-black",
                           inter.riskLevel === 'critique' ? "bg-red-600 text-white" : "bg-orange-500 text-white"
                         )}>{inter.riskLevel}</span>
                      </h4>
                      <p className="text-sm opacity-80 mt-1">{inter.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Medications List */}
            <div className="space-y-3 sm:space-y-4">
              {medications.map((m) => (
                <div key={m.id} className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-full max-w-[320px] space-y-1">
                        <div className="relative group">
                          <Pill className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500 group-hover:text-primary transition-colors" />
                          <Input
                            list={`medication-options-${m.id}`}
                            title="Saisir un médicament"
                            value={m.name}
                            onChange={(e) => updateMedication(m.id, { name: e.target.value })}
                            placeholder="Saisir un médicament"
                            className="rounded-2xl h-14 pl-12 focus-visible:ring-primary text-lg"
                          />
                          <datalist id={`medication-options-${m.id}`}>
                            {dbMedications.map((dbM) => (
                              <option key={dbM.id} value={dbM.name} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeMedication(m.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                    {/* Frequency */}
                    <div className="space-y-3 md:col-span-2 lg:col-span-1">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fréquence des prises</Label>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {['1x', '2x', '3x', '4x', 'prb'].map((freq) => {
                          const fMap: Record<string, FrequencyType> = {
                            '1x': '1x', '2x': '2x', '3x': '3x', '4x': '4x', 'prb': 'prn'
                          };
                          const currentFreq = fMap[freq];
                          return (
                            <button
                              key={freq}
                              onClick={() => {
                                const newTimes = currentFreq === '1x' ? ['08:00']
                                  : currentFreq === '2x' ? ['08:00', '20:00']
                                    : currentFreq === '3x' ? ['08:00', '14:00', '20:00']
                                      : currentFreq === '4x' ? ['00:00', '06:00', '12:00', '18:00'] : [];
                                updateMedication(m.id, {
                                  frequencyType: currentFreq,
                                  times: newTimes,
                                  intervalHours: undefined
                                });
                              }}
                              className={cn(
                                "flex-1 sm:flex-initial min-w-[44px] sm:min-w-[50px] h-10 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl border text-[9px] sm:text-[10px] md:text-sm font-bold transition-all",
                                m.frequencyType === currentFreq ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-slate-50 hover:bg-slate-100"
                              )}
                            >
                              {freq === 'prb' ? '-/-' : freq}
                            </button>
                          );
                        })}
                      </div>

                      {m.frequencyType === '1x' && <p className="text-[11px] sm:text-xs text-primary mt-1 sm:mt-2">Une fois par jour <span className="opacity-70">(matin)</span></p>}
                      {m.frequencyType === '2x' && <p className="text-[11px] sm:text-xs text-primary mt-1 sm:mt-2">Deux fois par jour <span className="opacity-70">(matin et soir)</span></p>}
                      {m.frequencyType === '3x' && <p className="text-[11px] sm:text-xs text-primary mt-1 sm:mt-2">Trois fois par jour <span className="opacity-70">(matin, midi et soir)</span></p>}
                      {m.frequencyType === '4x' && <p className="text-[11px] sm:text-xs text-primary mt-1 sm:mt-2">Quatre fois par jour <span className="opacity-70">(toutes les 6h)</span></p>}
                      {m.frequencyType === 'interval' && <p className="text-[11px] sm:text-xs text-primary mt-1 sm:mt-2">Prises à intervalles réguliers</p>}
                      {m.frequencyType === 'prn' && <p className="text-[11px] sm:text-xs text-primary mt-1 sm:mt-2">En cas de besoin</p>}

                      {(m.frequencyType === '1x' || m.frequencyType === '2x' || m.frequencyType === '3x' || m.frequencyType === '4x') && (
                        <div className="grid grid-cols-1 gap-1.5 sm:gap-2 mt-2 sm:mt-4">
                          {m.times.map((t, tIdx) => (
                            <div key={tIdx} className="flex items-center gap-1.5 sm:gap-2">
                              <Clock className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-muted-foreground shrink-0" />
                              <Input
                                type="time"
                                value={t}
                                onChange={(e) => {
                                  const newTimes = [...m.times];
                                  newTimes[tIdx] = e.target.value;
                                  updateMedication(m.id, { times: newTimes });
                                }}
                                className="h-7 sm:h-8 text-[11px] sm:text-xs rounded-lg"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {m.frequencyType === 'interval' && (
                        <div className="space-y-2 mt-4">
                          <select
                            title="Choisir l'intervalle"
                            className="w-full h-14 rounded-2xl border bg-slate-50 px-4 text-sm outline-none font-medium"
                            value={m.intervalHours}
                            onChange={(e) => updateMedication(m.id, { intervalHours: parseInt(e.target.value) })}
                          >
                            <option value={6}>Toutes les 6 heures (4 prises/jour)</option>
                          </select>
                        </div>
                      )}

                      <div className="mt-2 sm:mt-3 flex items-start gap-1.5 sm:gap-2">
                        <Checkbox
                          checked={applyCustomReminderHours}
                          onCheckedChange={(checked) => setApplyCustomReminderHours(checked === true)}
                          className="mt-0.5 shrink-0"
                        />
                        <p className="text-[11px] sm:text-xs text-primary leading-snug">
                          Je m'engage formellement a proceder a la modification des horaires de prise
                        </p>
                      </div>
                    </div>

                    {/* Dose */}
                    <div className="space-y-3 sm:space-y-4">
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label className="text-[10px] sm:text-xs uppercase">Dose</Label>
                          <Input
                            type="number"
                            value={m.doseValue}
                            onChange={(e) => updateMedication(m.id, { doseValue: parseInt(e.target.value) || 0 })}
                            className="rounded-xl sm:rounded-2xl h-10 sm:h-12 md:h-14 w-20 sm:w-28 text-center text-sm sm:text-lg"
                          />
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label className="text-[10px] sm:text-xs uppercase">Unité</Label>
                          <select
                            className="w-full h-10 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl border bg-slate-50 px-2 sm:px-4 text-xs sm:text-base font-medium outline-none"
                            value={m.unit}
                            onChange={(e) => updateMedication(m.id, { unit: e.target.value })}
                            aria-label="Unité de dosage"
                          >
                            <option value="comprimé">comprimé</option>
                            <option value="mg">mg</option>
                            <option value="ml">ml</option>
                            <option value="goutte">goutte</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-3 sm:space-y-4">
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label className="text-[10px] sm:text-xs uppercase">Durée (jours)</Label>
                        <Input
                          type="number"
                          value={m.durationDays}
                          onChange={(e) => updateMedication(m.id, { durationDays: parseInt(e.target.value) || 0 })}
                          className="rounded-xl sm:rounded-2xl h-10 sm:h-12 md:h-14 text-center text-sm sm:text-lg w-20 sm:w-28"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Button onClick={addMedication} variant="outline" className="rounded-xl border-emerald-500 text-emerald-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors text-xs sm:text-sm">
                <Plus className="w-3 sm:w-4 h-3 sm:h-4 mr-1 sm:mr-2" />
                Ajouter un médicament
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 pt-4 sm:pt-8">
              <Button variant="ghost" onClick={() => setStep(1)} className="rounded-xl sm:rounded-2xl h-10 sm:h-12 md:h-14 px-4 sm:px-8 text-sm sm:text-base">
                <ArrowLeft className="mr-1 sm:mr-2 w-4 sm:w-5 h-4 sm:h-5" />
                Retour
              </Button>
              <Button size="lg" className="rounded-xl sm:rounded-2xl h-10 sm:h-12 md:h-14 px-6 sm:px-12 text-sm sm:text-lg font-bold shadow-xl shadow-primary/20" onClick={handleNextStep}>
                Suivant : Calendrier
                <ArrowRight className="ml-1 sm:ml-2 w-4 sm:w-5 h-4 sm:h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* ========== STEP 3: Calendar Preview & Submit ========== */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Summary */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border flex flex-col md:flex-row gap-6 items-start">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{clientInfo.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {clientInfo.phone}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 flex-wrap">
                <div className="bg-slate-50 px-4 py-2 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Médicaments</p>
                  <p className="text-xl font-black text-primary">{medications.length}</p>
                </div>
                <div className="bg-slate-50 px-4 py-2 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Prises totales</p>
                  <p className="text-xl font-black text-primary">{scheduleState.length}</p>
                </div>
              </div>
            </div>

            {/* Schedule Table */}
            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-3xl shadow-sm border space-y-4 sm:space-y-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
                <Table className="w-6 h-6 text-primary" />
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Calendrier des prises</h2>
              </div>

              <div className="md:hidden space-y-2">
                {scheduleState.map((s, idx) => {
                  const dateStr = getDateForDay(s.day);
                  return (
                    <div key={idx} className="rounded-2xl border bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                          <input
                            type="date"
                            value={dateStr}
                            onChange={(e) => handleDateChange(s.day, e.target.value)}
                            className="text-xs font-semibold bg-transparent border-b border-transparent hover:border-primary focus:border-primary focus:outline-none cursor-pointer"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">({formatDateShort(dateStr)})</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{s.time}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-primary truncate">{s.medicationName}</span>
                        <span className="text-xs bg-slate-100 px-2 py-1 rounded-lg font-medium shrink-0">
                          {s.dose} {s.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto rounded-2xl border">
                <table className="responsive-data-table w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 text-left border-b">
                      <th className="p-4 text-xs font-bold uppercase tracking-wider">Jour</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider">Médicament</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider">Dose</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider">Heure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleState.map((s, idx) => {
                      const dateStr = getDateForDay(s.day);
                      return (
                        <tr key={idx} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <input
                                type="date"
                                value={dateStr}
                                onChange={(e) => handleDateChange(s.day, e.target.value)}
                                className="font-semibold bg-transparent border-b border-transparent hover:border-primary focus:border-primary focus:outline-none cursor-pointer"
                              />
                              <span className="text-xs text-muted-foreground">({formatDateShort(dateStr)})</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-primary">{s.medicationName}</span>
                          </td>
                          <td className="p-4">
                            <span className="bg-slate-100 px-2 py-1 rounded-lg text-sm font-medium">
                              {s.dose} {s.unit}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span className="font-mono">{s.time}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={() => setStep(2)} className="rounded-2xl h-14 px-8">
                <ArrowLeft className="mr-2 w-5 h-5" />
                Retour
              </Button>
              <Button
                size="lg"
                disabled={isSubmitting}
                className="rounded-2xl h-14 px-12 text-lg font-bold shadow-xl shadow-primary/20 bg-green-600 hover:bg-green-700 disabled:opacity-50 min-w-[250px]"
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Traitement...
                  </div>
                ) : (
                  <>
                    Inscrire le client
                    <CheckCircle2 className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ========== STEP 4: PIN Validation ========== */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white p-8 rounded-3xl shadow-sm border space-y-6 max-w-lg mx-auto text-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">Validation du client</h2>
              <p className="text-muted-foreground">
                Le client <span className="font-bold text-foreground">{clientInfo.name}</span> a reçu un <span className="font-bold text-foreground">PIN par SMS</span> au <span className="font-mono font-bold text-foreground">{clientInfo.phone}</span>.
                <br />Demandez-lui ce code pour finaliser l'inscription.
              </p>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex gap-3 text-left">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  <strong>Important :</strong> Si le client n'est pas validé, son compte sera automatiquement supprimé.
                </p>
              </div>

              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Code PIN à 6 chiffres"
                  value={pinCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^[0-9]+$/.test(val)) setPinCode(val);
                  }}
                  maxLength={6}
                  className="rounded-2xl h-16 text-center text-3xl font-bold tracking-[0.5em] bg-slate-50 border-2 focus-visible:border-green-500 focus-visible:ring-green-500"
                />

                <div className="flex flex-col gap-3">
                  <Button
                    size="lg"
                    disabled={isSubmitting || pinCode.length !== 6}
                    className="w-full rounded-2xl h-14 text-lg font-bold shadow-xl bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    onClick={handleValidatePin}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Vérification...
                      </div>
                    ) : (
                      <>
                        <ShieldCheck className="mr-2 w-5 h-5" />
                        Valider et finaliser
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                    onClick={async () => {
                      if (window.confirm("Voulez-vous vraiment annuler ? Le client sera supprimé.")) {
                        try {
                           if (registeredClientId) {
                             await fetch(`https://dev.takymed.com/api/commercial/clients/${registeredClientId}`, { 
                               method: 'DELETE',
                               headers: { "x-user-id": user?.id?.toString() || "" }
                             });
                           }
                           toast.info("Inscription annulée.");
                           navigate("/commercial");
                        } catch (e) {
                           console.error("Error canceling:", e);
                           navigate("/commercial");
                        }
                      }
                    }}
                  >
                    Annuler et supprimer le client
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
    </PageShell>
  );
}
