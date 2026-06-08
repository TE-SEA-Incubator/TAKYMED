import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Résout photo_url API : URL absolue, data-URI, ou chemin /uploads/... */
export function resolveMedicationPhotoUrl(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function formatPharmacyDistanceShort(distance: unknown): string {
  if (distance == null || distance === "") return "—";
  const km = typeof distance === "number" ? distance : parseFloat(String(distance));
  if (Number.isNaN(km)) return String(distance);
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function pharmacyShortLocation(p: {
  region?: string | null;
  ville?: string | null;
  address?: string | null;
}): string {
  const region = String(p.region ?? "").trim();
  if (region) return region;
  const ville = String(p.ville ?? "").trim();
  if (ville) return ville;
  const address = String(p.address ?? "").trim();
  if (!address) return "Cameroun";
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  if (address.length > 36) return `${address.slice(0, 33)}…`;
  return address;
}
