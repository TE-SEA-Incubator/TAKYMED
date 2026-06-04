#!/usr/bin/env node
/**
 * Scrape les pharmacies de garde (annuaire-medical.cm) via Node.js + Cheerio.
 *
 * Usage:
 *   npm run scrape:pharmacies
 *   npx tsx scripts/scrape_pharmacies_garde.ts --regions centre,littoral
 *   npx tsx scripts/scrape_pharmacies_garde.ts --no-geocode
 */

import "dotenv/config";
import { initializeDatabase } from "../server/db.ts";
import { syncPharmaciesGarde } from "../server/services/pharmacyGardeSync.ts";

function parseArgs() {
  const regionsArg = process.argv.find((arg) => arg.startsWith("--regions="));
  const regions = regionsArg
    ? regionsArg.split("=")[1].split(",").map((r) => r.trim()).filter(Boolean)
    : ["centre", "littoral"];

  return {
    regions,
    noGeocode: process.argv.includes("--no-geocode"),
  };
}

async function main() {
  const { regions } = parseArgs();

  initializeDatabase();

  const result = await syncPharmaciesGarde(regions, {
    geocode: !process.argv.includes("--no-geocode"),
    useGemini: Boolean(process.env.GEMINI_API_KEY),
  });
  console.log(JSON.stringify(result));

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
