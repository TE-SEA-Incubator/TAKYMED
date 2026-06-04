import { db } from "../db";
import {
  countActiveOrdonnances,
  countPendingRappels,
  getUserAccountLimits,
  isUnlimited,
  refreshOrdonnanceActiveState,
} from "./accountLimits";

export interface UserDashboardStats {
  observanceRate: number;
  activeReminders: number;
  plannedReminders: number;
  completedDoses: number;
  overdueReminders: number;
  nearbyPharmacies: number;
  pharmaciesOnDuty: number;
  nextDose: Record<string, unknown> | null;
  quota: {
    ordonnances: {
      max: number | null;
      used: number;
      remaining: number | null;
      unlimited: boolean;
    };
    rappels: {
      max: number | null;
      used: number;
      remaining: number | null;
      unlimited: boolean;
    };
  };
}

function userDoseFilter(userId: number, patientId?: number): { sql: string; params: number[] } {
  let sql = `
    FROM CalendrierPrises cp
    JOIN ElementsOrdonnance eo ON cp.id_element_ordonnance = eo.id_element_ordonnance
    JOIN Medicaments m ON eo.id_medicament = m.id_medicament
    JOIN Ordonnances o ON eo.id_ordonnance = o.id_ordonnance
    WHERE o.id_utilisateur = ?
  `;
  const params: number[] = [userId];
  if (patientId) {
    sql += ` AND o.id_ordonnance = ?`;
    params.push(patientId);
  }
  return { sql, params };
}

function mapNextDoseRow(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  const dateObj = new Date(row.time as string);
  const isValidDate = !isNaN(dateObj.getTime());
  return {
    id: row.id,
    medicationId: row.medicationId,
    medicationName: row.medicationName,
    clientName: row.clientName || "Patient",
    patientId: row.patientId,
    dose: row.dose,
    unit: row.unit || "unité",
    scheduledAt: row.time,
    time: isValidDate
      ? dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : "--:--",
    day: isValidDate ? dateObj.getDate() : 1,
    statusReminderSent: !!row.statusReminderSent,
    statusTaken: !!row.statusTaken,
    isOverdue: isValidDate && dateObj.getTime() < Date.now(),
  };
}

/** Statistiques dashboard calculées depuis SQLite (données réelles). */
export function buildUserDashboardStats(
  userId: number,
  patientId?: number,
): UserDashboardStats {
  refreshOrdonnanceActiveState(userId);

  const { sql: doseFrom, params: doseParams } = userDoseFilter(userId, patientId);

  const aggregates = db
    .prepare(
      `
    SELECT
      COUNT(*) as totalScheduled,
      SUM(CASE WHEN cp.statut_prise = 1 THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN cp.statut_prise = 0 THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN cp.statut_prise = 0 AND datetime(cp.heure_prevue) <= datetime('now') THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN datetime(cp.heure_prevue) <= datetime('now') THEN 1 ELSE 0 END) as dueTotal,
      SUM(CASE WHEN cp.statut_prise = 1 AND datetime(cp.heure_prevue) <= datetime('now') THEN 1 ELSE 0 END) as dueTaken
    ${doseFrom}
  `,
    )
    .get(...doseParams) as {
    totalScheduled: number;
    completed: number;
    pending: number;
    overdue: number;
    dueTotal: number;
    dueTaken: number;
  };

  const totalScheduled = Number(aggregates?.totalScheduled || 0);
  const completed = Number(aggregates?.completed || 0);
  const pending = Number(aggregates?.pending || 0);
  const overdue = Number(aggregates?.overdue || 0);
  const dueTotal = Number(aggregates?.dueTotal || 0);
  const dueTaken = Number(aggregates?.dueTaken || 0);

  const observanceRate =
    dueTotal > 0 ? Math.round((dueTaken / dueTotal) * 100) : 100;

  const nextFuture = db
    .prepare(
      `
    SELECT
      cp.id_calendrier_prise as id,
      m.id_medicament as medicationId,
      m.nom as medicationName,
      o.nom_patient as clientName,
      o.id_ordonnance as patientId,
      eo.dose_personnalisee as dose,
      cp.heure_prevue as time,
      cp.rappel_envoye as statusReminderSent,
      cp.statut_prise as statusTaken
    ${doseFrom}
      AND cp.statut_prise = 0
      AND datetime(cp.heure_prevue) >= datetime('now')
    ORDER BY cp.heure_prevue ASC
    LIMIT 1
  `,
    )
    .get(...doseParams) as Record<string, unknown> | undefined;

  const nextOverdue = !nextFuture
    ? (db
        .prepare(
          `
    SELECT
      cp.id_calendrier_prise as id,
      m.id_medicament as medicationId,
      m.nom as medicationName,
      o.nom_patient as clientName,
      o.id_ordonnance as patientId,
      eo.dose_personnalisee as dose,
      cp.heure_prevue as time,
      cp.rappel_envoye as statusReminderSent,
      cp.statut_prise as statusTaken
    ${doseFrom}
      AND cp.statut_prise = 0
    ORDER BY cp.heure_prevue ASC
    LIMIT 1
  `,
        )
        .get(...doseParams) as Record<string, unknown> | undefined)
    : undefined;

  const partnerPharmacies = db
    .prepare(
      `
    SELECT COUNT(DISTINCT p.id_pharmacie) as count
    FROM Pharmacies p
    JOIN StockMedicamentsPharmacie s ON p.id_pharmacie = s.id_pharmacie
    WHERE s.quantite > 0
  `,
    )
    .get() as { count: number };

  let gardeCount = 0;
  try {
    gardeCount = (
      db.prepare("SELECT COUNT(*) as count FROM PharmaciesGarde").get() as {
        count: number;
      }
    ).count;
  } catch {
    gardeCount = 0;
  }

  const limits = getUserAccountLimits(userId);
  const activeOrdonnances = countActiveOrdonnances(userId);
  const activeRappels = countPendingRappels(userId);

  const ordonnanceUnlimited = isUnlimited(limits?.maxOrdonnances);
  const rappelsUnlimited = isUnlimited(limits?.maxRappels);

  const ordonnanceRemaining = ordonnanceUnlimited
    ? null
    : Math.max(Number(limits?.maxOrdonnances || 0) - activeOrdonnances, 0);

  const rappelsRemaining = rappelsUnlimited
    ? null
    : Math.max(Number(limits?.maxRappels || 0) - activeRappels, 0);

  return {
    observanceRate,
    activeReminders: pending,
    plannedReminders: totalScheduled,
    completedDoses: completed,
    overdueReminders: overdue,
    nearbyPharmacies: Number(partnerPharmacies?.count || 0),
    pharmaciesOnDuty: Number(gardeCount),
    nextDose: mapNextDoseRow(nextFuture || nextOverdue),
    quota: {
      ordonnances: {
        max: limits?.maxOrdonnances ?? null,
        used: activeOrdonnances,
        remaining: ordonnanceRemaining,
        unlimited: ordonnanceUnlimited,
      },
      rappels: {
        max: limits?.maxRappels ?? null,
        used: activeRappels,
        remaining: rappelsRemaining,
        unlimited: rappelsUnlimited,
      },
    },
  };
}
