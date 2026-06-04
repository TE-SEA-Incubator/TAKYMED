import { Router } from "express";
import { db } from "../db";
import {
    countActiveOrdonnances,
    countPendingRappels,
    isUnlimited,
    refreshOrdonnanceActiveState,
} from "../services/accountLimits";
import { resolveAccountLimits } from "../services/prescriptionAccessService";

const router = Router();

function estimateReminderCount(type: string, intervalHours: any, durationDays: any, times: any): number {
    const days = Number(durationDays) || 0;
    if (days <= 0 || type === "prn") return 0;

    if (type === "interval" && Number(intervalHours) > 0) {
        const interval = Number(intervalHours);
        let countPerDay = 0;
        let hour = 0;
        while (hour < 24) {
            countPerDay += 1;
            hour += interval;
        }
        return countPerDay * days;
    }

    const timesPerDay = Array.isArray(times) && times.length > 0 ? times.length : 1;
    return timesPerDay * days;
}

// Get all ordonnances for a user with stats
router.get("/", (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
    }

    try {
        const ordonnances = db.prepare(`
            SELECT 
                o.id_ordonnance as id,
                o.titre,
                o.nom_patient,
                o.poids_patient,
                o.categorie_age,
                o.date_ordonnance,
                o.est_active,
                u.numero_telephone as phone,
                COUNT(DISTINCT eo.id_element_ordonnance) as nombre_medicaments,
                COUNT(cp.id_calendrier_prise) as prises_totales,
                SUM(CASE WHEN cp.statut_prise = 1 THEN 1 ELSE 0 END) as prises_effectuees
            FROM Ordonnances o
            LEFT JOIN ElementsOrdonnance eo ON o.id_ordonnance = eo.id_ordonnance
            LEFT JOIN CalendrierPrises cp ON eo.id_element_ordonnance = cp.id_element_ordonnance
            JOIN Utilisateurs u ON o.id_utilisateur = u.id_utilisateur
            WHERE o.id_utilisateur = ?
            GROUP BY o.id_ordonnance
            ORDER BY o.date_ordonnance DESC
        `).all(userId);

        res.json({ ordonnances });
    } catch (error) {
        console.error("Failed to fetch ordonnances:", error);
        res.status(500).json({ error: "Failed to fetch ordonnances" });
    }
});

// Get single ordonnance details with medicaments and rappels
router.get("/:id", (req, res) => {
    const { id } = req.params;

    try {
        const ordonnance = db.prepare(`
            SELECT 
                o.id_ordonnance as id,
                o.titre,
                o.nom_patient,
                o.poids_patient,
                o.categorie_age,
                o.date_ordonnance,
                o.est_active,
                u.numero_telephone as phone
            FROM Ordonnances o
            JOIN Utilisateurs u ON o.id_utilisateur = u.id_utilisateur
            WHERE o.id_ordonnance = ?
        `).get(id);

        if (!ordonnance) {
            return res.status(404).json({ error: "Ordonnance not found" });
        }

        const medicaments = db.prepare(`
            SELECT 
                eo.id_element_ordonnance as id,
                m.nom as medicament,
                eo.dose_personnalisee as dose,
                eo.type_frequence,
                eo.intervalle_heures,
                eo.duree_jours
            FROM ElementsOrdonnance eo
            JOIN Medicaments m ON eo.id_medicament = m.id_medicament
            WHERE eo.id_ordonnance = ?
        `).all(id);

        // Get upcoming rappels (prises non effectuées)
        const rappels = db.prepare(`
            SELECT 
                cp.id_calendrier_prise as id,
                m.nom as medicament,
                eo.dose_personnalisee as dose,
                cp.heure_prevue,
                cp.statut_prise
            FROM CalendrierPrises cp
            JOIN ElementsOrdonnance eo ON cp.id_element_ordonnance = eo.id_element_ordonnance
            JOIN Medicaments m ON eo.id_medicament = m.id_medicament
            WHERE eo.id_ordonnance = ?
            ORDER BY cp.heure_prevue ASC
            LIMIT 20
        `).all(id);

        res.json({ ordonnance, medicaments, rappels });
    } catch (error) {
        console.error("Failed to fetch ordonnance:", error);
        res.status(500).json({ error: "Failed to fetch ordonnance" });
    }
});

// Update ordonnance
// Update ordonnance
router.put("/:id", (req, res) => {
    const { id } = req.params;
    const { titre, nom_patient, poids_patient, categorie_age } = req.body;
    const userId = req.headers["x-user-id"];

    console.log("Updating ordonnance:", id, { titre, nom_patient, poids_patient, categorie_age });

    try {
        if (userId) {
            const user = db.prepare("SELECT id_type_compte FROM Utilisateurs WHERE id_utilisateur = ?").get(userId) as { id_type_compte: number } | undefined;
            if (user?.id_type_compte === 3) {
                return res.status(403).json({ error: "Les commerciaux ne peuvent pas modifier les ordonnances après création." });
            }
        }

        const result = db.prepare(`
            UPDATE Ordonnances 
            SET titre = ?, nom_patient = ?, poids_patient = ?, categorie_age = ?
            WHERE id_ordonnance = ?
        `).run(titre || null, nom_patient || null, poids_patient || null, categorie_age || 'adulte', id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Ordonnance not found" });
        }

        res.json({ success: true, message: "Ordonnance mise à jour" });
    } catch (error) {
        console.error("Failed to update ordonnance:", error);
        res.status(500).json({ error: "Failed to update ordonnance" });
    }
});

// Cancel an ordonnance
router.patch("/:id/cancel", (req, res) => {
    const { id } = req.params;

    try {
        const result = db.prepare(`
            UPDATE Ordonnances 
            SET est_active = 0 
            WHERE id_ordonnance = ?
        `).run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Ordonnance not found" });
        }

        res.json({ success: true, message: "Ordonnance annulée" });
    } catch (error) {
        console.error("Failed to cancel ordonnance:", error);
        res.status(500).json({ error: "Failed to cancel ordonnance" });
    }
});

// Reactivate an ordonnance
router.patch("/:id/reactivate", (req, res) => {
    const { id } = req.params;

    try {
        const ordonnanceMeta = db.prepare(`
            SELECT id_ordonnance, id_utilisateur, est_active
            FROM Ordonnances
            WHERE id_ordonnance = ?
        `).get(id) as { id_ordonnance: number; id_utilisateur: number; est_active: number } | undefined;

        if (!ordonnanceMeta) {
            return res.status(404).json({ error: "Ordonnance not found" });
        }

        if (Number(ordonnanceMeta.est_active) === 1) {
            return res.json({ success: true, message: "Ordonnance déjà active" });
        }

        refreshOrdonnanceActiveState(ordonnanceMeta.id_utilisateur);

        const limits = resolveAccountLimits(ordonnanceMeta.id_utilisateur);
        if (!limits) {
            return res.status(404).json({ error: "Compte utilisateur introuvable" });
        }

        const activeOrdonnances = countActiveOrdonnances(ordonnanceMeta.id_utilisateur);
        if (!isUnlimited(limits.maxOrdonnances) && activeOrdonnances >= Number(limits.maxOrdonnances)) {
            return res.status(403).json({
                error: `Quota dépassé: vous avez déjà ${activeOrdonnances}/${limits.maxOrdonnances} ordonnance(s) active(s).`,
            });
        }

        const pendingRappelsCurrent = countPendingRappels(ordonnanceMeta.id_utilisateur);
        const pendingRappelsForOrdonnance = db.prepare(`
            SELECT COUNT(*) as count
            FROM CalendrierPrises cp
            JOIN ElementsOrdonnance eo ON cp.id_element_ordonnance = eo.id_element_ordonnance
            WHERE eo.id_ordonnance = ?
              AND cp.statut_prise = 0
        `).get(id) as { count: number };

        const projectedRappels = pendingRappelsCurrent + (pendingRappelsForOrdonnance?.count || 0);
        if (!isUnlimited(limits.maxRappels) && projectedRappels > Number(limits.maxRappels)) {
            return res.status(403).json({
                error: `Quota dépassé: cette validation créerait ${projectedRappels}/${limits.maxRappels} rappels actifs.`,
            });
        }

        const result = db.prepare(`
            UPDATE Ordonnances 
            SET est_active = 1 
            WHERE id_ordonnance = ?
        `).run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Ordonnance not found" });
        }

        res.json({ success: true, message: "Ordonnance réactivée" });
    } catch (error) {
        console.error("Failed to reactivate ordonnance:", error);
        res.status(500).json({ error: "Failed to reactivate ordonnance" });
    }
});

// Delete an ordonnance permanently
router.delete("/:id", (req, res) => {
    const { id } = req.params;
    const userId = req.headers["x-user-id"];

    try {
        if (userId) {
            const user = db.prepare("SELECT id_type_compte FROM Utilisateurs WHERE id_utilisateur = ?").get(userId) as { id_type_compte: number } | undefined;
            if (user?.id_type_compte === 3) {
                return res.status(403).json({ error: "Les commerciaux ne peuvent pas supprimer les ordonnances." });
            }
        }

        // Delete in cascade: CalendrierPrises -> ElementsOrdonnance -> Ordonnance
        db.prepare(`
            DELETE FROM CalendrierPrises 
            WHERE id_element_ordonnance IN (
                SELECT id_element_ordonnance FROM ElementsOrdonnance WHERE id_ordonnance = ?
            )
        `).run(id);

        db.prepare(`DELETE FROM ElementsOrdonnance WHERE id_ordonnance = ?`).run(id);
        
        const result = db.prepare(`DELETE FROM Ordonnances WHERE id_ordonnance = ?`).run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Ordonnance not found" });
        }

        res.json({ success: true, message: "Ordonnance supprimée définitivement" });
    } catch (error) {
        console.error("Failed to delete ordonnance:", error);
        res.status(500).json({ error: "Failed to delete ordonnance" });
    }
});

// === MEDICAMENT ROUTES ===

// Add a medicament to an ordonnance
router.post("/:id/medicaments", (req, res) => {
    const { id } = req.params;
    const { medicamentName, dose, type_frequence, intervalle_heures, duree_jours, times } = req.body;

    if (!medicamentName) {
        return res.status(400).json({ error: "Le nom du médicament est requis" });
    }

    try {
        const ordonnanceOwner = db.prepare(`SELECT id_utilisateur FROM Ordonnances WHERE id_ordonnance = ?`).get(id) as { id_utilisateur: number } | undefined;
        if (!ordonnanceOwner) {
            return res.status(404).json({ error: "Ordonnance not found" });
        }

        const limits = resolveAccountLimits(ordonnanceOwner.id_utilisateur);
        if (!limits) {
            return res.status(404).json({ error: "Compte utilisateur introuvable" });
        }

        refreshOrdonnanceActiveState(ordonnanceOwner.id_utilisateur);

        const newReminderCount = estimateReminderCount(type_frequence, intervalle_heures, duree_jours, times);
        if (!isUnlimited(limits.maxRappels)) {
            const currentPending = countPendingRappels(ordonnanceOwner.id_utilisateur);
            if (currentPending + newReminderCount > Number(limits.maxRappels)) {
                return res.status(403).json({
                    error: `Limite de rappels atteinte (${limits.maxRappels}). Rappels actuels: ${currentPending}, nouveaux: ${newReminderCount}.`,
                });
            }
        }

        // Find or create medicament
        let med = db.prepare(`SELECT id_medicament FROM Medicaments WHERE nom = ?`).get(medicamentName);
        if (!med) {
            const result = db.prepare(`INSERT INTO Medicaments (nom) VALUES (?)`).run(medicamentName);
            med = { id_medicament: result.lastInsertRowid };
        }

        // Add to ElementsOrdonnance
        const elementResult = db.prepare(`
            INSERT INTO ElementsOrdonnance (id_ordonnance, id_medicament, dose_personnalisee, type_frequence, intervalle_heures, duree_jours)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, (med as any).id_medicament, dose || 1, type_frequence || '1x', intervalle_heures || null, duree_jours || 1);

        const elementId = elementResult.lastInsertRowid;

        // Generate CalendrierPrises based on frequency
        const ordonnanceDate = db.prepare(`SELECT date_ordonnance FROM Ordonnances WHERE id_ordonnance = ?`).get(id) as any;
        const startDate = new Date(ordonnanceDate.date_ordonnance);

        const parseTime = (timeStr: string): [number, number] => {
            const [h, m] = timeStr.split(':').map(Number);
            return [h || 8, m || 0];
        };

        const insertPrise = db.prepare(`
            INSERT INTO CalendrierPrises (id_element_ordonnance, heure_prevue, dose, id_unite, rappel_envoye, statut_prise)
            VALUES (?, ?, ?, ?, 0, 0)
        `);

        for (let day = 0; day < (duree_jours || 1); day++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(dayDate.getDate() + day);

            if (type_frequence === 'interval' && intervalle_heures) {
                let hour = 0;
                while (hour < 24) {
                    const priseDate = new Date(dayDate);
                    priseDate.setHours(hour, 0, 0, 0);
                    insertPrise.run(elementId, priseDate.toISOString(), dose || 1, 1);
                    hour += intervalle_heures;
                }
            } else {
                const timesArray = times || ['08:00'];
                timesArray.forEach((timeStr: string) => {
                    const [h, m] = parseTime(timeStr);
                    const priseDate = new Date(dayDate);
                    priseDate.setHours(h, m, 0, 0);
                    insertPrise.run(elementId, priseDate.toISOString(), dose || 1, 1);
                });
            }
        }

        res.json({ 
            success: true, 
            message: "Médicament ajouté",
            elementId 
        });
    } catch (error) {
        console.error("Failed to add medicament:", error);
        res.status(500).json({ error: "Failed to add medicament" });
    }
});

// Update a medicament
router.put("/:id/medicaments/:elementId", (req, res) => {
    const { id, elementId } = req.params;
    const { dose, type_frequence, intervalle_heures, duree_jours, times } = req.body;

    try {
        const ordonnanceOwner = db.prepare(`SELECT id_utilisateur FROM Ordonnances WHERE id_ordonnance = ?`).get(id) as { id_utilisateur: number } | undefined;
        if (!ordonnanceOwner) {
            return res.status(404).json({ error: "Ordonnance not found" });
        }

        const limits = resolveAccountLimits(ordonnanceOwner.id_utilisateur);
        if (!limits) {
            return res.status(404).json({ error: "Compte utilisateur introuvable" });
        }

        refreshOrdonnanceActiveState(ordonnanceOwner.id_utilisateur);

        const newReminderCount = estimateReminderCount(type_frequence, intervalle_heures, duree_jours, times);
        if (!isUnlimited(limits.maxRappels)) {
            const pendingExcludingCurrent = countPendingRappels(ordonnanceOwner.id_utilisateur, Number(elementId));
            if (pendingExcludingCurrent + newReminderCount > Number(limits.maxRappels)) {
                return res.status(403).json({
                    error: `Limite de rappels atteinte (${limits.maxRappels}). Rappels actuels: ${pendingExcludingCurrent}, nouveaux: ${newReminderCount}.`,
                });
            }
        }

        // Update element
        db.prepare(`
            UPDATE ElementsOrdonnance 
            SET dose_personnalisee = ?, type_frequence = ?, intervalle_heures = ?, duree_jours = ?
            WHERE id_element_ordonnance = ? AND id_ordonnance = ?
        `).run(dose, type_frequence, intervalle_heures || null, duree_jours, elementId, id);

        // Regenerate CalendrierPrises
        // First delete existing prises
        db.prepare(`DELETE FROM CalendrierPrises WHERE id_element_ordonnance = ?`).run(elementId);

        // Get ordonnance start date
        const ordonnanceDate = db.prepare(`SELECT date_ordonnance FROM Ordonnances WHERE id_ordonnance = ?`).get(id) as any;
        const startDate = new Date(ordonnanceDate.date_ordonnance);

        const parseTime = (timeStr: string): [number, number] => {
            const [h, m] = timeStr.split(':').map(Number);
            return [h || 8, m || 0];
        };

        const insertPrise = db.prepare(`
            INSERT INTO CalendrierPrises (id_element_ordonnance, heure_prevue, dose, id_unite, rappel_envoye, statut_prise)
            VALUES (?, ?, ?, ?, 0, 0)
        `);

        for (let day = 0; day < (duree_jours || 1); day++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(dayDate.getDate() + day);

            if (type_frequence === 'interval' && intervalle_heures) {
                let hour = 0;
                while (hour < 24) {
                    const priseDate = new Date(dayDate);
                    priseDate.setHours(hour, 0, 0, 0);
                    insertPrise.run(elementId, priseDate.toISOString(), dose || 1, 1);
                    hour += intervalle_heures;
                }
            } else {
                const timesArray = times || ['08:00'];
                timesArray.forEach((timeStr: string) => {
                    const [h, m] = parseTime(timeStr);
                    const priseDate = new Date(dayDate);
                    priseDate.setHours(h, m, 0, 0);
                    insertPrise.run(elementId, priseDate.toISOString(), dose || 1, 1);
                });
            }
        }

        res.json({ success: true, message: "Médicament mis à jour" });
    } catch (error) {
        console.error("Failed to update medicament:", error);
        res.status(500).json({ error: "Failed to update medicament" });
    }
});

// Delete a medicament from ordonnance
router.delete("/:id/medicaments/:elementId", (req, res) => {
    const { elementId } = req.params;

    try {
        // Delete prises first
        db.prepare(`DELETE FROM CalendrierPrises WHERE id_element_ordonnance = ?`).run(elementId);
        
        // Delete element
        const result = db.prepare(`DELETE FROM ElementsOrdonnance WHERE id_element_ordonnance = ?`).run(elementId);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Medicament not found" });
        }

        res.json({ success: true, message: "Médicament supprimé" });
    } catch (error) {
        console.error("Failed to delete medicament:", error);
        res.status(500).json({ error: "Failed to delete medicament" });
    }
});

// === RAPPEL ROUTES ===

// Update a single prise (rappel)
router.patch("/prises/:priseId", (req, res) => {
    const { priseId } = req.params;
    const { heure_prevue, statut_prise } = req.body;

    try {
        const updates: string[] = [];
        const values: any[] = [];

        if (heure_prevue !== undefined) {
            updates.push("heure_prevue = ?");
            values.push(heure_prevue);
        }
        if (statut_prise !== undefined) {
            updates.push("statut_prise = ?");
            values.push(statut_prise ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No updates provided" });
        }

        values.push(priseId);
        
        const result = db.prepare(`
            UPDATE CalendrierPrises 
            SET ${updates.join(", ")}
            WHERE id_calendrier_prise = ?
        `).run(...values);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Prise not found" });
        }

        res.json({ success: true, message: "Prise mise à jour" });
    } catch (error) {
        console.error("Failed to update prise:", error);
        res.status(500).json({ error: "Failed to update prise" });
    }
});

// Mark all prises as taken for a day
router.patch("/:id/prises/mark-all-taken", (req, res) => {
    const { id } = req.params;
    const { date } = req.body; // Optional: specific date

    try {
        let query = `
            UPDATE CalendrierPrises 
            SET statut_prise = 1 
            WHERE id_element_ordonnance IN (
                SELECT id_element_ordonnance FROM ElementsOrdonnance WHERE id_ordonnance = ?
            )
        `;
        const params: any[] = [id];

        if (date) {
            query += " AND date(heure_prevue) = date(?)";
            params.push(date);
        }

        const result = db.prepare(query).run(...params);

        res.json({ 
            success: true, 
            message: `${result.changes} prise(s) marquée(s) comme effectuée(s)` 
        });
    } catch (error) {
        console.error("Failed to mark prises as taken:", error);
        res.status(500).json({ error: "Failed to mark prises as taken" });
    }
});

export const ordonnanceRouter = router;
