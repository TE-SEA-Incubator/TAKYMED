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
  MessageSquare,
  Smartphone,
  PhoneCall,
  Send,
  Check
} from "lucide-react";
import { ensurePushIfSelected } from "@/lib/pushNotifications";
import { cn } from "@/lib/utils";
import { MedicationEntry, DoseSchedule, FrequencyType } from "@shared/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PageShell } from "@/components/app/PageShell";
import { PageHeader } from "@/components/app/PageHeader";
import { StepIndicator } from "@/components/app/StepIndicator";
import { TargetContextBanner } from "@/components/app/TargetContextBanner";

export default function Prescription() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialClientId = searchParams.get("clientId");
  const initialClientName = searchParams.get("clientName") || "";
  const initialClientPhone = searchParams.get("clientPhone") || "";
  const initialMedName = searchParams.get("med") || "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [patient, setPatient] = useState({
    title: initialClientName || "",
    name: initialClientName || user?.name || "",
    categorieAge: "adulte",
    weight: 0,
    startDate: (function() {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${now.getFullYear()}-${month}-${day}`;
    })()
  });

  const [categories, setCategories] = useState<{ id: number, name: string, description: string, considerWeight: boolean }[]>([]);
  const [countries, setCountries] = useState<{ code: string, name: string, dialCode: string, flag: string }[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("CM");

  const [medications, setMedications] = useState<MedicationEntry[]>([
    {
      id: "1",
      name: initialMedName,
      frequencyType: "1x",
      times: ["08:00"],
      durationDays: 1,
      doseValue: 1,
      unit: "comprimé"
    }
  ]);

  const [notifConfig, setNotifConfig] = useState({
    recipients: [initialClientPhone || user?.phone || ""],
    channels: ["whatsapp", "push"] as Array<"sms" | "whatsapp" | "call" | "push">
  });

  const needsPhoneRecipient = notifConfig.channels.some((c) => c !== "push");

  // Custom dates for each day (allows modification with propagation)
  const [customDates, setCustomDates] = useState<Record<number, string>>({});
  const [applyCustomReminderHours, setApplyCustomReminderHours] = useState(false);

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

  // Calculate exact date for a given day
  const getDateForDay = (day: number): string => {
    if (customDates[day]) return customDates[day];
    const baseDate = new Date(patient.startDate);
    baseDate.setDate(baseDate.getDate() + day - 1);
    const resDate = new Date(baseDate);
    const month = String(resDate.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(resDate.getDate()).padStart(2, '0');
    return `${resDate.getFullYear()}-${month}-${dayOfMonth}`;
  };

  // Format date as dd/mm/yy
  const formatDateShort = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // Handle date modification with propagation
  const handleDateChange = (day: number, newDate: string) => {
    const updatedDates: Record<number, string> = { ...customDates, [day]: newDate };

    // Propagate to following days
    const maxDay = Math.max(...medications.map(m => m.durationDays));
    const baseDate = new Date(newDate);

    for (let d = day + 1; d <= maxDay; d++) {
      const nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + (d - day));
      updatedDates[d] = nextDate.toISOString().split('T')[0];
    }

    setCustomDates(updatedDates);
  };

  const [dbMedications, setDbMedications] = useState<{ id: number, name: string }[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);

  useEffect(() => {
    async function fetchMeds() {
      try {
        const res = await fetch('http://dev.takymed.com/api/medications');
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
        const res = await fetch('http://dev.takymed.com/api/medications/interactions');
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
        const res = await fetch('http://dev.takymed.com/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories);
          // Set default category to the first one available
          if (data.categories.length > 0 && !patient.categorieAge) {
            setPatient(p => ({ ...p, categorieAge: data.categories[0].name }));
          }
        }
      } catch (err) {
        console.error("Erreur lors du chargement des catégories:", err);
      }
    }

    async function fetchCountries() {
      try {
        const res = await fetch('http://dev.takymed.com/api/countries');
        if (res.ok) {
          const data = await res.json();
          setCountries(data.countries);
        }
      } catch (err) {
        console.error("Erreur lors du chargement des pays:", err);
      }
    }

    fetchMeds();
    fetchInteractions();
    fetchCategories();
    fetchCountries();
  }, []);

  const addMedication = () => {
    setMedications([
      ...medications,
      {
        id: Math.random().toString(36).substr(2, 9),
        name: "",
        frequencyType: "1x",
        times: ["08:00"],
        durationDays: 1,
        doseValue: 1,
        unit: "comprimé"
      }
    ]);
  };

  const removeMedication = (id: string) => {
    setMedications(medications.filter(m => m.id !== id));
  };

  const updateMedication = (id: string, updates: Partial<MedicationEntry>) => {
    setMedications(medications.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  // Lifted schedule state for interactivity in step 2 preview
  const [scheduleState, setScheduleState] = useState<DoseSchedule[]>([]);

  useEffect(() => {
    if (step === 2) {
      const computedSchedule: DoseSchedule[] = [];
      medications.forEach(m => {
        if (!m.name || m.frequencyType === 'prn') return;

        const effectiveMedication = getEffectiveMedicationForSave(m);

        for (let day = 1; day <= m.durationDays; day++) {
          if (effectiveMedication.frequencyType === 'interval' && effectiveMedication.intervalHours) {
            let hour = 0;
            while (hour < 24) {
              computedSchedule.push({
                medicationId: effectiveMedication.id,
                medicationName: effectiveMedication.name,
                clientName: patient.title,
                patientId: 0,
                dose: effectiveMedication.doseValue,
                unit: effectiveMedication.unit,
                time: `${hour.toString().padStart(2, '0')}:00`,
                day,
                statusReminderSent: false,
                statusTaken: false
              });
              hour += effectiveMedication.intervalHours;
            }
          } else {
            effectiveMedication.times.forEach(timeStr => {
              computedSchedule.push({
                medicationId: effectiveMedication.id,
                medicationName: effectiveMedication.name,
                clientName: patient.title,
                patientId: 0,
                dose: effectiveMedication.doseValue,
                unit: effectiveMedication.unit,
                time: timeStr,
                day,
                statusReminderSent: false,
                statusTaken: false
              });
            });
          }
        }
      });
      setScheduleState(computedSchedule);
    }
  }, [step, medications, patient.title, applyCustomReminderHours]);

  const handleToggleDose = (idx: number) => {
    setScheduleState(prev => prev.map((s, i) => i === idx ? { ...s, statusTaken: !s.statusTaken } : s));
  };

  const handleNext = () => {
    if (step === 1) {
      if (medications.some(m => !m.name)) {
        toast.error("Veuillez remplir le nom de tous les médicaments.");
        return;
      }
      setStep(2);
    }
  };

  const detectedInteractions = useMemo(() => {
    const clashes: any[] = [];
    const names = medications.map(m => m.name.toLowerCase()).filter(Boolean);
    
    interactions.forEach(inter => {
      const m1 = inter.med1Name.toLowerCase();
      const m2 = inter.med2Name.toLowerCase();
      
      if (names.includes(m1) && names.includes(m2)) {
        clashes.push(inter);
      }
    });

    return clashes;
  }, [medications, interactions]);

  const isForClient = Boolean(initialClientId);
  const prescriptionSteps = [
    { id: 1, label: "Médicaments" },
    { id: 2, label: "Rappels & canaux" },
  ];

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        badge={user?.type === "commercial" ? "Espace commercial" : "Ordonnance"}
        title={isForClient ? "Ordonnance client" : "Nouveau rappel"}
        subtitle={
          isForClient
            ? "Configurez le traitement et les canaux de notification pour votre client."
            : "Créez un rappel de prise avec horaires et notifications personnalisées."
        }
      />

      <TargetContextBanner
        mode={isForClient ? "client" : "self"}
        clientName={initialClientName || patient.name}
        clientPhone={initialClientPhone}
        actorName={user?.name}
      />

      <StepIndicator steps={prescriptionSteps} currentStep={step} />

        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Patient Header */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Stethoscope className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">{t('prescription.addPrescTitle')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <Label>{t('prescription.prescName')}</Label>
                  <Input
                    value={patient.title}
                    onChange={(e) => setPatient({ ...patient, title: e.target.value })}
                    className="rounded-2xl h-14 text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.categories')}</Label>
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
                  <Label>{t('prescription.prescDate')}</Label>
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
            <div className="space-y-4">


              {medications.map((m, idx) => (
                <div key={m.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">

                      <div className="w-full max-w-[320px] space-y-1">
                        <div className="relative group">
                          <Pill className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500 group-hover:text-primary transition-colors" />
                          <Input
                            list={`medication-options-${m.id}`}
                            title={t('prescription.searchMeds')}
                            value={m.name}
                            onChange={(e) => updateMedication(m.id, { name: e.target.value })}
                            placeholder={t('prescription.searchMeds')}
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

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fréquence des prises</Label>
                      <div className="flex flex-wrap gap-2">
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
                                "flex-1 min-w-[50px] h-14 rounded-2xl border text-[10px] md:text-sm font-bold transition-all",
                                m.frequencyType === currentFreq ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-slate-50 hover:bg-slate-100"
                              )}
                            >
                              {freq === 'prb' ? '-/-' : freq}
                            </button>
                          );
                        })}
                      </div>

                      {m.frequencyType === '1x' && <p className="text-xs text-primary mt-2">{t('prescription.onceADay')} <span className="opacity-70">{t('prescription.morning')}</span></p>}
                      {m.frequencyType === '2x' && <p className="text-xs text-primary mt-2">{t('prescription.twiceADay')} <span className="opacity-70">{t('prescription.morningEvening')}</span></p>}
                      {m.frequencyType === '3x' && <p className="text-xs text-primary mt-2">{t('prescription.threeTimesADay')} <span className="opacity-70">{t('prescription.morningNoonEvening')}</span></p>}
                      {m.frequencyType === '4x' && <p className="text-xs text-primary mt-2">Quatre fois par jour <span className="opacity-70">(toutes les 6h)</span></p>}
                      {m.frequencyType === 'interval' && <p className="text-xs text-primary mt-2">{t('prescription.regularIntervals')}</p>}
                      {m.frequencyType === 'prn' && <p className="text-xs text-primary mt-2">{t('prescription.asNeeded')}</p>}

                      {/* Custom Time Selection for 1x, 2x, 3x */}
                      {(m.frequencyType === '1x' || m.frequencyType === '2x' || m.frequencyType === '3x' || m.frequencyType === '4x') && (
                        <div className="grid grid-cols-1 gap-2 mt-4">
                          {m.times.map((t, tIdx) => (
                            <div key={tIdx} className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <Input
                                type="time"
                                value={t}
                                onChange={(e) => {
                                  const newTimes = [...m.times];
                                  newTimes[tIdx] = e.target.value;
                                  updateMedication(m.id, { times: newTimes });
                                }}
                                className="h-8 text-xs rounded-lg"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {m.frequencyType === 'interval' && (
                        <div className="space-y-2 mt-4">
                          <Label className="text-[10px] text-muted-foreground uppercase"></Label>
                          <select
                            title="Choisir l'intervalle de temps"
                            className="w-full h-14 rounded-2xl border bg-slate-50 px-4 text-sm outline-none font-medium"
                            value={m.intervalHours}
                            onChange={(e) => updateMedication(m.id, { intervalHours: parseInt(e.target.value) })}
                          >
                            <option value={6}>Toutes les 6 heures (4 prises/jour)</option>
                          </select>
                        </div>
                      )}

                      <div className="mt-2 flex items-start gap-2">
                        <Checkbox
                          checked={applyCustomReminderHours}
                          onCheckedChange={(checked) => setApplyCustomReminderHours(checked === true)}
                          className="mt-0.5"
                        />
                        <p className="text-xs text-primary">
                          Je m'engage formellement a proceder a la modification des horaires de prise
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase">{t('prescription.doseTab')}</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={m.doseValue}
                              onChange={(e) => updateMedication(m.id, { doseValue: parseInt(e.target.value) || 0 })}
                              className="rounded-2xl h-14 w-28 text-center text-lg"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs uppercase">{t('prescription.unitTab')}</Label>
                          <select
                            className="w-full h-14 rounded-2xl border bg-slate-50 px-4 text-base font-medium focus-visible:ring-1 focus-visible:ring-primary outline-none"
                            value={m.unit}
                            onChange={(e) => updateMedication(m.id, { unit: e.target.value })}
                            aria-label="Unité de dosage"
                          >                        <option value="comprimé">comprimé</option>
                            <option value="mg">mg</option>
                            <option value="ml">ml</option>
                            <option value="goutte">goutte</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase">{t('prescription.durationDays')}</Label>
                          <Input
                            type="number"
                            value={m.durationDays}
                            onChange={(e) => updateMedication(m.id, { durationDays: parseInt(e.target.value) || 0 })}
                            className="rounded-2xl h-14 text-center text-lg w-28"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button
                onClick={addMedication}
                variant="outline"
                className="rounded-xl border-emerald-500 text-emerald-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('prescription.addMedBtn')}
              </Button>
            </div>
            <div className="flex justify-end pt-8">
              <Button size="lg" className="rounded-2xl h-14 px-12 text-lg font-bold shadow-xl shadow-primary/20" onClick={handleNext}>
                {t('prescription.nextBtn')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Calendrier des prises */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Table className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold">{t('prescription.scheduleTitle')}</h2>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-200" /> {t('prescription.planned')}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" /> {t('prescription.reminderSent')}
                  </div>
                </div>
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
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t('prescription.takenTable')}</span>
                        <Checkbox
                          checked={s.statusTaken}
                          onCheckedChange={() => handleToggleDose(idx)}
                          className="rounded-full h-5 w-5 border-2"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto rounded-2xl border">
                <table className="responsive-data-table w-full border-collapse min-w-[820px]">
                  <thead>
                    <tr className="bg-slate-50 text-left border-b">
                      <th className="p-4 text-xs font-bold uppercase tracking-wider">{t('prescription.dayTable')}</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider">{t('prescription.medTable')}</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider">{t('prescription.doseTable')}</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider">{t('prescription.timeTable')}</th>
                      <th className="hidden lg:table-cell p-4 text-xs font-bold uppercase tracking-wider text-center">{t('prescription.reminderTable')}</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-center">{t('prescription.takenTable')}</th>
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
                          <td className="hidden lg:table-cell p-4 text-center">
                            <Checkbox checked={s.statusReminderSent} className="rounded-full h-5 w-5 border-2" />
                          </td>
                          <td className="p-4 text-center">
                            <Checkbox
                              checked={s.statusTaken}
                              onCheckedChange={() => handleToggleDose(idx)}
                              className="rounded-full h-5 w-5 border-2"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Méthodes de Rappel - Moved and Redesigned */}
              <div className="pt-4 sm:pt-6 border-t space-y-4 sm:space-y-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="bg-primary/10 w-8 sm:w-10 h-8 sm:h-10 rounded-xl flex items-center justify-center text-primary shrink-0">
                    <Bell className="w-4 sm:w-5 h-4 sm:h-5" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold">{t('prescription.reminderMethods')}</h3>
                </div>

                <div className="flex flex-col gap-4 sm:gap-6 bg-slate-50/50 p-3 sm:p-4 md:p-6 rounded-3xl border border-slate-100">
                  {/* Recipients Section */}
                  <div className="w-full space-y-2 sm:space-y-3">
                    <p className="text-xs sm:text-sm text-muted-foreground font-semibold uppercase">Destinataires</p>
                    <div className="space-y-2 sm:space-y-3">
                      {notifConfig.recipients.map((recipient, index) => (
                        <div key={index} className="flex flex-col sm:flex-row gap-2 sm:gap-2 md:gap-3">
                          {index === 0 ? (
                            <Select
                              value={selectedCountry}
                              onValueChange={(code) => {
                                setSelectedCountry(code);
                                const country = countries.find(c => c.code === code);
                                if (country) {
                                  const phoneWithoutCode = recipient.replace(/^\+\d+/, '');
                                  const updated = [...notifConfig.recipients];
                                  updated[index] = country.dialCode + phoneWithoutCode;
                                  setNotifConfig({ ...notifConfig, recipients: updated });
                                }
                              }}
                            >
                              <SelectTrigger className="w-full sm:w-24 md:w-32 h-10 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl border bg-white px-2 sm:px-3 text-xs sm:text-base font-bold focus:ring-2 focus:ring-primary outline-none">
                                <SelectValue placeholder="Pays" />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl max-h-60">
                                {countries.map(c => (
                                  <SelectItem key={c.code} value={c.code} className="rounded-xl">
                                    <span className="flex items-center gap-2">
                                      <span className="text-lg">{c.flag}</span>
                                      <span className="font-bold text-sm">{c.dialCode}</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="w-full sm:w-24 md:w-32 h-10 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl border bg-white px-2 sm:px-3 flex items-center justify-center text-[10px] sm:text-xs font-bold text-muted-foreground">#{index + 1}</div>
                          )}
                          <div className="relative flex-1">
                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 md:h-5 w-3.5 sm:w-4 md:w-5 text-muted-foreground" />
                            <Input
                              placeholder="0701020304"
                              value={recipient}
                              onChange={(e) => {
                                const updated = [...notifConfig.recipients];
                                updated[index] = e.target.value;
                                setNotifConfig({ ...notifConfig, recipients: updated });
                              }}
                              className="pl-9 sm:pl-11 h-10 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl text-sm sm:text-lg font-mono tracking-widest bg-white border-slate-200 focus-visible:ring-primary"
                            />
                          </div>
                          {notifConfig.recipients.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setNotifConfig({ ...notifConfig, recipients: notifConfig.recipients.filter((_, i) => i !== index) })}
                              className="h-10 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl px-2 sm:px-3 shrink-0"
                            >
                              <Trash2 className="w-3.5 sm:w-4 md:w-4 h-3.5 sm:h-4 md:h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setNotifConfig({ ...notifConfig, recipients: [...notifConfig.recipients, ""] })}
                        className="w-full sm:w-auto rounded-xl sm:rounded-2xl h-10 sm:h-12 md:h-14 text-xs sm:text-sm"
                      >
                        <Plus className="w-3 sm:w-4 h-3 sm:h-4 mr-1 sm:mr-2" /> {t('prescription.addRecipient')}
                      </Button>
                    </div>
                  </div>

                  {/* Channels Section */}
                  <div className="w-full space-y-2 sm:space-y-3">
                    <p className="text-xs sm:text-sm text-muted-foreground font-semibold uppercase">Canaux de notification</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      <NotificationOption
                        selected={notifConfig.channels.includes('sms')}
                        onClick={() => setNotifConfig({ ...notifConfig, channels: notifConfig.channels.includes('sms') ? notifConfig.channels.filter(c => c !== 'sms') : [...notifConfig.channels, 'sms'] })}
                        icon={<MessageSquare className="w-3 sm:w-4 h-3 sm:h-4" />}
                        label="SMS"
                        color="#10b981"
                      />
                      <NotificationOption
                        selected={notifConfig.channels.includes('whatsapp')}
                        onClick={() => setNotifConfig({ ...notifConfig, channels: notifConfig.channels.includes('whatsapp') ? notifConfig.channels.filter(c => c !== 'whatsapp') : [...notifConfig.channels, 'whatsapp'] })}
                        icon={<MessageSquare className="w-3 sm:w-4 h-3 sm:h-4" />}
                        label="WhatsApp"
                        color="#25d366"
                      />
                      <NotificationOption
                        selected={notifConfig.channels.includes('call')}
                        onClick={() => setNotifConfig({ ...notifConfig, channels: notifConfig.channels.includes('call') ? notifConfig.channels.filter(c => c !== 'call') : [...notifConfig.channels, 'call'] })}
                        icon={<PhoneCall className="w-3 sm:w-4 h-3 sm:h-4" />}
                        label={t('prescription.call')}
                        color="#3b82f6"
                      />
                      <NotificationOption
                        selected={notifConfig.channels.includes('push')}
                        onClick={() => setNotifConfig({ ...notifConfig, channels: notifConfig.channels.includes('push') ? notifConfig.channels.filter(c => c !== 'push') : [...notifConfig.channels, 'push'] })}
                        icon={<Bell className="w-3 sm:w-4 h-3 sm:h-4" />}
                        label="Push"
                        color="#8b5cf6"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-2 sm:gap-3">
                <Info className="w-4 sm:w-5 h-4 sm:h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-primary/80 leading-snug">
                  {t('prescription.infoPrecalculated')}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between sm:items-center">
              <Button variant="ghost" onClick={() => setStep(1)} className="rounded-xl sm:rounded-2xl h-10 sm:h-12 md:h-14 px-4 sm:px-8 text-sm sm:text-base order-2 sm:order-1">
                {t('prescription.backBtn')}
              </Button>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center order-3 sm:order-2">
                <span className="text-xs sm:text-sm text-muted-foreground italic">
                  {notifConfig.recipients.filter((r) => r.trim()).length > 0 ? `${t('prescription.recipient')} ${notifConfig.recipients.filter((r) => r.trim()).length} ${t('prescription.recipientCountSuffix')}` : t('prescription.enterPhone')}
                </span>
                <Button
                  size="lg"
                  disabled={
                    isSubmitting ||
                    notifConfig.channels.length === 0 ||
                    (needsPhoneRecipient && notifConfig.recipients.filter((r) => r.trim()).length === 0)
                  }
                  className="w-full sm:w-auto rounded-xl sm:rounded-2xl h-10 sm:h-12 md:h-14 px-4 sm:px-8 md:px-12 text-sm sm:text-base md:text-lg font-bold shadow-xl shadow-primary/20 bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  onClick={async () => {
                    if (!user) {
                      toast.error("Vous devez être connecté");
                      return;
                    }
                    if (!user.id || user.id <= 0) {
                      toast.error("Session invalide. Reconnectez-vous.");
                      return;
                    }

                    const targetUserId = initialClientId
                      ? Number.parseInt(initialClientId, 10)
                      : user.id;
                    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
                      toast.error("Compte patient cible invalide.");
                      return;
                    }

                    setIsSubmitting(true);
                    try {
                      // 1. Save to DB
                       const res = await fetch("http://dev.takymed.com/api/prescriptions", {
                        method: "POST",
                        headers: { 
                           "Content-Type": "application/json",
                           "x-user-id": user.id.toString()
                        },
                        body: JSON.stringify({
                                userId: targetUserId,
                               title: patient.title.trim(),
                               patientName: patient.name || user.name || "",
                               weight: patient.weight,
                               categorieAge: patient.categorieAge,
                               startDate: patient.startDate,
                               medications: medications.map(m => {
                                 const effective = getEffectiveMedicationForSave(m);
                                 return {
                                   ...effective,
                                   name: effective.name
                                 };
                               }),
                               notifConfig
                            })
                      });

                      if (!res.ok) {
                        const errBody = await res.json().catch(() => null);
                        throw new Error(errBody?.error || "Erreur de sauvegarde");
                      }

                      await ensurePushIfSelected(user.id, notifConfig.channels);

                      const methodsLabel = notifConfig.channels
                        .map((c) =>
                          c === "sms"
                            ? "SMS"
                            : c === "call"
                              ? "Appel vocal"
                              : c === "push"
                                ? "Push"
                                : "WhatsApp",
                        )
                        .join(", ");

                      toast.success(
                        `Ordonnance enregistrée. Rappels activés via : ${methodsLabel}.`,
                      );

                       setTimeout(() => {
                           if (user.type === 'commercial') {
                               navigate("/commercial/dashboard");
                           } else {
                               navigate("/dashboard");
                           }
                       }, 1000);

                    } catch (error) {
                      console.error(error);
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Échec de l'enregistrement de l'ordonnance",
                      );
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {t('prescription.processing')}
                    </div>
                  ) : (
                    <>
                      Enregistrer
                      <Save className="ml-2 w-5 h-5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
    </PageShell>
  );
}

function NotificationOption({ selected, onClick, icon, label, color }: { selected: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center h-14 px-4 rounded-2xl border-2 transition-all gap-2 relative overflow-hidden group w-full",
        selected ? "text-white border-transparent shadow-lg" : "bg-white border-slate-100 hover:border-primary/30"
      )}
      style={selected ? { background: `linear-gradient(135deg, ${color}, ${color}dd)` } : {}}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center z-10 transition-transform group-hover:scale-110"
        style={{ background: selected ? 'rgba(255,255,255,0.2)' : `${color}15`, color: selected ? '#fff' : color }}
      >
        {icon}
      </div>
      <span className="text-sm font-bold z-10">{label}</span>
      {selected && (
        <div className="absolute top-1 right-1 bg-white/20 rounded-full p-0.5 z-10">
          <Check className="w-2.5 h-2.5" />
        </div>
      )}
    </button>
  );
}
