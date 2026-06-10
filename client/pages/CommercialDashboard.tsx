import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UserPlus,
  CheckCircle,
  Users,
  Plus,
  PlusCircle,
  Search,
  Phone,
  ClipboardList,
  Loader2,
  ArrowRight,
  Calendar,
  Trash2,
  Pencil,
  Bell,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/app/PageShell";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";

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
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchClients();
  }, [user?.id]);

  const fetchClients = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const headers = { "x-user-id": user.id.toString() };
      const [clientsRes, statsRes] = await Promise.all([
        fetch(`http://dev.takymed.com/api/commercial/clients?commercialId=${user.id}`, { headers }),
        fetch(`http://dev.takymed.com/api/commercial/stats?commercialId=${user.id}`, { headers }),
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
    } catch (error: unknown) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Impossible de charger la liste des clients",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")),
    );
  }, [clients, searchQuery]);

  const handleRenameClient = async (id: number, currentName: string) => {
    const newName = prompt("Nouveau nom pour ce client :", currentName)?.trim();
    if (!newName || newName === currentName || !user?.id) return;

    try {
      const res = await fetch(`http://dev.takymed.com/api/commercial/clients/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id.toString(),
        },
        body: JSON.stringify({ commercialId: user.id, name: newName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur de modification");
      }
      toast.success("Client renommé avec succès");
      fetchClients();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Échec de la modification");
    }
  };

  const handleDeleteClient = async (id: number, name: string) => {
    if (
      !confirm(
        `Supprimer le client ${name} ? Cette action est irréversible et supprimera ses ordonnances.`,
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`http://dev.takymed.com/api/commercial/clients/${id}?commercialId=${user?.id}`, {
        method: "DELETE",
        headers: { "x-user-id": user?.id.toString() || "" },
      });
      if (!res.ok) throw new Error("Erreur de suppression");
      toast.success("Client supprimé");
      fetchClients();
    } catch {
      toast.error("Échec de la suppression");
    }
  };

  if (!user || user.type !== "commercial") {
    return (
      <PageShell maxWidth="md">
        <EmptyState
          icon={AlertCircle}
          title="Accès réservé"
          description="Cet espace est réservé aux comptes commerciaux TAKYMED."
        />
      </PageShell>
    );
  }

  const totalClients = summary?.totalClients ?? clients.length;
  const validClients = summary?.validClients ?? clients.filter((c) => c.isValid).length;
  const pendingClients = summary?.pendingClients ?? clients.filter((c) => !c.isValid).length;

  return (
    <PageShell>
      <PageHeader
        showLogo
        badge="Espace commercial"
        title={
          <>
            Tableau de bord{" "}
            <span className="text-primary">Commercial</span>
          </>
        }
        subtitle="Inscrivez vos clients, créez leurs rappels et suivez l'observance en temps réel."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => navigate("/prescription")}
              className="h-12 rounded-2xl px-6 font-bold"
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              Mon rappel personnel
            </Button>
            <Button
              onClick={() => navigate("/commercial/register")}
              className="h-12 rounded-2xl px-6 font-bold shadow-lg shadow-primary/20"
            >
              <UserPlus className="mr-2 h-5 w-5" />
              Inscrire un client
            </Button>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Clients" value={totalClients} icon={Users} tone="primary" />
        <StatCard label="Validés" value={validClients} icon={CheckCircle} tone="success" />
        <StatCard
          label="En attente PIN"
          value={pendingClients}
          icon={Loader2}
          tone="warning"
        />
        <StatCard
          label="Rappels actifs"
          value={summary?.activeReminders ?? summary?.totalReminders ?? 0}
          icon={Bell}
          tone="default"
          hint={`${summary?.overdueReminders ?? 0} en retard`}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Users className="h-5 w-5 text-primary" />
                Vos clients
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredClients.length} résultat{filteredClients.length > 1 ? "s" : ""}
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher nom ou téléphone…"
                className="h-11 rounded-2xl border-white/80 bg-white/90 pl-10 shadow-sm"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
            </div>
          ) : filteredClients.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title={searchQuery ? "Aucun résultat" : "Aucun client"}
              description={
                searchQuery
                  ? "Essayez un autre nom ou numéro de téléphone."
                  : "Inscrivez votre premier client pour commencer le suivi des traitements."
              }
              action={
                !searchQuery ? (
                  <Button
                    onClick={() => navigate("/commercial/register")}
                    className="rounded-2xl font-bold"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Inscrire un client
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredClients.map((client) => (
                <article
                  key={client.id}
                  className="group rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                          client.isValid
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-amber-100 text-amber-600",
                        )}
                      >
                        {client.isValid ? (
                          <CheckCircle className="h-6 w-6" />
                        ) : (
                          <Loader2 className="h-6 w-6" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-bold text-slate-900 group-hover:text-primary">
                            {client.name}
                          </h3>
                          <StatusBadge
                            label={client.isValid ? "Validé" : "En attente PIN"}
                            tone={client.isValid ? "success" : "warning"}
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameClient(client.id, client.name)}
                            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-primary"
                            title="Renommer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {client.phone}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                            <ClipboardList className="h-3 w-3" />
                            {client.prescriptionCount} ordonnance
                            {client.prescriptionCount > 1 ? "s" : ""}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700">
                            <Calendar className="h-3 w-3" />
                            {client.reminderCount} rappel
                            {client.reminderCount > 1 ? "s" : ""}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Inscrit le{" "}
                            {new Date(client.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <a
                        href={`https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour ${client.name}, je suis votre conseiller TAKYMED.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-all hover:bg-emerald-600 hover:text-white"
                        title="WhatsApp"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.03c0 2.122.54 4.197 1.57 6.057L0 24l6.105-1.604a11.81 11.81 0 005.94 1.585h.005c6.634 0 12.032-5.391 12.036-12.029a11.812 11.812 0 00-3.528-8.504z" />
                        </svg>
                      </a>
                      <a
                        href={`tel:${client.phone}`}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-all hover:bg-blue-600 hover:text-white"
                        title="Appeler"
                      >
                        <Phone className="h-5 w-5" />
                      </a>
                      {client.isValid && (
                        <Button
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/prescription?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}&clientPhone=${client.phone}`,
                            )
                          }
                          className="h-10 rounded-xl px-4 text-xs font-bold"
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Nouvelle ordonnance
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClient(client.id, client.name)}
                        className="h-10 w-10 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-[2rem] bg-slate-900 p-6 text-white shadow-2xl md:p-8">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold">
              <ClipboardList className="h-5 w-5 text-primary" />
              Récapitulatif
            </h3>
            <div className="space-y-4">
              {[
                ["Ordonnances créées", summary?.totalPrescriptions ?? clients.reduce((a, c) => a + c.prescriptionCount, 0), "text-blue-400"],
                ["Rappels planifiés", summary?.totalReminders ?? clients.reduce((a, c) => a + c.reminderCount, 0), "text-violet-400"],
                ["Rappels actifs", summary?.activeReminders ?? 0, "text-amber-400"],
                ["En retard", summary?.overdueReminders ?? 0, "text-red-400"],
              ].map(([label, value, color]) => (
                <div
                  key={label as string}
                  className="flex items-center justify-between border-t border-white/10 pt-4 first:border-0 first:pt-0"
                >
                  <span className="text-sm text-slate-400">{label}</span>
                  <span className={cn("text-xl font-black", color)}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <Card className="overflow-hidden rounded-[2rem] border-primary/10 bg-white/80 shadow-lg backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <ArrowRight className="h-4 w-4 text-primary" />
                Guide rapide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-slate-800">Mon rappel personnel</strong> — créez un
                rappel sur votre propre compte.
              </p>
              <p>
                <strong className="text-slate-800">Inscrire un client</strong> — enregistrement
                + première ordonnance + PIN de validation.
              </p>
              <p>
                <strong className="text-slate-800">Nouvelle ordonnance</strong> — disponible
                une fois le client validé (PIN confirmé).
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}
