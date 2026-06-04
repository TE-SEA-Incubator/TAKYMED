import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  UserPlus, 
  CheckCircle, 
  Users, 
  Plus, 
  Search, 
  Phone, 
  User, 
  ClipboardList,
  Loader2,
  ArrowRight,
  Calendar,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Logo from "@/components/Logo1";

interface Client {
  id: number;
  phone: string;
  name: string;
  isValid: boolean;
  createdAt: string;
  prescriptionCount: number;
  reminderCount: number;
}

interface CommercialSummary {
  totalClients: number;
  validClients: number;
  pendingClients: number;
  totalPrescriptions: number;
  totalReminders: number;
  activeReminders?: number;
  overdueReminders?: number;
}

export default function CommercialDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [summary, setSummary] = useState<CommercialSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, [user?.id]);

  const fetchClients = async () => {
    if (!user?.id) return;
    try {
      const headers = { "x-user-id": user.id.toString() };
      const [clientsRes, statsRes] = await Promise.all([
        fetch(`/api/commercial/clients?commercialId=${user.id}`, { headers }),
        fetch(`/api/commercial/stats?commercialId=${user.id}`, { headers }),
      ]);
      if (!clientsRes.ok) {
        const err = await clientsRes.json().catch(() => ({}));
        throw new Error(err.error || `Erreur chargement clients (${clientsRes.status})`);
      }
      const data = await clientsRes.json();
      setClients(Array.isArray(data.clients) ? data.clients : []);
      if (statsRes.ok) {
        setSummary(await statsRes.json());
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Impossible de charger la liste des clients");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameClient = async (id: number, currentName: string) => {
    const newName = prompt("Nouveau nom pour ce client :", currentName)?.trim();
    if (!newName || newName === currentName || !user?.id) return;

    try {
      const res = await fetch(`/api/commercial/clients/${id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": user.id.toString()
        },
        body: JSON.stringify({ commercialId: user.id, name: newName })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur de modification");
      }
      toast.success("Client renommé avec succès");
      fetchClients();
    } catch (error: any) {
      toast.error(error.message || "Échec de la modification");
    }
  };
  
  const handleDeleteClient = async (id: number, name: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le client ${name} ? cette action est irreversible.`)) return;
    
    try {
      const res = await fetch(`/api/commercial/clients/${id}?commercialId=${user?.id}`, {
        method: "DELETE",
        headers: { "x-user-id": user?.id.toString() || "" }
      });
      if (!res.ok) throw new Error("Erreur de suppression");
      toast.success("Client supprimé avec succès");
      fetchClients();
    } catch (error) {
      toast.error("Échec de la suppression");
    }
  };

  if (!user || user.type !== 'commercial') {
     return <div className="p-10 text-center">Accès non autorisé</div>;
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl animate-in fade-in duration-700">
        
        {/* Header Section */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32" />
          <div className="relative z-10 flex items-center gap-5 w-full md:w-auto">
            <Logo size="small" badge />
            <div>
              <h1 className="text-3xl font-black tracking-tighter">Tableau de bord <span className="text-primary font-bold">Commercial</span></h1>
              <p className="text-muted-foreground font-medium">Gestion et validation de vos clients</p>
            </div>
          </div>
          <div className="flex gap-4 relative z-10 w-full md:w-auto">
            <Button onClick={() => navigate('/commercial/register')} className="flex-1 md:flex-none rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20">
              <UserPlus className="w-5 h-5 mr-2" />
              Inscrire un Client
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content: Client List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Vos Clients Enregistrés
              </h2>
              <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
                {clients.length} Total
              </span>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
              </div>
            ) : clients.length === 0 ? (
              <div className="bg-white rounded-[2.5rem] border p-12 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <UserPlus className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Aucun client trouvé</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">Commencez par inscrire votre premier client pour le voir apparaître ici.</p>
                <Button onClick={() => navigate('/commercial/register')} variant="link" className="text-primary font-bold">Inscrire un client maintenant</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {clients.map(client => (
                  <div key={client.id} className="bg-white p-5 rounded-3xl border shadow-sm flex items-center justify-between hover:border-primary/30 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", client.isValid ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600")}>
                        {client.isValid ? <CheckCircle className="w-6 h-6" /> : <Loader2 className="w-6 h-6" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 group-hover:text-primary transition-colors">{client.name}</h4>
                          <button 
                            onClick={() => handleRenameClient(client.id, client.name)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Renommer"
                          >
                            <Plus className="w-3 h-3 rotate-45" /> 
                          </button>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {client.phone}
                        </p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">
                            <ClipboardList className="w-2.5 h-2.5" /> {client.prescriptionCount} ordonnance(s)
                          </span>
                          <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" /> {client.reminderCount} rappel(s)
                          </span>
                        </div>
                      </div>
                    </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <div className="flex flex-col items-end">
                          <span className={cn("text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest", client.isValid ? "bg-green-500/10 text-green-600" : "bg-orange-500/10 text-orange-600")}>
                            {client.isValid ? "Validé" : "En attente PIN"}
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-1 text-right italic">Inscrit le {new Date(client.createdAt).toLocaleDateString('fr-FR')}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* WhatsApp Button */}
                          <a 
                            href={`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour ${client.name}, je suis votre conseiller TAKYMED. Je vous contacte pour votre suivi de traitement.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-9 w-9 flex items-center justify-center rounded-xl bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all shadow-sm"
                            title="Contacter via WhatsApp"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.03c0 2.122.54 4.197 1.57 6.057L0 24l6.105-1.604a11.81 11.81 0 005.94 1.585h.005c6.634 0 12.032-5.391 12.036-12.029a11.812 11.812 0 00-3.528-8.504z"/></svg>
                          </a>
                          
                          {/* Call Button */}
                          <a 
                            href={`tel:${client.phone}`}
                            className="h-9 w-9 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            title="Appeler le client"
                          >
                            <Phone className="w-5 h-5" />
                          </a>
                        </div>
                        
                        {client.isValid && (
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={() => {
                              navigate(`/prescription?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}&clientPhone=${client.phone}`);
                            }}
                            className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 rounded-xl"
                          >
                            <Plus className="w-3 h-3 mr-1" /> New Ordonnance
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteClient(client.id, client.name)}
                          className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                          title="Supprimer le client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Stats & Global Actions */}
          <div className="space-y-6">
            {/* Stats Card */}
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl space-y-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />
               <h3 className="text-lg font-bold flex items-center gap-2">
                 <ClipboardList className="w-5 h-5 text-primary" />
                 Récapitulatif Global
               </h3>
               <div className="grid grid-cols-1 gap-6">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400 text-sm font-medium">Clients total</p>
                    <p className="text-xl font-black">{summary?.totalClients ?? clients.length}</p>
                  </div>
                  <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                    <p className="text-slate-400 text-sm font-medium">Clients validés</p>
                    <p className="text-xl font-black text-green-400">{summary?.validClients ?? clients.filter(c => c.isValid).length}</p>
                  </div>
                  <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                    <p className="text-slate-400 text-sm font-medium">En attente de PIN</p>
                    <p className="text-xl font-black text-orange-400">{summary?.pendingClients ?? clients.filter(c => !c.isValid).length}</p>
                  </div>
                  <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                    <p className="text-slate-400 text-sm font-medium">Ordonnances créées</p>
                    <p className="text-xl font-black text-blue-400">{summary?.totalPrescriptions ?? clients.reduce((acc, c) => acc + (c.prescriptionCount || 0), 0)}</p>
                  </div>
                  <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                    <p className="text-slate-400 text-sm font-medium">Rappels planifiés</p>
                    <p className="text-xl font-black text-purple-400">{summary?.totalReminders ?? clients.reduce((acc, c) => acc + (c.reminderCount || 0), 0)}</p>
                  </div>
                  <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                    <p className="text-slate-400 text-sm font-medium">Rappels actifs</p>
                    <p className="text-xl font-black text-amber-400">{summary?.activeReminders ?? summary?.totalReminders ?? 0}</p>
                  </div>
                  <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                    <p className="text-slate-400 text-sm font-medium">En retard</p>
                    <p className="text-xl font-black text-red-400">{summary?.overdueReminders ?? 0}</p>
                  </div>
               </div>
            </div>

            <Card className="rounded-[2.5rem] border-primary/10 shadow-xl overflow-hidden bg-white/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2 italic">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  Note Commerciale
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed">
                Chaque ordonnance créée pour un client lié sera automatiquement ajoutée à son calendrier de prises. Les patients recevront des rappels SMS/WhatsApp selon vos configurations.
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
