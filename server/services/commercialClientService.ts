import { db } from "../db";
import { getUserAccountContext } from "./prescriptionAccessService";
import { normalizePhone } from "../utils/phone";

export { normalizePhone };

export function findCommercialClientForValidation(
  commercialId: number,
  options: { clientId?: number; phone?: string },
) {
  if (options.clientId != null && Number.isFinite(options.clientId)) {
    return db
      .prepare(
        `
      SELECT id_utilisateur, pin_hash, est_valide, numero_telephone
      FROM Utilisateurs
      WHERE id_utilisateur = ? AND id_createur = ?
    `,
      )
      .get(options.clientId, commercialId) as
      | { id_utilisateur: number; pin_hash: string; est_valide: number; numero_telephone: string }
      | undefined;
  }

  const normalizedPhone = options.phone ? normalizePhone(options.phone) : "";
  if (!normalizedPhone) return undefined;

  const candidates = db
    .prepare(
      `
    SELECT id_utilisateur, pin_hash, est_valide, numero_telephone
    FROM Utilisateurs
    WHERE id_createur = ?
  `,
    )
    .all(commercialId) as Array<{
    id_utilisateur: number;
    pin_hash: string;
    est_valide: number;
    numero_telephone: string;
  }>;

  return candidates.find((c) => normalizePhone(c.numero_telephone) === normalizedPhone);
}

export function normalizeClientName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function findUserByPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  return db
    .prepare("SELECT id_utilisateur FROM Utilisateurs WHERE numero_telephone = ?")
    .get(normalizedPhone) as { id_utilisateur: number } | undefined;
}

export function findProfileByName(name: string, excludeUserId?: number) {
  const normalizedName = normalizeClientName(name);
  if (!normalizedName) return undefined;

  let query = `
    SELECT p.id_utilisateur, p.nom_complet as name
    FROM ProfilsUtilisateurs p
    WHERE LOWER(TRIM(p.nom_complet)) = LOWER(?)
  `;
  const params: Array<string | number> = [normalizedName];

  if (excludeUserId != null) {
    query += " AND p.id_utilisateur <> ?";
    params.push(excludeUserId);
  }

  return db.prepare(query).get(...params) as
    | { id_utilisateur: number; name: string }
    | undefined;
}

export interface ClientAvailability {
  nameAvailable: boolean;
  phoneAvailable: boolean;
  available: boolean;
  errors: string[];
}

export function checkClientAvailability(
  name: string,
  phone: string,
  excludeUserId?: number,
): ClientAvailability {
  const errors: string[] = [];
  const normalizedName = normalizeClientName(name);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedName) {
    errors.push("Le nom du client est requis.");
  }

  if (!normalizedPhone) {
    errors.push("Le numéro de téléphone est requis.");
  }

  const nameTaken =
    normalizedName.length > 0 && !!findProfileByName(normalizedName, excludeUserId);
  const phoneTaken = normalizedPhone.length > 0 && !!findUserByPhone(normalizedPhone);

  if (nameTaken) {
    errors.push("Un client avec ce nom existe déjà dans la base de données.");
  }

  if (phoneTaken) {
    errors.push("Ce numéro de téléphone est déjà associé à un compte existant.");
  }

  return {
    nameAvailable: !nameTaken,
    phoneAvailable: !phoneTaken,
    available: errors.length === 0,
    errors,
  };
}

export function assertCommercialActor(commercialId: number) {
  const commercial = getUserAccountContext(commercialId);

  if (!commercial) {
    return { ok: false as const, status: 403, error: "Accès refusé. Utilisateur non trouvé." };
  }

  const role = commercial.typeName;
  if (role !== "commercial" && role !== "administrateur") {
    return {
      ok: false as const,
      status: 403,
      error: "Accès refusé. Seul un commercial peut inscrire des clients.",
    };
  }

  return {
    ok: true as const,
    commercial: { id_utilisateur: commercial.id, typeName: commercial.typeName },
  };
}

export function assertHeaderMatchesCommercial(
  headerUserId: string | string[] | undefined,
  commercialId: number,
) {
  if (!headerUserId) return true;
  return String(headerUserId) === String(commercialId);
}
