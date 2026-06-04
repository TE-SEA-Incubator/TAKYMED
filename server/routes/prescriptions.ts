import { Router } from "express";
import { db } from "../db";
import { buildUserDashboardStats } from "../services/dashboardStats";
import {
    countActiveOrdonnances,
    countPendingRappels,
    getUserAccountLimits,
    isUnlimited,
    refreshOrdonnanceActiveState,
} from "../services/accountLimits";
import { saveUserNotificationPreferences } from "../services/notificationPreferencesService";

const router = Router();

function estimateReminderCountFromMedications(medications: any[]): number {
    let total = 0;

    for (const m of medications || []) {
        if (!m || m.frequencyType === "prn") continue;

        const durationDays = Number(m.durationDays) || 0;
        if (durationDays <= 0) continue;

        if (m.frequencyType === "interval" && Number(m.intervalHours) > 0) {
            const interval = Number(m.intervalHours);
            for (let day = 0; day < durationDays; day++) {
                let currHour = 0;
                while (currHour < 24) {
                    total += 1;
                    currHour += interval;
                }
            }
            continue;
        }

        const timesPerDay = Array.isArray(m.times) ? m.times.length : 0;
        if (timesPerDay > 0) {
            total += timesPerDay * durationDays;
        }
    }

    return total;
}

// Get user prescriptions and upcoming doses
router.get("/", (req, res) => {
    const userId = req.query.userId;
    const patientId = req.query.patientId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId)) {
        return res.status(400).json({ error: "Invalid userId" });
    }

    try {
        refreshOrdonnanceActiveState(numericUserId);

        let query = `
      SELECT 
        cp.id_calendrier_prise as id,
        m.id_medicament as medicationId,
        m.nom as medicationName,
        o.nom_patient as clientName,
        o.id_ordonnance as patientId,
        eo.dose_personnalisee as dose,
        cp.heure_prevue as time,
        cp.rappel_envoye as statusReminderSent,
        cp.statut_prise as statusTaken
      FROM CalendrierPrises cp
      JOIN ElementsOrdonnance eo ON cp.id_element_ordonnance = eo.id_element_ordonnance
      JOIN Medicaments m ON eo.id_medicament = m.id_medicament
      JOIN Ordonnances o ON eo.id_ordonnance = o.id_ordonnance
      WHERE o.id_utilisateur = ? AND (o.est_active = 1 OR cp.statut_prise = 0)
      `;
        const params: any[] = [userId];

        if (patientId) {
            query += ` AND o.id_ordonnance = ?`;
            params.push(patientId);
        }

        query += ` ORDER BY cp.heure_prevue ASC`;

        const doses = db.prepare(query).all(...params);

        const mappedDoses = doses.map((d: any) => {
            const dateObj = new Date(d.time);
            const isValidDate = !isNaN(dateObj.getTime());
            return {
                id: d.id,
                medicationId: d.medicationId,
                medicationName: d.medicationName,
                clientName: d.clientName || 'Patient',
                patientId: d.patientId,
                dose: d.dose,
                unit: d.unit || "unité",
                scheduledAt: d.time,
                time: isValidDate ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : "--:--",
                day: isValidDate ? dateObj.getDate() : 1,
                statusReminderSent: !!d.statusReminderSent,
                statusTaken: !!d.statusTaken
            };
        });

        // Fetch unique patients/prescriptions for the user
        // Only include patients that have active prescriptions with pending doses
        const patientsDb = db.prepare(`
           SELECT DISTINCT o.id_ordonnance as id, o.titre as name, o.date_ordonnance as date, u.numero_telephone as phone
           FROM Ordonnances o
           JOIN ElementsOrdonnance eo ON o.id_ordonnance = eo.id_ordonnance
           JOIN CalendrierPrises cp ON eo.id_element_ordonnance = cp.id_element_ordonnance
           JOIN Utilisateurs u ON o.id_utilisateur = u.id_utilisateur
           WHERE o.id_utilisateur = ? AND o.est_active = 1 AND cp.statut_prise = 0
           ORDER BY o.date_ordonnance DESC
        `).all(userId);

        const stats = buildUserDashboardStats(numericUserId, patientId ? Number(patientId) : undefined);

        res.json({
            doses: mappedDoses,
            patients: patientsDb,
            stats,
        });
    } catch (error) {
        console.error("Failed to list prescriptions:", error);
        res.status(500).json({ error: "Server error fetching prescriptions" });
    }
});

// Create a new prescription
router.post("/", (req, res) => {
    const { userId, title, weight, categorieAge, medications, notifConfig, startDate } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }

    // Header validation (consistent with Dashboard)
    const headerUserId = req.headers['x-user-id'];
    if (headerUserId && headerUserId.toString() !== userId.toString()) {
        // Check if the requester is a commercial user who created this client
        const client = db.prepare("SELECT id_createur FROM Utilisateurs WHERE id_utilisateur = ?").get(userId) as { id_createur: number } | undefined;
        if (!client || client.id_createur?.toString() !== headerUserId.toString()) {
            return res.status(403).json({ error: "User ID mismatch or unauthorized commercial link" });
        }
    }

    const limits = getUserAccountLimits(numericUserId);
    if (!limits) {
        return res.status(404).json({ error: "User account not found" });
    }

    refreshOrdonnanceActiveState(numericUserId);

    const activeOrdonnances = countActiveOrdonnances(numericUserId);
    if (!isUnlimited(limits.maxOrdonnances) && activeOrdonnances >= Number(limits.maxOrdonnances)) {
        return res.status(403).json({
            error: `Limite d'ordonnances atteinte (${limits.maxOrdonnances}).`,
        });
    }

    const newReminderCount = estimateReminderCountFromMedications(Array.isArray(medications) ? medications : []);
    if (!isUnlimited(limits.maxRappels)) {
        const currentPendingRappels = countPendingRappels(numericUserId);
        const projectedRappels = currentPendingRappels + newReminderCount;
        if (projectedRappels > Number(limits.maxRappels)) {
            return res.status(403).json({
                error: `Limite de rappels atteinte (${limits.maxRappels}). Rappels actuels: ${currentPendingRappels}, nouveaux: ${newReminderCount}.`,
            });
        }
    }

    try {
        const insertTransaction = db.transaction(() => {
            // 1. Create Ordonnance
            const ordStmt = db.prepare(`
                INSERT INTO Ordonnances (id_utilisateur, titre, nom_patient, poids_patient, categorie_age, date_ordonnance, date_debut) 
                VALUES (?, ?, ?, ?, ?, CURRENT_DATE, ?)
            `);
            const ordInfo = ordStmt.run(userId, title, title, weight || 0, categorieAge || 'adulte', startDate || null);
            const idOrdonnance = ordInfo.lastInsertRowid;

            // 2. Save Notification Preferences (multi contacts + multi channels)
            if (notifConfig) {
                saveUserNotificationPreferences(Number(userId), notifConfig);
            }

            // 3. Iterate each Medication
            for (const m of medications) {
                let medRecord = db.prepare("SELECT id_medicament FROM Medicaments WHERE LOWER(nom) = LOWER(?)").get(m.name) as { id_medicament: number } | undefined;

                let idMedicament;
                if (!medRecord) {
                    const mStmt = db.prepare("INSERT INTO Medicaments (nom) VALUES (?)");
                    const mInfo = mStmt.run(m.name);
                    idMedicament = mInfo.lastInsertRowid;
                } else {
                    idMedicament = medRecord.id_medicament;
                }

                // Find or insert unit ID
                let unitId = 5; // Default to 'unité'
                if (m.unit) {
                    const uRecord = db.prepare("SELECT id_unite FROM Unites WHERE LOWER(nom_unite) = LOWER(?)").get(m.unit) as { id_unite: number } | undefined;
                    if (uRecord) {
                        unitId = uRecord.id_unite;
                    } else {
                        // Optionally insert new unit if not found
                        try {
                            const uInfo = db.prepare("INSERT INTO Unites (nom_unite) VALUES (?)").run(m.unit);
                            unitId = uInfo.lastInsertRowid as number;
                        } catch (e) {
                            // If insert fails (race condition or unique constraint), try fetch again
                            const uRecordRetry = db.prepare("SELECT id_unite FROM Unites WHERE LOWER(nom_unite) = LOWER(?)").get(m.unit) as { id_unite: number } | undefined;
                            if (uRecordRetry) unitId = uRecordRetry.id_unite;
                        }
                    }
                }

                // Map the frequency type to match the CHECK constraint in the DB ('matin','midi','soir','personnalise')
                const allowedFrequencies = ['matin', 'midi', 'soir'];
                const dbFrequence = allowedFrequencies.includes(m.frequencyType) ? m.frequencyType : 'personnalise';

                // Insert ElementsOrdonnance
                const eoStmt = db.prepare(`
                    INSERT INTO ElementsOrdonnance (id_ordonnance, id_medicament, type_frequence, intervalle_heures, duree_jours, dose_personnalisee, id_unite_personnalisee)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                const eoInfo = eoStmt.run(
                    idOrdonnance,
                    idMedicament,
                    dbFrequence,
                    m.intervalHours || null,
                    m.durationDays,
                    m.doseValue,
                    unitId
                );
                const idElement = eoInfo.lastInsertRowid;

                // 4. Generate CalendrierPrises Schedule
                if (m.frequencyType !== 'prn') {
                    const pStmt = db.prepare(`
                        INSERT INTO CalendrierPrises (id_element_ordonnance, heure_prevue, dose, id_unite, statut_prise)
                        VALUES (?, ?, ?, ?, 0)
                    `);

                    // Use the startDate from the request if provided, otherwise default to today
                    let baseDate: Date;
                    if (startDate && typeof startDate === 'string') {
                        // Parse YYYY-MM-DD safely as local date (noon to avoid TZ issues)
                        const [y, mm, dd] = startDate.split('-').map(Number);
                        baseDate = new Date(y, mm - 1, dd, 12, 0, 0);
                    } else {
                        baseDate = new Date();
                        baseDate.setHours(12, 0, 0, 0);
                    }

                    for (let dayOffset = 0; dayOffset < m.durationDays; dayOffset++) {
                        const currentDate = new Date(baseDate);
                        currentDate.setDate(baseDate.getDate() + dayOffset);

                        if (m.frequencyType === 'interval' && m.intervalHours) {
                            let currHour = 0;
                            while (currHour < 24) {
                                const d = new Date(currentDate);
                                d.setHours(currHour, 0, 0, 0);
                                pStmt.run(idElement, d.toISOString(), m.doseValue, unitId);
                                currHour += m.intervalHours;
                            }
                        } else if (m.times && m.times.length > 0) {
                            for (const timeStr of m.times) {
                                const [h, min] = timeStr.split(':').map(Number);
                                const d = new Date(currentDate);
                                d.setHours(h, min, 0, 0);
                                pStmt.run(idElement, d.toISOString(), m.doseValue, unitId);
                            }
                        }
                    }
                }
            }
            return idOrdonnance;
        });

        const newId = insertTransaction();
        res.status(201).json({ success: true, prescriptionId: newId });

    } catch (error) {
        console.error("Failed to save prescription:", error);
        res.status(500).json({ error: "Server error saving prescription", details: error instanceof Error ? error.message : "Unknown error" });
    }
});

router.post("/doses/:id/take", (req, res) => {
    try {
        const result = db.prepare(`
            UPDATE CalendrierPrises 
            SET statut_prise = 1 
            WHERE id_calendrier_prise = ?
        `).run(req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Dose not found" });
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Failed to mark dose as taken:", error);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/doses/:id/untake", (req, res) => {
    try {
        const result = db.prepare(`
            UPDATE CalendrierPrises 
            SET statut_prise = 0 
            WHERE id_calendrier_prise = ?
        `).run(req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Dose not found" });
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Failed to unmark dose as taken:", error);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/doses/:id/delay", (req, res) => {
    try {
        // Delay by 1 hour
        const result = db.prepare(`
            UPDATE CalendrierPrises 
            SET heure_prevue = datetime(heure_prevue, '+1 hour') 
            WHERE id_calendrier_prise = ?
        `).run(req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Dose not found" });
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Failed to delay dose:", error);
        res.status(500).json({ error: "Server error" });
    }
});

export const prescriptionRouter = router;
