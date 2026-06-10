import * as cheerio from "cheerio";
import { db } from "../db";
import { CAMEROON_CITIES, geocodeAddress } from "../utils/geo";

export interface ScrapedPharmacy {
  name: string;
  address: string;
  phone: string;
  status: string;
}

const REGIONS: Record<string, { ville: string; url: string }> = {
  centre: {
    ville: "Yaoundé",
    url: "https://www.annuaire-medical.cm/fr/pharmacies-de-garde/centre/pharmacies-de-garde-yaounde",
  },
  littoral: {
    ville: "Douala",
    url: "https://www.annuaire-medical.cm/fr/pharmacies-de-garde/littoral/pharmacies-de-garde-douala",
  },
};

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; TAKYMED/1.0; +https://takymed.com)",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

const PHONE_PATTERN = /(\+237|00237)?[\s.-]?6[\d\s.-]{7,12}/;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(raw: string): string {
  let phone = raw.replace(/[\s.-]/g, "");
  if (!phone.startsWith("+") && !phone.startsWith("00237")) {
    phone = "+237" + phone.replace(/^0+/, "");
  }
  return phone.slice(0, 20);
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch pharmacy page (${response.status})`);
  }
  return response.text();
}

/** Extraction heuristique HTML avec Cheerio (équivalent BeautifulSoup). */
export function parsePharmaciesFromHtml(html: string, ville: string): ScrapedPharmacy[] {
  const $ = cheerio.load(html);
  const pharmacies: ScrapedPharmacy[] = [];
  const seen = new Set<string>();

  $("div, li, article, tr, section").each((_, element) => {
    const block = $(element);
    const text = block.text().replace(/\s+/g, " ").trim();

    if (text.length < 20 || text.length > 800) return;
    if (!text.toLowerCase().includes("pharmac")) return;

    const phoneMatch = text.match(PHONE_PATTERN);
    if (!phoneMatch) return;

    const phone = normalizePhone(phoneMatch[0]);

    let name: string | null = null;
    block.find("h2, h3, h4, strong, b").each((__, heading) => {
      const label = $(heading).text().trim();
      if (label.length > 3 && label.toLowerCase().includes("pharmac")) {
        name = label;
        return false;
      }
      return undefined;
    });

    if (!name) {
      const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.toLowerCase().includes("pharmac") && line.length < 120) {
          name = line;
          break;
        }
      }
    }

    if (!name) {
      name = `Pharmacie de garde (${ville})`;
    }

    const address = text.replace(PHONE_PATTERN, "").replace(/\s+/g, " ").trim().slice(0, 200) || ville;
    const key = `${name}|${phone}`;
    if (seen.has(key)) return;
    seen.add(key);

    const lower = text.toLowerCase();
    const status = lower.includes("ferm") || lower.includes("closed") ? "fermée" : "ouverte";

    pharmacies.push({
      name: name.slice(0, 255),
      address,
      phone,
      status,
    });
  });

  return pharmacies;
}

/** Fallback Gemini si le parser HTML est insuffisant. */
async function parseWithGemini(html: string, ville: string): Promise<ScrapedPharmacy[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const prompt = `Extrais la liste des pharmacies de garde à ${ville}, Cameroun depuis ce HTML.
Retourne UNIQUEMENT un JSON array valide:
[{"name": "...", "address": "...", "phone": "+237...", "status": "ouverte"}]

HTML (extrait):
${html.slice(0, 25000)}`;

  const aiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
    },
  );

  if (!aiResponse.ok) return [];

  const data = await aiResponse.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as ScrapedPharmacy[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function geocodeWithFallback(
  address: string,
  ville: string,
): Promise<{ lat: number | null; lng: number | null }> {
  if (!address || address.length < 5) {
    const city = CAMEROON_CITIES.find((c) => c.name === ville);
    return city ? { lat: city.lat, lng: city.lng } : { lat: null, lng: null };
  }

  const coords = await geocodeAddress(address, ville);
  if (coords) return coords;

  const city = CAMEROON_CITIES.find((c) => c.name === ville);
  return city ? { lat: city.lat, lng: city.lng } : { lat: null, lng: null };
}

async function savePharmaciesToDb(
  pharmacies: ScrapedPharmacy[],
  region: string,
  ville: string,
  sourceUrl: string,
  geocode = true,
): Promise<number> {
  // On supprime les anciennes pharmacies de garde pour cette région dans la table unifiée
  db.prepare("DELETE FROM Pharmacies WHERE est_garde = 1 AND region = ?").run(region);

  // Insertion dans la table unifiée
  const stmt = db.prepare(`
    INSERT INTO Pharmacies (id_pharmacien, nom_pharmacie, telephone, adresse, latitude, longitude, est_garde, region)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);

  let count = 0;
  for (const pharmacy of pharmacies) {
    const name = pharmacy.name?.trim();
    if (!name) continue;

    const address = (pharmacy.address || ville).trim();
    const phone = (pharmacy.phone || "").trim();

    let lat: number | null = null;
    let lng: number | null = null;

    if (geocode) {
      const coords = await geocodeWithFallback(address, ville);
      lat = coords.lat;
      lng = coords.lng;
      await sleep(1100);
    }

    // id_pharmacien est fixé à 1 pour les pharmacies de garde (admin)
    stmt.run(1, name, phone, address, lat, lng, region);
    count += 1;
  }

  return count;
}

export interface ScrapeRegionOptions {
  useGemini?: boolean;
  geocode?: boolean;
}

/** Scrape une région, enregistre en base et retourne la liste extraite. */
export async function scrapePharmaciesRegion(
  region: string,
  options: ScrapeRegionOptions = {},
): Promise<ScrapedPharmacy[]> {
  const cfg = REGIONS[region] ?? REGIONS.centre;
  const geocode = options.geocode !== false;
  const useGemini = options.useGemini ?? Boolean(process.env.GEMINI_API_KEY);

  console.log(`Scraping ${cfg.ville} (${region})…`);
  const html = await fetchHtml(cfg.url);

  let pharmacies = parsePharmaciesFromHtml(html, cfg.ville);
  console.log(`  → ${pharmacies.length} pharmacies (Cheerio)`);

  if (pharmacies.length < 2 && useGemini) {
    const geminiResults = await parseWithGemini(html, cfg.ville);
    if (geminiResults.length > 0) {
      pharmacies = geminiResults;
      console.log(`  → ${pharmacies.length} pharmacies (Gemini)`);
    }
  }

  if (pharmacies.length === 0) {
    throw new Error(`Aucune pharmacie trouvée pour ${region}`);
  }

  const saved = await savePharmaciesToDb(pharmacies, region, cfg.ville, cfg.url, geocode);
  console.log(`  ✓ ${saved} pharmacies enregistrées pour ${region}`);

  return pharmacies;
}

/** Alias rétrocompatible — scrape et persiste une région. */
export async function fetchPharmaciesOnDuty(region: string = "centre"): Promise<ScrapedPharmacy[]> {
  return scrapePharmaciesRegion(region);
}

export function getSupportedGardeRegions(): string[] {
  return Object.keys(REGIONS);
}
