import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Pill,
  Info,
  AlertTriangle,
  Plus,
  Bookmark,
  ChevronRight,
  MapPin,
  Navigation,
  Store,
  CheckCircle2,
  Clock
} from "lucide-react";
import { cn, resolveMedicationPhotoUrl } from "@/lib/utils";
import { toast } from "sonner";
import { PageShell } from "@/components/app/PageShell";
import { PageHeader } from "@/components/app/PageHeader";

export default function SearchMedications() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [medications, setMedications] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [selectedMed, setSelectedMed] = useState<any | null>(null);
  const [pharmaciesWithStock, setPharmaciesWithStock] = useState<any[]>([]);
  const [pharmaciesOnDuty, setPharmaciesOnDuty] = useState<any[]>([]);
  const [pharmacyTab, setPharmacyTab] = useState<"stock" | "garde">("garde");
  const [mainSection, setMainSection] = useState<"medications" | "pharmacies">("medications");
  const [pharmacyQuery, setPharmacyQuery] = useState("");
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);
  const [locationCity, setLocationCity] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isFindingLocation, setIsFindingLocation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const navigate = useNavigate();

  // Load bookmarks and interactions
  useEffect(() => {
    const saved = localStorage.getItem("med_bookmarks");
    if (saved) setBookmarks(JSON.parse(saved));
    
    fetchInteractions();
  }, []);

  const fetchInteractions = async () => {
    try {
      const res = await fetch('/api/medications/interactions');
      if (res.ok) {
        const data = await res.json();
        setInteractions(data.interactions);
      }
    } catch (err) {
      console.error("Error fetching interactions:", err);
    }
  };

  const toggleBookmark = (id: number) => {
    const newBookmarks = bookmarks.includes(id)
      ? bookmarks.filter(b => b !== id)
      : [...bookmarks, id];
    setBookmarks(newBookmarks);
    localStorage.setItem("med_bookmarks", JSON.stringify(newBookmarks));
    toast.success(bookmarks.includes(id) ? "Supprimé des favoris" : "Ajouté aux favoris");
  };

  const handleAddToTreatment = () => {
    if (!selectedMed) return;
    navigate(`/prescription?med=${encodeURIComponent(selectedMed.name)}`);
  };

  // Fetch medications based on query
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setMedications([]);
        setAiResult(null);
        return;
      }
      setLoading(true);
      setAiResult(null);
      try {
        const res = await fetch(`/api/medications?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setMedications(data.medications);
        }
      } catch (err) {
        console.error("Error fetching meds:", err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searchWithAI = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch(`/api/medications/ai-info?name=${encodeURIComponent(q)}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Réponse serveur invalide (${res.status})`);
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Recherche IA indisponible");
      }
      setAiResult(data.aiResult);
    } catch (err: any) {
      toast.error(err.message ?? "Recherche IA indisponible");
    } finally {
      setAiLoading(false);
    }
  };

  const normalizeNearbyPharmacies = (data: any) => {
    if (data.withStock || data.onDuty) {
      return {
        withStock: data.withStock ?? [],
        onDuty: data.onDuty ?? [],
        city: data.location?.city ?? null,
      };
    }
    return {
      withStock: data.pharmacies ?? [],
      onDuty: [],
      city: data.resolvedLocation?.city ?? null,
    };
  };

  // Filter interactions for current med
  const relevantInteractions = selectedMed 
    ? interactions.filter(i => 
        i.med1Name.toLowerCase() === selectedMed.name.toLowerCase() || 
        i.med2Name.toLowerCase() === selectedMed.name.toLowerCase()
      )
    : [];

  // Fetch pharmacies (garde + stock) when on pharmacy section
  const fetchNearbyPharmacies = async (medId?: number) => {
    setLoadingPharmacies(true);
    let url = `/api/pharmacies/nearby?limit=40`;
    if (userLocation) {
      url += `&lat=${userLocation.lat}&lng=${userLocation.lng}`;
    }
    const effectiveMedId = medId ?? selectedMed?.id;
    if (effectiveMedId) {
      url += `&medId=${effectiveMedId}`;
    }

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeNearbyPharmacies(data);
        setPharmaciesWithStock(normalized.withStock);
        setPharmaciesOnDuty(normalized.onDuty);
        setLocationCity(normalized.city);
      } else if (res.headers.get("content-type")?.includes("application/json")) {
        const err = await res.json();
        toast.error(err.error ?? "Erreur recherche pharmacies");
      }
    } catch (err) {
      console.error("Error fetching pharmacies:", err);
    } finally {
      setLoadingPharmacies(false);
    }
  };

  useEffect(() => {
    if (mainSection !== "pharmacies") return;
    fetchNearbyPharmacies();
  }, [mainSection, userLocation, selectedMed?.id]);

  const filterPharmacies = (list: any[]) => {
    const q = pharmacyQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        String(p.name ?? "").toLowerCase().includes(q) ||
        String(p.address ?? "").toLowerCase().includes(q),
    );
  };

  const openPharmaciesSection = (stockTab = false) => {
    setMainSection("pharmacies");
    setPharmacyTab(stockTab ? "stock" : "garde");
  };

  const handleGetLocation = () => {
    setIsFindingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(coords);
          setIsFindingLocation(false);
          toast.success("Position récupérée !");
          if (mainSection === "pharmacies") {
            fetchNearbyPharmacies();
          }
        },
        (error) => {
          console.warn("Geolocation error:", error.message);
          setIsFindingLocation(false);
          if (error.code === 1) {
            toast.warning("Géolocalisation non disponible - utilisez localhost ou HTTPS");
          } else {
            toast.error("Impossible de récupérer votre position.");
          }
        }
      );
    } else {
      setIsFindingLocation(false);
      toast.error("Géolocalisation non supportée par votre navigateur.");
    }
  };

  const pharmacyList = filterPharmacies(
    pharmacyTab === "stock" ? pharmaciesWithStock : pharmaciesOnDuty,
  );

  const renderPharmacyCard = (p: any, isGarde: boolean) => (
    <div
      key={p.id}
      className={cn(
        "p-6 rounded-3xl border space-y-4 hover:border-primary/50 transition-all",
        isGarde ? "border-amber-100 bg-amber-50/50" : "border-slate-100 bg-slate-50",
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isGarde && (
              <span className="text-[10px] font-black uppercase bg-amber-500 text-white px-2 py-0.5 rounded-md">
                De garde
              </span>
            )}
            <h4 className="font-bold text-lg">{p.name}</h4>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0" />
            {p.address}
          </div>
        </div>
        {p.distance != null && (
          <div className="bg-white px-2 py-1 rounded-lg border text-[10px] font-bold text-primary shrink-0">
            {p.distance} km
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-2">
        {!isGarde ? (
          <div className="flex items-center gap-1 text-green-600 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            En stock ({p.quantity} unités)
          </div>
        ) : (
          <div className="flex items-center gap-1 text-amber-600 font-bold text-xs">
            <Clock className="w-4 h-4" />
            {p.status || "Ouverte"}
          </div>
        )}
        <Button asChild variant="ghost" className="h-8 rounded-xl text-xs font-bold gap-2">
          <a href={`tel:${p.phone?.replace(/\s+/g, "")}`}>{p.phone || "Appeler"}</a>
        </Button>
      </div>
    </div>
  );

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        badge="Recherche"
        title={t("search.title")}
        subtitle="Médicaments, stocks et pharmacies de garde près de chez vous."
      />

      {/* Section principale : Médicaments | Pharmacies */}
      <div className="mb-8 flex rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMainSection("medications")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all",
            mainSection === "medications"
              ? "bg-white text-primary shadow-sm"
              : "text-muted-foreground hover:text-primary",
          )}
        >
          <Pill className="h-4 w-4" />
          Médicaments
        </button>
        <button
          type="button"
          onClick={() => {
            setMainSection("pharmacies");
            setPharmacyTab("garde");
          }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all",
            mainSection === "pharmacies"
              ? "bg-white text-amber-600 shadow-sm"
              : "text-muted-foreground hover:text-amber-600",
          )}
        >
          <Store className="h-4 w-4" />
          Pharmacies
        </button>
      </div>

      {mainSection === "medications" ? (
        <div className="space-y-8">
          <div className="relative flex w-full items-center rounded-[30px] border bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="ml-4 h-6 w-6 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.searchPlaceholder")}
              className="h-14 border-none bg-transparent text-xl focus-visible:ring-0"
            />
            {loading && (
              <div className="mr-4 h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
            )}
          </div>

          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-4">
              <div className="mb-2 flex items-center justify-between px-2 text-sm text-muted-foreground">
                <span>{medications.length} médicament(s)</span>
              </div>
              <div className="space-y-3">
                {medications.map((m) => {
                  const photoSrc = resolveMedicationPhotoUrl(m.photoUrl);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMed(m)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-3xl border bg-white p-4 text-left transition-all hover:border-primary/50",
                        selectedMed?.id === m.id
                          ? "border-primary bg-primary/5 ring-4 ring-primary/5"
                          : "border-slate-100",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl",
                          selectedMed?.id === m.id ? "ring-2 ring-primary" : "bg-slate-100",
                        )}
                      >
                        {photoSrc ? (
                          <img src={photoSrc} alt={m.name} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <Pill className="h-6 w-6 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-bold">{m.name}</h3>
                        <p className="text-xs uppercase text-muted-foreground">{m.type || "médicament"}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>
                  );
                })}
                {query && medications.length === 0 && !loading && (
                  <div className="space-y-4 py-4">
                    <p className="text-center text-muted-foreground">Aucun médicament trouvé.</p>
                    {!aiResult && (
                      <Button
                        onClick={searchWithAI}
                        disabled={aiLoading}
                        className="h-12 w-full rounded-2xl bg-violet-600 font-bold hover:bg-violet-700"
                      >
                        {aiLoading ? "Recherche IA..." : "Rechercher avec l'IA"}
                      </Button>
                    )}
                    {aiResult && (
                      <div className="space-y-3 rounded-3xl border border-violet-100 bg-violet-50 p-6 text-left">
                        <div className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase text-violet-700">
                          Résultat IA
                        </div>
                        <h3 className="text-xl font-bold">{aiResult.name}</h3>
                        <p className="text-sm text-muted-foreground">{aiResult.description}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8 lg:col-span-8">
              {selectedMed ? (
                <>
                  <div className="animate-in slide-in-from-right-4 space-y-8 rounded-[40px] border bg-white p-8 shadow-sm duration-500">
                    {resolveMedicationPhotoUrl(selectedMed.photoUrl) && (
                      <div className="h-52 w-full overflow-hidden rounded-3xl bg-slate-100">
                        <img
                          src={resolveMedicationPhotoUrl(selectedMed.photoUrl)!}
                          alt={selectedMed.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                      <div className="space-y-2">
                        <div className="mb-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                          {selectedMed.type || "médicament"}
                        </div>
                        <h2 className="text-4xl font-extrabold">{selectedMed.name}</h2>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className={cn(
                            "h-12 w-12 rounded-2xl",
                            bookmarks.includes(selectedMed.id) && "border-amber-200 bg-amber-50 text-amber-500",
                          )}
                          onClick={() => toggleBookmark(selectedMed.id)}
                        >
                          <Bookmark className={cn("h-5 w-5", bookmarks.includes(selectedMed.id) && "fill-current")} />
                        </Button>
                        <Button className="h-12 rounded-2xl px-6 font-bold shadow-lg shadow-primary/20" onClick={handleAddToTreatment}>
                          <Plus className="mr-2 h-4 w-4" />
                          Ajouter au traitement
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 font-bold text-primary">
                          <Info className="h-5 w-5" />
                          Description
                        </div>
                        <p className="leading-relaxed text-muted-foreground">
                          {selectedMed.description || "Aucune description disponible."}
                        </p>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 font-bold text-amber-600">
                          <AlertTriangle className="h-5 w-5" />
                          Précautions
                        </div>
                        {relevantInteractions.length > 0 ? (
                          relevantInteractions.map((inter, idx) => (
                            <div key={idx} className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm">
                              <p className="font-bold">Incompatibilité : {inter.med1Name} / {inter.med2Name}</p>
                              <p className="mt-1 opacity-80">{inter.description}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {selectedMed.precautions && selectedMed.precautions !== "aucune"
                              ? selectedMed.precautions
                              : "Aucune précaution spécifique enregistrée."}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="h-12 w-full rounded-2xl font-bold"
                      onClick={() => openPharmaciesSection(true)}
                    >
                      <Store className="mr-2 h-4 w-4" />
                      Voir disponibilité en pharmacie
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex h-[420px] flex-col items-center justify-center rounded-[40px] border border-dashed border-slate-200 bg-white p-12 text-center opacity-60">
                  <Pill className="mb-4 h-12 w-12 text-slate-300" />
                  <p className="font-bold text-slate-600">Sélectionnez un médicament</p>
                  <p className="text-sm text-slate-400">Consultez la fiche et les stocks disponibles.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <Button
              onClick={handleGetLocation}
              disabled={isFindingLocation}
              variant="outline"
              className="h-14 flex-1 rounded-2xl border-primary/20 font-bold text-primary hover:bg-primary/5"
            >
              <Navigation className={cn("mr-2 h-5 w-5", isFindingLocation && "animate-spin")} />
              {userLocation
                ? `Ma position${locationCity ? ` · ${locationCity}` : ""}`
                : "Utiliser ma position"}
            </Button>
            <div className="relative flex flex-[2] items-center rounded-2xl border bg-white p-2 shadow-sm">
              <Search className="ml-3 h-5 w-5 text-muted-foreground" />
              <Input
                value={pharmacyQuery}
                onChange={(e) => setPharmacyQuery(e.target.value)}
                placeholder="Filtrer par nom ou adresse…"
                className="h-12 border-none bg-transparent focus-visible:ring-0"
              />
            </div>
          </div>

          {selectedMed && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
              Stock pour : {selectedMed.name}
            </div>
          )}

          <div className="flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setPharmacyTab("garde")}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-sm font-bold transition-all",
                pharmacyTab === "garde" ? "bg-white text-amber-600 shadow" : "text-muted-foreground",
              )}
            >
              De garde ({pharmaciesOnDuty.length})
            </button>
            <button
              type="button"
              onClick={() => setPharmacyTab("stock")}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-sm font-bold transition-all",
                pharmacyTab === "stock" ? "bg-white text-primary shadow" : "text-muted-foreground",
              )}
            >
              Avec stock ({pharmaciesWithStock.length})
            </button>
          </div>

          {loadingPharmacies ? (
            <div className="flex justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : pharmacyList.length === 0 ? (
            <div className="rounded-[30px] border border-dashed bg-slate-50 p-12 text-center text-muted-foreground">
              {pharmacyTab === "stock"
                ? selectedMed
                  ? t("search.noResults")
                  : "Sélectionnez un médicament dans l'onglet Médicaments pour voir les stocks."
                : `Aucune pharmacie de garde${!userLocation ? " — activez votre position pour affiner" : ""}`}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {pharmacyList.map((p) => renderPharmacyCard(p, pharmacyTab === "garde"))}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
