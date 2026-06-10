import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Users,
    Pill,
    Activity,
    Briefcase,
    Shield,
    Plus,
    Edit2,
    Trash2,
    Check,
    X,
    Upload,
    Download,
    FileText,
    ArrowRightLeft,
    Loader2,
    UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminHeroCard, AdminStatCard, DistributionChart, ActivityChart } from "@/components/AdminComponents";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoImg from "@/components/images/takymed.png";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";

const TEAL = "#006093";
const EMERALD = "#00A859";

// Local African avatars from public/avatars folder are now used based on account type

interface AdminStats {
    users: number;
    prescriptions: number;
    medications: number;
    pharmacies: number;
    upgradeRequests?: number;
    recentActivity: { id: number | string; type: string; message: string; time: string }[];
}

interface UserRecord {
    id: number;
    email: string;
    phone: string;
    type: string;
    name: string;
    pin?: string;
    pinExpiresAt?: string;
    pinUpdatedAt?: string;
    protected?: boolean;
}

interface AdminPharmacy {
    id: number;
    name: string;
    address: string;
    phone: string;
    stockCount: number;
    ownerName: string;
}

interface AdminMedication {
    id: number;
    name: string;
    defaultDose: number;
    unitId: number | null;
    description?: string;
    photoUrl?: string;
    price?: string;
    typeUtilisation?: string;
    precautionAlimentaire?: string;
    posology?: {
        categorieAge: "bébé" | "enfant" | "adulte";
        doseRecommandee: number;
        unitId?: number;
    };
    isManualUpload?: boolean;
}

interface AccountTypeSetting {
    id: number;
    name: string;
    description: string;
    price: number;
    maxOrdonnances: number | null;
    maxRappels: number | null;
}

interface MonthlyActivityPoint {
    name: string;
    prescriptions: number;
    inscriptions: number;
    medications?: number;
    pharmacies?: number;
}

export default function AdminDashboard() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();
    const navigate = useNavigate();

    const getActiveTab = () => {
        const path = location.pathname;
        if (path.includes("clients")) return "users";
        if (path.includes("catalogue")) return "meds";
        if (path.includes("abonnements") || path.includes("settings")) return "settings";
        if (path.includes("pharmacies")) return "pharmacies";
        if (path.includes("categories")) return "categories";
        if (path.includes("requests")) return "requests";
        if (path.includes("analytics")) return "analytics";
        if (path.includes("commercials")) return "commercials";
        return "analytics"; // Default for /admin
    };

    const handleTabChange = (value: string) => {
        if (value === "users") navigate("/admin/clients");
        else if (value === "meds") navigate("/admin/catalogue");
        else if (value === "settings") navigate("/admin/settings");
        else if (value === "pharmacies") navigate("/admin/pharmacies");
        else if (value === "categories") navigate("/admin/categories");
        else if (value === "requests") navigate("/admin/requests");
        else if (value === "analytics") navigate("/admin");
        else if (value === "commercials") navigate("/admin/commercials");
    };

    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [pharmacies, setPharmacies] = useState<AdminPharmacy[]>([]);
    const [medications, setMedications] = useState<AdminMedication[]>([]);
    const [settings, setSettings] = useState<AccountTypeSetting[]>([]);
    const [categories, setCategories] = useState<{ id: number, name: string, description: string, considerWeight: boolean }[]>([]);
    const [upgradeRequests, setUpgradeRequests] = useState<any[]>([]);
    const [commercials, setCommercials] = useState<any[]>([]);
    const [unassignedClients, setUnassignedClients] = useState<any[]>([]);
    const [monthlyActivity, setMonthlyActivity] = useState<MonthlyActivityPoint[]>([]);
    const [loading, setLoading] = useState(true);

    const [isAddCatOpen, setIsAddCatOpen] = useState(false);
    const [newCat, setNewCat] = useState({ name: "", description: "", considerWeight: false });
    const [editingCat, setEditingCat] = useState<{ id: number, name: string, description: string, considerWeight: boolean } | null>(null);

    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [newUser, setNewUser] = useState({ name: "", email: "", phone: "", password: "", type: "standard" });
    const [changingTypeUserId, setChangingTypeUserId] = useState<number | null>(null);
    const [selectedTypeId, setSelectedTypeId] = useState<number>(1);
    const [isChangeTypeOpen, setIsChangeTypeOpen] = useState(false);

    const [isEditUserOpen, setIsEditUserOpen] = useState(false);
    const [clientToEdit, setClientToEdit] = useState<{ id: number; phone: string; name: string; protected?: boolean } | null>(null);

    const [selectedCommercial, setSelectedCommercial] = useState<any | null>(null);
    const [commercialClients, setCommercialClients] = useState<any[]>([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [isClientsDialogOpen, setIsClientsDialogOpen] = useState(false);
    const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
    const [clientToReassign, setClientToReassign] = useState<any | null>(null);

    const [isAddMedOpen, setIsAddMedOpen] = useState(false);
    const [newMed, setNewMed] = useState<Partial<AdminMedication>>({
        name: "",
        unitId: 1,
        defaultDose: 1,
        description: "",
        photoUrl: "",
        price: "",
        typeUtilisation: "comprime",
        precautionAlimentaire: "aucune",
        posology: {
            categorieAge: "adulte",
            doseRecommandee: 1,
            unitId: 1,
        },
        isManualUpload: false,
    });
    const [editingMed, setEditingMed] = useState<AdminMedication | null>(null);

    const newMedFileInputRef = useRef<HTMLInputElement>(null);
    const editMedFileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (
        file: File | undefined,
        apply: (dataUrl: string) => void,
    ) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Veuillez sélectionner un fichier image valide");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image trop volumineuse (max 2MB)");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            apply(reader.result as string);
            toast.success("Image chargée depuis votre appareil");
        };
        reader.readAsDataURL(file);
    };

    const handleDeleteAllMeds = async () => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer TOUS les médicaments du catalogue ? Cette action est irréversible.")) {
            return;
        }

        try {
            const res = await fetch("https://dev.takymed.com:3500/api/admin/medications/all", { 
                method: "DELETE",
                headers: { "x-user-id": user?.id?.toString() || "" }
            });
            if (res.ok) {
                toast.success("Tous les médicaments ont été supprimés.");
                refreshData();
            } else {
                toast.error("Erreur lors de la suppression.");
            }
        } catch (error) {
            toast.error("Erreur réseau.");
        }
    };

    const refreshData = async () => {
        if (!user?.id) return;

        const headers = { "x-user-id": user.id.toString() };

        try {
            const [
                statsRes,
                usersRes,
                medsRes,
                settingsRes,
                pharmRes,
                catRes,
                upgradeRes,
                monthlyActivityRes,
                commRes,
                unassignedRes,
            ] = await Promise.all([
                fetch("https://dev.takymed.com:3500/api/admin/stats", { headers }),
                fetch("https://dev.takymed.com:3500/api/admin/users", { headers }),
                fetch("https://dev.takymed.com:3500/api/admin/medications", { headers }),
                fetch("https://dev.takymed.com:3500/api/admin/settings", { headers }),
                fetch("https://dev.takymed.com:3500/api/admin/pharmacies", { headers }),
                fetch("https://dev.takymed.com:3500/api/categories", { headers }),
                fetch("https://dev.takymed.com:3500/api/admin/upgrade-requests", { headers }),
                fetch("https://dev.takymed.com:3500/api/admin/monthly-activity", { headers }),
                fetch("https://dev.takymed.com:3500/api/admin/commercials", { headers }),
                fetch("https://dev.takymed.com:3500/api/admin/unassigned-clients", { headers }),
            ]);

            if (statsRes.ok && usersRes.ok && medsRes.ok && settingsRes.ok && pharmRes.ok && catRes.ok) {
                setStats(await statsRes.json());

                const uData = await usersRes.json();
                setUsers(uData.users);

                const mData = await medsRes.json();
                setMedications(mData.medications);

                const sData = await settingsRes.json();
                setSettings(sData.types);

                const pData = await pharmRes.json();
                setPharmacies(pData.pharmacies);

                const cData = await catRes.json();
                setCategories(cData.categories);

                if (upgradeRes.ok) {
                    const urData = await upgradeRes.json();
                    setUpgradeRequests(urData.requests || []);
                }

                if (monthlyActivityRes.ok) {
                    const maData = await monthlyActivityRes.json();
                    setMonthlyActivity(Array.isArray(maData) ? maData : []);
                }

                if (commRes.ok) {
                    const commData = await commRes.json();
                    setCommercials(commData.commercials);
                }

                if (unassignedRes.ok) {
                    const unassignedData = await unassignedRes.json();
                    setUnassignedClients(unassignedData.clients);
                }
            } else {
                toast.error("Impossible de charger toutes les données admin");
            }
        } catch (err) {
            console.error(err);
            toast.error("Erreur de synchronisation");
        }
    };

    useEffect(() => {
        if (!user?.id) return;
        refreshData().finally(() => setLoading(false));
    }, [user?.id]);

    const handleDeleteUser = async (id: number) => {
        const target = users.find((u) => u.id === id);
        if (target?.protected) {
            toast.error("Le compte administrateur système par défaut ne peut pas être supprimé.");
            return;
        }
        if (!confirm("Supprimer cet utilisateur ?")) return;
        const res = await fetch(`/api/admin/users/${id}`, { 
            method: 'DELETE',
            headers: { "x-user-id": user?.id?.toString() || "" }
        });
        if (res.ok) { toast.success("Utilisateur supprimé"); refreshData(); }
        else {
            const data = await res.json().catch(() => null);
            toast.error(data?.error || "Erreur lors de la suppression");
        }
    };

    const handleAddUser = async () => {
        if (!newUser.phone && !newUser.email) {
            toast.error("Veuillez fournir un email ou un téléphone");
            return;
        }
        if (!newUser.password) {
            toast.error("Veuillez fournir un mot de passe");
            return;
        }
        const res = await fetch("https://dev.takymed.com:3500/api/admin/users", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-id': user?.id?.toString() || ""
            },
            body: JSON.stringify(newUser)
        });
        if (res.ok) {
            toast.success("Utilisateur créé avec succès");
            setNewUser({ name: "", email: "", phone: "", password: "", type: "standard" });
            setIsAddUserOpen(false);
            refreshData();
        } else {
            const data = await res.json().catch(() => null);
            toast.error(data?.error || "Erreur lors de la création");
        }
    };

    const handleChangeUserType = async () => {
        if (!changingTypeUserId) return;
        const res = await fetch(`/api/admin/users/${changingTypeUserId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-id': user?.id?.toString() || ""
            },
            body: JSON.stringify({ id_type_compte: selectedTypeId })
        });
        if (res.ok) {
            toast.success("Type de compte modifié avec succès");
            setIsChangeTypeOpen(false);
            setChangingTypeUserId(null);
            refreshData();
        } else {
            const data = await res.json().catch(() => null);
            toast.error(data?.error || "Erreur lors de la modification");
        }
    };

    const openChangeTypeDialog = (userId: number, currentType: string) => {
        const target = users.find((u) => u.id === userId);
        if (target?.protected) {
            toast.error("Le type du compte administrateur système par défaut ne peut pas être modifié.");
            return;
        }
        const typeMap: Record<string, number> = {
            'Standard': 1,
            'Professionnel': 2,
            'Commercial': 3,
            'Administrateur': 4,
        };
        setChangingTypeUserId(userId);
        setSelectedTypeId(typeMap[currentType] || 1);
        setIsChangeTypeOpen(true);
    };

    const handleAddMed = async () => {
        // Clean up the payload to only include valid fields with proper defaults
        const payload = {
            name: newMed.name || "",
            unitId: newMed.unitId ?? 1,
            defaultDose: newMed.defaultDose ?? 1,
            description: newMed.description || "",
            photoUrl: newMed.photoUrl || "",
            price: newMed.price || "",
            typeUtilisation: newMed.typeUtilisation || "comprime",
            precautionAlimentaire: newMed.precautionAlimentaire || "aucune",
            posology: newMed.posology ? {
                categorieAge: newMed.posology.categorieAge || "adulte",
                doseRecommandee: newMed.posology.doseRecommandee ?? 1,
                unitId: newMed.posology.unitId ?? (newMed.unitId || 1),
            } : undefined,
        };

        // Validate required fields
        if (!payload.name || payload.name.trim().length < 2) {
            toast.error("Le nom du médicament doit avoir au moins 2 caractères");
            return;
        }

        const res = await fetch("https://dev.takymed.com:3500/api/admin/medications", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-id': user?.id?.toString() || ""
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            toast.success("Médicament ajouté");
            setIsAddMedOpen(false);
            setNewMed({
                name: "",
                unitId: 1,
                defaultDose: 1,
                description: "",
                photoUrl: "",
                price: "",
                typeUtilisation: "comprime",
                precautionAlimentaire: "aucune",
                posology: { categorieAge: "adulte", doseRecommandee: 1, unitId: 1 },
                isManualUpload: false,
            });
            if (newMedFileInputRef.current) newMedFileInputRef.current.value = "";
            refreshData();
        } else {
            const errorData = await res.json().catch(() => null);
            toast.error(errorData?.error || "Erreur d'ajout");
        }
    };

    const handleUpdateMed = async () => {
        if (!editingMed) return;

        // Clean up the payload to only include valid fields with proper defaults
        const payload = {
            name: editingMed.name || "",
            unitId: editingMed.unitId ?? 1,
            defaultDose: editingMed.defaultDose ?? 1,
            description: editingMed.description || "",
            photoUrl: editingMed.photoUrl || "",
            price: editingMed.price || "",
            typeUtilisation: editingMed.typeUtilisation || "comprime",
            precautionAlimentaire: editingMed.precautionAlimentaire || "aucune",
            posology: editingMed.posology ? {
                categorieAge: editingMed.posology.categorieAge || "adulte",
                doseRecommandee: editingMed.posology.doseRecommandee ?? 1,
                unitId: editingMed.posology.unitId ?? (editingMed.unitId || 1),
            } : undefined,
        };

        // Validate required fields
        if (!payload.name || payload.name.trim().length < 2) {
            toast.error("Le nom du médicament doit avoir au moins 2 caractères");
            return;
        }

        const res = await fetch(`/api/admin/medications/${editingMed.id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-id': user?.id?.toString() || ""
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            toast.success("Mis à jour");
            setEditingMed(null);
            if (editMedFileInputRef.current) editMedFileInputRef.current.value = "";
            refreshData();
        } else {
            const errorData = await res.json().catch(() => null);
            toast.error(errorData?.error || "Erreur de mise à jour");
        }
    };

    const handleDeleteMed = async (id: number) => {
        if (!confirm("Retirer ce médicament ?")) return;
        const res = await fetch(`/api/admin/medications/${id}`, { 
            method: 'DELETE',
            headers: { "x-user-id": user?.id?.toString() || "" }
        });
        if (res.ok) { toast.success("Médicament supprimé"); refreshData(); }
        else toast.error("Erreur de suppression");
    };

    const handleUpdateSetting = async (id: number, price: number, description: string, maxOrdonnances: number | null, maxRappels: number | null) => {
        const res = await fetch(`/api/admin/settings/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-id': user?.id?.toString() || ""
            },
            body: JSON.stringify({ price, description, maxOrdonnances, maxRappels })
        });
        if (res.ok) { toast.success("Paramètres mis à jour"); refreshData(); }
        else toast.error("Erreur de sauvegarde");
    };

    const handleAddCat = async () => {
        if (!newCat.name.trim()) return toast.error("Le nom est requis");
        const res = await fetch("https://dev.takymed.com:3500/api/categories", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCat)
        });
        if (res.ok) {
            toast.success("Catégorie ajoutée");
            setNewCat({ name: "", description: "", considerWeight: false });
            setIsAddCatOpen(false);
            refreshData();
        } else {
            const data = await res.json().catch(() => null);
            toast.error(data?.error || "Erreur lors de l'ajout");
        }
    };

    const handleUpdateCat = async () => {
        if (!editingCat || !editingCat.name.trim()) return;
        const res = await fetch(`/api/categories/${editingCat.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingCat)
        });
        if (res.ok) {
            toast.success("Catégorie modifiée");
            setEditingCat(null);
            refreshData();
        } else {
            const data = await res.json().catch(() => null);
            toast.error(data?.error || "Erreur de modification");
        }
    };

    const handleDeleteCat = async (id: number) => {
        if (!confirm("Supprimer cette catégorie d'âge ?")) return;
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
            toast.success("Catégorie supprimée");
            refreshData();
        } else {
            toast.error("Erreur, cette catégorie est peut-être utilisée.");
        }
    };

    const handleProcessRequest = async (id: number, status: 'approved' | 'rejected') => {
        const adminNotes = status === 'rejected' ? prompt("Motif du refus (optionnel) :") : "";
        if (status === 'rejected' && adminNotes === null) return;

        try {
            const res = await fetch(`/api/admin/upgrade-requests/${id}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, adminNotes, processedBy: user?.id })
            });

            if (res.ok) {
                toast.success(status === 'approved' ? "Demande approuvée !" : "Demande refusée");
                refreshData();
            } else {
                toast.error("Erreur lors du traitement");
            }
        } catch (error) {
            toast.error("Erreur réseau");
        }
    };

    const fetchCommercialClients = async (commId: number) => {
        setLoadingClients(true);
        try {
            const res = await fetch(`/api/admin/commercial-clients/${commId}`, {
                headers: { "x-user-id": user?.id?.toString() || "" }
            });
            if (res.ok) {
                const data = await res.json();
                setCommercialClients(data.clients);
            }
        } catch (err) {
            toast.error("Erreur lors du chargement des clients");
        } finally {
            setLoadingClients(false);
        }
    };

    const handleReassignClient = async (newCommId: number) => {
        if (!clientToReassign) return;
        try {
            const res = await fetch("https://dev.takymed.com:3500/api/admin/reassign-client", {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id?.toString() || ""
                },
                body: JSON.stringify({ clientId: clientToReassign.id, newCommercialId: newCommId })
            });
            if (res.ok) {
                toast.success("Client réattribué avec succès");
                setIsReassignDialogOpen(false);
                if (selectedCommercial) fetchCommercialClients(selectedCommercial.id);
                refreshData();
            } else {
                toast.error("Erreur lors de la réattribution");
            }
        } catch (err) {
            toast.error("Erreur réseau");
        }
    };

    const handleUpdateUser = async () => {
        if (!clientToEdit) return;
        try {
            const res = await fetch(`/api/admin/users/${clientToEdit.id}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': user?.id?.toString() || ""
                },
                body: JSON.stringify({ phone: clientToEdit.phone, name: clientToEdit.name })
            });
            if (res.ok) {
                toast.success("Utilisateur mis à jour");
                setIsEditUserOpen(false);
                if (selectedCommercial) fetchCommercialClients(selectedCommercial.id);
                refreshData();
            } else {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || "Erreur de mise à jour");
            }
        } catch (err) {
            toast.error("Erreur réseau");
        }
    };

    // ============== CSV EXPORT ==============
    const handleExportCSV = () => {
        if (medications.length === 0) { toast.error("Aucun médicament à exporter"); return; }
        const header = "ID,Nom,Forme,Dose Défaut";
        const rows = medications.map(m => {
            const forme = m.unitId === 1 ? "Comprimé" : m.unitId === 2 ? "Gélule" : "Sirop";
            return `${m.id},"${m.name}","${forme}",${m.defaultDose}`;
        });
        const csv = [header, ...rows].join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `takymed_medicaments_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Export CSV téléchargé !");
    };

    // ============== CSV IMPORT ==============
    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const text = ev.target?.result as string;
            const lines = text.split('\n').filter(l => l.trim());
            let imported = 0;
            // Skip header if present
            const startIdx = lines[0]?.toLowerCase().includes('nom') ? 1 : 0;
            for (let i = startIdx; i < lines.length; i++) {
                const parts = lines[i].split(',').map(s => s.replace(/"/g, '').trim());
                const name = parts[1] || parts[0]; // Support "ID,Nom,..." or just "Nom,..."
                if (!name) continue;
                const unitId = parts[2]?.toLowerCase().includes('gélule') ? 2 : parts[2]?.toLowerCase().includes('sirop') ? 3 : 1;
                const dose = parseFloat(parts[3] || parts[2]) || 1;
                try {
                    const res = await fetch("https://dev.takymed.com:3500/api/admin/medications", {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'x-user-id': user?.id?.toString() || ""
                        },
                        body: JSON.stringify({ name, unitId, defaultDose: dose })
                    });
                    if (res.ok) imported++;
                } catch { /* skip failed entries */ }
            }
            toast.success(`${imported} médicament(s) importé(s) avec succès !`);
            refreshData();
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset file input
    };

    // ============== PDF EXPORT ==============
    const handleExportPDF = () => {
        if (medications.length === 0) { toast.error("Aucun médicament à exporter"); return; }

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Add logo
        try {
            doc.addImage(logoImg, 'PNG', 14, 10, 30, 30);
        } catch { /* logo load failed, continue without */ }

        // Header text
        doc.setFontSize(20);
        doc.setTextColor(0, 96, 147); // TEAL
        doc.text('TAKYMED', 50, 25);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Catalogue des Médicaments', 50, 32);
        doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 50, 38);

        // Separator
        doc.setDrawColor(0, 168, 89); // EMERALD
        doc.setLineWidth(0.8);
        doc.line(14, 45, pageWidth - 14, 45);

        // Table
        autoTable(doc, {
            startY: 50,
            head: [['#', 'Désignation', 'Forme', 'Dose Défaut']],
            body: medications.map((m, i) => [
                (i + 1).toString(),
                m.name,
                m.unitId === 1 ? 'Comprimé' : m.unitId === 2 ? 'Gélule' : 'Sirop',
                `${m.defaultDose} unité(s)`
            ]),
            theme: 'grid',
            headStyles: {
                fillColor: [0, 96, 147],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 9,
            },
            alternateRowStyles: { fillColor: [245, 248, 250] },
            styles: { fontSize: 9, cellPadding: 4 },
            margin: { left: 14, right: 14 },
        });

        // Footer
        const pageCount = (doc as any).getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`TAKYMED - Page ${i}/${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
        }

        doc.save(`takymed_catalogue_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success("Export PDF téléchargé !");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="h-12 w-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: TEAL, borderTopColor: "transparent" }} />
            </div>
        );
    }

    const getTrend = (key: "prescriptions" | "inscriptions") => {
        if (monthlyActivity.length < 2) return 0;
        const current = Number(monthlyActivity[monthlyActivity.length - 1]?.[key] || 0);
        const previous = Number(monthlyActivity[monthlyActivity.length - 2]?.[key] || 0);
        if (previous <= 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    };

    const usersSparkData = monthlyActivity.map((point) => ({ value: point.inscriptions }));
    const prescriptionsSparkData = monthlyActivity.map((point) => ({ value: point.prescriptions }));
    const medsSparkData = monthlyActivity.map((point) => ({ value: point.medications ?? 0 }));
    const pharmaciesSparkData = monthlyActivity.map((point) => ({ value: point.pharmacies ?? 0 }));

    const typeLabels: Record<string, string> = {
        standard: "Standard",
        professionnel: "Professionnel",
        professional: "Professionnel",
        commercial: "Commercial",
        administrateur: "Administrateur",
        admin: "Administrateur",
    };

    const distributionMap = users.reduce((acc, currentUser) => {
        const rawType = String(currentUser.type || "Autre").toLowerCase();
        const label = typeLabels[rawType] || currentUser.type || "Autre";
        acc[label] = (acc[label] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const accountDistribution = Object.entries(distributionMap).map(([name, value]) => ({ name, value }));

    const activePrescriptionRate = stats?.users
        ? Math.round(((stats?.prescriptions || 0) / Math.max(stats.users, 1)) * 100)
        : 0;

    const inputClass = "bg-slate-50 border-slate-200 rounded-xl h-11 text-slate-800 focus:border-teal-400 placeholder:text-slate-400";
    const labelClass = "text-xs font-bold text-slate-500 uppercase tracking-wide";

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-700">
            {/* Page Title */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter" style={{ color: "#1e293b" }}>
                        {getActiveTab() === 'analytics' ? t('admin.analytics') :
                            getActiveTab() === 'users' ? t('admin.users') :
                            getActiveTab() === 'meds' ? t('admin.medications') :
                            getActiveTab() === 'pharmacies' ? t('admin.pharmacies') :
                            getActiveTab() === 'settings' ? t('admin.settings') :
                            getActiveTab() === 'categories' ? t('admin.categories') :
                            getActiveTab() === 'requests' ? t('admin.promoRequests') :
                            getActiveTab() === 'commercials' ? t('admin.commercials') : t('admin.title')}
                    </h1>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        <Shield className="w-3 h-3" />
                        <span>{t('admin.title')}</span>
                        <span>/</span>
                        <span style={{ color: TEAL }}>
                            {getActiveTab() === 'analytics' ? t('admin.analytics') :
                            getActiveTab() === 'users' ? t('admin.users') :
                            getActiveTab() === 'meds' ? t('admin.medications') :
                            getActiveTab() === 'pharmacies' ? t('admin.pharmacies') :
                            getActiveTab() === 'settings' ? t('admin.settings') :
                            getActiveTab() === 'categories' ? t('admin.categories') :
                            getActiveTab() === 'requests' ? t('admin.promoRequests') :
                            getActiveTab() === 'commercials' ? t('admin.commercials') : t('nav.dashboard')}
                        </span>
                    </div>
                </div>
                <Button
                    onClick={refreshData}
                    className="rounded-xl px-6 h-10 font-bold text-white shadow-md hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}
                >
                    {t('common.save')} {/* Just reusing a common action translation for now, or we can use Actualiser if we add it */}
                </Button>
            </div>

            {/* Hero + Stats - ONLY ON DASHBOARD/ANALYTICS */}
            {getActiveTab() === "analytics" && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-4 h-full">
                            <AdminHeroCard
                                name={user?.name || "Admin"}
                                amount={stats?.prescriptions?.toString() || "0"}
                                targetPercent={Math.max(0, Math.min(activePrescriptionRate, 100))}
                            />
                        </div>
                        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <AdminStatCard
                                label="Utilisateurs"
                                value={stats?.users?.toLocaleString() || "0"}
                                trend={getTrend("inscriptions")}
                                data={usersSparkData}
                                color="bg-[#006093]"
                                icon={<Users size={22} />}
                            />
                            <AdminStatCard
                                label="Prescriptions"
                                value={stats?.prescriptions?.toLocaleString() || "0"}
                                trend={getTrend("prescriptions")}
                                data={prescriptionsSparkData}
                                color="bg-[#00A859]"
                                icon={<Activity size={22} />}
                            />
                            <AdminStatCard
                                label="Médicaments"
                                value={stats?.medications?.toLocaleString() || "0"}
                                data={medsSparkData}
                                color="bg-violet-500"
                                icon={<Pill size={22} />}
                            />
                            <AdminStatCard
                                label="Pharmacies"
                                value={stats?.pharmacies?.toLocaleString() || "0"}
                                data={pharmaciesSparkData}
                                color="bg-amber-500"
                                icon={<Briefcase size={22} />}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl border p-4 shadow-sm" style={{ borderColor: "#e2e8f0" }}>
                            <p className="text-[10px] uppercase text-slate-400 font-bold">Conversion ordonnances/utilisateurs</p>
                            <p className="text-2xl font-black text-slate-800">
                                {stats?.users ? `${Math.round(((stats?.prescriptions || 0) / stats.users) * 100)}%` : "0%"}
                            </p>
                        </div>
                        <div className="bg-white rounded-2xl border p-4 shadow-sm" style={{ borderColor: "#e2e8f0" }}>
                            <p className="text-[10px] uppercase text-slate-400 font-bold">Catalogue moyen / pharmacie</p>
                            <p className="text-2xl font-black text-slate-800">
                                {stats?.pharmacies ? ((stats?.medications || 0) / stats.pharmacies).toFixed(1) : "0"}
                            </p>
                        </div>
                        <div className="bg-white rounded-2xl border p-4 shadow-sm" style={{ borderColor: "#e2e8f0" }}>
                            <p className="text-[10px] uppercase text-slate-400 font-bold">Activité récente</p>
                            <p className="text-2xl font-black text-slate-800">{stats?.recentActivity?.length || 0}</p>
                        </div>
                    </div>
                </>
            )}

            {/* Tabs Content - TabsList hidden as Navigation is handled by Sidebar */}
            <Tabs value={getActiveTab()} onValueChange={handleTabChange} className="space-y-6">
                <TabsList className="hidden">
                    {[
                        { value: "users", label: "Clients" },
                        { value: "meds", label: "Catalogue" },
                        { value: "pharmacies", label: "Pharmacies" },
                        { value: "settings", label: "Abonnements" },
                        { value: "categories", label: "Catégories d'âge" },
                        { value: "requests", label: "Demandes Promo" },
                        { value: "commercials", label: "Agents Commerciaux" },
                        { value: "analytics", label: "Analytique" },
                    ].map(tab => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* USERS TAB */}
                <TabsContent value="users">
                    <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                        <div className="p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderColor: "#f1f5f9" }}>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Clients inscrits</h3>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">{users.length} comptes enregistrés</p>
                            </div>
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            className="text-white rounded-xl px-5 h-11 font-bold shadow-md whitespace-nowrap"
                                            style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}
                                        >
                                            <Plus className="w-4 h-4 mr-2" /> Nouveau Client
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-white border-slate-200 text-slate-800 rounded-3xl sm:max-w-md shadow-2xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-slate-800">Ajouter un Utilisateur</DialogTitle>
                                            <DialogDescription>Créer un nouveau compte utilisateur</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <label className={labelClass}>Nom Complet (Optionnel)</label>
                                                <Input className={inputClass} placeholder="ex: Jean Dupont" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className={labelClass}>Téléphone</label>
                                                    <Input className={cn(inputClass, "w-auto min-w-[15ch]")} size={15} placeholder="+225..." value={newUser.phone} onChange={e => {
                                                        const val = e.target.value;
                                                        if (val === "" || /^[0-9+]+$/.test(val)) {
                                                            setNewUser({ ...newUser, phone: val });
                                                        }
                                                    }} />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className={labelClass}>Email</label>
                                                    <Input className={inputClass} type="email" placeholder="mail@example.com" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className={labelClass}>Mot de passe <span className="text-red-500">*</span></label>
                                                    <Input className={inputClass} type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className={labelClass}>Type de profil <span className="text-red-500">*</span></label>
                                                    <select
                                                        title="Type de profil"
                                                        className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-400"
                                                        value={newUser.type}
                                                        onChange={e => setNewUser({ ...newUser, type: e.target.value })}
                                                    >
                                                        <option value="standard">Standard (Patient)</option>
                                                        <option value="professionnel">Professionnel / Pharmacien</option>
                                                        <option value="commercial">Commercial</option>
                                                        <option value="administrateur">Administrateur</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button
                                                className="w-full h-11 rounded-xl font-bold text-white"
                                                style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}
                                                onClick={handleAddUser}
                                            >
                                                Créer le compte
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="responsive-admin-table responsive-data-table w-full min-w-[760px] text-left">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Utilisateur</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Type</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Contact</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">PIN</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: "#f1f5f9" }}>
                                    {users.map((u) => {
                                        const displayName = u.name || u.email || u.phone || `User #${u.id}`;
                                        return (
                                            <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="cell-user px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-white shadow-sm border overflow-hidden">
                                                            <img
                                                                src={`/avatars/${u.type}.svg`}
                                                                alt={u.type}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = "/avatars/default.png";
                                                                }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="font-extrabold text-slate-900 text-sm">{displayName}</p>
                                                            <p className="text-xs text-slate-500 font-bold">ID #{u.id}</p>
                                                            {u.protected && (
                                                                <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                                                                    Compte système
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={cn(
                                                        "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                                        u.type === 'Standard' ? "text-blue-600 bg-blue-50" :
                                                            u.type === 'Professionnel' ? "text-emerald-600 bg-emerald-50" :
                                                                u.type === 'Commercial' ? "text-orange-600 bg-orange-50" :
                                                                    "text-violet-600 bg-violet-50"
                                                    )}>
                                                        {u.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-700 font-bold">
                                                    {u.email || u.phone || "—"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-mono font-bold text-slate-800">{u.pin || "—"}</span>
                                                        {u.pinExpiresAt && (
                                                            <span className={cn(
                                                                "text-[10px] font-bold",
                                                                new Date(u.pinExpiresAt) < new Date() ? "text-red-500" : "text-slate-400"
                                                            )}>
                                                                {new Date(u.pinExpiresAt) < new Date() ? "Expiré" : `Expire le ${new Date(u.pinExpiresAt).toLocaleDateString('fr-FR')}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="hover:bg-teal-50 hover:text-teal-600 rounded-xl"
                                                            onClick={() => {
                                                                setClientToEdit({ id: u.id, phone: u.phone || "", name: u.name || "", protected: u.protected });
                                                                setIsEditUserOpen(true);
                                                            }}
                                                            title="Modifier les infos"
                                                        >
                                                            <Edit2 size={15} />
                                                        </Button>
                                                        {!u.protected && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="hover:bg-teal-50 hover:text-teal-600 rounded-xl"
                                                                onClick={() => openChangeTypeDialog(u.id, u.type)}
                                                                title="Changer le type de compte"
                                                            >
                                                                <ArrowRightLeft size={15} />
                                                            </Button>
                                                        )}
                                                        {!u.protected && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="hover:bg-red-50 hover:text-red-500 rounded-xl"
                                                                onClick={() => handleDeleteUser(u.id)}
                                                            >
                                                                <Trash2 size={15} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* MEDS TAB */}
                <TabsContent value="meds">
                    <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                        <div className="p-6 border-b flex items-center justify-between flex-wrap gap-3" style={{ borderColor: "#f1f5f9" }}>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Catalogue Médicaments</h3>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">{medications.length} produits référencés</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* CSV Import */}
                                <input
                                    type="file"
                                    id="csv-import-input"
                                    title="Importer un fichier CSV"
                                    className="hidden"
                                    accept=".csv"
                                    onChange={handleImportCSV}
                                />
                                <Button
                                    variant="outline"
                                    className="rounded-xl h-10 px-4 text-xs font-bold border-slate-200 hover:bg-slate-50"
                                    onClick={() => document.getElementById('csv-import-input')?.click()}
                                >
                                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Importer CSV
                                </Button>
                                {/* CSV Export */}
                                <Button
                                    variant="outline"
                                    className="rounded-xl h-10 px-4 text-xs font-bold border-slate-200 hover:bg-slate-50"
                                    onClick={handleExportCSV}
                                >
                                    <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
                                </Button>
                                {/* PDF Export */}
                                <Button
                                    variant="outline"
                                    className="rounded-xl h-10 px-4 text-xs font-bold border-red-100 text-red-600 hover:bg-red-50"
                                    onClick={handleExportPDF}
                                >
                                    <FileText className="w-3.5 h-3.5 mr-1.5" /> Export PDF
                                </Button>
                                {/* Delete All */}
                                <Button
                                    variant="outline"
                                    className="rounded-xl h-10 px-4 text-xs font-bold border-red-200 text-red-700 hover:bg-red-100"
                                    onClick={handleDeleteAllMeds}
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Tout Supprimer
                                </Button>
                                {/* Add New */}
                                <Dialog open={isAddMedOpen} onOpenChange={setIsAddMedOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            className="text-white rounded-xl px-5 h-10 font-bold shadow-md"
                                            style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}
                                        >
                                            <Plus className="w-4 h-4 mr-2" /> Nouveau
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-white border-slate-200 text-slate-800 rounded-3xl sm:max-w-md shadow-2xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-slate-800">Ajouter au Catalogue</DialogTitle>
                                            <DialogDescription>Ajouter un nouveau médicament au catalogue</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <label className={labelClass}>Nom du Produit <span className="text-red-500">*</span></label>
                                                <Input className={inputClass} value={newMed.name || ""} onChange={e => setNewMed({ ...newMed, name: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className={labelClass}>Unité <span className="text-red-500">*</span></label>
                                                    <select
                                                        title="Sélectionner l'unité"
                                                        className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-400"
                                                        value={newMed.unitId ?? 1}
                                                        onChange={e => setNewMed({ ...newMed, unitId: parseInt(e.target.value) })}
                                                    >
                                                        <option value={1}>mg</option>
                                                        <option value={2}>ml</option>
                                                        <option value={3}>comprimé</option>
                                                        <option value={4}>goutte</option>
                                                        <option value={5}>unité</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className={labelClass}>Dose Défaut <span className="text-red-500">*</span></label>
                                                    <Input type="number" className={inputClass} value={newMed.defaultDose ?? 1} onChange={e => setNewMed({ ...newMed, defaultDose: parseFloat(e.target.value) })} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className={labelClass}>Description</label>
                                                <Input className={inputClass} value={newMed.description || ""} onChange={e => setNewMed({ ...newMed, description: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className={labelClass}>Prix</label>
                                                    <Input className={inputClass} value={newMed.price || ""} onChange={e => setNewMed({ ...newMed, price: e.target.value })} placeholder="ex: 2500 FCFA" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className={labelClass}>Photo URL</label>
                                                    <Input
                                                        className={inputClass}
                                                        value={newMed.isManualUpload ? "" : (newMed.photoUrl || "")}
                                                        placeholder={newMed.isManualUpload ? "Image locale sélectionnée" : "https://example.com/image.jpg"}
                                                        onChange={e => {
                                                            setNewMed({ ...newMed, photoUrl: e.target.value, isManualUpload: false });
                                                            if (newMedFileInputRef.current) newMedFileInputRef.current.value = "";
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className={labelClass}>Ou charger une image locale</label>
                                                <Input
                                                    ref={newMedFileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className={inputClass}
                                                    onChange={(e) => handleImageUpload(e.target.files?.[0], (dataUrl) => setNewMed({ ...newMed, photoUrl: dataUrl, isManualUpload: true }))}
                                                />
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">PNG/JPG/WebP - max 2MB</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className={labelClass}>Type d'utilisation</label>
                                                    <select title="Type d'utilisation" className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-400" value={newMed.typeUtilisation || "comprime"} onChange={e => setNewMed({ ...newMed, typeUtilisation: e.target.value })}>
                                                        <option value="comprime">Comprimé</option>
                                                        <option value="sirop">Sirop</option>
                                                        <option value="gelule">Gélule</option>
                                                        <option value="pommade">Pommade</option>
                                                        <option value="goutte">Goutte</option>
                                                        <option value="spray">Spray</option>
                                                        <option value="injection">Injection</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className={labelClass}>Précaution</label>
                                                    <select title="Précaution" className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-400" value={newMed.precautionAlimentaire || "aucune"} onChange={e => setNewMed({ ...newMed, precautionAlimentaire: e.target.value })}>
                                                        <option value="aucune">Aucune</option>
                                                        <option value="eviter_alcool">Éviter alcool</option>
                                                        <option value="boire_beaucoup_eau">Boire beaucoup d'eau</option>
                                                        <option value="eviter_produits_laitiers">Éviter produits laitiers</option>
                                                        <option value="eviter_pamplemousse">Éviter pamplemousse</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 space-y-3">
                                                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Posologie recommandée (optionnelle)</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <select title="Catégorie d'âge" className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800" value={newMed.posology?.categorieAge || categories[0]?.name || "adulte"} onChange={e => setNewMed({ ...newMed, posology: { ...(newMed.posology || { doseRecommandee: 1, unitId: 1 }), categorieAge: e.target.value as any } })}>
                                                        {categories.map(cat => (
                                                            <option key={cat.id} value={cat.name}>{cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}</option>
                                                        ))}
                                                    </select>
                                                    <Input type="number" className="h-10 rounded-xl text-xs" value={newMed.posology?.doseRecommandee ?? 1} onChange={e => setNewMed({ ...newMed, posology: { ...(newMed.posology || { categorieAge: "adulte", unitId: newMed.unitId || 1 }), doseRecommandee: parseFloat(e.target.value) || 0 } })} />
                                                    <select title="Unité posologie" className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800" value={newMed.posology?.unitId ?? newMed.unitId ?? 1} onChange={e => setNewMed({ ...newMed, posology: { ...(newMed.posology || { categorieAge: "adulte", doseRecommandee: 1 }), unitId: parseInt(e.target.value) } })}>
                                                        <option value={1}>mg</option>
                                                        <option value={2}>ml</option>
                                                        <option value={3}>comprimé</option>
                                                        <option value={4}>goutte</option>
                                                        <option value={5}>unité</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button
                                                className="w-full h-11 rounded-xl font-bold text-white"
                                                style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}
                                                onClick={handleAddMed}
                                            >
                                                Ajouter au Catalogue
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="responsive-data-table w-full text-left">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Désignation</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Forme</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Dose Standard</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: "#f1f5f9" }}>
                                    {medications.map((m) => (
                                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #e0f0fa, #d0ede0)" }}>
                                                        <Pill size={16} style={{ color: TEAL }} />
                                                    </div>
                                                    <span className="font-bold text-slate-800 text-sm">{m.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase text-slate-600 bg-slate-100">
                                                    {m.unitId === 1 ? "Comprimé" : m.unitId === 2 ? "Gélule" : "Sirop"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700 font-bold">
                                                {m.defaultDose} unité(s)
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-1">
                                                <Button variant="ghost" size="icon" className="hover:bg-teal-50 hover:text-teal-600 rounded-xl" onClick={() => {
                                                    const isManual = m.photoUrl?.startsWith("/uploads/") || m.photoUrl?.startsWith("data:");
                                                    setEditingMed({ ...m, isManualUpload: isManual });
                                                }}>
                                                    <Edit2 size={15} />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-500 rounded-xl" onClick={() => handleDeleteMed(m.id)}>
                                                    <Trash2 size={15} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* PHARMACIES TAB */}
                <TabsContent value="pharmacies" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: "#f1f5f9" }}>
                            <div>
                                <h3 className="text-lg font-black text-slate-800">Pharmacies Enregistrées</h3>
                                <p className="text-xs text-slate-500 font-bold mt-1">Gérez le réseau des officines</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="responsive-data-table w-full text-left">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Officine</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Gérant</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Contact & Adresse</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest text-right">Stock (Médicaments)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: "#f1f5f9" }}>
                                    {pharmacies.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #e0f0fa, #d0ede0)" }}>
                                                        <Briefcase size={16} style={{ color: TEAL }} />
                                                    </div>
                                                    <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-slate-700 text-sm">{p.ownerName || "—"}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-700 font-bold">{p.phone}</p>
                                                <p className="text-xs text-slate-500">{p.address}</p>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700 font-bold text-right">
                                                {p.stockCount} article(s)
                                            </td>
                                        </tr>
                                    ))}
                                    {pharmacies.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-slate-500 font-bold text-sm">
                                                Aucune pharmacie enregistrée.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* SETTINGS TAB */}
                <TabsContent value="settings">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {settings.map((s) => (
                            <EditableSettingCard key={s.id} setting={s} onSave={handleUpdateSetting} />
                        ))}
                    </div>
                </TabsContent>

                {/* CATEGORIES TAB */}
                <TabsContent value="categories" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                        <div className="p-6 border-b flex items-center justify-between gap-4" style={{ borderColor: "#f1f5f9" }}>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Catégories d'âge</h3>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">Pour personnaliser les posologies</p>
                            </div>
                            <Dialog open={isAddCatOpen} onOpenChange={setIsAddCatOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        className="text-white rounded-xl px-5 h-10 font-bold shadow-md"
                                        style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Nouvelle Catégorie
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-white border-slate-200 text-slate-800 rounded-3xl sm:max-w-md shadow-2xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-slate-800">Ajouter une Catégorie</DialogTitle>
                                        <DialogDescription>Créer une nouvelle catégorie d'âge</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <label className={labelClass}>Nom de la Catégorie <span className="text-red-500">*</span></label>
                                            <Input className={inputClass} placeholder="ex: adolescent" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value.toLowerCase() })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>Description</label>
                                            <Input className={inputClass} placeholder="ex: 12 à 18 ans" value={newCat.description} onChange={e => setNewCat({ ...newCat, description: e.target.value })} />
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                            <input
                                                type="checkbox"
                                                id="considerWeight"
                                                checked={newCat.considerWeight}
                                                onChange={e => setNewCat({ ...newCat, considerWeight: e.target.checked })}
                                                className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                                            />
                                            <label htmlFor="considerWeight" className="text-sm font-medium text-slate-700 cursor-pointer">
                                                Cette catégorie nécessite la prise en compte du poids du patient
                                            </label>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            className="w-full h-11 rounded-xl font-bold text-white"
                                            style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}
                                            onClick={handleAddCat}
                                        >
                                            Ajouter
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="responsive-data-table w-full text-left">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Catégorie</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Description</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Poids requis</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: "#f1f5f9" }}>
                                    {categories.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800 text-sm capitalize">{c.name}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{c.description || "—"}</td>
                                            <td className="px-6 py-4 text-sm">
                                                {c.considerWeight ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                                        Oui
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">
                                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                                                        Non
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-1">
                                                <Button variant="ghost" size="icon" className="hover:bg-teal-50 hover:text-teal-600 rounded-xl" onClick={() => setEditingCat(c)}>
                                                    <Edit2 size={15} />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-500 rounded-xl" onClick={() => handleDeleteCat(c.id)}>
                                                    <Trash2 size={15} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {categories.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-slate-500 font-bold text-sm">
                                                Aucune catégorie enregistrée.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* UPGRADE REQUESTS TAB */}
                <TabsContent value="requests">
                    <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: "#f1f5f9" }}>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Demandes de Promotion</h3>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">{upgradeRequests.filter(r => r.status === 'pending').length} demandes en attente</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            {upgradeRequests.length === 0 ? (
                                <div className="py-20 text-center">
                                    <ArrowRightLeft className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                    <p className="text-slate-400 font-bold">Aucune demande d'upgrade enregistrée</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {upgradeRequests.map((req: any) => (
                                        <div key={req.id} className="bg-slate-50 border rounded-3xl p-6 transition-all hover:shadow-md">
                                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                                <div className="flex gap-4">
                                                    <div className="h-12 w-12 rounded-2xl bg-[#006093] flex items-center justify-center text-white font-bold text-lg uppercase">
                                                        {req.userName?.charAt(0) || "U"}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-slate-800 text-base">{req.userName}</h4>
                                                            <span className={cn(
                                                                "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider",
                                                                req.status === 'pending' ? "bg-amber-100 text-amber-600" :
                                                                req.status === 'approved' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                                            )}>
                                                                {req.status === 'pending' ? 'En attente' : req.status === 'approved' ? 'Approuvée' : 'Refusée'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 font-medium">{req.userPhone}</p>
                                                        <div className="mt-2 inline-flex items-center gap-1.5 bg-white border px-3 py-1 rounded-full text-[10px] font-bold text-[#00A859] border-slate-100">
                                                            Vers: <span className="uppercase text-[#006093]">{req.requestedType}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-col items-end gap-2">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{new Date(req.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                                    {req.status === 'pending' && (
                                                        <div className="flex gap-2 mt-2">
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => handleProcessRequest(req.id, 'approved')}
                                                                className="rounded-xl h-9 px-4 bg-green-600 hover:bg-green-700 font-bold text-xs shadow-sm"
                                                            >
                                                                <Check className="w-3.5 h-3.5 mr-1.5" /> Approuver
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline"
                                                                onClick={() => handleProcessRequest(req.id, 'rejected')}
                                                                className="rounded-xl h-9 px-4 border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs shadow-sm"
                                                            >
                                                                <X className="w-3.5 h-3.5 mr-1.5" /> Refuser
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {req.motive && (
                                                <div className="mt-4 bg-white border rounded-2xl p-4 border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Motif de la demande:</p>
                                                    <p className="text-sm text-slate-700 italic font-medium">"{req.motive}"</p>
                                                </div>
                                            )}

                                            {req.adminNotes && (
                                                <div className="mt-4 bg-slate-100 rounded-2xl p-4">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Note admin:</p>
                                                    <p className="text-sm text-slate-700 font-medium">{req.adminNotes}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* COMMERCIALS TAB */}
                <TabsContent value="commercials">
                    <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: "#f1f5f9" }}>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Agents Commerciaux</h3>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">{commercials.length} agents actifs</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="responsive-data-table w-full text-left">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Agent</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Téléphone</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Clients</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: "#f1f5f9" }}>
                                    {commercials.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                                                        {c.name?.charAt(0) || "C"}
                                                    </div>
                                                    <span className="font-bold text-slate-800 text-sm">{c.name || "Agent"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 font-mono">{c.phone}</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-black">
                                                    {c.clientCount} clients
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="rounded-xl h-9 border-slate-200 hover:bg-slate-50 font-bold text-xs"
                                                    onClick={() => {
                                                        setSelectedCommercial(c);
                                                        fetchCommercialClients(c.id);
                                                        setIsClientsDialogOpen(true);
                                                    }}
                                                >
                                                    <Users className="w-3.5 h-3.5 mr-1.5" /> Voir les clients
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {commercials.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-20 text-center">
                                                <Briefcase className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                                <p className="text-slate-400 font-bold">Aucun agent commercial trouvé</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ORPHAN CLIENTS SECTION */}
                    <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden mt-8" style={{ borderColor: "#e2e8f0" }}>
                        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: "#f1f5f9" }}>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Clients sans agent</h3>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">{unassignedClients.length} utilisateurs orphelins</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="responsive-data-table w-full text-left">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Client</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest">Téléphone</th>
                                        <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-700 tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: "#f1f5f9" }}>
                                    {unassignedClients.map((client) => (
                                        <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 border-b border-slate-50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                                        {client.name?.charAt(0) || "U"}
                                                    </div>
                                                    <span className="font-bold text-slate-800 text-sm">{client.name || client.phone}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 border-b border-slate-50 text-sm text-slate-600 font-mono">{client.phone}</td>
                                            <td className="px-6 py-4 border-b border-slate-50 text-right">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="rounded-xl h-8 border-slate-200 hover:bg-slate-50 font-bold text-[10px]"
                                                    onClick={() => {
                                                        setClientToReassign(client);
                                                        setIsReassignDialogOpen(true);
                                                    }}
                                                >
                                                    <UserPlus className="w-3 h-3 mr-1" /> Assigner
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {unassignedClients.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                Tous les clients ont un agent.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* ANALYTICS TAB */}
                <TabsContent value="analytics">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-4"><DistributionChart data={accountDistribution} /></div>
                        <div className="lg:col-span-8"><ActivityChart data={monthlyActivity} /></div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Edit Med Dialog */}
            <Dialog open={!!editingMed} onOpenChange={open => !open && setEditingMed(null)}>
                <DialogContent className="bg-white border-slate-200 text-slate-800 rounded-3xl sm:max-w-md shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800">Éditer le Médicament</DialogTitle>
                    </DialogHeader>
                    {editingMed && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className={labelClass}>Nom <span className="text-red-500">*</span></label>
                                <Input className={inputClass} value={editingMed.name} onChange={e => setEditingMed({ ...editingMed, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>Unité <span className="text-red-500">*</span></label>
                                    <select
                                        title="Sélectionner l'unité"
                                        className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-400"
                                        value={editingMed.unitId?.toString() || "1"}
                                        onChange={e => setEditingMed({ ...editingMed, unitId: parseInt(e.target.value) })}
                                    >
                                        <option value={1}>mg</option>
                                        <option value={2}>ml</option>
                                        <option value={3}>comprimé</option>
                                        <option value={4}>goutte</option>
                                        <option value={5}>unité</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Dose Défaut <span className="text-red-500">*</span></label>
                                    <Input type="number" className={inputClass} value={editingMed.defaultDose} onChange={e => setEditingMed({ ...editingMed, defaultDose: parseFloat(e.target.value) })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>Description</label>
                                <Input className={inputClass} value={editingMed.description || ""} onChange={e => setEditingMed({ ...editingMed, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>Prix</label>
                                    <Input className={inputClass} value={editingMed.price || ""} onChange={e => setEditingMed({ ...editingMed, price: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Photo URL</label>
                                    <Input
                                        className={inputClass}
                                        value={editingMed.isManualUpload ? "" : (editingMed.photoUrl || "")}
                                        placeholder={editingMed.isManualUpload ? "Image locale sélectionnée" : ""}
                                        onChange={e => {
                                            setEditingMed({ ...editingMed, photoUrl: e.target.value, isManualUpload: false });
                                            if (editMedFileInputRef.current) editMedFileInputRef.current.value = "";
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>Ou charger une image locale</label>
                                <Input
                                    ref={editMedFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className={inputClass}
                                    onChange={(e) => handleImageUpload(e.target.files?.[0], (dataUrl) => setEditingMed({ ...editingMed, photoUrl: dataUrl, isManualUpload: true }))}
                                />
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">PNG/JPG/WebP - max 2MB</p>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 space-y-3">
                                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Posologie recommandée (optionnelle)</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <select title="Catégorie d'âge" className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800" value={editingMed.posology?.categorieAge || categories[0]?.name || "adulte"} onChange={e => setEditingMed({ ...editingMed, posology: { ...(editingMed.posology || { doseRecommandee: 1, unitId: editingMed.unitId || 1 }), categorieAge: e.target.value as any } })}>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.name}>{cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}</option>
                                        ))}
                                    </select>
                                    <Input type="number" className="h-10 rounded-xl text-xs" value={editingMed.posology?.doseRecommandee ?? 1} onChange={e => setEditingMed({ ...editingMed, posology: { ...(editingMed.posology || { categorieAge: "adulte", unitId: editingMed.unitId || 1 }), doseRecommandee: parseFloat(e.target.value) || 0 } })} />
                                    <select title="Unité posologie" className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800" value={editingMed.posology?.unitId ?? editingMed.unitId ?? 1} onChange={e => setEditingMed({ ...editingMed, posology: { ...(editingMed.posology || { categorieAge: "adulte", doseRecommandee: 1 }), unitId: parseInt(e.target.value) } })}>
                                        <option value={1}>mg</option>
                                        <option value={2}>ml</option>
                                        <option value={3}>comprimé</option>
                                        <option value={4}>goutte</option>
                                        <option value={5}>unité</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            className="w-full h-11 rounded-xl font-bold text-white"
                            style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}
                            onClick={handleUpdateMed}
                        >
                            Sauvegarder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Cat Dialog */}
            <Dialog open={!!editingCat} onOpenChange={open => !open && setEditingCat(null)}>
                <DialogContent className="bg-white border-slate-200 text-slate-800 rounded-3xl sm:max-w-md shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800">Éditer la Catégorie</DialogTitle>
                    </DialogHeader>
                    {editingCat && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className={labelClass}>Nom de la Catégorie <span className="text-red-500">*</span></label>
                                <Input className={inputClass} value={editingCat.name} onChange={e => setEditingCat({ ...editingCat, name: e.target.value.toLowerCase() })} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>Description</label>
                                <Input className={inputClass} value={editingCat.description} onChange={e => setEditingCat({ ...editingCat, description: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <input
                                    type="checkbox"
                                    id="editConsiderWeight"
                                    checked={editingCat.considerWeight}
                                    onChange={e => setEditingCat({ ...editingCat, considerWeight: e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                                />
                                <label htmlFor="editConsiderWeight" className="text-sm font-medium text-slate-700 cursor-pointer">
                                    Cette catégorie nécessite la prise en compte du poids du patient
                                </label>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            className="w-full h-11 rounded-xl font-bold text-white"
                            style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}
                            onClick={handleUpdateCat}
                        >
                            Sauvegarder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Change User Type Dialog */}
            <Dialog open={isChangeTypeOpen} onOpenChange={setIsChangeTypeOpen}>
                <DialogContent className="bg-white border-slate-200 text-slate-800 rounded-3xl sm:max-w-md shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800">Changer le type de compte</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nouveau type de compte</label>
                            <select
                                title="Type de compte"
                                className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-400"
                                value={selectedTypeId}
                                onChange={e => setSelectedTypeId(Number(e.target.value))}
                            >
                                <option value={1}>Standard (Patient)</option>
                                <option value={2}>Professionnel / Pharmacien</option>
                                <option value={3}>Commercial</option>
                                <option value={4}>Administrateur</option>
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            className="w-full h-11 rounded-xl font-bold text-white"
                            style={{ background: `linear-gradient(135deg, ${TEAL}, ${EMERALD})` }}
                            onClick={handleChangeUserType}
                        >
                            Confirmer le changement
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Commercial Clients Dialog */}
            <Dialog open={isClientsDialogOpen} onOpenChange={setIsClientsDialogOpen}>
                <DialogContent className="bg-white border-slate-200 text-slate-800 rounded-3xl sm:max-w-3xl shadow-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b" style={{ borderColor: "#f1f5f9" }}>
                        <DialogTitle className="text-slate-800 flex items-center gap-3">
                            <Users className="w-6 h-6 text-orange-500" />
                            Clients de {selectedCommercial?.name || "l'agent"}
                        </DialogTitle>
                        <DialogDescription>Liste complète des clients assignés à cet agent commercial</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto p-0">
                        {loadingClients ? (
                            <div className="py-20 flex justify-center">
                                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                            </div>
                        ) : commercialClients.length === 0 ? (
                            <div className="py-20 text-center">
                                <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-400 font-bold">Cet agent n'a encore aucun client</p>
                            </div>
                        ) : (
                            <table className="responsive-data-table w-full text-left">
                                <thead className="bg-slate-50 border-b sticky top-0 z-10" style={{ borderColor: "#f1f5f9" }}>
                                    <tr>
                                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Client</th>
                                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Date</th>
                                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: "#f1f5f9" }}>
                                    {commercialClients.map((client) => (
                                        <tr key={client.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 text-sm">{client.name}</div>
                                                <div className="text-[10px] font-mono text-slate-400">{client.phone}</div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {new Date(client.createdAt).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="px-6 py-4">
                                                {client.isValid ? (
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase">Actif</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase">En attente</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 rounded-lg hover:bg-orange-50 hover:text-orange-600 text-[10px] font-black uppercase"
                                                    onClick={() => {
                                                        setClientToReassign(client);
                                                        setIsReassignDialogOpen(true);
                                                    }}
                                                >
                                                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Réattribuer
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reassign Client Dialog */}
            <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
                <DialogContent className="bg-white border-slate-200 text-slate-800 rounded-3xl sm:max-w-md shadow-2xl">
                    <DialogHeader>
                        <DialogTitle>Réattribuer le client</DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <p className="text-sm text-slate-500 font-medium">
                            Sélectionnez le nouvel agent commercial pour <span className="font-bold text-slate-800">{clientToReassign?.name}</span>.
                        </p>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                            {commercials.filter(c => c.id !== selectedCommercial?.id).map((c) => (
                                <button
                                    key={c.id}
                                    className="w-full flex items-center justify-between p-4 border rounded-2xl hover:bg-slate-50 hover:border-teal-300 transition-all text-left group"
                                    onClick={() => handleReassignClient(c.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center font-bold">
                                            {c.name?.charAt(0) || "C"}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm group-hover:text-teal-600">{c.name}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{c.phone}</div>
                                        </div>
                                    </div>
                                    <Check className="w-5 h-5 text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                            {commercials.filter(c => c.id !== selectedCommercial?.id).length === 0 && (
                                <p className="text-center py-4 text-xs font-bold text-slate-400 italic">
                                    Aucun autre agent disponible pour la réattribution.
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsReassignDialogOpen(false)} className="rounded-xl h-11 w-full font-bold">
                            Annuler
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
                <DialogContent className="bg-white border-slate-200 text-slate-800 rounded-3xl sm:max-w-md shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Edit2 className="w-6 h-6 text-teal-500" />
                            Modifier l'utilisateur
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Nom complet</label>
                            <Input
                                value={clientToEdit?.name || ""}
                                onChange={(e) => setClientToEdit(prev => prev ? { ...prev, name: e.target.value } : null)}
                                placeholder="Ex: Jean Dupont"
                                className="h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-teal-500 transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Numéro de téléphone</label>
                            <Input
                                value={clientToEdit?.phone || ""}
                                onChange={(e) => setClientToEdit(prev => prev ? { ...prev, phone: e.target.value } : null)}
                                placeholder="+221..."
                                disabled={clientToEdit?.protected}
                                className="h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-teal-500 transition-all font-medium disabled:opacity-60"
                            />
                            {clientToEdit?.protected && (
                                <p className="text-xs text-amber-700 font-medium px-1">
                                    L&apos;identifiant du compte administrateur système ne peut pas être modifié.
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="flex flex-row gap-2">
                        <Button variant="ghost" onClick={() => setIsEditUserOpen(false)} className="flex-1 rounded-xl h-11 font-bold">
                            Annuler
                        </Button>
                        <Button
                            onClick={handleUpdateUser}
                            disabled={!clientToEdit?.phone}
                            className="flex-1 rounded-xl h-11 font-bold bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-100"
                        >
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}

// --- EDITABLE SETTING CARD ---
function EditableSettingCard({
    setting,
    onSave,
}: {
    setting: AccountTypeSetting;
    onSave: (id: number, price: number, desc: string, maxOrdonnances: number | null, maxRappels: number | null) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [price, setPrice] = useState(setting.price || 0);
    const [desc, setDesc] = useState(setting.description || "");
    const [maxOrdo, setMaxOrdo] = useState<number | string>(setting.maxOrdonnances === -1 || setting.maxOrdonnances === null ? '' : setting.maxOrdonnances);
    const [maxRappels, setMaxRappels] = useState<number | string>(setting.maxRappels === -1 || setting.maxRappels === null ? '' : setting.maxRappels);

    const icons = [<Users size={22} />, <Briefcase size={22} />, <Pill size={22} />, <Shield size={22} />];
    const icon = icons[(setting.id - 1) % icons.length];

    // Color accent per plan
    const accents = [TEAL, EMERALD, "#f59e0b", "#8b5cf6"];
    const accent = accents[(setting.id - 1) % accents.length];

    return (
        <motion.div
            whileHover={{ y: -4 }}
            className="bg-white rounded-[2rem] p-6 border shadow-sm transition-all"
            style={{ borderColor: "#e2e8f0" }}
        >
            <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md" style={{ background: accent }}>
                    {icon}
                </div>
                {!isEditing ? (
                    <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-100" onClick={() => setIsEditing(true)}>
                        <Edit2 size={15} className="text-slate-400" />
                    </Button>
                ) : (
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-emerald-50 text-emerald-600"
                            onClick={() => {
                                const pMaxOrdo = maxOrdo === '' ? null : Number(maxOrdo);
                                const pMaxRappels = maxRappels === '' ? null : Number(maxRappels);
                                onSave(setting.id, price, desc, pMaxOrdo, pMaxRappels);
                                setIsEditing(false);
                            }}>
                            <Check size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-red-50 text-red-500"
                            onClick={() => {
                                setPrice(setting.price || 0);
                                setDesc(setting.description || "");
                                setMaxOrdo(setting.maxOrdonnances === -1 || setting.maxOrdonnances === null ? '' : setting.maxOrdonnances);
                                setMaxRappels(setting.maxRappels === -1 || setting.maxRappels === null ? '' : setting.maxRappels);
                                setIsEditing(false);
                            }}>
                            <X size={15} />
                        </Button>
                    </div>
                )}
            </div>

            <h4 className="text-base font-black text-slate-800 mb-2">{setting.name}</h4>

            {isEditing ? (
                <div className="space-y-3 mt-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Prix (FCFA)</label>
                        <Input
                            type="number"
                            value={price}
                            onChange={e => setPrice(parseInt(e.target.value))}
                            className="bg-slate-50 border-slate-200 h-10 rounded-xl text-sm text-slate-800"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Description</label>
                        <Input
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            className="bg-slate-50 border-slate-200 h-10 rounded-xl text-sm text-slate-800"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1" title="Laissez vide pour illimité">Ordonnances Max</label>
                            <Input
                                type="number"
                                placeholder="Illimité"
                                value={maxOrdo}
                                onChange={e => setMaxOrdo(e.target.value)}
                                className="bg-slate-50 border-slate-200 h-10 rounded-xl text-sm text-slate-800 placeholder:text-teal-500 placeholder:italic"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1" title="Laissez vide pour illimité">Rappels Max</label>
                            <Input
                                type="number"
                                placeholder="Illimité"
                                value={maxRappels}
                                onChange={e => setMaxRappels(e.target.value)}
                                className="bg-slate-50 border-slate-200 h-10 rounded-xl text-sm text-slate-800 placeholder:text-teal-500 placeholder:italic"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <p className="text-sm text-slate-500 leading-relaxed mb-4">{setting.description || "Aucune description"}</p>

                    <div className="flex gap-2 mb-4">
                        <span className="flex-1 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-xs flex flex-col items-center justify-center">
                            <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Ordonnances</span>
                            <span className="font-extrabold text-slate-700">{setting.maxOrdonnances === -1 || setting.maxOrdonnances === null ? '∞ Illimité' : setting.maxOrdonnances}</span>
                        </span>
                        <span className="flex-1 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-xs flex flex-col items-center justify-center">
                            <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Rappels</span>
                            <span className="font-extrabold text-slate-700">{setting.maxRappels === -1 || setting.maxRappels === null ? '∞ Illimité' : setting.maxRappels}</span>
                        </span>
                    </div>

                    <div className="pt-4 border-t flex items-end justify-between" style={{ borderColor: "#f1f5f9" }}>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tarification</p>
                            <p className="text-2xl font-black tracking-tighter" style={{ color: accent }}>
                                {(setting.price || 0).toLocaleString()}
                                <span className="text-xs font-bold text-slate-400 ml-1">FCFA /mois</span>
                            </p>
                        </div>
                        <div className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase" style={{ background: `${accent}15`, color: accent }}>
                            Actif
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
}
