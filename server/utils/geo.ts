/** Utilitaires géographiques pour la recherche de pharmacies. */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface CityInfo {
  name: string;
  region: string;
  lat: number;
  lng: number;
}

export const CAMEROON_CITIES: CityInfo[] = [
  { name: "Yaoundé", region: "centre", lat: 3.848, lng: 11.5021 },
  { name: "Douala", region: "littoral", lat: 4.0511, lng: 9.7679 },
];

/** Distance Haversine en kilomètres. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/** Détecte la ville / région camerounaise la plus proche. */
export function detectNearestCity(lat: number, lng: number): CityInfo {
  let nearest = CAMEROON_CITIES[0];
  let minDist = Infinity;
  for (const city of CAMEROON_CITIES) {
    const d = haversineKm(lat, lng, city.lat, city.lng);
    if (d < minDist) {
      minDist = d;
      nearest = city;
    }
  }
  return nearest;
}

export function detectNearestRegion(lat: number, lng: number): string {
  return detectNearestCity(lat, lng).region;
}

export type WithDistance<T> = T & { distance: number | null };

/** Ajoute la distance et trie par proximité. */
export function sortByDistance<T extends { latitude?: number | null; longitude?: number | null }>(
  items: T[],
  userLat: number,
  userLng: number,
  radiusKm = 80,
): WithDistance<T>[] {
  const withDist = items.map((item) => {
    let distance: number | null = null;
    if (item.latitude != null && item.longitude != null) {
      distance = haversineKm(userLat, userLng, item.latitude, item.longitude);
    }
    return { ...item, distance };
  });

  const filtered = withDist.filter(
    (p) => p.distance === null || p.distance <= radiusKm,
  );

  filtered.sort((a, b) => {
    if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
    if (a.distance !== null) return -1;
    if (b.distance !== null) return 1;
    return 0;
  });

  return filtered;
}

/** Géocodage via Nominatim (OpenStreetMap). */
export async function geocodeAddress(
  address: string,
  city: string,
): Promise<Coordinates | null> {
  if (!address?.trim()) return null;

  try {
    const q = encodeURIComponent(`${address}, ${city}, Cameroun`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { "User-Agent": "TAKYMED/1.0 (pharmacy search)" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
