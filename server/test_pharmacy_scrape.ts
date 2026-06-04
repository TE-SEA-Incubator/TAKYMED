import { scrapePharmaciesRegion } from "./services/pharmacyScraper.ts";
import { initializeDatabase } from "./db.ts";
import "dotenv/config";

async function testScrape() {
    console.log("🚀 Starting pharmacy scrape test (Node.js + Cheerio)...");
    initializeDatabase();
    try {
        const pharmacies = await scrapePharmaciesRegion("centre", { geocode: false });
        console.log("✅ Scrape successful!");
        console.log("Found", pharmacies.length, "pharmacies.");
        console.table(pharmacies);
    } catch (e) {
        console.error("❌ Scrape failed:", e);
    }
}

testScrape();
