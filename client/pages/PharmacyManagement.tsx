import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Store,
  MapPin,
  Phone,
  Clock,
  Pill,
  Trash2,
  Edit3,
  Search,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Upload, Navigation } from "lucide-react";

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  phone: string;
  openTime: string;
  closeTime: string;
  est_garde: boolean;
  stocks: { medId: number; medName: string; quantity: number }[];
}

const MAP_CONTAINER_STYLE = { width: "100%", height: "250px", borderRadius: "20px" };
const DEFAULT_CENTER = { lat: 4.0511, lng: 9.7679 }; // Douala center

export default function PharmacyManagement() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: "" // User will provide or use fallback
  });

  const { user } = useAuth();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbMedications, setDbMedications] = useState<{ id: number, name: string }[]>([]);
  const [selectedPharmacyForStock, setSelectedPharmacyForStock] = useState<string | null>(null);
  const [stockUpdate, setStockUpdate] = useState({ medicationId: "", quantity: 0 });
  const [isRegisteringMed, setIsRegisteringMed] = useState(false);
  const [newMed, setNewMed] = useState({
    name: "",
    description: "",
    price: "",
    photoUrl: "",
    typeUtilisation: "comprime"
  });

  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  // File Upload Logic
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Le fichier est trop lourd (max 2MB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMed({ ...newMed, photoUrl: reader.result as string });
        toast.success("Photo chargée !");
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchPharmacies();
      fetchMedications();
    }
  }, [user]);

  const fetchPharmacies = async () => {
    try {
      const res = await fetch(`/api/pharmacies?userId=${user?.id}`);
      if (res.ok) {
        const data = await res.json();
        // Fetch stocks for each pharmacy
        const pharmaciesWithStock = await Promise.all(data.pharmacies.map(async (p: any) => {
          const stockRes = await fetch(`/api/pharmacies/${p.id}/stock`);
          const stockData = await stockRes.json();
          return { ...p, stocks: stockData.stock.map((s: any) => ({ medId: s.medicationId, medName: s.medicationName, quantity: s.quantity })) };
        }));
        setPharmacies(pharmaciesWithStock);
      }
    } catch (err) {
      toast.error("Échec du chargement des pharmacies");
    } finally {
      setLoading(false);
    }
  };

  const fetchMedications = async () => {
    try {
      const res = await fetch('/api/medications');
      if (res.ok) {
        const data = await res.json();
        setDbMedications(data.medications);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [isAdding, setIsAdding] = useState(false);
  const [newPharmacy, setNewPharmacy] = useState({
    name: "",
    address: "",
    phone: "",
    openTime: "08:00",
    closeTime: "20:00"
  });

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPharmacyForStock || !stockUpdate.medicationId) return;

    try {
      const res = await fetch(`/api/pharmacies/${selectedPharmacyForStock}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stockUpdate)
      });
      if (res.ok) {
        toast.success("Stock mis à jour !");
        setSelectedPharmacyForStock(null);
        fetchPharmacies();
      } else {
        throw new Error();
      }
    } catch (err) {
      toast.error("Erreur lors de la mise à jour du stock");
    }
  };

  const handleRegisterMed = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/medications', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMed)
      });
      if (res.ok) {
        toast.success("Médicament enregistré avec succès !");
        setIsRegisteringMed(false);
        setNewMed({ name: "", description: "", price: "", photoUrl: "", typeUtilisation: "comprime" });
        fetchMedications();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de l'enregistrement");
      }
    } catch (err) {
      toast.error("Erreur de connexion au serveur");
    }
  };

  const [initialStocks, setInitialStocks] = useState<{ id: number, quantity: number }[]>([]);

  const handleAddPharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newPharmacy,
        userId: user?.id,
        initialMeds: initialStocks,
        latitude: selectedCoords?.lat,
        longitude: selectedCoords?.lng
      };

      const res = await fetch('/api/pharmacies', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success("Pharmacie ajoutée avec succès !");
        setIsAdding(false);
        setNewPharmacy({ name: "", address: "", phone: "", openTime: "08:00", closeTime: "20:00" });
        setInitialStocks([]);
        setSelectedCoords(null);
        fetchPharmacies();
      }
    } catch (err) {
      toast.error("Erreur lors de la création de la pharmacie");
    }
  };

  const deletePharmacy = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette pharmacie ?")) return;
    try {
      const res = await fetch(`/api/pharmacies/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchPharmacies();
        toast.info("Pharmacie supprimée.");
      }
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setSelectedCoords({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setMapCenter(coords);
          setSelectedCoords(coords);
        },
        (error) => {
          console.warn("Geolocation error:", error.message);
          if (error.code === 1) {
            console.info("Geolocation requires secure origin (HTTPS) or localhost");
          }
        }
      );
    }
  };

  if (user?.type !== "admin") {
    return (
      <div className="container mx-auto px-4 py-24 text-center animate-in fade-in duration-700">
        <div className="bg-white p-12 rounded-[40px] shadow-2xl border max-w-lg mx-auto space-y-6">
          <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center text-destructive mx-auto">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Accès réservé</h1>
          <p className="text-muted-foreground font-medium leading-relaxed">
            Seuls les administrateurs de TAKYMED peuvent gérer le réseau national de pharmacies.
          </p>
          <Button onClick={() => window.history.back()} variant="outline" className="rounded-2xl h-12 px-8 font-bold border-2">
            Retourner
          </Button>
        </div>
      </div>
    );
  }

  const totalStocks = pharmacies.reduce((acc, pharmacy) => {
    return acc + pharmacy.stocks.reduce((sAcc, stock) => sAcc + stock.quantity, 0);
  }, 0);
  const lowStockItems = pharmacies.reduce((acc, pharmacy) => {
    return acc + pharmacy.stocks.filter((stock) => stock.quantity > 0 && stock.quantity <= 5).length;
  }, 0);

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] pb-20">
      <div className="container mx-auto px-4 py-12 max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-5xl font-black tracking-tighter">Gestion Officine</h1>
            <p className="text-muted-foreground mt-2 font-medium">Gérez vos pharmacies, adresses et stocks en temps réel.</p>
          </div>
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <Button onClick={() => setIsAdding(true)} className="rounded-2xl h-14 px-8 font-black shadow-2xl shadow-primary/30 hover:scale-[1.02] transition-all">
              <Plus className="w-5 h-5 mr-2" />
              Ajouter Pharmacie
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-3xl border p-4 shadow-sm">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Pharmacies actives</p>
            <p className="text-2xl font-black">{pharmacies.length}</p>
          </div>
          <div className="bg-white rounded-3xl border p-4 shadow-sm">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Médicaments catalogue</p>
            <p className="text-2xl font-black">{dbMedications.length}</p>
          </div>
          <div className="bg-white rounded-3xl border p-4 shadow-sm">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Unités en stock</p>
            <p className="text-2xl font-black">{totalStocks}</p>
          </div>
          <div className="bg-white rounded-3xl border p-4 shadow-sm">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Stocks faibles</p>
            <p className="text-2xl font-black text-amber-600">{lowStockItems}</p>
          </div>
        </div>



        {isAdding && (
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[95vh]">
              <h2 className="text-2xl font-bold mb-4">Nouvelle Pharmacie</h2>
              <form onSubmit={handleAddPharmacy} className="space-y-4">
                <div className="space-y-2">
                  <Label>Localisation sur la carte</Label>
                  {isLoaded ? (
                    <div className="relative">
                      <GoogleMap
                        mapContainerStyle={MAP_CONTAINER_STYLE}
                        center={mapCenter}
                        zoom={13}
                        onClick={handleMapClick}
                      >
                        {selectedCoords && <Marker position={selectedCoords} />}
                      </GoogleMap>
                      <Button
                        type="button"
                        onClick={getCurrentLocation}
                        className="absolute bottom-4 right-4 h-8 w-8 p-0 rounded-full bg-white text-primary shadow-lg border hover:bg-slate-50"
                        title="Ma position"
                      >
                        <Navigation className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-[250px] bg-slate-100 rounded-[20px] flex items-center justify-center text-muted-foreground text-xs text-center p-8">
                      Chargement de la carte...<br />(Cliquez pour définir la position une fois chargée)
                    </div>
                  )}
                  {selectedCoords && (
                    <p className="text-[10px] text-green-600 font-bold">✓ Coordonnées sélectionnées : {selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Nom de la pharmacie</Label>
                  <Input
                    required
                    value={newPharmacy.name}
                    onChange={e => setNewPharmacy({ ...newPharmacy, name: e.target.value })}
                    className="rounded-xl h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adresse textuelle</Label>
                  <Input
                    required
                    value={newPharmacy.address}
                    onChange={e => setNewPharmacy({ ...newPharmacy, address: e.target.value })}
                    className="rounded-xl h-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input
                      required
                      size={15}
                      value={newPharmacy.phone}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === "" || /^[0-9+]+$/.test(val)) {
                          setNewPharmacy({ ...newPharmacy, phone: val });
                        }
                      }}
                      className="rounded-xl h-10 w-auto min-w-[15ch]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horaires</Label>
                    <div className="flex gap-2">
                      <Input type="time" value={newPharmacy.openTime} onChange={e => setNewPharmacy({ ...newPharmacy, openTime: e.target.value })} className="rounded-xl h-10 px-1 text-xs" />
                      <Input type="time" value={newPharmacy.closeTime} onChange={e => setNewPharmacy({ ...newPharmacy, closeTime: e.target.value })} className="rounded-xl h-10 px-1 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <Pill className="w-4 h-4 text-primary" />
                    Initialiser le stock (Optionnel)
                  </Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto p-4 bg-slate-50 rounded-2xl border">
                    {dbMedications.map(med => (
                      <div key={med.id} className="flex items-center gap-4">
                        <span className="text-xs font-medium flex-1 truncate">{med.name}</span>
                        <Input
                          type="number"
                          placeholder="0"
                          className="w-16 h-8 text-xs rounded-lg"
                          onChange={(e) => {
                            const qty = parseInt(e.target.value);
                            if (qty > 0) {
                              setInitialStocks(prev => {
                                const existing = prev.find(s => s.id === med.id);
                                if (existing) return prev.map(s => s.id === med.id ? { ...s, quantity: qty } : s);
                                return [...prev, { id: med.id, quantity: qty }];
                              });
                            } else {
                              setInitialStocks(prev => prev.filter(s => s.id !== med.id));
                            }
                          }}
                        />
                      </div>
                    ))}
                    {dbMedications.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center">Aucun médicament enregistré.</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAdding(false)} className="flex-1 rounded-xl">Annuler</Button>
                  <Button type="submit" className="flex-1 rounded-xl">Enregistrer</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {pharmacies.map(p => (
              <div key={p.id} className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8 space-y-8 hover:shadow-2xl hover:shadow-primary/5 transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="bg-primary/10 p-5 rounded-[2rem] text-primary group-hover:scale-110 transition-transform bg-primary/5">
                      <Store className="w-8 h-8 font-black" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        {p.name}
                        {p.est_garde && (
                          <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Garde</span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mt-1">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        {p.address}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-muted-foreground hover:bg-slate-100"><Edit3 className="w-5 h-5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deletePharmacy(p.id)} className="rounded-xl h-10 w-10 text-destructive hover:bg-destructive/10"><Trash2 className="w-5 h-5" /></Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 relative z-10">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Téléphone</div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      {p.phone}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Horaires</div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {p.openTime} - {p.closeTime}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-lg flex items-center gap-2 tracking-tight">
                      <Pill className="w-5 h-5 text-primary" />
                      Stocks Réels
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl h-9 px-4 text-xs font-bold border-2 hover:bg-slate-50 transition-all"
                      onClick={() => setSelectedPharmacyForStock(p.id)}
                    >
                      Mettre à jour
                    </Button>
                  </div>

                  {selectedPharmacyForStock === p.id && (
                    <form onSubmit={handleUpdateStock} className="bg-slate-50 p-6 rounded-[2.5rem] border-2 border-primary/20 space-y-5 animate-in slide-in-from-top-4 duration-300">
                      <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Médicament</Label>
                          <select
                            title="Sélectionner le médicament"
                            className="w-full bg-white border rounded-xl h-11 px-3 text-sm outline-none font-bold focus:ring-2 ring-primary/20"
                            value={stockUpdate.medicationId}
                            onChange={e => setStockUpdate({ ...stockUpdate, medicationId: e.target.value })}
                            required
                          >
                            <option value="">Choisir...</option>
                            {dbMedications.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Quantité</Label>
                          <Input
                            type="number"
                            className="rounded-xl h-11 font-bold"
                            value={stockUpdate.quantity}
                            onChange={e => setStockUpdate({ ...stockUpdate, quantity: parseInt(e.target.value) })}
                            required
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button type="button" variant="ghost" className="flex-1 h-11 rounded-xl font-bold" onClick={() => setSelectedPharmacyForStock(null)}>Annuler</Button>
                        <Button type="submit" className="flex-1 h-11 rounded-xl font-black shadow-lg shadow-primary/20">Enregistrer</Button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {p.stocks.map(s => (
                      <div key={s.medId} className="flex justify-between items-center text-sm p-4 bg-white border border-slate-100 rounded-2xl group/item hover:border-primary/30 transition-all">
                        <span className="font-black text-slate-700 tracking-tight">{s.medName}</span>
                        <div className={cn(
                          "px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-tighter shadow-sm",
                          s.quantity > 10 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {s.quantity} unités
                        </div>
                      </div>
                    ))}
                    {p.stocks.length === 0 && (
                      <div className="text-center py-8 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                        <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                        <p className="text-xs text-muted-foreground font-bold">Aucun stock répertorié</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {pharmacies.length === 0 && (
              <div className="col-span-full py-32 text-center bg-white rounded-[40px] border-2 border-dashed border-slate-200">
                <Store className="w-20 h-20 text-muted-foreground mx-auto mb-6 opacity-20" />
                <h3 className="text-xl font-black text-slate-800">Aucune pharmacie enregistrée</h3>
                <p className="text-muted-foreground font-medium mt-2 mb-8">Commencez par ajouter votre première officine pour gérer vos stocks.</p>
                <Button onClick={() => setIsAdding(true)} className="rounded-2xl h-14 px-10 font-black shadow-2xl shadow-primary/30">
                  Ajouter ma première pharmacie
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
