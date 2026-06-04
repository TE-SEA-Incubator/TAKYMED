import { db } from "../db";

export interface UserAccountLimits {
  maxOrdonnances: number | null;
  maxRappels: number | null;
}

export function refreshOrdonnanceActiveState(userId: number): void {
  // 1) Désactiver les ordonnances entièrement terminées (plus aucune prise en attente).
  db.prepare(
    `
      UPDATE Ordonnances
      SET est_active = 0
      WHERE id_utilisateur = ?
        AND est_active = 1
        AND NOT EXISTS (
          SELECT 1
          FROM ElementsOrdonnance eo
          JOIN CalendrierPrises cp ON cp.id_element_ordonnance = eo.id_element_ordonnance
          WHERE eo.id_ordonnance = Ordonnances.id_ordonnance
            AND cp.statut_prise = 0
        )
    `,
  ).run(userId);
}

export function isUnlimited(limit: number | null | undefined): boolean {
  return limit === null || limit === undefined || Number(limit) < 0;
}

export function getUserAccountLimits(userId: number): UserAccountLimits | null {
  if (!Number.isFinite(userId) || userId <= 0) return null;

  const user = db
    .prepare("SELECT id_type_compte FROM Utilisateurs WHERE id_utilisateur = ?")
    .get(userId) as { id_type_compte: number | null } | undefined;

  if (!user) return null;

  if (user.id_type_compte != null) {
    const row = db
      .prepare(
        `
      SELECT tc.max_ordonnances as maxOrdonnances, tc.max_rappels as maxRappels
      FROM TypesComptes tc
      WHERE tc.id_type_compte = ?
    `,
      )
      .get(user.id_type_compte) as UserAccountLimits | undefined;

    if (row) return row;
  }

  // Utilisateur sans type lié : quotas illimités pour ne pas bloquer la création
  return {
    maxOrdonnances: -1,
    maxRappels: -1,
  };
}

export function countActiveOrdonnances(userId: number): number {
  const row = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM Ordonnances
      WHERE id_utilisateur = ? AND est_active = 1
    `,
    )
    .get(userId) as { count: number };

  return row?.count || 0;
}

export function countPendingRappels(
  userId: number,
  excludeElementId?: number,
): number {
  let query = `
    SELECT COUNT(*) as count
    FROM CalendrierPrises cp
    JOIN ElementsOrdonnance eo ON cp.id_element_ordonnance = eo.id_element_ordonnance
    JOIN Ordonnances o ON eo.id_ordonnance = o.id_ordonnance
    WHERE o.id_utilisateur = ?
      AND o.est_active = 1
      AND cp.statut_prise = 0
  `;

  const params: Array<number> = [userId];

  if (excludeElementId !== undefined) {
    query += ` AND cp.id_element_ordonnance <> ?`;
    params.push(excludeElementId);
  }

  const row = db.prepare(query).get(...params) as { count: number };
  return row?.count || 0;
}
