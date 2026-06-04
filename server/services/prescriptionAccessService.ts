import { db } from "../db";
import { getUserAccountLimits, type UserAccountLimits } from "./accountLimits";

export interface UserAccountContext {
  id: number;
  typeName: string;
  name: string;
  phone: string | null;
  creatorId: number | null;
  isValidated: boolean;
}

const UNLIMITED_LIMITS: UserAccountLimits = {
  maxOrdonnances: -1,
  maxRappels: -1,
};

export function normalizeAccountTypeName(typeName: string | null | undefined): string {
  return (typeName || "standard").toLowerCase().replace(/_old$/, "");
}

export function getUserAccountContext(userId: number): UserAccountContext | null {
  if (!Number.isFinite(userId) || userId <= 0) return null;

  const row = db
    .prepare(
      `
    SELECT
      u.id_utilisateur as id,
      tc.nom_type as typeName,
      COALESCE(p.nom_complet, u.numero_telephone, 'Utilisateur') as name,
      u.numero_telephone as phone,
      u.id_createur as creatorId,
      u.est_valide as isValidated
    FROM Utilisateurs u
    LEFT JOIN ProfilsUtilisateurs p ON p.id_utilisateur = u.id_utilisateur
    LEFT JOIN TypesComptes tc ON tc.id_type_compte = u.id_type_compte
    WHERE u.id_utilisateur = ?
  `,
    )
    .get(userId) as
    | {
        id: number;
        typeName: string | null;
        name: string;
        phone: string | null;
        creatorId: number | null;
        isValidated: number;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    typeName: normalizeAccountTypeName(row.typeName),
    name: row.name,
    phone: row.phone,
    creatorId: row.creatorId ?? null,
    isValidated: row.isValidated === 1,
  };
}

export function resolveAccountLimits(userId: number): UserAccountLimits | null {
  const limits = getUserAccountLimits(userId);
  if (limits) return limits;

  const ctx = getUserAccountContext(userId);
  if (!ctx) return null;

  // Compte existant mais type/limites manquants → quotas illimités par défaut
  return UNLIMITED_LIMITS;
}

/** Le demandeur peut-il créer/gérer une ordonnance pour ce compte cible ? */
export function canManagePrescriptionFor(
  actorId: number,
  targetUserId: number,
): { allowed: boolean; reason?: string } {
  if (!Number.isFinite(actorId) || actorId <= 0) {
    return { allowed: false, reason: "Session invalide. Reconnectez-vous." };
  }

  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return { allowed: false, reason: "Compte patient cible invalide." };
  }

  const actor = getUserAccountContext(actorId);
  if (!actor) {
    return { allowed: false, reason: "Utilisateur connecté introuvable." };
  }

  const target = getUserAccountContext(targetUserId);
  if (!target) {
    return { allowed: false, reason: "Compte patient introuvable." };
  }

  // Pour soi-même (patient, pro, commercial, admin…)
  if (actorId === targetUserId) {
    return { allowed: true };
  }

  // Commercial : ordonnance pour un client qu'il a créé
  if (actor.typeName === "commercial" || actor.typeName === "administrateur") {
    if (target.creatorId === actorId) {
      return { allowed: true };
    }
    if (actor.typeName === "administrateur") {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "Ce client n'est pas rattaché à votre compte commercial.",
    };
  }

  return {
    allowed: false,
    reason: "Vous ne pouvez créer des ordonnances que pour votre propre compte.",
  };
}
