import { Router } from "express";
import { db } from "../db";
import { geminiGenerateText, getGeminiApiKey, parseJsonFromAiText } from "../utils/gemini";

const router = Router();

// Get all medications from the database with optional search and date filtering
router.get("/", (req, res) => {
    try {
        const isNewOnly = req.query.new === 'true';
        const searchQuery = req.query.q as string;

        let sql = `
            SELECT id_medicament as id, nom as name, description, photo_url as photoUrl, 
                   prix as price, date_ajout as dateAdded, type_utilisation as type, 
                   precaution_alimentaire as precautions
            FROM Medicaments
        `;
        const params: any[] = [];
        const whereClauses: string[] = [];

        if (isNewOnly) {
            whereClauses.push(`strftime('%m', date_ajout) = strftime('%m', 'now') AND strftime('%Y', date_ajout) = strftime('%Y', 'now')`);
        }

        if (searchQuery) {
            whereClauses.push(`(nom LIKE ? OR description LIKE ?)`);
            params.push(`%${searchQuery}%`, `%${searchQuery}%`);
        }

        if (whereClauses.length > 0) {
            sql += ` WHERE ` + whereClauses.join(" AND ");
        }

        let medications = db.prepare(sql + " ORDER BY nom ASC").all(...params);
        
        // Fallback: If "new" was requested but none found, return the most recent 5
        if (isNewOnly && medications.length === 0) {
            medications = db.prepare(`
                SELECT id_medicament as id, nom as name, description, photo_url as photoUrl, 
                       prix as price, date_ajout as dateAdded, type_utilisation as type, 
                       precaution_alimentaire as precautions
                FROM Medicaments
                ORDER BY date_ajout DESC
                LIMIT 5
            `).all();
        }

        res.json({ medications });
    } catch (error) {
        console.error("Failed to fetch medications:", error);
        res.status(500).json({ error: "Server error fetching medications" });
    }
});

// Register a new medication (Pharmacist only)
router.post("/", (req, res) => {
    const { name, description, photoUrl, price, typeUtilisation } = req.body;
    if (!name) return res.status(400).json({ error: "Medication name is required" });

    try {
        const info = db.prepare(`
            INSERT INTO Medicaments (nom, description, photo_url, prix, type_utilisation, date_ajout)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(name, description || '', photoUrl || '', price || '', typeUtilisation || 'comprime');

        res.status(201).json({ success: true, medicationId: info.lastInsertRowid });
    } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
            return res.status(409).json({ error: "Ce médicament existe déjà dans la base de données." });
        }
        console.error("Failed to register medication:", error);
        res.status(500).json({ error: "Server error registering medication" });
    }
});

// Get all medication interactions
router.get("/interactions", (req, res) => {
    try {
        const interactions = db.prepare(`
            SELECT 
                i.id_interaction as id,
                m1.nom as med1Name,
                m2.nom as med2Name,
                i.niveau_risque as riskLevel,
                i.description
            FROM InteractionsMedicaments i
            JOIN Medicaments m1 ON i.medicament_source = m1.id_medicament
            JOIN Medicaments m2 ON i.medicament_interdit = m2.id_medicament
        `).all();
        res.json({ interactions });
    } catch (error) {
        console.error("Failed to fetch interactions:", error);
        res.status(500).json({ error: "Server error fetching interactions" });
    }
});

// Add a new medication interaction
router.post("/interactions", (req, res) => {
    const { medicamentSourceId, medicamentInterditId, riskLevel, description } = req.body;
    if (!medicamentSourceId || !medicamentInterditId) {
        return res.status(400).json({ error: "Source and Interdit medication IDs are required" });
    }

    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const userRole = db.prepare(`
            SELECT tc.nom_type 
            FROM Utilisateurs u 
            JOIN TypesComptes tc ON u.id_type_compte = tc.id_type_compte 
            WHERE u.id_utilisateur = ?
        `).get(userId) as { nom_type: string } | undefined;

        if (userRole?.nom_type !== "Administrateur") {
            return res.status(403).json({ error: "Only Administrateurs can manage interactions" });
        }

        const info = db.prepare(`
            INSERT INTO InteractionsMedicaments (medicament_source, medicament_interdit, niveau_risque, description)
            VALUES (?, ?, ?, ?)
        `).run(medicamentSourceId, medicamentInterditId, riskLevel || 'modere', description || '');

        res.status(201).json({ success: true, interactionId: info.lastInsertRowid });
    } catch (error) {
        console.error("Failed to add interaction:", error);
        res.status(500).json({ error: "Server error adding interaction" });
    }
});

// AI-powered medication info (Gemini fallback when not in DB)
router.get("/ai-info", async (req, res) => {
    const name = req.query.name as string;
    if (!name || name.trim().length < 2) {
        return res.status(400).json({ error: "Nom du médicament requis" });
    }

    if (!getGeminiApiKey()) {
        return res.status(503).json({ error: "Clé API Gemini non configurée sur le serveur" });
    }

    try {
        const prompt = `Tu es un assistant médical. Donne des informations sur le médicament "${name.trim()}" en JSON uniquement.
Format exact:
{"name":"${name.trim()}","description":"description générale en français (2-3 phrases)","dosage":"posologie habituelle adulte","precautions":"principales précautions d'emploi","sideEffects":"effets indésirables courants","category":"catégorie (antibiotique, analgésique, etc.)"}
Si le médicament est inconnu, retourne uniquement: {"error":"Médicament inconnu"}`;

        const { text, error } = await geminiGenerateText(prompt, { json: true, maxOutputTokens: 768 });

        if (!text) {
            return res.status(502).json({ error: error ?? "Erreur API Gemini" });
        }

        try {
            const parsed = parseJsonFromAiText(text) as { error?: string };

            if (parsed.error) {
                return res.status(404).json({ error: parsed.error });
            }

            // Automatically persist to DB
            try {
                db.prepare(`
                    INSERT OR IGNORE INTO Medicaments (nom, description, prix, type_utilisation, precaution_alimentaire, date_ajout)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(
                    parsed.name,
                    parsed.description,
                    parsed.price || '',
                    parsed.category?.toLowerCase() || 'comprime',
                    parsed.precautions || 'aucune'
                );
            } catch (dbErr) {
                console.error("Failed to persist AI result:", dbErr);
            }

            res.json({ aiResult: parsed, fromAI: true });
        } catch (e) {
            console.error("Failed to parse AI response:", text);
            return res.status(502).json({ error: "Format de réponse IA invalide" });
        }
    } catch (error) {
        console.error("AI medication lookup failed:", error);
        res.status(500).json({ error: "Recherche IA indisponible" });
    }
});

export const medicationRouter = router;
