import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus,
  Store,
  MapPin,
  Phone,
  Clock,
  Pill,
  Trash2,
  Edit3,
  AlertCircle,
  Navigation
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  phone: string;
  openTime: string;
  closeTime: string;
  est_garde: boolean;
  latitude: number | null;
  longitude: number | null;
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
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbMedications, setDbMedications] = useState<{ id: number, name: string }[]>([]);
  const [selectedPharmacyForStock, setSelectedPharmacyForStock] = useState<string | null>(null);
  const [stockUpdate, setStockUpdate] = useState({ medicationId: "", quantity: 0 });
  const [isAdding, setIsAdding] = useState(false);
  const [newPharmacy, setNewPharmacy] = useState({
    name: "",
    address: "",
    phone: "",
    openTime: "08:00",
    closeTime: "20:00"
  });
  const [initialStocks, setInitialStocks] = useState<{ id: number, quantity: number }[]>([]);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchPharmacies();
      fetchMedications();
    }
  }, [user]);

const API_BASE = "http://dev.takymed.com/api";

// ... (dans fetchPharmacies)
  const fetchPharmacies = async () => {
    try {
      const res = await fetch(`${API_BASE}/pharmacies/all`);
// ... (et ainsi de suite pour tous les autres fetch)
      if (res.ok) {
        const data = await res.json();
        setPharmacies(data.pharmacies);
      }
    } catch (err) {
      toast.error("Échec du chargement des pharmacies");
    } finally {
      setLoading(false);
    }
  };

  const fetchMedications = async () => {
    try {
      const res = await fetch('http://dev.takymed.com/api/medications');
      if (res.ok) {
        const data = await res.json();
        setDbMedications(data.medications);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPharmacyForStock || !stockUpdate.medicationId) return;

    try {
      const res = await fetch(`http://dev.takymed.com/api/pharmacies/${selectedPharmacyForStock}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stockUpdate)
      });
      if (res.ok) {
        toast.success("Stock mis à jour !");
        setSelectedPharmacyForStock(null);
        fetchPharmacies();
      }
    } catch (err) {
      toast.error("Erreur lors de la mise à jour du stock");
    }
  };

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

      const res = await fetch('http://dev.takymed.com/api/pharmacies', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success("Pharmacie ajoutée avec succès !");
        setIsAdding(false);
        setNewPharmacy({ name: "", address: "", phone: "", openTime: "08:00", closeTime: "20:00" });
        fetchPharmacies();
      }
    } catch (err) {
      toast.error("Erreur lors de la création de la pharmacie");
    }
  };

  const deletePharmacy = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette pharmacie ?")) return;
    try {
      const res = await fetch(`http://dev.takymed.com/api/pharmacies/${id}`, { method: "DELETE" });
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
        (error) => console.warn("Geolocation error:", error.message)
      );
    }
  };

  if (user?.type !== "admin") {
    return <div className="p-12 text-center">Accès réservé aux administrateurs.</div>;
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] pb-20">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-5xl font-black tracking-tighter">Gestion Officine</h1>
          <Button onClick={() => setIsAdding(true)} className="rounded-2xl h-14 px-8 font-black">
            <Plus className="w-5 h-5 mr-2" /> Ajouter
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-20">Chargement...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {pharmacies.map(p => (
              <div key={p.id} onClick={() => setSelectedPharmacy(p)} className="bg-white rounded-[40px] border shadow-sm p-8 space-y-8 hover:shadow-xl transition-all cursor-pointer">
                <h3 className="text-2xl font-black flex items-center gap-2">
                  {p.name}
                  {p.est_garde && <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase font-black">Garde</span>}
                </h3>
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                  <MapPin className="w-4 h-4 text-primary" /> {p.address}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deletePharmacy(p.id); }}><Trash2 className="w-5 h-5 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedPharmacy} onOpenChange={() => setSelectedPharmacy(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPharmacy?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-primary" /> {selectedPharmacy?.address}</p>
            <p className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-primary" /> {selectedPharmacy?.phone}</p>
            <div className="flex gap-4 pt-4">
              <Button className="flex-1" onClick={() => window.location.href = `tel:${selectedPharmacy?.phone}`}>Appeler</Button>
              <Button className="flex-1" variant="secondary" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedPharmacy?.latitude},${selectedPharmacy?.longitude}`, '_blank')}>Itinéraire</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
