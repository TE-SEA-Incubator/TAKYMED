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
  Navigation,
  Store,
  Phone,
} from "lucide-react";
import { cn, resolveMedicationPhotoUrl, formatPharmacyDistanceShort, pharmacyShortLocation } from "@/lib/utils";
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
  const [pharmaciesNearby, setPharmaciesNearby] = useState<any[]>([]);
  const [pharmaciesOnDuty, setPharmaciesOnDuty] = useState<any[]>([]);
  const [pharmacyTab, setPharmacyTab] = useState<"pharmacy" | "garde">("garde");
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
      const res = await fetch('https://dev.takymed.comhttps://dev.takymed.com/api/medications/interactions');
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
        const res = await fetch(`https://dev.takymed.com/api/medications?q=${encodeURIComponent(query)}`);
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

  // Auto-trigger AI search when no meds found
  useEffect(() => {
    if (!loading && medications.length === 0 && query.trim() && !aiResult) {
      // Initiate AI search silently
      searchWithAI();
    }
  }, [loading, medications, query]);
  const searchWithAI = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch(`https://dev.takymed.com/api/medications/ai-info?name=${encodeURIComponent(q)}`);
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
    if (data.allNearby || data.onDuty) {
      return {
        allNearby: data.allNearby ?? [],
        onDuty: data.onDuty ?? [],
        city: data.location?.city ?? null,
      };
    }
    return {
      allNearby: data.pharmacies ?? [],
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
  const fetchNearbyPharmacies = async () => {
    setLoadingPharmacies(true);
    let url = `https://dev.takymed.com/api/pharmacies/nearby?limit=80`;
    if (userLocation) {
      url += `&lat=${userLocation.lat}&lng=${userLocation.lng}`;
    }

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeNearbyPharmacies(data);
        setPharmaciesNearby(normalized.allNearby);
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

  const handleGetLocation = (silent = false) => {
    setIsFindingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(coords);
          setIsFindingLocation(false);
          if (!silent) toast.success("Position récupérée !");
          if (mainSection === "pharmacies") {
            fetchNearbyPharmacies();
          }
        },
        (error) => {
          console.warn("Geolocation error:", error.message);
          setIsFindingLocation(false);
          if (silent) return;
          if (error.code === 1) {
            toast.warning("Géolocalisation non disponible - utilisez localhost ou HTTPS");
          } else {
            toast.error("Impossible de récupérer votre position.");
          }
        }
      );
    } else {
      setIsFindingLocation(false);
      if (!silent) toast.error("Géolocalisation non supportée par votre navigateur.");
    }
  };

  useEffect(() => {
    if (mainSection !== "pharmacies") return;
    if (!userLocation && !isFindingLocation) {
      handleGetLocation(true);
      return;
    }
    fetchNearbyPharmacies();
  }, [mainSection, userLocation, pharmacyTab]);

  const filterPharmacies = (list: any[]) => {
    const q = pharmacyQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        String(p.name ?? "").toLowerCase().includes(q) ||
        String(p.address ?? "").toLowerCase().includes(q),
    );
  };

  const openPharmaciesSection = (pharmacyListTab = false) => {
    setMainSection("pharmacies");
    setPharmacyTab(pharmacyListTab ? "pharmacy" : "garde");
  };

  const pharmacyList = filterPharmacies(
    pharmacyTab === "pharmacy" ? pharmaciesNearby : pharmaciesOnDuty,
  );

  const renderGardeRow = (p: any, index: number) => {
    const phone = String(p.phone ?? "").replace(/\s+/g, "");
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => phone && (window.location.href = `tel:${phone}`)}
        className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition-colors hover:border-amber-200 hover:bg-amber-50/40"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[11px] font-black leading-tight text-amber-600">
          {p.distance != null ? formatPharmacyDistanceShort(p.distance) : index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-foreground">{p.name}</p>
          <p className="truncate text-xs text-muted-foreground">{pharmacyShortLocation(p)}</p>
        </div>
        {phone && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Phone className="h-4 w-4" />
          </span>
        )}
      </button>
    );
  };

  const renderPharmacyRow = (p: any, index: number) => {
    const phone = String(p.phone ?? "").replace(/\s+/g, "");
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => phone && (window.location.href = `tel:${phone}`)}
        className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[11px] font-black leading-tight text-primary">
          {p.distance != null ? formatPharmacyDistanceShort(p.distance) : index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-foreground">{p.name}</p>
          <p className="truncate text-xs text-muted-foreground">{pharmacyShortLocation(p)}</p>
        </div>
        {phone && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Phone className="h-4 w-4" />
          </span>
        )}
      </button>
    );
  };

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        badge="Recherche"
        title={t("search.title")}
        subtitle="Médicaments et pharmacies près de chez vous."
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
                    {aiLoading && <p className="text-center text-muted-foreground">Recherche IA...</p>}
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
                      Voir les pharmacies proches
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
        <div className="space-y-4">
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
              onClick={() => setPharmacyTab("pharmacy")}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-sm font-bold transition-all",
                pharmacyTab === "pharmacy" ? "bg-white text-primary shadow" : "text-muted-foreground",
              )}
            >
              Pharmacie ({pharmaciesNearby.length})
            </button>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm text-muted-foreground",
              pharmacyTab === "garde"
                ? "border-amber-100 bg-amber-50/50"
                : "border-primary/15 bg-primary/5",
            )}
          >
            <Navigation
              className={cn(
                "h-4 w-4 shrink-0",
                pharmacyTab === "garde" ? "text-amber-600" : "text-primary",
                isFindingLocation && "animate-spin",
              )}
            />
            <span className="flex-1">
              {isFindingLocation
                ? "Localisation en cours…"
                : userLocation
                  ? pharmacyTab === "pharmacy"
                    ? `Pharmacies de ${locationCity ?? "votre ville"} — du plus proche au plus loin`
                    : `Les plus proches${locationCity ? ` · ${locationCity}` : ""}`
                  : "Autorisez la position pour afficher les pharmacies de votre ville"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 rounded-xl font-bold"
              disabled={isFindingLocation}
              onClick={() => handleGetLocation(userLocation != null)}
            >
              {userLocation ? "Actualiser" : "Activer"}
            </Button>
          </div>

          {pharmacyTab === "pharmacy" && (
            <div className="relative flex items-center rounded-2xl border bg-white p-2 shadow-sm">
              <Search className="ml-3 h-5 w-5 text-muted-foreground" />
              <Input
                value={pharmacyQuery}
                onChange={(e) => setPharmacyQuery(e.target.value)}
                placeholder="Filtrer par nom ou adresse…"
                className="h-12 border-none bg-transparent focus-visible:ring-0"
              />
            </div>
          )}

          {loadingPharmacies ? (
            <div className="flex justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : pharmacyList.length === 0 ? (
            <div className="rounded-[30px] border border-dashed bg-slate-50 p-12 text-center text-muted-foreground">
              {pharmacyTab === "pharmacy"
                ? userLocation
                  ? `Aucune pharmacie trouvée${locationCity ? ` à ${locationCity}` : " près de vous"}.`
                  : "Autorisez la localisation pour lister les pharmacies de votre ville."
                : userLocation
                  ? "Aucune pharmacie de garde trouvée près de vous."
                  : "Autorisez la localisation pour voir les pharmacies de garde les plus proches."}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pharmacyList.map((p, i) =>
                pharmacyTab === "garde" ? renderGardeRow(p, i) : renderPharmacyRow(p, i),
              )}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
