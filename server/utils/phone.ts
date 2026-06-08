import { db } from "../db";

const SPECIAL_ACCOUNTS = new Set(["admin", "commercial"]);

/** Normalise un numéro (Cameroun +237) ou laisse les comptes spéciaux intacts. */
export function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-().]/g, "").trim();
  if (!p) return "";

  const lower = p.toLowerCase();
  if (SPECIAL_ACCOUNTS.has(lower)) return lower;

  while (p.startsWith("+237+237")) {
    p = "+237" + p.slice(8);
  }
  if (p.startsWith("237237")) {
    p = "+237" + p.slice(6);
  }

  if (/^\+2376\d{8}$/.test(p)) return p;

  if (p.startsWith("2376") && !p.startsWith("+")) {
    p = "+237" + p.slice(3);
  }

  const local = p.replace(/^\+237/, "").replace(/^0/, "");
  if (/^6\d{8}$/.test(local)) {
    return "+237" + local;
  }

  if (!p.startsWith("+") && /^\d+$/.test(p)) {
    return "+" + p;
  }

  return p;
}

/** Variantes pour retrouver un compte créé avec un ancien format. */
export function phoneLookupVariants(rawPhone: string): string[] {
  const normalized = normalizePhone(rawPhone);
  if (SPECIAL_ACCOUNTS.has(normalized)) return [normalized];

  const variants = new Set<string>();
  if (normalized) variants.add(normalized);

  const local = normalized.replace(/^\+237/, "");
  if (/^6\d{8}$/.test(local)) {
    variants.add(local);
    variants.add(`0${local}`);
    variants.add(`237${local}`);
    variants.add(`+237${local}`);
  }

  return [...variants];
}

export type AuthUserRow = {
  id_utilisateur: number;
  email?: string | null;
  numero_telephone: string;
  nom_complet?: string | null;
  nom_type: string;
  pin_hash?: string | null;
  pin_expires_at?: string | null;
  est_valide?: number | null;
};

export function findUserByPhone(rawPhone: string): AuthUserRow | undefined {
  const variants = phoneLookupVariants(rawPhone);
  const sql = `
    SELECT u.*, p.nom_complet, tc.nom_type
    FROM Utilisateurs u
    LEFT JOIN ProfilsUtilisateurs p ON u.id_utilisateur = p.id_utilisateur
    JOIN TypesComptes tc ON u.id_type_compte = tc.id_type_compte
    WHERE u.numero_telephone = ?
  `;

  for (const variant of variants) {
    const user = db.prepare(sql).get(variant) as AuthUserRow | undefined;
    if (user) {
      const canonical = normalizePhone(rawPhone);
      if (
        canonical &&
        !SPECIAL_ACCOUNTS.has(canonical) &&
        user.numero_telephone !== canonical
      ) {
        db.prepare(
          "UPDATE Utilisateurs SET numero_telephone = ? WHERE id_utilisateur = ?",
        ).run(canonical, user.id_utilisateur);
        user.numero_telephone = canonical;
      }
      return user;
    }
  }

  return undefined;
}

export function isValidUserPin(pin: unknown): pin is string {
  if (typeof pin !== "string") return false;
  const trimmed = pin.trim();
  return /^\d{4,8}$/.test(trimmed);
}

export function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function pinExpiryIso(days = 30): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
