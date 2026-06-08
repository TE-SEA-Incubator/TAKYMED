import { db } from "../db";
import {
  detectNearestCity,
  pharmacyMatchesCity,
  sortByDistance,
  type Coordinates,
} from "../utils/geo";

export interface NearbyPharmacyResult {
  id: string | number;
  name: string;
  address: string;
  phone: string | null;
  distance: number | null;
  latitude: number | null;
  longitude: number | null;
  type: "stock" | "garde" | "pharmacy";
  quantity?: number | null;
  status?: string | null;
  isOnDuty: boolean;
  region?: string | null;
}

export interface NearbySearchResponse {
  location: {
    lat: number;
    lng: number;
    city: string;
    region: string;
  } | null;
  withStock: NearbyPharmacyResult[];
  onDuty: NearbyPharmacyResult[];
  allNearby: NearbyPharmacyResult[];
  updatedAt: string | null;
}

export function searchNearbyPharmacies(options: {
  lat?: number;
  lng?: number;
  medId?: number;
  limit?: number;
  radiusKm?: number;
}): NearbySearchResponse {
  const limit = options.limit ?? 25;
  const radiusKm = options.radiusKm ?? 60;
  const hasLocation =
    options.lat != null &&
    options.lng != null &&
    !Number.isNaN(options.lat) &&
    !Number.isNaN(options.lng);

  let locationInfo: NearbySearchResponse["location"] = null;
  let regionFilter: string | null = null;

  if (hasLocation) {
    const city = detectNearestCity(options.lat!, options.lng!);
    locationInfo = {
      lat: options.lat!,
      lng: options.lng!,
      city: city.name,
      region: city.region,
    };
    regionFilter = city.region;
  }

  // --- Pharmacies avec stock (si medId) ---
  let withStock: NearbyPharmacyResult[] = [];
  if (options.medId) {
    const rows = db
      .prepare(
        `
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
    `,
      )
      .all(options.medId) as Record<string, unknown>[];

    withStock = rows.map((r) => ({
      id: r.id as number,
      name: (r.name as string) || "Pharmacie",
      address: (r.address as string) || "",
      phone: (r.phone as string) || null,
      distance: null,
      latitude: (r.latitude as number) ?? null,
      longitude: (r.longitude as number) ?? null,
      type: "stock" as const,
      quantity: r.quantity as number,
      isOnDuty: false,
    }));
  }

  // --- Toutes les pharmacies enregistrées (sans filtre stock) ---
  const allPharmacyRows = db
    .prepare(
      `
    SELECT id_pharmacie as id, nom_pharmacie as name, adresse as address,
           telephone as phone, latitude, longitude
    FROM Pharmacies
  `,
    )
    .all() as Record<string, unknown>[];

  let allNearby: NearbyPharmacyResult[] = allPharmacyRows.map((r) => ({
    id: r.id as number,
    name: (r.name as string) || "Pharmacie",
    address: (r.address as string) || "",
    phone: (r.phone as string) || null,
    distance: null,
    latitude: (r.latitude as number) ?? null,
    longitude: (r.longitude as number) ?? null,
    type: "pharmacy" as const,
    isOnDuty: false,
  }));

  // --- Pharmacies de garde (cache SQLite) ---
  let gardeQuery = `
    SELECT id, nom as name, adresse as address, telephone as phone,
           statut as status, region, ville, latitude, longitude, mis_a_jour_le
    FROM PharmaciesGarde
  `;
  const gardeParams: string[] = [];
  if (regionFilter) {
    gardeQuery += ` WHERE region = ?`;
    gardeParams.push(regionFilter);
  }
  gardeQuery += ` ORDER BY mis_a_jour_le DESC`;

  const gardeRows = db.prepare(gardeQuery).all(...gardeParams) as Record<string, unknown>[];

  let onDuty: NearbyPharmacyResult[] = gardeRows.map((r) => ({
    id: `garde-${r.id}`,
    name: (r.name as string) || "Pharmacie de garde",
    address: (r.address as string) || "",
    phone: (r.phone as string) || null,
    distance: null,
    latitude: (r.latitude as number) ?? null,
    longitude: (r.longitude as number) ?? null,
    type: "garde" as const,
    status: (r.status as string) || "ouverte",
    isOnDuty: true,
    region: (r.region as string) || null,
  }));

  const updatedAt =
    gardeRows.length > 0 ? (gardeRows[0].mis_a_jour_le as string) : null;

  if (hasLocation) {
    const coords: Coordinates = { lat: options.lat!, lng: options.lng! };
    const city = detectNearestCity(coords.lat, coords.lng);
    allNearby = allNearby.filter((p) => pharmacyMatchesCity(p, city));
    withStock = sortByDistance(withStock, coords.lat, coords.lng, radiusKm).slice(0, limit);
    onDuty = sortByDistance(onDuty, coords.lat, coords.lng, radiusKm).slice(0, limit);
    allNearby = sortByDistance(allNearby, coords.lat, coords.lng, radiusKm);
    // Liste complète de la ville, triée de la plus proche à la plus lointaine
    allNearby = allNearby.slice(0, Math.max(limit, 80));
  } else {
    withStock = withStock.slice(0, limit);
    onDuty = onDuty.slice(0, limit);
    allNearby = allNearby.slice(0, limit);
  }

  return {
    location: locationInfo,
    withStock,
    onDuty,
    allNearby,
    updatedAt,
  };
}

/** Pharmacies de garde depuis le cache DB uniquement. */
export function getGardePharmaciesFromCache(options: {
  lat?: number;
  lng?: number;
  region?: string;
  limit?: number;
}): NearbyPharmacyResult[] {
  const result = searchNearbyPharmacies({
    lat: options.lat,
    lng: options.lng,
    limit: options.limit ?? 50,
  });
  return result.onDuty;
}
