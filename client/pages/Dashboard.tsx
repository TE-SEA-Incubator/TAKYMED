import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Link, Navigate } from "react-router-dom";
import {
  Bell,
  PlusCircle,
  Search,
  Calendar as CalendarUIIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Store,
  ArrowRight,
  Loader2,
  Check,
  Shield,
  ChevronRight,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DoseSchedule } from "@shared/api";
import { toast } from "sonner";
import Logo from "@/components/Logo1";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [doses, setDoses] = useState<DoseSchedule[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    async function fetchPrescriptions() {
      if (!user?.id) return;
      try {
        let url = `/api/prescriptions?userId=${user.id}`;
        if (selectedPatientId) {
          url += `&patientId=${selectedPatientId}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setDoses(data.doses);
        setStats(data.stats);
        // Only update patients list if not filtering by patient, so the list stays intact
        if (!selectedPatientId) {
          setPatients(data.patients || []);
        }
      } catch (error) {
        console.error(error);
        toast.error("Erreur lors du chargement des ordonnances");
      } finally {
        setIsLoading(false);
      }
    }
    fetchPrescriptions();
  }, [user?.id, selectedPatientId]);

  const handleToggleMedication = async (doseId: number, isTaken: boolean) => {
    try {
      const endpoint = isTaken ? "take" : "untake";
      const res = await fetch(
        `/api/prescriptions/doses/${doseId}/${endpoint}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Error updating dose status");

      toast.success(isTaken ? "Prise enregistrée !" : "Prise annulée");

      // Refresh data
      const url = selectedPatientId
        ? `/api/prescriptions?userId=${user?.id}&patientId=${selectedPatientId}`
        : `/api/prescriptions?userId=${user?.id}`;
      const refreshRes = await fetch(url);
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setDoses(data.doses);
        setStats(data.stats);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelayMedication = async (doseId: number) => {
    try {
      const res = await fetch(`/api/prescriptions/doses/${doseId}/delay`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Error delaying dose");
      toast.success("Prise reportée !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du report");
    }
  };

  const handleChangeName = async () => {
    const newName = prompt("Nouveau nom complet :", user?.name || "");
    if (!newName || newName === user?.name) return;

    try {
      const res = await fetch("https://dev.takymed.com:3500/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id.toString(),
        },
        body: JSON.stringify({ name: newName }),
      });

      if (res.ok) {
        toast.success("Nom mis à jour !");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error("Erreur lors de la mise à jour");
      }
    } catch (error) {
      toast.error("Erreur réseau");
    }
  };

  if (!user) return null;

  // Redirect based on role
  if (user.type?.toLowerCase() === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (user.type?.toLowerCase() === "commercial") {
    return <Navigate to="/commercial" replace />;
  }

  const ordonnanceQuota = stats?.quota?.ordonnances;
  const reminderQuota = stats?.quota?.rappels;
  const normalizedUserType = String(user.type || "").toLowerCase();
  const isProAccount =
    normalizedUserType === "professional" ||
    normalizedUserType === "professionnel" ||
    normalizedUserType === "pharmacist";

  const formatQuotaLimit = (quota: any) => {
    if (!quota) return "--";
    return quota.unlimited ? "Illimité" : String(quota.max ?? 0);
  };

  const formatQuotaRemaining = (quota: any) => {
    if (!quota) return "--";
    return quota.unlimited ? "∞" : String(Math.max(Number(quota.remaining ?? 0), 0));
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl animate-in fade-in duration-700">
        {/* Welcome Header */}
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border shadow-2xl mb-8 md:mb-12 flex flex-col md:flex-row justify-between items-center gap-6 md:gap-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32" />
          <div className="flex items-center gap-5 md:gap-8 relative z-10 w-full">
            <Logo size="small" className="hidden sm:block shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-tighter mb-1">
                  {t("dashboard.hello")},{" "}
                  <span className="text-primary">
                    {user.name || user.phone || user.email?.split("@")[0]}
                  </span>
                </h1>
                <button
                  onClick={handleChangeName}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-primary transition-all"
                  title="Changer mon nom"
                >
                  <ArrowRight className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <p className="text-muted-foreground flex items-center gap-2 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Espace{" "}
                <span className="text-primary font-bold capitalize">
                  {(user.type as string) === "professional"
                    ? "Pro"
                    : (user.type as string) === "commercial"
                      ? "Agent Commercial"
                      : (user.type as string) === "pharmacist"
                        ? "Pharmacien"
                        : user.type}
                </span>{" "}
                activé
              </p>
            </div>
          </div>
          <div className="flex w-full md:w-auto gap-4 relative z-10">
            <Link to="/prescription" className="w-full md:w-auto">
              <Button className="w-full rounded-2xl h-14 px-8 text-lg font-black shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95">
                <PlusCircle className="w-6 h-6 mr-2" />
                {t("dashboard.newPrescription")}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-3xl p-5 border shadow-sm">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">
              Quota ordonnances actives
            </p>
            <p className="text-2xl font-black mt-1">
              {ordonnanceQuota ? ordonnanceQuota.used : 0}
              <span className="text-base font-bold text-muted-foreground ml-1">
                / {formatQuotaLimit(ordonnanceQuota)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Restant: <span className="font-bold">{formatQuotaRemaining(ordonnanceQuota)}</span>
            </p>
          </div>

          <div className="bg-white rounded-3xl p-5 border shadow-sm">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">
              Quota rappels actifs
            </p>
            <p className="text-2xl font-black mt-1">
              {reminderQuota ? reminderQuota.used : 0}
              <span className="text-base font-bold text-muted-foreground ml-1">
                / {formatQuotaLimit(reminderQuota)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Restant: <span className="font-bold">{formatQuotaRemaining(reminderQuota)}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {(user.type as string) === "standard" ? (
            <>
              <div className="bg-white rounded-3xl p-5 border shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">
                  {t("dashboard.adherence")}
                </p>
                <p className="text-2xl font-black">
                  {stats ? `${stats.observanceRate}%` : "0%"}
                </p>
              </div>
              <div className="bg-white rounded-3xl p-5 border shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">
                  {t("dashboard.plannedDoses")}
                </p>
                <p className="text-2xl font-black">
                  {stats ? stats.plannedReminders : 0}
                </p>
              </div>
              <div className="bg-white rounded-3xl p-5 border shadow-sm col-span-2 lg:col-span-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">
                  {t("dashboard.toTake")}
                </p>
                <p className="text-2xl font-black">
                  {stats ? stats.activeReminders : 0}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-3xl p-5 border shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">
                  {t("dashboard.adherence")}
                </p>
                <p className="text-2xl font-black">
                  {stats ? `${stats.observanceRate}%` : "0%"}
                </p>
              </div>
              <div className="bg-white rounded-3xl p-5 border shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">
                  {t("dashboard.plannedDoses")}
                </p>
                <p className="text-2xl font-black">
                  {stats ? stats.plannedReminders : 0}
                </p>
              </div>
              <div className="bg-white rounded-3xl p-5 border shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">
                  {t("dashboard.toTake")}
                </p>
                <p className="text-2xl font-black">
                  {stats ? stats.activeReminders : 0}
                </p>
              </div>
              <div className="bg-white rounded-3xl p-5 border shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">
                  {t("dashboard.nearbyPharmacies")}
                </p>
                <p className="text-2xl font-black">
                  {stats ? stats.nearbyPharmacies : 0}
                </p>
              </div>
              <div className="bg-white rounded-3xl p-5 border shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">
                  {t("dashboard.overdueReminders")}
                </p>
                <p className="text-2xl font-black">
                  {stats ? stats.overdueReminders ?? 0 : 0}
                </p>
              </div>
              <div className="bg-white rounded-3xl p-5 border shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">
                  {t("dashboard.pharmaciesOnDuty")}
                </p>
                <p className="text-2xl font-black">
                  {stats ? stats.pharmaciesOnDuty ?? 0 : 0}
                </p>
              </div>
            </>
          )}
        </div>

        <Tabs defaultValue="today" className="space-y-8">
          <TabsList className="bg-white/50 backdrop-blur-sm border p-1 rounded-2xl h-14 w-full max-w-md mx-auto grid grid-cols-2 shadow-sm">
            <TabsTrigger
              value="today"
              className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all"
            >
              <Clock className="w-4 h-4 mr-2" />
              {user.type === "standard" ? "Ma Prise" : t("dashboard.today")}
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all"
            >
              <CalendarUIIcon className="w-4 h-4 mr-2" />
              {t("dashboard.calendar")}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="today"
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div
              className={cn(
                "grid grid-cols-1 gap-8",
                user.type !== "standard" ? "lg:grid-cols-4" : "lg:grid-cols-3",
              )}
            >
              {/* Left Column: Quick Actions */}
              <div className="hidden md:hidden lg:block">
                <QuickAccessPanel user={user} t={t} />
              </div>

              {/* Middle Column: Status & Activity */}
              <div className="lg:col-span-2 space-y-8">
                <h2 className="text-xl font-bold flex items-center gap-2 px-2">
                  <CalendarUIIcon className="w-5 h-5 text-primary" />
                  {t("dashboard.today")}
                </h2>

                <div className="bg-white rounded-[40px] border shadow-sm p-8 space-y-8">
                  {/* Next Dose */}
                  <div className="flex flex-col md:flex-row gap-8 items-center border-b pb-8">
                    <div className="w-24 h-24 rounded-full border-8 border-primary/20 flex items-center justify-center text-primary font-bold text-lg relative">
                      <Clock className="w-6 h-6 absolute -top-1 -right-1 bg-white rounded-full p-1 border shadow-sm" />
                      {stats?.nextDose ? stats.nextDose.time : "--:--"}
                    </div>
                    <div className="flex-1 text-center md:text-left space-y-2">
                      <h3 className="text-2xl font-bold">
                        {stats?.nextDose ? (
                          <>
                            <span>{t("dashboard.nextDose")} : </span>
                            <span className="text-primary">
                              {stats.nextDose.medicationName}
                            </span>
                            <span className="text-sm text-slate-500 font-medium block mt-1">
                              <span>{t("dashboard.forInfo")} </span>
                              {stats.nextDose.clientName}
                            </span>
                          </>
                        ) : (
                          <span>{t("dashboard.noUpcoming")}</span>
                        )}
                      </h3>
                      <p className="text-muted-foreground">
                        {stats?.nextDose ? (
                          <span>
                            {stats.nextDose.dose} {stats.nextDose.unit} à
                            prendre pendant le {stats.nextDose.type}.
                          </span>
                        ) : (
                          <span>
                            Toutes vos prises sont terminées ou aucune
                            n&apos;est planifiée.
                          </span>
                        )}
                      </p>
                      {stats?.nextDose && (
                        <div className="flex gap-4 justify-center md:justify-start pt-2">
                          <Button
                            size="sm"
                            className="rounded-xl h-10 px-6 font-bold"
                            onClick={() =>
                              handleToggleMedication(stats.nextDose.id, true)
                            }
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {t("dashboard.markTaken")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl h-10 px-6"
                            onClick={() =>
                              handleDelayMedication(stats.nextDose.id)
                            }
                          >
                            {t("dashboard.later")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats - Pro/Admin/Pharmacist Only */}
                  {user.type !== "standard" && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                      <DashboardStat
                        label={t("dashboard.adherence")}
                        value={stats ? `${stats.observanceRate}%` : "0%"}
                        subtext="Sur les doses échues"
                      />
                      <DashboardStat
                        label={t("dashboard.toTake")}
                        value={stats ? stats.activeReminders.toString() : "0"}
                        subtext={`Sur ${stats ? stats.plannedReminders : 0} planifiés`}
                      />
                      <DashboardStat
                        label={t("dashboard.nearbyPharmacies")}
                        value={stats ? stats.nearbyPharmacies.toString() : "0"}
                        subtext="Avec stock disponible"
                      />
                      <DashboardStat
                        label={t("dashboard.overdueReminders")}
                        value={stats ? String(stats.overdueReminders ?? 0) : "0"}
                        subtext="Prises en retard"
                      />
                      <DashboardStat
                        label={t("dashboard.pharmaciesOnDuty")}
                        value={stats ? String(stats.pharmaciesOnDuty ?? 0) : "0"}
                        subtext="Pharmacies de garde"
                      />
                    </div>
                  )}

                  {/* Tips */}
                  <div className="p-6 bg-slate-50 rounded-3xl border border-dashed flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <div className="space-y-1">
                      <p className="font-bold">{t("dashboard.healthTip")}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Pensez à bien vous hydrater. Boire un grand verre d'eau
                        facilite l'absorption de vos médicaments.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Client List (Pro/Admin/Pharmacist Only) */}
              {user.type !== "standard" && (
                <div className="lg:col-span-1 space-y-8">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Store className="w-5 h-5 text-primary" />
                      {isProAccount
                        ? "Liste ordonnances"
                        : t("dashboard.clientList")}
                    </h2>
                    {selectedPatientId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-xs font-bold text-muted-foreground hover:text-primary"
                        onClick={() => setSelectedPatientId(null)}
                      >
                        {t("dashboard.all")}
                      </Button>
                    )}
                  </div>
                  <div className="bg-white rounded-[40px] border shadow-sm p-6 flex flex-col h-[500px]">
                    {patients.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground opacity-60">
                        <Store className="w-12 h-12 mb-4" />
                        <p>
                          {isProAccount
                            ? "Aucune ordonnance enregistrée."
                            : "Aucun client enregistré."}
                        </p>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {patients.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => setSelectedPatientId(p.id)}
                            className={cn(
                              "p-4 rounded-3xl border transition-all cursor-pointer flex justify-between items-center group",
                              selectedPatientId === p.id
                                ? "border-primary shadow-md bg-primary/5"
                                : "border-slate-100 hover:border-primary/30 hover:shadow-md bg-slate-50",
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <h4
                                className={cn(
                                  "font-bold text-sm transition-colors line-clamp-1",
                                  selectedPatientId === p.id
                                    ? "text-primary"
                                    : "text-slate-800 group-hover:text-primary",
                                )}
                              >
                                {p.name ||
                                  (isProAccount
                                    ? "Ordonnance inconnue"
                                    : t("dashboard.unknownClient"))}
                              </h4>
                              <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                {t("dashboard.registeredOn")}{" "}
                                {new Date(p.date).toLocaleDateString("fr-FR")}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 ml-2">
                              {p.phone && (
                                <>
                                  <a
                                    href={`https://wa.me/${p.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour ${p.name}, je suis votre praticien sur TAKYMED. Je vous contacte pour votre suivi de traitement.`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-sm"
                                    title="WhatsApp"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.03c0 2.122.54 4.197 1.57 6.057L0 24l6.105-1.604a11.81 11.81 0 005.94 1.585h.005c6.634 0 12.032-5.391 12.036-12.029a11.812 11.812 0 00-3.528-8.504z" />
                                    </svg>
                                  </a>
                                  <a
                                    href={`tel:${p.phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                    title="Appeler"
                                  >
                                    <Search className="w-4 h-4 rotate-90" />{" "}
                                    {/* Using Search as phone icon fallback if Phone not imported here, but Phone IS imported at line 13 if I check carefully, oh wait, line 13 in Dashboard.tsx is NOT imported. Let's check imports. */}
                                  </a>
                                </>
                              )}
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm",
                                  selectedPatientId === p.id
                                    ? "bg-primary text-white"
                                    : "bg-white text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                                )}
                              >
                                <ArrowRight className="w-3 h-3" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="calendar"
            className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6"
          >
            <QuickAccessPanel user={user} t={t} compact />
            <CalendarView
              doses={doses}
              isLoading={isLoading}
              onToggleMed={handleToggleMedication}
              user={user}
              patients={patients}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function QuickAccessPanel({
  user,
  t,
  compact = false,
}: {
  user: any;
  t: (key: string) => string;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-8", compact ? "" : "lg:col-span-1")}>
      <h2 className="text-xl font-bold flex items-center gap-2 px-2">
        <ArrowRight className="w-5 h-5 text-primary" />
        {t("dashboard.quickAccess")}
      </h2>
      <div
        className={cn(
          "gap-4",
          compact
            ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
            : "grid grid-cols-1",
        )}
      >
        <DashboardActionCard
          title={t("dashboard.reminders")}
          description={t("dashboard.remindersDesc")}
          icon={<Bell className="w-6 h-6" />}
          link="/prescription"
          color="bg-primary"
        />
        <DashboardActionCard
          title={t("dashboard.medication")}
          description={t("dashboard.medicationDesc")}
          icon={<Search className="w-6 h-6" />}
          link="/search"
          color="bg-secondary"
        />
        {user.type === "pharmacist" && (
          <DashboardActionCard
            title={t("dashboard.myPharmacies")}
            description={t("dashboard.myPharmaciesDesc")}
            icon={<Store className="w-6 h-6" />}
            link="/pharmacy-mgmt"
            color="bg-slate-900"
          />
        )}
        {!compact && <DashboardSecurityCard user={user} />}
      </div>
    </div>
  );
}

// ─── Color palette for medication doses ───────────────────────────────────────
const DOSE_COLORS = [
  { bar: "#ef4444", bg: "rgba(239,68,68,0.12)", text: "#ef4444" }, // red
  { bar: "#3b82f6", bg: "rgba(59,130,246,0.12)", text: "#3b82f6" }, // blue
  { bar: "#22c55e", bg: "rgba(34,197,94,0.12)", text: "#22c55e" }, // green
  { bar: "#f59e0b", bg: "rgba(245,158,11,0.12)", text: "#f59e0b" }, // amber
  { bar: "#a855f7", bg: "rgba(168,85,247,0.12)", text: "#a855f7" }, // purple
  { bar: "#06b6d4", bg: "rgba(6,182,212,0.12)", text: "#06b6d4" }, // cyan
];

// ─── Calendar View Component ───────────────────────────────────────────────────
function CalendarView({
  doses,
  isLoading,
  onToggleMed,
  user,
  patients,
}: {
  doses: DoseSchedule[];
  isLoading: boolean;
  onToggleMed: (id: number, isTaken: boolean) => void;
  user: any;
  patients: any[];
}) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(today.getDate());
  const [calFilterPatient, setCalFilterPatient] = useState<number | null>(null);

  const isNonStandard = user?.type !== "standard";
  const normalizedUserType = String(user?.type || "").toLowerCase();
  const isProAccount =
    normalizedUserType === "professional" ||
    normalizedUserType === "professionnel" ||
    normalizedUserType === "pharmacist";

  // Filter doses by selected patient if applicable
  const filteredDoses = calFilterPatient
    ? doses.filter((d) => d.patientId === calFilterPatient)
    : doses;

  const MONTH_NAMES = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];
  const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  // New helper for correct date format jj/mm/aa
  const formatDateJJMMYY = (date: Date) => {
    const j = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const a = String(date.getFullYear()).slice(-2);
    return `${j}/${m}/${a}`;
  };

  // State for showing prescription details
  const [expandedPrescriptionId, setExpandedPrescriptionId] = useState<
    number | string | null
  >(null);

  // Days in the current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  // Build calendar grid
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  // Color map per medication name (consistent colors)
  const medColorMap = new Map<string, (typeof DOSE_COLORS)[0]>();
  filteredDoses.forEach((d) => {
    if (!medColorMap.has(d.medicationName)) {
      medColorMap.set(
        d.medicationName,
        DOSE_COLORS[medColorMap.size % DOSE_COLORS.length],
      );
    }
  });

  const dosesByDate = new Map<string, DoseSchedule[]>();
  filteredDoses.forEach((dose) => {
    if (!dose.scheduledAt) return;
    const d = new Date(dose.scheduledAt);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const current = dosesByDate.get(dateKey) ?? [];
    current.push(dose);
    dosesByDate.set(dateKey, current);
  });

  const dSel = new Date(currentYear, currentMonth, selectedDate);
  const selectedKey = `${dSel.getFullYear()}-${String(dSel.getMonth() + 1).padStart(2, "0")}-${String(dSel.getDate()).padStart(2, "0")}`;
  const selectedDoses = dosesByDate.get(selectedKey) ?? [];
  const takenCount = selectedDoses.filter((d) => d.statusTaken).length;
  const pendingCount = selectedDoses.length - takenCount;
  const adherence =
    selectedDoses.length > 0
      ? Math.round((takenCount / selectedDoses.length) * 100)
      : 0;

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else setCurrentMonth((m) => m + 1);
  };

  return (
    <div
      className={cn(
        "rounded-[2.5rem] overflow-hidden border shadow-2xl",
        isNonStandard ? "grid grid-cols-1 xl:grid-cols-[260px,1fr]" : "",
      )}
      style={{
        background: "linear-gradient(135deg, #004a73, #002a42)",
        borderColor: "#006093",
      }}
    >
      {/* ── CLIENT FILTER (non-standard only) ── */}
      {isNonStandard && (
        <div
          className="p-5 border-b xl:border-b-0 xl:border-r flex flex-col gap-3"
          style={{ borderColor: "#006093", background: "rgba(0,0,0,0.15)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-slate-300 uppercase tracking-widest">
              {isProAccount ? "Ordonnances" : "Clients"}
            </p>
            {calFilterPatient && (
              <button
                onClick={() => setCalFilterPatient(null)}
                className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors"
              >
                Tous
              </button>
            )}
          </div>
          <div className="flex xl:flex-col gap-2 overflow-x-auto xl:overflow-y-auto xl:max-h-[520px] pb-1">
            {patients.length === 0 ? (
              <p className="text-slate-500 text-xs italic">
                {isProAccount ? "Aucune ordonnance" : "Aucun client"}
              </p>
            ) : (
              patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    setCalFilterPatient(calFilterPatient === p.id ? null : p.id)
                  }
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all text-left",
                    calFilterPatient === p.id
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent",
                  )}
                >
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-black text-[10px] shrink-0">
                    {(p.name || "?")[0].toUpperCase()}
                  </span>
                  <span className="truncate max-w-[140px]">
                    {p.name ||
                      (isProAccount
                        ? "Ordonnance inconnue"
                        : "Client inconnu")}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] min-h-[580px]">
        {/* ── LEFT: Monthly Grid ── */}
        <div className="p-6 md:p-8">
          {/* Month header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">
                {MONTH_NAMES[currentMonth]}
              </h2>
              <span className="text-slate-400 font-medium">{currentYear}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={prevMonth}
                title="Mois précédent"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={nextMonth}
                title="Mois suivant"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_NAMES.map((d) => (
              <div
                key={d}
                className="text-center text-[11px] font-bold text-slate-500 py-2 uppercase tracking-wider"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {calendarCells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;
              const isToday =
                day === today.getDate() &&
                currentMonth === today.getMonth() &&
                currentYear === today.getFullYear();
              const isSelected = day === selectedDate;
              const dCel = new Date(currentYear, currentMonth, day);
              const dayKey = `${dCel.getFullYear()}-${String(dCel.getMonth() + 1).padStart(2, "0")}-${String(dCel.getDate()).padStart(2, "0")}`;
              const dayDoses = dosesByDate.get(dayKey) ?? [];
              const hasDoses = dayDoses.length > 0;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(day)}
                  className="flex flex-col items-center justify-start pt-1.5 pb-2 rounded-xl transition-all relative min-h-[52px] group"
                  style={
                    isSelected
                      ? { background: "#1a6eb5" }
                      : isToday
                        ? { background: "rgba(26,110,181,0.2)" }
                        : {}
                  }
                >
                  <span
                    className="text-sm font-bold leading-none"
                    style={{
                      color: isSelected
                        ? "#fff"
                        : isToday
                          ? "#4dc0ff"
                          : "#cbd5e1",
                    }}
                  >
                    {day}
                  </span>
                  {/* Dose indicator dots */}
                  {hasDoses &&
                    !isSelected &&
                    (() => {
                      const isPast =
                        currentYear < today.getFullYear() ||
                        (currentYear === today.getFullYear() &&
                          currentMonth < today.getMonth()) ||
                        (currentYear === today.getFullYear() &&
                          currentMonth === today.getMonth() &&
                          day < today.getDate());
                      const isTodayNum =
                        currentYear === today.getFullYear() &&
                        currentMonth === today.getMonth() &&
                        day === today.getDate();
                      let dayStatusColor = "#38bdf8";
                      if (isPast) {
                        const takenCount = dayDoses.filter(
                          (d) => d.statusTaken,
                        ).length;
                        dayStatusColor =
                          takenCount === dayDoses.length
                            ? "#00A859"
                            : "#EF4444";
                      } else if (isTodayNum) dayStatusColor = "#F59E0B";

                      return (
                        <div className="flex gap-0.5 mt-1.5">
                          <div
                            className="w-2 h-2 rounded-full shadow-sm"
                            style={{ background: dayStatusColor }}
                          />
                          {dayDoses.length > 1 && (
                            <div
                              className="w-2 h-2 rounded-full shadow-sm"
                              style={{
                                background: dayStatusColor,
                                opacity: 0.5,
                              }}
                            />
                          )}
                        </div>
                      );
                    })()}
                  {isSelected && selectedDoses.length > 0 && (
                    <div className="flex gap-0.5 mt-1.5">
                      <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-8 flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00A859]" />
              <span className="text-xs text-slate-300 font-medium">Pris</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
              <span className="text-xs text-slate-300 font-medium">
                Pas pris
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <span className="text-xs text-slate-300 font-medium">
                En cours
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
              <span className="text-xs text-slate-300 font-medium">
                À venir
              </span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Daily Schedule ── */}
        <div
          className="border-t lg:border-t-0 lg:border-l p-6 flex flex-col"
          style={{
            borderColor: "#006093",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          {/* Header */}
          <div className="mb-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Ordonnances
            </p>
            <h3 className="text-lg font-bold text-white mt-0.5">
              {formatDateJJMMYY(
                new Date(currentYear, currentMonth, selectedDate),
              )}
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div
                className="rounded-xl p-2 text-center"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <p className="text-[10px] text-slate-400 uppercase">Total</p>
                <p className="text-white font-black text-lg">
                  {selectedDoses.length}
                </p>
              </div>
              <div
                className="rounded-xl p-2 text-center"
                style={{ background: "rgba(0,168,89,0.15)" }}
              >
                <p className="text-[10px] text-green-300 uppercase">Pris</p>
                <p className="text-green-300 font-black text-lg">
                  {takenCount}
                </p>
              </div>
              <div
                className="rounded-xl p-2 text-center"
                style={{ background: "rgba(245,158,11,0.15)" }}
              >
                <p className="text-[10px] text-amber-300 uppercase">Restant</p>
                <p className="text-amber-300 font-black text-lg">
                  {pendingCount}
                </p>
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                style={{ width: `${adherence}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400 uppercase tracking-wider">
              Adhérence du jour: {adherence}%
            </p>
          </div>

          {/* Scheduled doses */}
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[460px] pr-1">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
              </div>
            ) : selectedDoses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div
                  className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <CalendarUIIcon className="w-7 h-7 text-slate-500" />
                </div>
                <p className="text-slate-500 text-sm font-medium">
                  Aucune prise
                  <br />
                  programmée
                </p>
              </div>
            ) : (
              selectedDoses.map((dose, idx) => {
                const color =
                  medColorMap.get(dose.medicationName) || DOSE_COLORS[0];
                return (
                  <div
                    key={dose.id || idx}
                    className="rounded-2xl p-4 flex gap-3 items-start relative overflow-hidden"
                    style={{
                      background: color.bg,
                      border: `1px solid ${color.bar}30`,
                    }}
                  >
                    {/* Color bar */}
                    <div
                      className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                      style={{ background: color.bar }}
                    />
                    <div className="ml-2 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-sm leading-tight truncate">
                            {dose.medicationName}
                          </h4>
                          {isNonStandard && dose.clientName && (
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              👤 {dose.clientName}
                            </p>
                          )}
                        </div>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            color: color.text,
                            background: `${color.bar}25`,
                          }}
                        >
                          {dose.dose} {dose.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-slate-400 text-xs">
                          <Clock className="w-3 h-3" /> {dose.time}
                        </span>
                        {dose.statusTaken ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-3 text-[10px] rounded-full bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleMed(dose.id, false);
                            }}
                          >
                            ✓ Pris (Annuler)
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-3 text-[10px] rounded-full bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 hover:text-orange-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleMed(dose.id, true);
                            }}
                          >
                            Marquer pris
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer stats */}
          {!isLoading && (
            <div
              className="mt-4 pt-4 grid grid-cols-2 gap-3"
              style={{ borderTop: "1px solid #006093" }}
            >
              <div
                className="text-center p-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <p className="text-2xl font-black text-white">{takenCount}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Pris
                </p>
              </div>
              <div
                className="text-center p-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <p className="text-2xl font-black text-white">{pendingCount}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  À venir
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardActionCard({
  title,
  description,
  icon,
  link,
  color,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
  color: string;
}) {
  return (
    <Link to={link} className="group">
      <div className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm hover:shadow-2xl hover:shadow-primary/10 transition-all flex items-center gap-5 hover:border-primary/20">
        <div
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/5 transition-transform group-hover:scale-110",
            color,
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-lg group-hover:text-primary transition-colors tracking-tight">
            {title}
          </h4>
          <p className="text-xs font-medium text-muted-foreground truncate">
            {description}
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}

function DashboardStat({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
        {label}
      </p>
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{subtext}</p>
    </div>
  );
}

function DashboardSecurityCard({ user }: { user: any }) {
  const [isLoading, setIsLoading] = useState(false);
  const [pinExpiresAt, setPinExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    // Fetch PIN expiration info
    const fetchPinInfo = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch("https://dev.takymed.com:3500/api/auth/pin-info", {
          headers: {
            "x-user-id": user.id.toString(),
          },
        });
        if (res.ok) {
          const data = await res.json();
          setPinExpiresAt(data.expiresAt);
        }
      } catch (error) {
        console.error("Failed to fetch PIN info:", error);
      }
    };
    fetchPinInfo();
  }, [user?.id]);

  const handleRegeneratePin = async () => {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir régénérer votre PIN ? Un nouveau PIN de 6 chiffres vous sera envoyé par SMS.",
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("https://dev.takymed.com:3500/api/auth/regenerate-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id.toString(),
        },
      });

      if (res.ok) {
        const data = await res.json();
        setPinExpiresAt(data.expiresAt);
        toast.success("Nouveau PIN envoyé par SMS !");
      } else {
        const error = await res.json();
        toast.error(error.error || "Erreur lors de la régénération");
      }
    } catch (error) {
      console.error("PIN regeneration error:", error);
      toast.error("Erreur réseau");
    } finally {
      setIsLoading(false);
    }
  };

  const formatExpirationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm hover:shadow-2xl hover:shadow-primary/10 transition-all hover:border-primary/20">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-black/5">
          <Shield className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h4 className="font-black text-lg tracking-tight">
            Sécurité du compte
          </h4>
          <p className="text-xs font-medium text-muted-foreground">
            Gérez votre PIN de connexion
          </p>
        </div>
      </div>

      {pinExpiresAt && (
        <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-600 mb-1">
            Expiration PIN
          </p>
          <p className="text-sm font-medium text-slate-800">
            {formatExpirationDate(pinExpiresAt)}
          </p>
        </div>
      )}

      <Button
        onClick={handleRegeneratePin}
        disabled={isLoading}
        className="w-full rounded-xl h-10 font-bold bg-slate-900 hover:bg-slate-800 text-white"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Envoi en cours...
          </>
        ) : (
          <>🔄 Régénérer PIN</>
        )}
      </Button>

      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        Nouveau PIN de 6 chiffres envoyé par SMS
      </p>
    </div>
  );
}
