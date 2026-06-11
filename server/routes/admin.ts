import { Router } from "express";
import { db } from "../db";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(process.cwd(), "public", "uploads");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Saves a base64 image string to the uploads directory and returns the public URL.
 */
function saveBase64Image(base64Data: string, prefix: string = "med"): string {
    if (!base64Data || !base64Data.startsWith("data:image/")) return base64Data;

    try {
        const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return base64Data;

        const type = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const extension = type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1];
        const filename = `${prefix}_${Date.now()}.${extension}`;
        const filePath = path.join(uploadsDir, filename);

        fs.writeFileSync(filePath, buffer);
        return `/uploads/${filename}`;
    } catch (error) {
        console.error("Error saving image:", error);
        return base64Data;
    }
}


const router = Router();

const medicationSchema = z.object({
    name: z.string().trim().min(2).max(255),
    unitId: z.number().int().nullable().optional(),
    defaultDose: z.number().nonnegative().nullable().optional(),
    description: z.string().max(2000).optional().default(""),
    photoUrl: z.string().max(4000000).optional().default(""),
    price: z.string().max(50).optional().default(""),
    typeUtilisation: z.enum(["comprime", "sirop", "gelule", "pommade", "goutte", "spray", "injection"]).optional().default("comprime"),
    precautionAlimentaire: z.enum(["aucune", "eviter_alcool", "boire_beaucoup_eau", "eviter_produits_laitiers", "eviter_pamplemousse"]).optional().default("aucune"),
    posology: z.object({
        categorieAge: z.string().trim().min(1).max(100),
        doseRecommandee: z.number().nonnegative(),
        unitId: z.number().int().optional(),
    }).optional(),
});

import { verifyRole } from "../middleware/auth";
import {
    isDefaultAdminUserId,
    PROTECTED_ADMIN_DELETE_ERROR,
    PROTECTED_ADMIN_PHONE_ERROR,
    PROTECTED_ADMIN_TYPE_ERROR,
} from "../utils/protectedAdmin";
import { getCronIntervalMs, setCronIntervalMs } from "../services/reminderWorker";

// Middleware to check if user is admin
router.use(verifyRole(["Administrateur"]));

// Global system statistics
router.get("/stats", (_req, res) => {
    try {
        const userCount = db.prepare("SELECT COUNT(*) as count FROM Utilisateurs").get() as { count: number };
        const prescriptionCount = db.prepare("SELECT COUNT(*) as count FROM Ordonnances").get() as { count: number };
        const medicationCount = db.prepare("SELECT COUNT(*) as count FROM Medicaments").get() as { count: number };
        const pharmacyCount = db.prepare("SELECT COUNT(*) as count FROM Pharmacies").get() as { count: number };

        const latestUsers = db.prepare(`
            SELECT u.id_utilisateur as id, u.cree_le as createdAt, COALESCE(p.nom_complet, u.numero_telephone, 'Utilisateur') as label
            FROM Utilisateurs u
            LEFT JOIN ProfilsUtilisateurs p ON p.id_utilisateur = u.id_utilisateur
            ORDER BY u.id_utilisateur DESC
            LIMIT 2
        `).all() as { id: number; createdAt?: string; label: string }[];

        const latestPrescriptions = db.prepare(`
            SELECT id_ordonnance as id, date_ordonnance as createdAt, COALESCE(titre, 'Ordonnance') as label
            FROM Ordonnances
            ORDER BY id_ordonnance DESC
            LIMIT 2
        `).all() as { id: number; createdAt?: string; label: string }[];

        const latestPharmacies = db.prepare(`
            SELECT id_pharmacie as id, nom_pharmacie as label, adresse as createdAt
            FROM Pharmacies
            ORDER BY id_pharmacie DESC
            LIMIT 2
        `).all() as { id: number; createdAt?: string; label: string }[];

        const recentActivity = [
            ...latestUsers.map((u) => ({ id: `u-${u.id}`, type: "user", message: `Nouveau compte: ${u.label}`, time: u.createdAt || "Récent" })),
            ...latestPrescriptions.map((o) => ({ id: `o-${o.id}`, type: "prescription", message: `Ordonnance: ${o.label}`, time: o.createdAt || "Récent" })),
            ...latestPharmacies.map((p) => ({ id: `p-${p.id}`, type: "pharmacy", message: `Pharmacie: ${p.label}`, time: p.createdAt || "Récent" })),
        ].slice(0, 6);

        res.json({
            users: userCount.count,
            prescriptions: prescriptionCount.count,
            medications: medicationCount.count,
            pharmacies: pharmacyCount.count,
            recentActivity
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch admin stats" });
    }
});

// Monthly activity statistics for charts
router.get("/monthly-activity", (_req, res) => {
    try {
        // Get prescriptions per month for the last 7 months
        const prescriptionsByMonth = db.prepare(`
            SELECT 
                strftime('%m', date_ordonnance) as month,
                strftime('%Y', date_ordonnance) as year,
                COUNT(*) as count
            FROM Ordonnances
            WHERE date_ordonnance >= date('now', '-7 months')
            GROUP BY year, month
            ORDER BY year, month
        `).all() as { month: string; year: string; count: number }[];

        // Get user registrations per month
        const visitsByMonth = db.prepare(`
            SELECT 
                strftime('%m', cree_le) as month,
                strftime('%Y', cree_le) as year,
                COUNT(*) as count
            FROM Utilisateurs
            WHERE cree_le >= date('now', '-7 months')
            GROUP BY year, month
            ORDER BY year, month
        `).all() as { month: string; year: string; count: number }[];

        const medicationsByMonth = db.prepare(`
            SELECT
                strftime('%m', date_ajout) as month,
                strftime('%Y', date_ajout) as year,
                COUNT(*) as count
            FROM Medicaments
            WHERE date_ajout >= date('now', '-7 months')
            GROUP BY year, month
            ORDER BY year, month
        `).all() as { month: string; year: string; count: number }[];

        let pharmaciesByMonth: { month: string; year: string; count: number }[] = [];
        try {
            pharmaciesByMonth = db.prepare(`
                SELECT
                    strftime('%m', mis_a_jour_le) as month,
                    strftime('%Y', mis_a_jour_le) as year,
                    COUNT(*) as count
                FROM PharmaciesGarde
                WHERE mis_a_jour_le >= date('now', '-7 months')
                GROUP BY year, month
                ORDER BY year, month
            `).all() as { month: string; year: string; count: number }[];
        } catch {
            pharmaciesByMonth = [];
        }

        // Generate last 7 months labels (chronological order)
        const months = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleDateString('fr-FR', { month: 'short' })
            });
        }

        // Map data to months
        const data = months.map(m => {
            const presc = prescriptionsByMonth.find(p => `${p.year}-${p.month}` === m.key);
            const inscriptions = visitsByMonth.find(v => `${v.year}-${v.month}` === m.key);
            const meds = medicationsByMonth.find(v => `${v.year}-${v.month}` === m.key);
            const pharmacies = pharmaciesByMonth.find(v => `${v.year}-${v.month}` === m.key);
            return {
                name: m.label.charAt(0).toUpperCase() + m.label.slice(1),
                prescriptions: presc?.count || 0,
                inscriptions: inscriptions?.count || 0,
                medications: meds?.count || 0,
                pharmacies: pharmacies?.count || 0,
            };
        });

        res.json(data);
    } catch (error) {
        console.error("Error fetching monthly activity:", error);
        res.status(500).json({ error: "Failed to fetch monthly activity" });
    }
});

// List all users with their account types
router.get("/users", (_req, res) => {
    try {
        const users = db.prepare(`
            SELECT u.id_utilisateur as id, u.email, u.numero_telephone as phone, tc.nom_type as type, p.nom_complet as name,
                   u.pin_hash as pin, u.pin_expires_at as pinExpiresAt, u.pin_updated_at as pinUpdatedAt
            FROM Utilisateurs u
            JOIN TypesComptes tc ON u.id_type_compte = tc.id_type_compte
            LEFT JOIN ProfilsUtilisateurs p ON u.id_utilisateur = p.id_utilisateur
            ORDER BY u.id_utilisateur DESC
        `).all() as { id: number; email: string; phone: string; type: string; name: string; pin?: string; pinExpiresAt?: string; pinUpdatedAt?: string }[];

        res.json({
            users: users.map((u) => ({
                ...u,
                protected: isDefaultAdminUserId(u.id),
            })),
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Update user type
router.put("/users/:id", (req, res) => {
    const { id } = req.params;
    const { id_type_compte } = req.body;

    if (isDefaultAdminUserId(id)) {
        return res.status(403).json({ error: PROTECTED_ADMIN_TYPE_ERROR });
    }

    try {
        db.prepare("UPDATE Utilisateurs SET id_type_compte = ? WHERE id_utilisateur = ?").run(id_type_compte, id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to update user" });
    }
});

// Delete user
router.delete("/users/:id", (req, res) => {
    const { id } = req.params;

    if (isDefaultAdminUserId(id)) {
        return res.status(403).json({ error: PROTECTED_ADMIN_DELETE_ERROR });
    }

    try {
        db.prepare("DELETE FROM Utilisateurs WHERE id_utilisateur = ?").run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete user" });
    }
});

// Create user
router.post("/users", (req, res) => {
    const { email, phone, password, type, name } = req.body;
    try {
        const typeStr = String(type).toLowerCase();
        let typeId = 1; // "standard"
        if (typeStr === "professionnel" || typeStr === "professional" || typeStr === "pharmacien" || typeStr === "pharmacist") typeId = 2;
        if (typeStr === "administrateur" || typeStr === "admin") typeId = 4;
        // Migration: Pharmacien (3) is now merged into Professionnel (2)

        db.transaction(() => {
            const insertUser = db.prepare(`
                INSERT INTO Utilisateurs (email, mot_de_passe_hash, numero_telephone, id_type_compte)
                VALUES (?, ?, ?, ?)
            `).run(email || undefined, password || 'defaultpassword123', phone || undefined, typeId);

            const userId = insertUser.lastInsertRowid;

            if (name) {
                db.prepare(`
                    INSERT INTO ProfilsUtilisateurs (id_utilisateur, nom_complet)
                    VALUES (?, ?)
                `).run(userId, name);
            }
        })();

        res.status(201).json({ success: true });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Failed to create user" });
    }
});

// Medications management
router.get("/medications", (_req, res) => {
    try {
        const medications = db.prepare(`
            SELECT id_medicament as id, nom as name, id_unite_par_defaut as unitId, dose_par_defaut as defaultDose,
                   description, photo_url as photoUrl, prix as price, type_utilisation as typeUtilisation,
                   precaution_alimentaire as precautionAlimentaire
            FROM Medicaments
            ORDER BY nom ASC
        `).all();
        res.json({ medications });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch medications" });
    }
});

// Get single medication by ID
router.get("/medications/:id", (req, res) => {
    const { id } = req.params;
    try {
        const medication = db.prepare(`
            SELECT id_medicament as id, nom as name, id_unite_par_defaut as unitId, dose_par_defaut as defaultDose,
                   description, photo_url as photoUrl, prix as price, type_utilisation as typeUtilisation,
                   precaution_alimentaire as precautionAlimentaire
            FROM Medicaments
            WHERE id_medicament = ?
        `).get(id);

        if (!medication) {
            return res.status(404).json({ error: "Medication not found" });
        }

        res.json({ medication });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch medication" });
    }
});

// Add medication
router.post("/medications", (req, res) => {
    const parsed = medicationSchema.safeParse({
        ...req.body,
        unitId: req.body?.unitId !== undefined && req.body?.unitId !== null ? Number(req.body.unitId) : null,
        defaultDose: req.body?.defaultDose !== undefined && req.body?.defaultDose !== null ? Number(req.body.defaultDose) : null,
        posology: req.body?.posology
            ? {
                ...req.body.posology,
                doseRecommandee: Number(req.body.posology.doseRecommandee),
                unitId: req.body.posology.unitId !== undefined ? Number(req.body.posology.unitId) : undefined,
            }
            : undefined,
    });

    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid medication payload" });
    }

    const { name, unitId, defaultDose, description, photoUrl, price, typeUtilisation, precautionAlimentaire, posology } = parsed.data;

    try {
        const finalPhotoUrl = saveBase64Image(photoUrl || "", "med");

        const insertTx = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO Medicaments
                (nom, id_unite_par_defaut, dose_par_defaut, description, photo_url, prix, type_utilisation, precaution_alimentaire)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(name, unitId, defaultDose, description, finalPhotoUrl, price, typeUtilisation, precautionAlimentaire);

            const medicationId = Number(result.lastInsertRowid);

            if (posology) {
                db.prepare(`
                    INSERT INTO PosologieDefautMedicaments (id_medicament, categorie_age, dose_recommandee, id_unite)
                    VALUES (?, ?, ?, ?)
                `).run(medicationId, posology.categorieAge, posology.doseRecommandee, posology.unitId ?? unitId ?? null);
            }

            return medicationId;
        });

        const id = insertTx();
        res.status(201).json({ id });
    } catch (error) {
        res.status(500).json({ error: "Failed to create medication" });
    }
});

// Update medication
router.put("/medications/:id", (req, res) => {
    const { id } = req.params;
    const parsed = medicationSchema.safeParse({
        ...req.body,
        unitId: req.body?.unitId !== undefined && req.body?.unitId !== null ? Number(req.body.unitId) : null,
        defaultDose: req.body?.defaultDose !== undefined && req.body?.defaultDose !== null ? Number(req.body.defaultDose) : null,
        posology: req.body?.posology
            ? {
                ...req.body.posology,
                doseRecommandee: Number(req.body.posology.doseRecommandee),
                unitId: req.body.posology.unitId !== undefined ? Number(req.body.posology.unitId) : undefined,
            }
            : undefined,
    });

    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid medication payload" });
    }

    const { name, unitId, defaultDose, description, photoUrl, price, typeUtilisation, precautionAlimentaire, posology } = parsed.data;
    try {
        const finalPhotoUrl = saveBase64Image(photoUrl || "", "med");

        const updateTx = db.transaction(() => {
            db.prepare(`
                UPDATE Medicaments
                SET nom = ?, id_unite_par_defaut = ?, dose_par_defaut = ?, description = ?, photo_url = ?, prix = ?,
                    type_utilisation = ?, precaution_alimentaire = ?
                WHERE id_medicament = ?
            `).run(name, unitId, defaultDose, description, finalPhotoUrl, price, typeUtilisation, precautionAlimentaire, id);

            if (posology) {
                db.prepare("DELETE FROM PosologieDefautMedicaments WHERE id_medicament = ? AND categorie_age = ?")
                    .run(id, posology.categorieAge);
                db.prepare(`
                    INSERT INTO PosologieDefautMedicaments (id_medicament, categorie_age, dose_recommandee, id_unite)
                    VALUES (?, ?, ?, ?)
                `).run(id, posology.categorieAge, posology.doseRecommandee, posology.unitId ?? unitId ?? null);
            }
        });

        updateTx();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to update medication" });
    }
});

// Delete all medications
router.delete("/medications/all", (req, res) => {
    try {
        db.transaction(() => {
            // Delete dependent records first to avoid FK constraint issues
            db.prepare("DELETE FROM StockMedicamentsPharmacie").run();
            db.prepare("DELETE FROM PosologieDefautMedicaments").run();
            db.prepare("DELETE FROM InteractionsMedicaments").run();
            db.prepare("DELETE FROM ElementsOrdonnance").run();
            // Finally delete all medications
            db.prepare("DELETE FROM Medicaments").run();
        })();
        res.json({ success: true, message: "Tous les médicaments ont été supprimés." });
    } catch (error) {
        console.error("Failed to delete all medications:", error);
        res.status(500).json({ error: "Failed to delete all medications" });
    }
});

// Delete medication
router.delete("/medications/:id", (req, res) => {
    const { id } = req.params;
    try {
        db.prepare("DELETE FROM Medicaments WHERE id_medicament = ?").run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete medication" });
    }
});

// Account Types Settings (join with FraisComptesProfessionnels for pricing)
router.get("/settings", (_req, res) => {
    try {
        const types = db.prepare(`
            SELECT tc.id_type_compte as id, tc.nom_type as name, tc.description,
                   tc.max_ordonnances as maxOrdonnances, tc.max_rappels as maxRappels,
                   COALESCE(f.montant, 0) as price, COALESCE(f.devise, 'FCFA') as currency
            FROM TypesComptes tc
            LEFT JOIN FraisComptesProfessionnels f ON tc.id_type_compte = f.id_type_compte
            ORDER BY tc.id_type_compte ASC
        `).all();
        res.json({ types });
    } catch (error) {
        console.error("Settings fetch error:", error);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

router.put("/settings/:id", (req, res) => {
    const { id } = req.params;
    const { price, description, maxOrdonnances, maxRappels } = req.body;
    try {
        // Update description and limits in TypesComptes
        db.prepare("UPDATE TypesComptes SET description = ?, max_ordonnances = ?, max_rappels = ? WHERE id_type_compte = ?")
            .run(description, maxOrdonnances, maxRappels, id);
        // Upsert pricing in FraisComptesProfessionnels
        db.prepare(`
            INSERT INTO FraisComptesProfessionnels (id_type_compte, montant, devise)
            VALUES (?, ?, 'FCFA')
            ON CONFLICT(id_type_compte) DO UPDATE SET montant = excluded.montant
        `).run(id, price);
        res.json({ success: true });
    } catch (error) {
        console.error("Settings update error:", error);
        res.status(500).json({ error: "Failed to update settings" });
    }
});

// List all pharmacies
router.get("/pharmacies", (_req, res) => {
    try {
        const pharmacies = db.prepare(`
            SELECT p.id_pharmacie as id, p.nom_pharmacie as name, p.adresse as address, p.telephone as phone, 
                   COUNT(sp.id_medicament) as stockCount, u.nom_complet as ownerName
            FROM Pharmacies p
            LEFT JOIN StockMedicamentsPharmacie sp ON p.id_pharmacie = sp.id_pharmacie
            LEFT JOIN ProfilsUtilisateurs u ON p.id_pharmacien = u.id_utilisateur
            GROUP BY p.id_pharmacie
            ORDER BY p.id_pharmacie DESC
        `).all();
        res.json({ pharmacies });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pharmacies" });
    }
});

// List account upgrade requests
router.get("/upgrade-requests", (_req, res) => {
    try {
        const requests = db.prepare(`
            SELECT r.id_request as id, r.id_utilisateur as userId, r.requested_type as requestedType,
                   r.status, r.motive, r.admin_notes as adminNotes, r.created_at as createdAt,
                   COALESCE(p.nom_complet, u.numero_telephone, 'Utilisateur') as userName,
                   u.numero_telephone as userPhone
            FROM UpgradeRequests r
            JOIN Utilisateurs u ON r.id_utilisateur = u.id_utilisateur
            LEFT JOIN ProfilsUtilisateurs p ON u.id_utilisateur = p.id_utilisateur
            ORDER BY r.created_at DESC
        `).all();
        res.json({ requests });
    } catch (error) {
        console.error("Error fetching upgrade requests:", error);
        res.status(500).json({ error: "Failed to fetch upgrade requests" });
    }
});

// Process account upgrade request
router.post("/upgrade-requests/:id/process", (req, res) => {
    const { id } = req.params;
    const { status, adminNotes, processedBy } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    try {
        db.transaction(() => {
            // Update request status
            db.prepare(`
                UPDATE UpgradeRequests 
                SET status = ?, admin_notes = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
                WHERE id_request = ?
            `).run(status, adminNotes || null, processedBy || null, id);

            if (status === 'approved') {
                const request = db.prepare("SELECT id_utilisateur, requested_type FROM UpgradeRequests WHERE id_request = ?").get(id) as { id_utilisateur: number, requested_type: string };
                
                if (request) {
                    // Resolve type name to ID
                    let typeId = 1;
                    const typeName = request.requested_type.toLowerCase();
                    if (typeName === 'commercial') typeId = 3;
                    else if (typeName === 'pro' || typeName === 'professionnel') typeId = 2;
                    else if (typeName === 'admin' || typeName === 'administrateur') typeId = 4;

                    db.prepare("UPDATE Utilisateurs SET id_type_compte = ? WHERE id_utilisateur = ?").run(typeId, request.id_utilisateur);
                }
            }
        })();
        res.json({ success: true });
    } catch (error) {
        console.error("Error processing upgrade request:", error);
        res.status(500).json({ error: "Failed to process request" });
    }
});

// Commercial Management
router.get("/commercials", (_req, res) => {
    try {
        const commercials = db.prepare(`
            SELECT u.id_utilisateur as id, u.numero_telephone as phone, p.nom_complet as name,
                   (SELECT COUNT(*) FROM Utilisateurs WHERE id_createur = u.id_utilisateur) as clientCount
            FROM Utilisateurs u
            JOIN TypesComptes tc ON u.id_type_compte = tc.id_type_compte
            LEFT JOIN ProfilsUtilisateurs p ON u.id_utilisateur = p.id_utilisateur
            WHERE tc.nom_type = 'Commercial'
            ORDER BY clientCount DESC
        `).all();
        res.json({ commercials });
    } catch (error) {
        console.error("Error fetching commercials:", error);
        res.status(500).json({ error: "Failed to fetch commercials" });
    }
});

router.get("/commercial-clients/:id", (req, res) => {
    const { id } = req.params;
    try {
        const clients = db.prepare(`
            SELECT u.id_utilisateur as id, u.email, u.numero_telephone as phone, p.nom_complet as name, u.est_valide as isValid, u.cree_le as createdAt
            FROM Utilisateurs u
            LEFT JOIN ProfilsUtilisateurs p ON u.id_utilisateur = p.id_utilisateur
            WHERE u.id_createur = ?
            ORDER BY u.cree_le DESC
        `).all(id);
        res.json({ clients });
    } catch (error) {
        console.error("Error fetching commercial clients:", error);
        res.status(500).json({ error: "Failed to fetch clients" });
    }
});

router.patch("/reassign-client", (req, res) => {
    const { clientId, newCommercialId } = req.body;
    if (!clientId || !newCommercialId) {
        return res.status(400).json({ error: "ClientId and newCommercialId are required" });
    }
    try {
        db.prepare("UPDATE Utilisateurs SET id_createur = ? WHERE id_utilisateur = ?").run(newCommercialId, clientId);
        res.json({ success: true, message: "Client réattribué avec succès" });
    } catch (error) {
        console.error("Error reassigning client:", error);
        res.status(500).json({ error: "Failed to reassign client" });
    }
});

router.get("/unassigned-clients", (_req, res) => {
    try {
        const clients = db.prepare(`
            SELECT u.id_utilisateur as id, u.email, u.numero_telephone as phone, p.nom_complet as name, u.est_valide as isValid, u.cree_le as createdAt
            FROM Utilisateurs u
            LEFT JOIN ProfilsUtilisateurs p ON u.id_utilisateur = p.id_utilisateur
            JOIN TypesComptes tc ON u.id_type_compte = tc.id_type_compte
            WHERE u.id_createur IS NULL AND tc.nom_type = 'Standard'
            ORDER BY u.cree_le DESC
        `).all();
        res.json({ clients });
    } catch (error) {
        console.error("Error fetching unassigned clients:", error);
        res.status(500).json({ error: "Failed to fetch unassigned clients" });
    }
});

router.patch("/users/:id", (req, res) => {
    const { id } = req.params;
    const { phone, name, email } = req.body;

    try {
        const user = db.prepare("SELECT id_utilisateur FROM Utilisateurs WHERE id_utilisateur = ?").get(id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (phone && isDefaultAdminUserId(id)) {
            return res.status(403).json({ error: PROTECTED_ADMIN_PHONE_ERROR });
        }

        if (email) {
            const existing = db.prepare("SELECT id_utilisateur FROM Utilisateurs WHERE email = ? AND id_utilisateur != ?").get(email, id);
            if (existing) {
                return res.status(400).json({ error: "Cette adresse email est déjà utilisée par un autre utilisateur." });
            }
        }

        if (phone) {
            db.prepare("UPDATE Utilisateurs SET numero_telephone = ? WHERE id_utilisateur = ?").run(phone, id);
        }

        if (email !== undefined) {
            db.prepare("UPDATE Utilisateurs SET email = ? WHERE id_utilisateur = ?").run(email || null, id);
        }

        if (name !== undefined) {
            // Check if profile exists
            const profile = db.prepare("SELECT id_utilisateur FROM ProfilsUtilisateurs WHERE id_utilisateur = ?").get(id);
            if (profile) {
                db.prepare("UPDATE ProfilsUtilisateurs SET nom_complet = ? WHERE id_utilisateur = ?").run(name, id);
            } else {
                db.prepare("INSERT INTO ProfilsUtilisateurs (id_utilisateur, nom_complet) VALUES (?, ?)").run(id, name);
            }
        }

        res.json({ success: true, message: "Informations utilisateur mises à jour" });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Failed to update user" });
    }
});

// Get current cron interval configuration
router.get("/cron-config", (_req, res) => {
    const intervalMs = getCronIntervalMs();
    res.json({
        intervalMs,
        intervalSeconds: intervalMs / 1000,
        intervalMinutes: intervalMs / 60000,
        limits: { minSeconds: 30, maxMinutes: 60 },
    });
});

// Update cron interval configuration
router.put("/cron-config", (req, res) => {
    const { intervalSeconds } = req.body;
    const seconds = Number(intervalSeconds);

    if (!Number.isFinite(seconds) || seconds < 30 || seconds > 3600) {
        return res.status(400).json({
            error: "L'intervalle doit être compris entre 30 secondes et 60 minutes (3600 secondes).",
        });
    }

    setCronIntervalMs(seconds * 1000);
    const actual = getCronIntervalMs();

    console.log(`[Admin] Cron interval updated to ${actual / 1000}s by admin.`);
    res.json({
        success: true,
        message: `Intervalle mis à jour : ${actual / 1000} secondes.`,
        intervalMs: actual,
        intervalSeconds: actual / 1000,
    });
});

export const adminRouter = router;
