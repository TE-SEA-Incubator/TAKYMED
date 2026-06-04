import cron from "node-cron";
import { syncPharmaciesGarde } from "./pharmacyGardeSync";

export function startPharmacyScheduler() {
  // Mise à jour des pharmacies de garde : 02h, 12h, 18h
  cron.schedule("0 2,12,18 * * *", async () => {
    console.log("🔄 Synchronisation des pharmacies de garde…");
    try {
      const result = await syncPharmaciesGarde(["centre", "littoral"]);
      console.log(
        `✅ Pharmacies de garde mises à jour (${result.source}): ${result.total} entrées`,
      );
    } catch (error) {
      console.error("❌ Échec sync pharmacies de garde:", error);
    }
  });

  // Sync au démarrage si cache vide (non bloquant)
  setTimeout(async () => {
    try {
      const { db } = await import("../db");
      const count = db
        .prepare("SELECT COUNT(*) as c FROM PharmaciesGarde")
        .get() as { c: number };
      if (count.c === 0) {
        console.log("📍 Cache pharmacies de garde vide — sync initiale…");
        await syncPharmaciesGarde(["centre", "littoral"]);
      }
    } catch {
      // PharmaciesGarde table may not exist yet
    }
  }, 5000);
}
