import { Router } from "express";
import { searchNearbyPharmacies, getGardePharmaciesFromCache } from "../services/pharmacySearchService";
import { syncPharmaciesGarde } from "../services/pharmacyGardeSync";

const router = Router();

/**
 * Pharmacies de garde depuis le cache SQLite (triées par distance si lat/lng).
 * GET /api/pharmacies-garde/garde?lat=&lng=&region=
 */
router.get("/garde", (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const region = req.query.region as string | undefined;

    const hasLocation = !Number.isNaN(lat) && !Number.isNaN(lng);

    const pharmacies = getGardePharmaciesFromCache({
      lat: hasLocation ? lat : undefined,
      lng: hasLocation ? lng : undefined,
      region,
      limit: 50,
    });

    res.json({
      pharmacies,
      count: pharmacies.length,
      cached: true,
    });
  } catch (error) {
    console.error("Failed to fetch pharmacies on duty:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des pharmacies de garde" });
  }
});

/**
 * Force la synchronisation (scraper Node.js + Cheerio, fallback Gemini).
 * POST /api/pharmacies-garde/sync
 */
router.post("/sync", async (_req, res) => {
  try {
    const result = await syncPharmaciesGarde(["centre", "littoral"]);
    res.json(result);
  } catch (error) {
    console.error("Garde sync failed:", error);
    res.status(500).json({ error: "Échec de la synchronisation" });
  }
});

export const pharmaciesGardeRouter = router;
