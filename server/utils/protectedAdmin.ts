import { db } from "../db";

/** Identifiant du compte admin système (ADMIN_PHONE ou « admin »). */
export function getDefaultAdminPhone(): string {
  return (process.env.ADMIN_PHONE || "admin").trim();
}

export function getDefaultAdminUserId(): number | null {
  const row = db
    .prepare("SELECT id_utilisateur FROM Utilisateurs WHERE numero_telephone = ?")
    .get(getDefaultAdminPhone()) as { id_utilisateur: number } | undefined;
  return row?.id_utilisateur ?? null;
}

export function isDefaultAdminUserId(userId: number | string): boolean {
  const id = Number(userId);
  if (!Number.isFinite(id)) return false;
  const defaultId = getDefaultAdminUserId();
  return defaultId !== null && defaultId === id;
}

export const PROTECTED_ADMIN_DELETE_ERROR =
  "Le compte administrateur système par défaut ne peut pas être supprimé.";

export const PROTECTED_ADMIN_TYPE_ERROR =
  "Le type du compte administrateur système par défaut ne peut pas être modifié.";

export const PROTECTED_ADMIN_PHONE_ERROR =
  "L'identifiant du compte administrateur système par défaut ne peut pas être modifié.";
