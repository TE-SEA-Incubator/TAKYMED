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
  Stethoscope,
  Plus,
  Bookmark,
  ChevronRight,
  Filter,
  MapPin,
  Navigation,
  Store,
  CheckCircle2,
  Clock
} from "lucide-react";
import { cn, resolveMedicationPhotoUrl } from "@/lib/utils";
import { toast } from "sonner";

const MOCK_MEDICATIONS = [
  { id: 1, name: "Doliprane 1000", type: "comprimé", description: "Paracétamol, indiqué en cas de douleur et/ou fièvre.", mode: "orale", moment: "indifferent", precautions: "aucune" },
  { id: 2, name: "Amoxicilline 500", type: "gelule", description: "Antibiotique de la famille des pénicillines.", mode: "orale", moment: "pendant_repas", precautions: "aucune" },
  { id: 3, name: "Ventoline", type: "spray", description: "Traitement de fond de l'asthme.", mode: "inhalation", moment: "indifferent", precautions: "aucune" },
  { id: 4, name: "Spasfon", type: "comprimé", description: "Traitement des douleurs spasmodiques.", mode: "orale", moment: "avant_repas", precautions: "aucune" },
  { id: 5, name: "Maxilase", type: "sirop", description: "Indiqué en cas d'oedèmes de la gorge.", mode: "orale", moment: "apres_repas", precautions: "aucune" },
  { id: 6, name: "Gaviscon", type: "sirop", description: "Remontées acides et brûlures d'estomac.", mode: "orale", moment: "apres_repas", precautions: "aucune" },
];

const MOCK_PHARMACIES = [
  { id: 1, name: "Pharmacie de la Paix", address: "Bonapriso, Douala", phone: "+237 6001", distance: 1.2, stocks: [1, 2, 4] },
  { id: 2, name: "Pharmacie Saint Jean", address: "Akwa, Douala", phone: "+237 6002", distance: 3.5, stocks: [1, 3, 5] },
  { id: 3, name: "Pharmacie du Littoral", address: "Deido, Douala", phone: "+237 6003", distance: 0.8, stocks: [2, 3, 6] },
];

export default function SearchMedications() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [medications, setMedications] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [selectedMed, setSelectedMed] = useState<any | null>(null);
  const [pharmaciesWithStock, setPharmaciesWithStock] = useState<any[]>([]);
  const [pharmaciesOnDuty, setPharmaciesOnDuty] = useState<any[]>([]);
  const [pharmacyTab, setPharmacyTab] = useState<"stock" | "garde">("stock");
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

  // Fetch pharmacies when a medication is selected (stock + garde)
  useEffect(() => {
    if (!selectedMed) {
      setPharmaciesWithStock([]);
      setPharmaciesOnDuty([]);
      return;
    }

    async function fetchPharmacies() {
      let url = `/api/pharmacies/nearby?medId=${selectedMed.id}`;
      if (userLocation) {
        url += `&lat=${userLocation.lat}&lng=${userLocation.lng}`;
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
      }
    }

    fetchPharmacies();
  }, [selectedMed, userLocation]);

  const handleGetLocation = () => {
    setIsFindingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(coords);
          setIsFindingLocation(false);
          toast.success("Position récupérée !");
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

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] pb-20">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">{t('search.title')}</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Trouvez les informations et vérifiez la disponibilité dans les pharmacies les plus proches.
          </p>
        </div>

        <div className="max-w-6xl mx-auto space-y-12">
          {/* Search & Location Row */}
          <div className="flex flex-col md:flex-row gap-4 items-center group">
            <div className="relative flex-1 w-full flex items-center bg-white border rounded-[30px] p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <Search className="ml-4 h-6 w-6 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.searchPlaceholder')}
                className="border-none text-xl h-14 focus-visible:ring-0 bg-transparent rounded-none"
              />
              {loading && (
                <div className="mr-4 animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              )}
            </div>
            <Button
              onClick={handleGetLocation}
              disabled={isFindingLocation}
              variant="outline"
              className="h-16 px-8 rounded-[30px] font-bold gap-2 border-primary/20 hover:bg-primary/5 text-primary"
            >
              <Navigation className={cn("w-5 h-5", isFindingLocation && "animate-spin")} />
              {userLocation ? `Position ok${locationCity ? ` · ${locationCity}` : ""}` : "Pharmacies à proximité"}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Results List */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between px-2 text-sm text-muted-foreground mb-2">
                <span>{medications.length} médicaments trouvés</span>
              </div>
              <div className="space-y-3">
                {medications.map(m => {
                  const photoSrc = resolveMedicationPhotoUrl(m.photoUrl);
                  return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMed(m)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-3xl border bg-white transition-all text-left hover:border-primary/50",
                      selectedMed?.id === m.id ? "border-primary ring-4 ring-primary/5 bg-primary/5" : "border-slate-100"
                    )}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center transition-colors",
                      selectedMed?.id === m.id ? "ring-2 ring-primary" : "bg-slate-100"
                    )}>
                      {photoSrc ? (
                        <img
                          src={photoSrc}
                          alt={m.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div className={cn(
                        "w-full h-full flex items-center justify-center",
                        selectedMed?.id === m.id ? "bg-primary text-white" : "bg-slate-100 text-slate-400",
                        photoSrc ? "hidden" : ""
                      )}>
                        <Pill className="w-6 h-6" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{m.name}</h3>
                      <p className="text-xs text-muted-foreground uppercase">{m.type || "médicament"}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>
                  );
                })}
                {query && medications.length === 0 && !loading && (
                  <div className="space-y-4 py-4">
                    <p className="text-center text-muted-foreground">Aucun médicament trouvé dans la base.</p>
                    {!aiResult && (
                      <Button
                        onClick={searchWithAI}
                        disabled={aiLoading}
                        className="w-full rounded-2xl h-12 font-bold bg-violet-600 hover:bg-violet-700"
                      >
                        {aiLoading ? "Recherche IA..." : "Rechercher avec l'IA"}
                      </Button>
                    )}
                    {aiResult && (
                      <div className="bg-violet-50 border border-violet-100 rounded-3xl p-6 space-y-3 text-left">
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold uppercase">
                          Résultat IA
                        </div>
                        <h3 className="text-xl font-bold">{aiResult.name}</h3>
                        <p className="text-sm text-muted-foreground">{aiResult.description}</p>
                        {aiResult.dosage && <p className="text-sm"><span className="font-bold">Dosage :</span> {aiResult.dosage}</p>}
                        {aiResult.precautions && <p className="text-sm"><span className="font-bold">Précautions :</span> {aiResult.precautions}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Detail View & Availability */}
            <div className="lg:col-span-8 space-y-8">
              {selectedMed ? (
                <>
                  {/* Med Info Card */}
                  <div className="bg-white rounded-[40px] border shadow-sm p-8 space-y-8 animate-in slide-in-from-right-4 duration-500">
                    {resolveMedicationPhotoUrl(selectedMed.photoUrl) && (
                      <div className="w-full h-52 rounded-3xl overflow-hidden bg-slate-100">
                        <img
                          src={resolveMedicationPhotoUrl(selectedMed.photoUrl)!}
                          alt={selectedMed.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).parentElement!.classList.add("hidden");
                          }}
                        />
                      </div>
                    )}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-2">
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                          {selectedMed.type || "médicament"}
                        </div>
                        <h2 className="text-4xl font-extrabold text-foreground">{selectedMed.name}</h2>
                        <div className="text-2xl font-bold text-primary">
                          {selectedMed.price ? `${selectedMed.price}` : "Prix non défini"}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className={cn("rounded-2xl h-12 w-12 border-slate-200 transition-colors", bookmarks.includes(selectedMed.id) && "bg-amber-50 border-amber-200 text-amber-500")}
                          onClick={() => toggleBookmark(selectedMed.id)}
                        >
                          <Bookmark className={cn("w-5 h-5", bookmarks.includes(selectedMed.id) && "fill-current")} />
                        </Button>
                        <Button
                          className="rounded-2xl h-12 px-6 font-bold bg-primary shadow-lg shadow-primary/20"
                          onClick={handleAddToTreatment}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Ajouter au traitement
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary font-bold">
                          <Info className="w-5 h-5" />
                          <span>Description</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          {selectedMed.description || "Aucune description disponible pour ce médicament."}
                        </p>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-amber-600 font-bold">
                          <AlertTriangle className="w-5 h-5" />
                          <span>Précautions & Incompatibilités</span>
                        </div>
                        <div className="space-y-3">
                          {((selectedMed.precautions && selectedMed.precautions !== 'aucune') || (!relevantInteractions.length)) && (
                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-sm text-amber-800">
                              <span className="font-bold opacity-60 block mb-1">RECOMMANDATIONS :</span>
                              {selectedMed.precautions && selectedMed.precautions !== 'aucune' 
                                ? selectedMed.precautions 
                                : "Aucune précaution spécifique enregistrée."
                              }
                              <div className="mt-2 font-bold opacity-80">
                                {selectedMed.mode && `Mode: ${selectedMed.mode}`}
                                {selectedMed.moment && selectedMed.moment !== 'indifferent' && ` • Moment: ${selectedMed.moment}`}
                              </div>
                            </div>
                          )}

                          {relevantInteractions.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-xs font-bold text-destructive uppercase tracking-wider ml-1">Incompatibilités détectées :</span>
                              {relevantInteractions.map((inter, idx) => {
                                const otherMed = inter.med1Name.toLowerCase() === selectedMed.name.toLowerCase() ? inter.med2Name : inter.med1Name;
                                return (
                                  <div key={idx} className={cn(
                                    "p-4 rounded-2xl border flex gap-3",
                                    inter.riskLevel === 'critique' ? "bg-red-50 border-red-100 text-red-900" :
                                    inter.riskLevel === 'eleve' ? "bg-orange-50 border-orange-100 text-orange-900" :
                                    "bg-amber-50 border-amber-100 text-amber-900"
                                  )}>
                                    <AlertTriangle className="w-5 h-5 shrink-0" />
                                    <div>
                                      <p className="font-bold">Ne pas mélanger avec : {otherMed}</p>
                                      <p className="text-xs opacity-80 mt-1">{inter.description}</p>
                                      <div className={cn(
                                        "inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                        inter.riskLevel === 'critique' ? "bg-red-600 text-white" : 
                                        inter.riskLevel === 'eleve' ? "bg-orange-500 text-white" : "bg-amber-500 text-white"
                                      )}>
                                        Risque {inter.riskLevel}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Availability Card */}
                  <div className="bg-white rounded-[40px] border shadow-sm p-8 space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <h3 className="text-2xl font-bold flex items-center gap-3">
                        <Store className="w-6 h-6 text-primary" />
                        Pharmacies proches
                      </h3>
                      <div className="flex bg-slate-100 p-1 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setPharmacyTab("stock")}
                          className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                            pharmacyTab === "stock" ? "bg-white shadow text-primary" : "text-muted-foreground"
                          )}
                        >
                          Avec stock ({pharmaciesWithStock.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPharmacyTab("garde")}
                          className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                            pharmacyTab === "garde" ? "bg-white shadow text-amber-600" : "text-muted-foreground"
                          )}
                        >
                          De garde ({pharmaciesOnDuty.length})
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(pharmacyTab === "stock" ? pharmaciesWithStock : pharmaciesOnDuty).map((p: any) => (
                        <div key={p.id} className={cn(
                          "p-6 rounded-3xl border space-y-4 hover:border-primary/50 transition-all",
                          pharmacyTab === "garde" ? "border-amber-100 bg-amber-50/50" : "border-slate-100 bg-slate-50"
                        )}>
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {pharmacyTab === "garde" && (
                                  <span className="text-[10px] font-black uppercase bg-amber-500 text-white px-2 py-0.5 rounded-md">De garde</span>
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
                            {pharmacyTab === "stock" ? (
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
                              <a href={`tel:${p.phone?.replace(/\s+/g, '')}`}>
                                {p.phone || "Appeler"}
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(pharmacyTab === "stock" ? pharmaciesWithStock : pharmaciesOnDuty).length === 0 && (
                        <div className="md:col-span-2 p-12 text-center text-muted-foreground bg-slate-50 rounded-[30px] border border-dashed">
                          {pharmacyTab === "stock"
                            ? t('search.noResults')
                            : `Aucune pharmacie de garde${!userLocation ? " — activez votre position" : ""}`}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-[500px] bg-white rounded-[40px] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-12 space-y-4 opacity-50">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                    <Pill className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-600">Sélectionnez un médicament</p>
                    <p className="text-sm text-slate-400">Pour voir sa description et ses stocks en pharmacie.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
