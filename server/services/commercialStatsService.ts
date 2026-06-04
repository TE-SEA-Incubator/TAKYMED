import { db } from "../db";

export interface CommercialDashboardSummary {
  totalClients: number;
  validClients: number;
  pendingClients: number;
  totalPrescriptions: number;
  totalReminders: number;
  activeReminders: number;
  overdueReminders: number;
}

export interface CommercialClientRow {
  id: number;
  phone: string;
  name: string;
  isValid: boolean;
  createdAt: string | null;
  prescriptionCount: number;
  reminderCount: number;
}

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

/** Liste les clients créés par un commercial (profil optionnel). */
export function listCommercialClients(commercialId: number): CommercialClientRow[] {
  const cid = Number(commercialId);
  if (!Number.isFinite(cid)) return [];

  const rows = db
    .prepare(
      `
    SELECT
      u.id_utilisateur as id,
      u.numero_telephone as phone,
      COALESCE(NULLIF(TRIM(p.nom_complet), ''), u.numero_telephone, 'Client') as name,
      u.est_valide as isValid,
      COALESCE(u.cree_le, u.pin_updated_at, u.mis_a_jour_le) as createdAt,
      (SELECT COUNT(*) FROM Ordonnances WHERE id_utilisateur = u.id_utilisateur) as prescriptionCount,
      (
        SELECT COUNT(cp.id_calendrier_prise)
        FROM CalendrierPrises cp
        JOIN ElementsOrdonnance eo ON cp.id_element_ordonnance = eo.id_element_ordonnance
        JOIN Ordonnances o ON eo.id_ordonnance = o.id_ordonnance
        WHERE o.id_utilisateur = u.id_utilisateur
      ) as reminderCount
    FROM Utilisateurs u
    LEFT JOIN ProfilsUtilisateurs p ON u.id_utilisateur = p.id_utilisateur
    WHERE u.id_createur = ?
    ORDER BY COALESCE(u.cree_le, u.pin_updated_at, u.mis_a_jour_le) DESC
  `,
    )
    .all(cid) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: toInt(row.id),
    phone: String(row.phone ?? ""),
    name: String(row.name ?? "Client"),
    isValid: toBool(row.isValid),
    createdAt: row.createdAt ? String(row.createdAt) : null,
    prescriptionCount: toInt(row.prescriptionCount),
    reminderCount: toInt(row.reminderCount),
  }));
}

/** Statistiques agrégées pour le tableau de bord commercial. */
export function buildCommercialDashboardStats(commercialId: number): CommercialDashboardSummary {
  const cid = Number(commercialId);
  if (!Number.isFinite(cid)) {
    return {
      totalClients: 0,
      validClients: 0,
      pendingClients: 0,
      totalPrescriptions: 0,
      totalReminders: 0,
      activeReminders: 0,
      overdueReminders: 0,
    };
  }

  const summary = db
    .prepare(
      `
    SELECT
      COUNT(*) as totalClients,
      SUM(CASE WHEN u.est_valide = 1 THEN 1 ELSE 0 END) as validClients,
      SUM(CASE WHEN u.est_valide = 0 OR u.est_valide IS NULL THEN 1 ELSE 0 END) as pendingClients
    FROM Utilisateurs u
    WHERE u.id_createur = ?
  `,
    )
    .get(cid) as Record<string, unknown> | undefined;

  const prescriptions = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM Ordonnances o
    JOIN Utilisateurs u ON o.id_utilisateur = u.id_utilisateur
    WHERE u.id_createur = ?
  `,
    )
    .get(cid) as { count: unknown };

  const reminders = db
    .prepare(
      `
    SELECT COUNT(cp.id_calendrier_prise) as count
    FROM CalendrierPrises cp
    JOIN ElementsOrdonnance eo ON cp.id_element_ordonnance = eo.id_element_ordonnance
    JOIN Ordonnances o ON eo.id_ordonnance = o.id_ordonnance
    JOIN Utilisateurs u ON o.id_utilisateur = u.id_utilisateur
    WHERE u.id_createur = ?
  `,
    )
    .get(cid) as { count: unknown };

  const activeReminders = db
    .prepare(
      `
    SELECT COUNT(cp.id_calendrier_prise) as count
    FROM CalendrierPrises cp
    JOIN ElementsOrdonnance eo ON cp.id_element_ordonnance = eo.id_element_ordonnance
    JOIN Ordonnances o ON eo.id_ordonnance = o.id_ordonnance
    JOIN Utilisateurs u ON o.id_utilisateur = u.id_utilisateur
    WHERE u.id_createur = ?
      AND cp.statut_prise = 0
  `,
    )
    .get(cid) as { count: unknown };

  const overdueReminders = db
    .prepare(
      `
    SELECT COUNT(cp.id_calendrier_prise) as count
    FROM CalendrierPrises cp
    JOIN ElementsOrdonnance eo ON cp.id_element_ordonnance = eo.id_element_ordonnance
    JOIN Ordonnances o ON eo.id_ordonnance = o.id_ordonnance
    JOIN Utilisateurs u ON o.id_utilisateur = u.id_utilisateur
    WHERE u.id_createur = ?
      AND cp.statut_prise = 0
      AND datetime(cp.heure_prevue) <= datetime('now')
  `,
    )
    .get(cid) as { count: unknown };

  return {
    totalClients: toInt(summary?.totalClients),
    validClients: toInt(summary?.validClients),
    pendingClients: toInt(summary?.pendingClients),
    totalPrescriptions: toInt(prescriptions?.count),
    totalReminders: toInt(reminders?.count),
    activeReminders: toInt(activeReminders?.count),
    overdueReminders: toInt(overdueReminders?.count),
  };
}
