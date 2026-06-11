import { Router } from "express";
import { db } from "../db";
import { notificationProvider } from "../services/notificationProvider";
import {
    assertCommercialActor,
    assertHeaderMatchesCommercial,
    checkClientAvailability,
    findCommercialClientForValidation,
    findProfileByName,
    normalizeClientName,
    normalizePhone,
} from "../services/commercialClientService";
import { insertPrescriptionForUser } from "../services/commercialPrescriptionService";
import {
    buildCommercialDashboardStats,
    listCommercialClients,
} from "../services/commercialStatsService";

import { verifyRole } from "../middleware/auth";

const router = Router();

// Only Commercials and Administrators can access commercial features
router.use(verifyRole(["Commercial", "Administrateur"]));

// Vérifier disponibilité nom / téléphone avant inscription
router.get("/check-client", (req, res) => {
    const commercialId = req.query.commercialId;
    const name = String(req.query.name || "");
    const phone = String(req.query.phone || "");
    const excludeUserId = req.query.excludeUserId ? Number(req.query.excludeUserId) : undefined;

    if (!commercialId) {
        return res.status(400).json({ error: "Commercial ID requis" });
    }

    if (!assertHeaderMatchesCommercial(req.headers["x-user-id"], Number(commercialId))) {
        return res.status(403).json({ error: "Identité commercial invalide." });
    }

    const availability = checkClientAvailability(name, phone, excludeUserId);
    res.json(availability);
});

// Endpoint for Commercial to register a new client with a mandatory prescription
router.post("/register-client", async (req, res) => {
    const { commercialId, clientPhone, clientName, prescription, startDate } = req.body;

    if (!commercialId || !clientPhone || !clientName || !prescription) {
        return res.status(400).json({ error: "Tous les champs sont requis (Commercial ID, Phone, Name, Prescription)" });
    }

    const numericCommercialId = Number(commercialId);
    if (!Number.isFinite(numericCommercialId)) {
        return res.status(400).json({ error: "Commercial ID invalide." });
    }

    if (!assertHeaderMatchesCommercial(req.headers["x-user-id"], numericCommercialId)) {
        return res.status(403).json({ error: "Identité commercial invalide." });
    }

    try {
        const actor = assertCommercialActor(numericCommercialId);
        if (!actor.ok) {
            return res.status(actor.status).json({ error: actor.error });
        }

        const normalizedName = normalizeClientName(String(clientName));
        const normalizedPhone = normalizePhone(String(clientPhone));

        if (!normalizedName) {
            return res.status(400).json({ error: "Le nom du client est requis." });
        }

        if (!normalizedPhone) {
            return res.status(400).json({ error: "Le numéro de téléphone est requis." });
        }

        const availability = checkClientAvailability(normalizedName, normalizedPhone);
        if (!availability.available) {
            return res.status(409).json({
                error: availability.errors[0],
                errors: availability.errors,
                nameAvailable: availability.nameAvailable,
                phoneAvailable: availability.phoneAvailable,
            });
        }

        const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const updatedAt = new Date().toISOString();

        const insertTransaction = db.transaction(() => {
            const userStmt = db.prepare(`
                INSERT INTO Utilisateurs (numero_telephone, pin_hash, pin_expires_at, pin_updated_at, id_type_compte, id_createur, est_valide)
                VALUES (?, ?, ?, ?, 1, ?, 0)
            `);
            const userInfo = userStmt.run(
                normalizedPhone,
                generatedPin,
                expiresAt,
                updatedAt,
                numericCommercialId,
            );
            const idUtilisateur = userInfo.lastInsertRowid as number;

            db.prepare("INSERT INTO ProfilsUtilisateurs (id_utilisateur, nom_complet) VALUES (?, ?)").run(
                idUtilisateur,
                normalizedName,
            );

            insertPrescriptionForUser(
                idUtilisateur,
                normalizedName,
                prescription,
                startDate,
            );

            return idUtilisateur;
        });

        const newUserId = insertTransaction();

        await notificationProvider
            .sendSMS(
                normalizedPhone,
                `Bienvenue sur TAKYMED ! Pour valider votre inscription faite par votre agent, donnez-lui ce code PIN : ${generatedPin}`,
            )
            .catch((err) => console.error("SMS Warning:", err));

        res.status(201).json({ success: true, clientId: newUserId });
    } catch (error) {
        console.error("Commercial register-client error:", error);
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        if (message.includes("médicament")) {
            return res.status(400).json({ error: message });
        }
        res.status(500).json({ error: "Internal server error", details: message });
    }
});

// Endpoint for adding a prescription to an existing client
router.post("/add-prescription", async (req, res) => {
    const { commercialId, clientId, prescription } = req.body;

    if (!commercialId || !clientId || !prescription) {
        return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    try {
        // Verify commercial ownership
        const client = db.prepare("SELECT id_utilisateur FROM Utilisateurs WHERE id_utilisateur = ? AND id_createur = ?").get(clientId, commercialId);
        if (!client) {
            return res.status(403).json({ error: "Accès refusé ou client non trouvé." });
        }

        const transaction = db.transaction(() => {
            const ordInfo = db.prepare(`
                INSERT INTO Ordonnances (id_utilisateur, titre, nom_patient, poids_patient, categorie_age, date_ordonnance)
                VALUES (?, ?, (SELECT nom_complet FROM ProfilsUtilisateurs WHERE id_utilisateur = ?), ?, ?, CURRENT_DATE)
            `).run(clientId, prescription.title || "Nouvelle Ordonnance", clientId, prescription.weight || 0, prescription.categorieAge || 'adulte');
            
            const idOrdonnance = ordInfo.lastInsertRowid;

            for (const m of prescription.medications) {
                 let medRecord = db.prepare("SELECT id_medicament FROM Medicaments WHERE LOWER(nom) = LOWER(?)").get(m.name) as { id_medicament: number } | undefined;
                 let idMedicament = medRecord ? medRecord.id_medicament : db.prepare("INSERT INTO Medicaments (nom) VALUES (?)").run(m.name).lastInsertRowid;

                 const eoInfo = db.prepare(`
                    INSERT INTO ElementsOrdonnance (id_ordonnance, id_medicament, type_frequence, duree_jours, dose_personnalisee, id_unite_personnalisee)
                    VALUES (?, ?, ?, ?, ?, ?)
                 `).run(idOrdonnance, idMedicament, m.frequencyType || 'matin', m.durationDays || 7, m.doseValue || 1, 5);
                 
                 const idElement = eoInfo.lastInsertRowid;
                 
                 db.prepare(`
                    INSERT INTO CalendrierPrises (id_element_ordonnance, heure_prevue, dose, id_unite, statut_prise)
                    VALUES (?, datetime('now', '+1 day'), ?, 5, 0)
                 `).run(idElement, m.doseValue || 1);
            }
        });

        transaction();
        res.json({ success: true, message: "Ordonnance ajoutée." });
    } catch (error) {
        console.error("Commercial add-prescription error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint for Commercial to validate a client using the PIN the client received
router.post("/validate-client", async (req, res) => {
    const { commercialId, clientPhone, clientId, pin } = req.body;

    if (!commercialId || !pin) {
        return res.status(400).json({ error: "Commercial ID et PIN requis." });
    }

    if (!clientPhone && (clientId == null || clientId === "")) {
        return res.status(400).json({ error: "Téléphone ou ID client requis." });
    }

    const numericCommercialId = Number(commercialId);
    if (!assertHeaderMatchesCommercial(req.headers["x-user-id"], numericCommercialId)) {
        return res.status(403).json({ error: "Identité commercial invalide." });
    }

    try {
        const normalizedPin = String(pin).trim();
        const parsedClientId =
            clientId != null && clientId !== "" ? Number(clientId) : undefined;

        const user = findCommercialClientForValidation(numericCommercialId, {
            clientId: Number.isFinite(parsedClientId) ? parsedClientId : undefined,
            phone: clientPhone ? String(clientPhone) : undefined,
        });

        if (!user) {
            return res.status(404).json({
                error:
                    "Client introuvable. Terminez d'abord l'inscription (étape précédente), puis vérifiez le numéro de téléphone.",
            });
        }

        if (user.est_valide === 1) {
            return res.status(400).json({ error: "Ce client est déjà validé." });
        }

        if (user.pin_hash !== normalizedPin) {
            return res.status(401).json({ error: "Code PIN incorrect." });
        }

        db.prepare("UPDATE Utilisateurs SET est_valide = 1 WHERE id_utilisateur = ?").run(user.id_utilisateur);

        res.json({ success: true, message: "Compte client validé avec succès." });
    } catch (error) {
        console.error("Commercial validate-client error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Aggregated stats for commercial dashboard (computed server-side)
router.get("/stats", (req, res) => {
    const commercialId = req.query.commercialId;
    if (!commercialId) return res.status(400).json({ error: "Commercial ID requis" });

    const numericCommercialId = Number(commercialId);
    if (!Number.isFinite(numericCommercialId)) {
        return res.status(400).json({ error: "Commercial ID invalide" });
    }

    if (!assertHeaderMatchesCommercial(req.headers["x-user-id"], numericCommercialId)) {
        return res.status(403).json({ error: "Identité commercial invalide." });
    }

    try {
        res.json(buildCommercialDashboardStats(numericCommercialId));
    } catch (error) {
        console.error("Commercial stats error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// List clients for a commercial user with prescription and reminder counts
router.get("/clients", (req, res) => {
    const commercialId = req.query.commercialId;
    if (!commercialId) return res.status(400).json({ error: "Commercial ID requis" });

    const numericCommercialId = Number(commercialId);
    if (!Number.isFinite(numericCommercialId)) {
        return res.status(400).json({ error: "Commercial ID invalide" });
    }

    if (!assertHeaderMatchesCommercial(req.headers["x-user-id"], numericCommercialId)) {
        return res.status(403).json({ error: "Identité commercial invalide." });
    }

    try {
        res.json({ clients: listCommercialClients(numericCommercialId) });
    } catch (error) {
        console.error("Commercial get-clients error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to update client name
router.patch("/clients/:id", (req, res) => {
    const { id } = req.params;
    const { commercialId, name } = req.body;

    if (!commercialId || !name) {
        return res.status(400).json({ error: "Commercial ID et nom requis" });
    }

    const numericCommercialId = Number(commercialId);
    const normalizedName = normalizeClientName(String(name));

    if (!normalizedName) {
        return res.status(400).json({ error: "Le nom du client est requis." });
    }

    if (!assertHeaderMatchesCommercial(req.headers["x-user-id"], numericCommercialId)) {
        return res.status(403).json({ error: "Identité commercial invalide." });
    }

    try {
        const existing = findProfileByName(normalizedName, Number(id));
        if (existing) {
            return res.status(409).json({ error: "Un client avec ce nom existe déjà dans la base de données." });
        }

        const result = db.prepare(`
            UPDATE ProfilsUtilisateurs 
            SET nom_complet = ? 
            WHERE id_utilisateur = ? 
            AND id_utilisateur IN (SELECT id_utilisateur FROM Utilisateurs WHERE id_createur = ?)
        `).run(normalizedName, id, numericCommercialId);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Client non trouvé ou non autorisé." });
        }

        db.prepare(`
            UPDATE Ordonnances
            SET nom_patient = ?
            WHERE id_utilisateur = ?
        `).run(normalizedName, id);

        res.json({ success: true, message: "Nom du client mis à jour." });
    } catch (error) {
        console.error("Commercial update-client error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to send a message to a client
router.post("/send-message", async (req, res) => {
    const { commercialId, clientId, message } = req.body;

    if (!commercialId || !clientId || !message) {
        return res.status(400).json({ error: "Commercial ID, Client ID et message requis" });
    }

    const numericCommercialId = Number(commercialId);
    if (!assertHeaderMatchesCommercial(req.headers["x-user-id"], numericCommercialId)) {
        return res.status(403).json({ error: "Identité commercial invalide." });
    }

    try {
        // Verify commercial ownership
        const client = db.prepare("SELECT id_utilisateur FROM Utilisateurs WHERE id_utilisateur = ? AND id_createur = ?").get(clientId, numericCommercialId);
        if (!client) {
            return res.status(403).json({ error: "Accès refusé ou client non trouvé." });
        }

        const commercialProfile = db.prepare("SELECT nom_complet FROM ProfilsUtilisateurs WHERE id_utilisateur = ?").get(numericCommercialId) as { nom_complet: string } | undefined;
        const senderName = commercialProfile?.nom_complet || "Votre conseiller TAKYMED";

        // Insert in-app notification
        db.prepare(`
            INSERT INTO Notifications (id_utilisateur, titre, contenu, type_notif)
            VALUES (?, ?, ?, ?)
        `).run(clientId, `Message de ${senderName}`, message, 'commercial_message');

        // Send push notification
        await sendPushToUser(Number(clientId), `Message de ${senderName}`, message).catch(err => {
            console.error("Failed to send push notification:", err);
        });

        res.json({ success: true, message: "Message envoyé avec succès" });
    } catch (error) {
        console.error("Commercial send-message error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to delete a client (used for cancellation before validation)
router.delete("/clients/:id", (req, res) => {
    const { id } = req.params;
    const finalCommercialId = (req.body && req.body.commercialId) || req.query.commercialId;

    if (!finalCommercialId) {
        return res.status(400).json({ error: "Commercial ID requis" });
    }

    try {
        // We allow deleting any client created by this commercial
        const result = db.prepare("DELETE FROM Utilisateurs WHERE id_utilisateur = ? AND id_createur = ?").run(id, finalCommercialId);
        if (result.changes === 0) {
            return res.status(404).json({ error: "Client non trouvé ou non autorisé." });
        }
        res.json({ success: true, message: "Client supprimé." });
    } catch (error) {
        console.error("Commercial delete-client error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export const commercialRouter = router;
