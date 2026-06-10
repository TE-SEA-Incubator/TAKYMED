import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Calendar, User, Pill, CheckCircle2, Clock, XCircle, Loader2, ChevronDown, ChevronUp, Pencil, Trash2, Bell, Plus, Minus, Save, X, RefreshCw, RotateCcw, Phone, ArrowRight, Crown, Check, Shield, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/app/PageShell";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { EmptyState } from "@/components/app/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Medicament {
  id: number;
  medicament: string;
  dose: string | number;
  type_frequence: string;
  intervalle_heures: number | null;
  duree_jours: number;
}

interface Rappel {
  id: number;
  medicament: string;
  dose: string;
  heure_prevue: string;
  statut_prise: boolean;
}

interface Ordonnance {
  id: number;
  titre: string;
  nom_patient: string;
  poids_patient: number | null;
  categorie_age: string;
  date_ordonnance: string;
  est_active: boolean;
  nombre_medicaments: number;
  prises_totales: number;
  prises_effectuees: number;
  medicaments?: Medicament[];
  rappels?: Rappel[];
}

export default function Ordonnances() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Ordonnance>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
  // Medicament editing state
  const [editingMedId, setEditingMedId] = useState<number | null>(null);
  const [editMedForm, setEditMedForm] = useState<Partial<Medicament>>({});
  const [showAddMedDialog, setShowAddMedDialog] = useState(false);
  const [newMedForm, setNewMedForm] = useState({
    medicamentName: "",
    dose: 1,
    type_frequence: "1x",
    intervalle_heures: null as number | null,
    duree_jours: 1,
    times: ["08:00"]
  });
  
  // Rappel editing state
  const [editingRappelId, setEditingRappelId] = useState<number | null>(null);
  const [editRappelForm, setEditRappelForm] = useState<{ heure_prevue: string }>({ heure_prevue: "" });

  useEffect(() => {
    fetchOrdonnances();
  }, [user]);

  const authHeaders = (extra: Record<string, string> = {}) => ({
    "Content-Type": "application/json",
    ...(user?.id ? { "x-user-id": String(user.id) } : {}),
    ...extra,
  });

  async function fetchOrdonnances() {
    if (!user) return;
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setOrdonnances(data.ordonnances || []);
      }
    } catch (error) {
      console.error("Failed to fetch ordonnances:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrdonnanceDetails(id: number) {
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances/${id}`);
      if (res.ok) {
        const data = await res.json();
        // Update the ordonnance in the list with details
        setOrdonnances(prev => prev.map(o => 
          o.id === id ? { ...o, medicaments: data.medicaments, rappels: data.rappels } : o
        ));
      }
    } catch (error) {
      console.error("Failed to fetch details:", error);
    }
  }

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchOrdonnanceDetails(id);
    }
  };

  const startEdit = (ord: Ordonnance) => {
    setEditingId(ord.id);
    setEditForm({
      titre: ord.titre,
      nom_patient: ord.nom_patient,
      poids_patient: ord.poids_patient,
      categorie_age: ord.categorie_age
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id: number) => {
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        toast.success("Ordonnance modifiée avec succès");
        // Update local state directly to avoid full refresh
        setOrdonnances(prev => prev.map(o =>
          o.id === id ? { ...o, ...editForm } : o
        ));
        setEditingId(null);
        setEditForm({});
      } else {
        toast.error("Erreur lors de la modification");
      }
    } catch (error) {
      toast.error("Erreur lors de la modification");
    }
  };

  const cancelOrdonnance = async (id: number) => {
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances/${id}/cancel`, {
        method: "PATCH"
      });
      if (res.ok) {
        toast.success("Ordonnance annulée");
        fetchOrdonnances();
      } else {
        toast.error("Erreur lors de l'annulation");
      }
    } catch (error) {
      toast.error("Erreur lors de l'annulation");
    }
  };

  const reactivateOrdonnance = async (id: number) => {
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances/${id}/reactivate`, {
        method: "PATCH"
      });
      if (res.ok) {
        toast.success("Ordonnance réactivée");
        fetchOrdonnances();
      } else {
        let errorMessage = "Erreur lors de la réactivation";
        try {
          const data = await res.json();
          if (data?.error) {
            errorMessage = data.error;
          }
        } catch {
          // Keep fallback message if response body is not JSON.
        }
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error("Erreur lors de la réactivation");
    }
  };

  const deleteOrdonnance = async (id: number) => {
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        toast.success("Ordonnance supprimée définitivement");
        setOrdonnances(prev => prev.filter(o => o.id !== id));
        setShowDeleteDialog(false);
        setDeleteId(null);
      } else {
        toast.error("Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  // Medicament functions
  const startEditMed = (med: Medicament) => {
    setEditingMedId(med.id);
    setEditMedForm({
      dose: med.dose,
      type_frequence: med.type_frequence,
      intervalle_heures: med.intervalle_heures,
      duree_jours: med.duree_jours
    });
  };

  const saveEditMed = async (ordonnanceId: number, medId: number) => {
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances/${ordonnanceId}/medicaments/${medId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(editMedForm)
      });
      if (res.ok) {
        toast.success("Médicament mis à jour");
        fetchOrdonnanceDetails(ordonnanceId);
        setEditingMedId(null);
        setEditMedForm({});
      } else {
        toast.error("Erreur lors de la mise à jour");
      }
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const deleteMedicament = async (ordonnanceId: number, medId: number) => {
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances/${ordonnanceId}/medicaments/${medId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast.success("Médicament supprimé");
        fetchOrdonnanceDetails(ordonnanceId);
      } else {
        toast.error("Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const addMedicament = async (ordonnanceId: number) => {
    if (!newMedForm.medicamentName) {
      toast.error("Le nom du médicament est requis");
      return;
    }
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances/${ordonnanceId}/medicaments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(newMedForm)
      });
      if (res.ok) {
        toast.success("Médicament ajouté");
        fetchOrdonnanceDetails(ordonnanceId);
        setShowAddMedDialog(false);
        setNewMedForm({
          medicamentName: "",
          dose: 1,
          type_frequence: "1x",
          intervalle_heures: null,
          duree_jours: 1,
          times: ["08:00"]
        });
      } else {
        toast.error("Erreur lors de l'ajout");
      }
    } catch (error) {
      toast.error("Erreur lors de l'ajout");
    }
  };

  // Rappel functions
  const updateRappelTime = async (rappelId: number, heure_prevue: string, ordonnanceId: number) => {
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances/prises/${rappelId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ heure_prevue: new Date(heure_prevue).toISOString() })
      });
      if (res.ok) {
        toast.success("Rappel mis à jour");
        fetchOrdonnanceDetails(ordonnanceId);
        setEditingRappelId(null);
      } else {
        toast.error("Erreur lors de la mise à jour");
      }
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const togglePriseStatus = async (rappelId: number, currentStatus: boolean, ordonnanceId: number) => {
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances/prises/${rappelId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ statut_prise: !currentStatus })
      });
      if (res.ok) {
        fetchOrdonnanceDetails(ordonnanceId);
      } else {
        toast.error("Erreur lors de la mise à jour");
      }
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const markAllPrisesTaken = async (ordonnanceId: number) => {
    try {
      const res = await fetch(`https://dev.takymed.com/api/ordonnances/${ordonnanceId}/prises/mark-all-taken`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({})
      });
      if (res.ok) {
        toast.success("Toutes les prises marquées comme effectuées");
        fetchOrdonnanceDetails(ordonnanceId);
      } else {
        toast.error("Erreur lors de la mise à jour");
      }
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const delayRappel = async (rappelId: number, ordonnanceId: number) => {
    try {
      const res = await fetch(`https://dev.takymed.com/api/prescriptions/doses/${rappelId}/delay`, { method: "POST" });
      if (res.ok) {
        toast.success("Prise reportée de 1 heure");
        fetchOrdonnanceDetails(ordonnanceId);
        fetchOrdonnances();
      } else {
        toast.error("Erreur lors du report");
      }
    } catch {
      toast.error("Erreur lors du report");
    }
  };

  const getStatusBadge = (ordonnance: Ordonnance) => {
    if (!ordonnance.est_active) {
      return <Badge className="bg-slate-500 text-white">Annulée</Badge>;
    }
    if (ordonnance.prises_effectuees >= ordonnance.prises_totales && ordonnance.prises_totales > 0) {
      return <Badge className="bg-green-500 text-white">Terminée</Badge>;
    }
    return <Badge className="bg-primary text-white">En cours</Badge>;
  };

  const getProgressPercentage = (ordonnance: Ordonnance) => {
    if (ordonnance.prises_totales === 0) return 0;
    return Math.round((ordonnance.prises_effectuees / ordonnance.prises_totales) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        badge="Gestion des ordonnances"
        title="Mes ordonnances"
        subtitle="Consultez, modifiez et suivez vos rappels de prise médicamenteuse."
        actions={
          <Button className="h-12 rounded-2xl px-6 font-bold" onClick={() => navigate("/prescription")}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau rappel
          </Button>
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total" value={ordonnances.length} icon={FileText} tone="primary" />
        <StatCard
          label="Terminées"
          value={ordonnances.filter((o) => o.prises_effectuees >= o.prises_totales && o.est_active && o.prises_totales > 0).length}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="En cours"
          value={ordonnances.filter((o) => (o.prises_effectuees < o.prises_totales || o.prises_totales === 0) && o.est_active).length}
          icon={Clock}
          tone="warning"
        />
      </div>

        {/* Ordonnances List */}
        {ordonnances.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aucune ordonnance"
            description="Créez votre premier rappel de prise pour commencer le suivi."
            action={
              <Button className="rounded-2xl font-bold" onClick={() => navigate("/prescription")}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau rappel
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {ordonnances.map((ord) => (
              <Card key={ord.id} className={cn(
                "border-0 shadow-md transition-all hover:shadow-lg",
                !ord.est_active && "opacity-60"
              )}>
                <CardContent className="p-6">
                  {/* Header Row */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 cursor-pointer" onClick={() => toggleExpand(ord.id)}>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-slate-800">{ord.titre || `Ordonnance #${ord.id}`}</h3>
                        {getStatusBadge(ord)}
                        {expandedId === ord.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                       <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <User className="w-4 h-4 text-primary" />
                          {ord.nom_patient}
                        </span>
                        
                        {(ord as any).phone && (
                          <div className="flex items-center gap-2">
                             <a 
                               href={`https://wa.me/${(ord as any).phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour ${ord.nom_patient}, je vous contacte via TAKYMED concernant votre ordonnance "${ord.titre}".`)}`}
                               target="_blank"
                               rel="noopener noreferrer"
                               onClick={(e) => e.stopPropagation()}
                               className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all shadow-sm flex items-center gap-1 text-[10px] font-bold"
                             >
                               <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                 <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.03c0 2.122.54 4.197 1.57 6.057L0 24l6.105-1.604a11.81 11.81 0 005.94 1.585h.005c6.634 0 12.032-5.391 12.036-12.029a11.812 11.812 0 00-3.528-8.504z"/></svg>
                               WhatsApp
                             </a>
                             <a 
                               href={`tel:${(ord as any).phone}`}
                               onClick={(e) => e.stopPropagation()}
                               className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-1 text-[10px] font-bold"
                             >
                               <Phone className="w-3 h-3" />
                               Appel
                             </a>
                          </div>
                        )}

                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {new Date(ord.date_ordonnance).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Pill className="w-4 h-4" />
                          {ord.nombre_medicaments} médicament(s)
                        </span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500 text-xs">Progression</span>
                        <span className="font-bold text-primary">{getProgressPercentage(ord)}%</span>
                      </div>
                      <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          style={{ '--progress-width': `${getProgressPercentage(ord)}%` } as React.CSSProperties}
                          className={cn(
                            "h-full rounded-full transition-all w-[var(--progress-width)]",
                            getProgressPercentage(ord) === 100 ? "bg-green-500" : "bg-primary"
                          )}
                        />
                      </div>
                      <span className="text-xs text-slate-400">
                        {ord.prises_effectuees} / {ord.prises_totales} prises
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-xl"
                      onClick={() => startEdit(ord)}
                      disabled={!ord.est_active}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Modifier
                    </Button>
                    {ord.est_active ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setDeleteId(ord.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Annuler
                      </Button>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-xl text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => reactivateOrdonnance(ord.id)}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Réactiver
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setDeleteId(ord.id);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Supprimer
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {expandedId === ord.id && (
                    <div className="mt-6 pt-6 border-t space-y-6">
                      {/* Edit Form */}
                      {editingId === ord.id ? (
                        <div className="bg-slate-50 p-4 rounded-xl space-y-4">
                          <h4 className="font-bold text-slate-700">Modifier l'ordonnance</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-slate-600">Titre</label>
                              <Input 
                                value={editForm.titre || ''} 
                                onChange={(e) => setEditForm(prev => ({ ...prev, titre: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-600">Nom du patient</label>
                              <Input 
                                value={editForm.nom_patient || ''} 
                                onChange={(e) => setEditForm(prev => ({ ...prev, nom_patient: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-600">Poids (kg)</label>
                              <Input 
                                type="number"
                                value={editForm.poids_patient || ''} 
                                onChange={(e) => setEditForm(prev => ({ ...prev, poids_patient: parseFloat(e.target.value) || null }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-600">Catégorie d'âge</label>
                              <Input 
                                value={editForm.categorie_age || ''} 
                                onChange={(e) => setEditForm(prev => ({ ...prev, categorie_age: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="rounded-xl" onClick={() => saveEdit(ord.id)}>
                              <Save className="w-4 h-4 mr-1" />
                              Enregistrer
                            </Button>
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={cancelEdit}>
                              <X className="w-4 h-4 mr-1" />
                              Annuler
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {/* Medicaments List */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-slate-700 flex items-center gap-2">
                            <Pill className="w-5 h-5 text-primary" />
                            Médicaments
                          </h4>
                          {ord.est_active && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="rounded-xl"
                              onClick={() => setShowAddMedDialog(true)}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Ajouter
                            </Button>
                          )}
                        </div>
                        {ord.medicaments && ord.medicaments.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {ord.medicaments.map((med) => (
                              <div key={med.id} className="bg-white p-4 rounded-xl border">
                                {editingMedId === med.id ? (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <Label className="text-xs">Dose</Label>
                                        <Input 
                                          type="number"
                                          value={editMedForm.dose || ''} 
                                          onChange={(e) => setEditMedForm(prev => ({ ...prev, dose: parseInt(e.target.value) || 1 }))}
                                          className="h-8"
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs">Durée (jours)</Label>
                                        <Input 
                                          type="number"
                                          value={editMedForm.duree_jours || ''} 
                                          onChange={(e) => setEditMedForm(prev => ({ ...prev, duree_jours: parseInt(e.target.value) || 1 }))}
                                          className="h-8"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <Label className="text-xs">Fréquence</Label>
                                      <select
                                        title="Sélectionner la fréquence"
                                        className="w-full h-8 rounded-lg border bg-slate-50 px-2 text-sm"
                                        value={editMedForm.type_frequence || '1x'}
                                        onChange={(e) => setEditMedForm(prev => ({ 
                                          ...prev, 
                                          type_frequence: e.target.value,
                                          intervalle_heures: e.target.value === 'interval' ? 8 : null
                                        }))}
                                      >
                                        <option value="1x">1x / jour</option>
                                        <option value="2x">2x / jour</option>
                                        <option value="3x">3x / jour</option>
                                        <option value="interval">Intervalle</option>
                                        <option value="prn">Si besoin</option>
                                      </select>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button size="sm" className="rounded-lg h-7 text-xs" onClick={() => saveEditMed(ord.id, med.id)}>
                                        <Save className="w-3 h-3 mr-1" />
                                        Sauver
                                      </Button>
                                      <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs" onClick={() => setEditingMedId(null)}>
                                        <X className="w-3 h-3 mr-1" />
                                        Annuler
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-start justify-between">
                                      <p className="font-bold text-slate-800">{med.medicament}</p>
                                      {ord.est_active && (
                                        <div className="flex gap-1">
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6"
                                            onClick={() => startEditMed(med)}
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 text-red-500 hover:text-red-700"
                                            onClick={() => deleteMedicament(ord.id, med.id)}
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-sm text-slate-500">Dose: {med.dose}</p>
                                    <p className="text-sm text-slate-500">Fréquence: {med.type_frequence}</p>
                                    <p className="text-sm text-slate-500">Durée: {med.duree_jours} jours</p>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-sm">Chargement des médicaments...</p>
                        )}
                      </div>

                      {/* Rappels List */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-slate-700 flex items-center gap-2">
                            <Bell className="w-5 h-5 text-primary" />
                            Rappels
                          </h4>
                          {ord.est_active && ord.rappels && ord.rappels.some(r => !r.statut_prise) && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="rounded-xl text-green-600"
                              onClick={() => markAllPrisesTaken(ord.id)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Tout marquer pris
                            </Button>
                          )}
                        </div>
                        {ord.rappels && ord.rappels.length > 0 ? (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {ord.rappels.slice(0, 20).map((rappel) => (
                              <div key={rappel.id} className={cn(
                                "flex items-center justify-between bg-white p-3 rounded-xl border",
                                rappel.statut_prise && "bg-green-50 border-green-200"
                              )}>
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={rappel.statut_prise}
                                    onCheckedChange={() => togglePriseStatus(rappel.id, rappel.statut_prise, ord.id)}
                                    className="rounded-full h-5 w-5"
                                  />
                                  <div>
                                    <p className={cn(
                                      "font-medium text-slate-800",
                                      rappel.statut_prise && "line-through text-slate-400"
                                    )}>{rappel.medicament}</p>
                                    <p className="text-xs text-slate-500">Dose: {rappel.dose}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {editingRappelId === rappel.id ? (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="datetime-local"
                                        value={editRappelForm.heure_prevue}
                                        onChange={(e) => setEditRappelForm({ heure_prevue: e.target.value })}
                                        className="h-8 w-40"
                                      />
                                      <Button 
                                        size="sm" 
                                        className="h-7"
                                        onClick={() => updateRappelTime(rappel.id, editRappelForm.heure_prevue, ord.id)}
                                      >
                                        <Save className="w-3 h-3" />
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-7"
                                        onClick={() => setEditingRappelId(null)}
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="text-right cursor-pointer hover:bg-slate-50 p-1 rounded"
                                        onClick={() => {
                                          setEditingRappelId(rappel.id);
                                          const d = new Date(rappel.heure_prevue);
                                          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                          setEditRappelForm({ heure_prevue: local });
                                        }}
                                      >
                                        <p className="text-sm font-medium text-slate-700">
                                          {new Date(rappel.heure_prevue).toLocaleDateString('fr-FR')}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {new Date(rappel.heure_prevue).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      </div>
                                      {ord.est_active && !rappel.statut_prise && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs rounded-lg"
                                          onClick={() => delayRappel(rappel.id, ord.id)}
                                        >
                                          +1h
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {ord.rappels.every(r => r.statut_prise) && (
                              <p className="text-green-600 text-sm font-medium text-center py-2">
                                ✓ Toutes les prises ont été effectuées
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-sm">Chargement des rappels...</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Gérer l'ordonnance</DialogTitle>
            <DialogDescription>Choisissez l'action à effectuer</DialogDescription>
          </DialogHeader>
          <p className="text-slate-500">Que souhaitez-vous faire avec cette ordonnance ?</p>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button 
              variant="outline" 
              className="rounded-xl w-full sm:w-auto text-amber-600"
              onClick={() => {
                if (deleteId) {
                  cancelOrdonnance(deleteId);
                  setShowDeleteDialog(false);
                  setDeleteId(null);
                }
              }}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Désactiver
            </Button>
            <Button 
              variant="destructive" 
              className="rounded-xl w-full sm:w-auto"
              onClick={() => {
                if (deleteId) {
                  deleteOrdonnance(deleteId);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Medicament Dialog */}
      <Dialog open={showAddMedDialog} onOpenChange={setShowAddMedDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un médicament</DialogTitle>
            <DialogDescription>Ajouter un nouveau médicament à cette ordonnance</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nom du médicament</Label>
              <Input 
                value={newMedForm.medicamentName}
                onChange={(e) => setNewMedForm(prev => ({ ...prev, medicamentName: e.target.value }))}
                placeholder="Ex: Paracétamol"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dose</Label>
                <Input 
                  type="number"
                  value={newMedForm.dose}
                  onChange={(e) => setNewMedForm(prev => ({ ...prev, dose: parseInt(e.target.value) || 1 }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Durée (jours)</Label>
                <Input 
                  type="number"
                  value={newMedForm.duree_jours}
                  onChange={(e) => setNewMedForm(prev => ({ ...prev, duree_jours: parseInt(e.target.value) || 1 }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Fréquence</Label>
              <select
                title="Choisir la fréquence du nouveau médicament"
                className="w-full h-10 rounded-xl border bg-slate-50 px-3 mt-1"
                value={newMedForm.type_frequence}
                onChange={(e) => setNewMedForm(prev => ({ 
                  ...prev, 
                  type_frequence: e.target.value,
                  intervalle_heures: e.target.value === 'interval' ? 8 : null,
                  times: e.target.value === '1x' ? ['08:00'] 
                    : e.target.value === '2x' ? ['08:00', '20:00']
                    : e.target.value === '3x' ? ['08:00', '14:00', '20:00']
                    : ['08:00']
                }))}
              >
                <option value="1x">1x / jour</option>
                <option value="2x">2x / jour</option>
                <option value="3x">3x / jour</option>
                <option value="interval">Intervalle (6h, 8h, 12h)</option>
                <option value="prn">Si besoin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowAddMedDialog(false)}>
              Annuler
            </Button>
            <Button 
              className="rounded-xl"
              onClick={() => {
                if (expandedId) addMedicament(expandedId);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
