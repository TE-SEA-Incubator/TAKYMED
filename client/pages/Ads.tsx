import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Pill,
  Info,
  Calendar,
  Stethoscope,
  TrendingUp,
  Star,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  Plus,
  Megaphone,
  Clock3,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface NewMed {
  id: number;
  name: string;
  description: string;
  price: string;
  photoUrl: string;
  dateAdded?: string;
}

export default function Ads() {
  const { user } = useAuth();
  const [newMedications, setNewMedications] = useState<NewMed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNewMeds() {
      try {
        const res = await fetch("/api/medications?new=true");
        if (res.ok) {
          const data = await res.json();
          setNewMedications(data.medications);
        }
      } catch (err) {
        console.error("Failed to fetch new meds:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchNewMeds();
  }, []);

  const monthSummary = useMemo(() => {
    const count = newMedications.length;
    return {
      newProducts: count,
      promotedProducts: count,
      avgPrice: count > 0
        ? `${Math.round(newMedications.reduce((acc, item) => acc + (parseFloat(item.price || "0") || 0), 0) / count)} FCFA`
        : "-",
    };
  }, [newMedications]);

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] pb-20">
      <div className="mx-auto px-4 py-12 max-w-[1600px]">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest gap-2">
            <Sparkles className="w-4 h-4 animate-pulse" />
            Publicités santé — nouveautés du mois
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Espace publicitaire TAKYMED</h1>
          <p className="text-muted-foreground max-w-3xl mx-auto text-lg leading-relaxed">
            Les encarts publicitaires de gauche et droite diffusent automatiquement les nouveaux médicaments du mois.
            Chaque publicité reste affichée <strong>30 secondes</strong> avant rotation.
          </p>
        </div>

        <div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20">
            {newMedications.map((med) => (
              <div key={med.id} className="group relative bg-white rounded-[40px] border shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col">
                <div className="h-64 overflow-hidden relative">
                  {med.photoUrl ? (
                    <img
                      src={med.photoUrl}
                      alt={med.name}
                      className="w-full h-full object-contain p-4 transition-transform duration-700 group-hover:scale-110 bg-white"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#006093] to-[#00A859] flex flex-col items-center justify-center transition-transform duration-700 group-hover:scale-110 text-white">
                      <Pill className="w-20 h-20 mb-2 opacity-80" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="bg-primary text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      Nouveau
                    </span>
                  </div>
                  <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl font-bold text-primary shadow-lg border border-white/20">
                    {med.price || "Contactez-nous"}
                  </div>
                </div>
                <div className="p-8 flex-1 flex flex-col space-y-4">
                  <h3 className="text-2xl font-extrabold group-hover:text-primary transition-colors">{med.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-grow">
                    {med.description || "Nouvelle spécialité disponible ce mois-ci."}
                  </p>
                  <div className="pt-6 mt-6 border-t border-slate-50 flex items-center justify-between">
                    <Link to={`/search?q=${med.name}`}>
                      <Button variant="ghost" className="rounded-xl h-10 hover:bg-slate-50 font-bold group-hover:text-primary">
                        Détails
                        <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </Link>
                    <Link to="/prescription">
                      <Button className="rounded-xl h-10 font-bold shadow-lg shadow-primary/10">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Suivre
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {!loading && newMedications.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[40px] border border-dashed">
                <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">Aucune nouveauté à présenter ce mois-ci.</p>
              </div>
            )}
          </div>

          {user?.type === "standard" && (
            <div className="relative rounded-[50px] bg-primary overflow-hidden p-12 lg:p-20 text-white shadow-2xl shadow-primary/20">
              <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
                <Stethoscope className="w-full h-full rotate-12" />
              </div>
              <div className="relative z-10 max-w-2xl space-y-8 text-center lg:text-left">
                <div className="flex items-center gap-3 justify-center lg:justify-start">
                  <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-md">
                    <Star className="w-6 h-6 fill-white" />
                  </div>
                  <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
                    Optimisez votre traitement avec TAKYMED Pro
                  </h2>
                </div>
                <p className="text-xl text-primary-foreground leading-relaxed opacity-90">
                  Accédez à des rapports détaillés, une assistance prioritaire et des notifications illimitées par SMS et WhatsApp.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                  <Link to="/register">
                    <Button size="lg" className="h-16 px-8 rounded-2xl bg-white text-primary hover:bg-slate-100 font-extrabold text-lg shadow-xl shadow-black/20 group">
                      Passer au compte Pro
                      <ArrowUpRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <StatItem label="Nouveaux Produits" value={monthSummary.newProducts.toString()} icon={<Plus className="w-4 h-4" />} />
            <StatItem label="Publicités actives" value={monthSummary.promotedProducts.toString()} icon={<Megaphone className="w-4 h-4" />} />
            <StatItem label="Prix moyen" value={monthSummary.avgPrice} icon={<TrendingUp className="w-4 h-4" />} />
            <StatItem label="Rotation pub" value="30 secondes" icon={<Clock3 className="w-4 h-4" />} />
          </div>
        </div>

      </div>
    </div>
  );
}

function StatItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-2 group hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest">
        <div className="p-1 bg-slate-50 rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          {icon}
        </div>
        {label}
      </div>
      <div className="text-3xl font-black text-foreground group-hover:text-primary transition-colors tracking-tight">{value}</div>
    </div>
  );
}
