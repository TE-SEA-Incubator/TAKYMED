import { scrapePharmaciesRegion, getSupportedGardeRegions } from "./pharmacyScraper";

export interface GardeSyncResult {
  success: boolean;
  total: number;
  source: "nodejs";
  regions: string[];
}

/**
 * Synchronise les pharmacies de garde via Cheerio (+ Gemini optionnel).
 */
export async function syncPharmaciesGarde(
  regions: string[] = ["centre", "littoral"],
  options: { geocode?: boolean; useGemini?: boolean } = {},
): Promise<GardeSyncResult> {
  const supported = getSupportedGardeRegions();
  const targets = regions.filter((region) => supported.includes(region));
  const geocode = options.geocode ?? process.env.SKIP_GARDE_GEOCODE !== "1";
  const useGemini = options.useGemini ?? Boolean(process.env.GEMINI_API_KEY);

  let total = 0;
  const synced: string[] = [];

  for (const region of targets) {
    try {
      const list = await scrapePharmaciesRegion(region, { useGemini, geocode });
      total += list.length;
      synced.push(region);
    } catch (error) {
      console.error(`Scraper Node.js failed for ${region}:`, error);
    }
  }

  return {
    success: total > 0,
    total,
    source: "nodejs",
    regions: synced,
  };
}
