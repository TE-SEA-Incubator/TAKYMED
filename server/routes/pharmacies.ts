import { Router } from "express";
import { db } from "../db";
import { searchNearbyPharmacies } from "../services/pharmacySearchService";

const router = Router();

// Get pharmacies owned by a specific user (Pro or Pharmacist)
router.get("/", (req, res) => {
    const userId = req.query.pharmacistId || req.query.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    try {
        const pharmacies = db.prepare(`
            SELECT id_pharmacie as id, nom_pharmacie as name, adresse as address, telephone as phone
            FROM Pharmacies
            WHERE id_pharmacien = ?
        `).all(userId);
        res.json({ pharmacies });
    } catch (error) {
        console.error("Failed to fetch pharmacies:", error);
        res.status(500).json({ error: "Server error fetching pharmacies" });
    }
});

// Create a new pharmacy (Pro users with limit)
router.post("/", (req, res) => {
    const { name, address, phone, openTime, closeTime, pharmacistId, userId, initialMeds, latitude, longitude } = req.body;
    const ownerId = pharmacistId || userId;
    
    if (!name || !ownerId) {
        return res.status(400).json({ error: "Name and User ID are required" });
    }

    try {
        // Check user type and pharmacy limit
        const user = db.prepare(`
            SELECT u.id_utilisateur, tc.nom_type, tc.max_pharmacies
            FROM Utilisateurs u
            JOIN TypesComptes tc ON u.id_type_compte = tc.id_type_compte
            WHERE u.id_utilisateur = ?
        `).get(ownerId) as { id_utilisateur: number; nom_type: string; max_pharmacies: number | null } | undefined;

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Only Administrateurs can create pharmacies now
        if (user.nom_type !== "Administrateur") {
            return res.status(403).json({ error: "Only Administrateurs can manage pharmacies" });
        }

        // Check current pharmacy count against limit
        const currentCount = db.prepare(`
            SELECT COUNT(*) as count FROM Pharmacies WHERE id_pharmacien = ?
        `).get(ownerId) as { count: number };

        if (user.max_pharmacies !== null && currentCount.count >= user.max_pharmacies) {
            return res.status(403).json({ 
                error: `Pharmacy limit reached. Maximum allowed: ${user.max_pharmacies}`,
                maxPharmacies: user.max_pharmacies,
                currentCount: currentCount.count
            });
        }

        const transaction = db.transaction(() => {
            const info = db.prepare(`
                INSERT INTO Pharmacies (nom_pharmacie, adresse, telephone, heure_ouverture, heure_fermeture, id_pharmacien, latitude, longitude)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(name, address || "", phone || "", openTime || "08:00", closeTime || "20:00", ownerId, latitude || null, longitude || null);

            const pharmacyId = info.lastInsertRowid;

            if (initialMeds && Array.isArray(initialMeds)) {
                const insertStock = db.prepare("INSERT INTO StockMedicamentsPharmacie (id_pharmacie, id_medicament, quantite) VALUES (?, ?, ?)");
                for (const med of initialMeds) {
                    insertStock.run(pharmacyId, med.id, med.quantity);
                }
            }

            return pharmacyId;
        });

        const pharmacyId = transaction();
        res.status(201).json({ success: true, pharmacyId });
    } catch (error) {
        console.error("Failed to create pharmacy:", error);
        res.status(500).json({ error: "Server error creating pharmacy" });
    }
});

/**
 * Recherche unifiée : pharmacies avec stock + pharmacies de garde, triées par proximité.
 * GET /api/pharmacies/nearby?lat=&lng=&medId=&limit=&radiusKm=
 */
router.get("/nearby", (req, res) => {
    const { medId, lat, lng, limit, radiusKm } = req.query;

    const parsedLat = parseFloat(lat as string);
    const parsedLng = parseFloat(lng as string);

    try {
        const result = searchNearbyPharmacies({
            lat: Number.isNaN(parsedLat) ? undefined : parsedLat,
            lng: Number.isNaN(parsedLng) ? undefined : parsedLng,
            medId: medId ? parseInt(medId as string, 10) : undefined,
            limit: limit ? parseInt(limit as string, 10) : 25,
            radiusKm: radiusKm ? parseFloat(radiusKm as string) : 60,
        });
        res.json(result);
    } catch (error) {
        console.error("Failed nearby pharmacy search:", error);
        res.status(500).json({ error: "Server error searching nearby pharmacies" });
    }
});

/**
 * Search for pharmacies by medication and calculate distance
 * GET /api/pharmacies/search?medId=...&lat=...&lng=...
 */
router.get("/search", (req, res) => {
    const { medId, lat, lng } = req.query;
    if (!medId) return res.status(400).json({ error: "medId is required" });

    try {
        const userLat = parseFloat(lat as string);
        const userLng = parseFloat(lng as string);

        const pharmacies = db.prepare(`
            SELECT 
                p.id_pharmacie as id, 
                p.nom_pharmacie as name, 
                p.adresse as address, 
                p.telephone as phone,
                p.latitude,
                p.longitude,
                s.quantite as quantity
            FROM Pharmacies p
            JOIN StockMedicamentsPharmacie s ON p.id_pharmacie = s.id_pharmacie
            WHERE s.id_medicament = ? AND s.quantite > 0
        `).all(medId) as any[];

        // Calculate distance using Haversine formula if coordinates are provided
        const result = pharmacies.map(p => {
            let distance = null;
            if (!isNaN(userLat) && !isNaN(userLng) && p.latitude && p.longitude) {
                const R = 6371; // Earth radius in km
                const dLat = (p.latitude - userLat) * Math.PI / 180;
                const dLng = (p.longitude - userLng) * Math.PI / 180;
                const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(userLat * Math.PI / 180) * Math.cos(p.latitude * Math.PI / 180) *
                    Math.sin(dLng / 2) * Math.sin(dLng / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                distance = parseFloat((R * c).toFixed(2));
            }
            return { ...p, distance };
        });

        // Sort by distance if available, otherwise by name
        result.sort((a, b) => {
            if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
            return a.name.localeCompare(b.name);
        });

        res.json({ pharmacies: result });
    } catch (error) {
        console.error("Failed to search pharmacies:", error);
        res.status(500).json({ error: "Server error searching pharmacies" });
    }
});

// Delete a pharmacy
router.delete("/:id", (req, res) => {
    const pharmacyId = req.params.id;
    try {
        db.prepare("DELETE FROM Pharmacies WHERE id_pharmacie = ?").run(pharmacyId);
        res.json({ success: true });
    } catch (error) {
        console.error("Failed to delete pharmacy:", error);
        res.status(500).json({ error: "Server error deleting pharmacy" });
    }
});

// Get stock for a specific pharmacy
router.get("/:id/stock", (req, res) => {
    const pharmacyId = req.params.id;
    try {
        const stock = db.prepare(`
            SELECT 
                s.id_stock as id,
                m.id_medicament as medicationId,
                m.nom as medicationName,
                s.quantite as quantity
            FROM StockMedicamentsPharmacie s
            JOIN Medicaments m ON s.id_medicament = m.id_medicament
            WHERE s.id_pharmacie = ?
        `).all(pharmacyId);
        res.json({ stock });
    } catch (error) {
        console.error("Failed to fetch stock:", error);
        res.status(500).json({ error: "Server error fetching stock" });
    }
});

// Update stock for a pharmacy
router.post("/:id/stock", (req, res) => {
    const pharmacyId = req.params.id;
    const { medicationId, quantity } = req.body;

    if (!medicationId) return res.status(400).json({ error: "Missing medicationId" });

    try {
        // Use UPSERT (using SQLite's INSERT ... ON CONFLICT)
        db.prepare(`
            INSERT INTO StockMedicamentsPharmacie (id_pharmacie, id_medicament, quantite)
            VALUES (?, ?, ?)
            ON CONFLICT(id_pharmacie, id_medicament) DO UPDATE SET quantite = excluded.quantite
        `).run(pharmacyId, medicationId, quantity || 0);

        res.json({ success: true });
    } catch (error) {
        console.error("Failed to update stock:", error);
        res.status(500).json({ error: "Server error updating stock" });
    }
});

export const pharmacyRouter = router;
