import { db } from "../db";

const ALLOWED_FREQUENCIES = ["matin", "midi", "soir", "1x", "2x", "3x", "4x", "interval", "prn", "personnalise"];

function resolveDbFrequency(frequencyType?: string): string {
  if (!frequencyType) return "personnalise";
  return ALLOWED_FREQUENCIES.includes(frequencyType) ? frequencyType : "personnalise";
}

function resolveUnitId(unit?: string): number {
  let unitId = 5;
  if (!unit) return unitId;

  const uRecord = db
    .prepare("SELECT id_unite FROM Unites WHERE LOWER(nom_unite) = LOWER(?)")
    .get(unit) as { id_unite: number } | undefined;

  if (uRecord) return uRecord.id_unite;

  try {
    const uInfo = db.prepare("INSERT INTO Unites (nom_unite) VALUES (?)").run(unit);
    return uInfo.lastInsertRowid as number;
  } catch {
    const uRecordRetry = db
      .prepare("SELECT id_unite FROM Unites WHERE LOWER(nom_unite) = LOWER(?)")
      .get(unit) as { id_unite: number } | undefined;
    return uRecordRetry?.id_unite ?? unitId;
  }
}

function resolveMedicamentId(name: string): number {
  const medRecord = db
    .prepare("SELECT id_medicament FROM Medicaments WHERE LOWER(nom) = LOWER(?)")
    .get(name) as { id_medicament: number } | undefined;

  if (medRecord) return medRecord.id_medicament;

  const mInfo = db.prepare("INSERT INTO Medicaments (nom) VALUES (?)").run(name);
  return mInfo.lastInsertRowid as number;
}

function parseBaseDate(startDate?: string | null): Date {
  if (startDate && typeof startDate === "string") {
    const [y, mm, dd] = startDate.split("-").map(Number);
    if (y && mm && dd) {
      return new Date(y, mm - 1, dd, 12, 0, 0);
    }
  }

  const baseDate = new Date();
  baseDate.setHours(12, 0, 0, 0);
  return baseDate;
}

export function insertPrescriptionForUser(
  userId: number,
  clientName: string,
  prescription: {
    title?: string;
    weight?: number;
    categorieAge?: string;
    medications?: Array<Record<string, unknown>>;
  },
  startDate?: string | null,
): number {
  const medications = Array.isArray(prescription?.medications) ? prescription.medications : [];
  if (medications.length === 0) {
    throw new Error("Au moins un médicament est requis pour l'ordonnance.");
  }

  const ordInfo = db
    .prepare(
      `
    INSERT INTO Ordonnances (id_utilisateur, titre, nom_patient, poids_patient, categorie_age, date_ordonnance, date_debut)
    VALUES (?, ?, ?, ?, ?, CURRENT_DATE, ?)
  `,
    )
    .run(
      userId,
      prescription.title || "Ordonnance initiale",
      clientName,
      prescription.weight || 0,
      prescription.categorieAge || "adulte",
      startDate || null,
    );

  const idOrdonnance = ordInfo.lastInsertRowid as number;
  const baseDate = parseBaseDate(startDate);

  for (const rawMed of medications) {
    const m = rawMed as {
      name?: string;
      frequencyType?: string;
      intervalHours?: number;
      durationDays?: number;
      doseValue?: number;
      unit?: string;
      times?: string[];
    };

    if (!m.name?.trim()) {
      throw new Error("Chaque médicament doit avoir un nom.");
    }

    const idMedicament = resolveMedicamentId(m.name.trim());
    const unitId = resolveUnitId(m.unit);
    const dbFrequence = resolveDbFrequency(m.frequencyType);

    const eoInfo = db
      .prepare(
        `
      INSERT INTO ElementsOrdonnance (id_ordonnance, id_medicament, type_frequence, intervalle_heures, duree_jours, dose_personnalisee, id_unite_personnalisee)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        idOrdonnance,
        idMedicament,
        dbFrequence,
        m.intervalHours || null,
        m.durationDays || 1,
        m.doseValue ?? 1,
        unitId,
      );

    const idElement = eoInfo.lastInsertRowid as number;

    if (m.frequencyType === "prn") continue;

    const pStmt = db.prepare(`
      INSERT INTO CalendrierPrises (id_element_ordonnance, heure_prevue, dose, id_unite, statut_prise)
      VALUES (?, ?, ?, ?, 0)
    `);

    const durationDays = Math.max(Number(m.durationDays) || 1, 1);

    for (let dayOffset = 0; dayOffset < durationDays; dayOffset++) {
      const currentDate = new Date(baseDate);
      currentDate.setDate(baseDate.getDate() + dayOffset);

      if (m.frequencyType === "interval" && m.intervalHours) {
        let currHour = 0;
        while (currHour < 24) {
          const d = new Date(currentDate);
          d.setHours(currHour, 0, 0, 0);
          pStmt.run(idElement, d.toISOString(), m.doseValue ?? 1, unitId);
          currHour += m.intervalHours;
        }
      } else if (Array.isArray(m.times) && m.times.length > 0) {
        for (const timeStr of m.times) {
          const [h, min] = timeStr.split(":").map(Number);
          const d = new Date(currentDate);
          d.setHours(h || 0, min || 0, 0, 0);
          pStmt.run(idElement, d.toISOString(), m.doseValue ?? 1, unitId);
        }
      }
    }
  }

  return idOrdonnance;
}
