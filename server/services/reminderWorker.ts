import { db } from "../db";
import { notificationProvider } from "./notificationProvider";
import { getActiveNotificationPreferences } from "./notificationPreferencesService";
import { sendPushToUser } from "./pushNotificationService";

const REMINDER_CHECK_INTERVAL = 30 * 1000;
let isChecking = false;
let workerTimeout: NodeJS.Timeout | null = null;

interface DueDoseRow {
  id_calendrier_prise: number;
  heure_prevue: string;
  dose: number | string;
  nom_unite: string;
  med_name: string;
  nom_patient: string;
  numero_telephone: string;
  id_utilisateur: number;
  tentatives_rappel: number;
}

function generateCombinedReminderMessage(patientName: string, items: DueDoseRow[]): string {
  const uniqueItemsMap = new Map<number, DueDoseRow>();
  items.forEach((item) => {
    if (!uniqueItemsMap.has(item.id_calendrier_prise)) {
      uniqueItemsMap.set(item.id_calendrier_prise, item);
    }
  });
  const uniqueItems = Array.from(uniqueItemsMap.values());
  if (uniqueItems.length === 0) return "";

  const scheduledTime = new Date(uniqueItems[0].heure_prevue);
  const hour = scheduledTime.getHours();
  const greeting = hour >= 18 || hour < 6 ? "Bonsoir" : "Bonjour";
  const timeStr = scheduledTime
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");

  const groupedMeds = new Map<string, { dose: number; unite: string; rawDose?: string }>();
  uniqueItems.forEach((item) => {
    const key = item.med_name;
    const current = groupedMeds.get(key) || { dose: 0, unite: item.nom_unite || "" };
    const doseNum = parseFloat(String(item.dose).replace(",", "."));
    if (!Number.isNaN(doseNum)) {
      current.dose += doseNum;
    } else if (current.dose === 0) {
      current.rawDose = String(item.dose);
    }
    groupedMeds.set(key, current);
  });

  const medsList = Array.from(groupedMeds.entries())
    .map(([name, info]) => {
      const doseDisplay = info.rawDose || info.dose;
      return `${name} : ${doseDisplay} ${info.unite}`.trim();
    })
    .join("\n");

  return `${greeting} MR/Mme ${patientName} ; c'est l'heure de prendre vos médicaments de ${timeStr} :\n${medsList}`;
}

export function startReminderWorker() {
  if (workerTimeout) {
    console.log("ℹ️ Reminder worker already running.");
    return;
  }

  console.log("🚀 Starting reminder worker (30s interval)...");

  const runWorker = async () => {
    try {
      await checkAndSendReminders();
      await handleVoiceFallbacks();
    } catch (err) {
      console.error("Error in reminder worker loop:", err);
    }
    workerTimeout = setTimeout(runWorker, REMINDER_CHECK_INTERVAL);
  };

  runWorker();
}

async function checkAndSendReminders() {
  if (isChecking) return;
  isChecking = true;

  try {
    const now = new Date();
    const plus65Str = new Date(now.getTime() + 65 * 60 * 1000).toISOString();
    const minus24HoursStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const retryCooldownStr = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    const dueDoses = db
      .prepare(
        `
      SELECT
        cp.id_calendrier_prise,
        cp.heure_prevue,
        cp.dose,
        u.nom_unite,
        m.nom as med_name,
        o.nom_patient,
        u2.numero_telephone,
        u2.id_utilisateur,
        cp.tentatives_rappel
      FROM CalendrierPrises cp
      JOIN ElementsOrdonnance eo ON cp.id_element_ordonnance = eo.id_element_ordonnance
      JOIN Ordonnances o ON eo.id_ordonnance = o.id_ordonnance
      JOIN Medicaments m ON eo.id_medicament = m.id_medicament
      JOIN Unites u ON cp.id_unite = u.id_unite
      JOIN Utilisateurs u2 ON o.id_utilisateur = u2.id_utilisateur
      WHERE cp.rappel_envoye = 0
        AND cp.tentatives_rappel < 3
        AND (cp.dernier_essai IS NULL OR cp.dernier_essai <= ?)
        AND cp.heure_prevue <= ?
        AND cp.heure_prevue >= ?
        AND o.est_active = 1
    `,
      )
      .all(retryCooldownStr, plus65Str, minus24HoursStr) as DueDoseRow[];

    if (dueDoses.length === 0) return;

    const groups: Record<string, DueDoseRow[]> = {};
    dueDoses.forEach((row) => {
      const key = `${row.id_utilisateur}_${row.nom_patient}_${row.heure_prevue}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });

    for (const items of Object.values(groups)) {
      await sendCombinedReminders(items);
    }
  } catch (error) {
    console.error("Critical error in reminder worker:", error);
  } finally {
    isChecking = false;
  }
}

async function sendCombinedReminders(items: DueDoseRow[]) {
  const patientName = items[0].nom_patient;
  const userId = items[0].id_utilisateur;
  const message = generateCombinedReminderMessage(patientName, items);
  const ids = items.map((i) => i.id_calendrier_prise);
  const placeholders = ids.map(() => "?").join(",");

  db.prepare(
    `
    UPDATE CalendrierPrises
    SET tentatives_rappel = tentatives_rappel + 1,
        dernier_essai = datetime('now')
    WHERE id_calendrier_prise IN (${placeholders})
  `,
  ).run(...ids);

  const prefs = getActiveNotificationPreferences(userId);
  const uniquePrefs = dedupePreferences(prefs);

  console.log(
    `📤 Sending reminders to user ${userId} via ${uniquePrefs.map((p) => p.channelName).join(", ")} (${items.length} doses)`,
  );

  let anySuccess = false;

  for (const pref of uniquePrefs) {
    const contact = pref.contact || items[0].numero_telephone;
    const jobId = db
      .prepare(
        `
      INSERT INTO NotificationJobs (id_utilisateur, channel, message, contact_value, scheduled_at, status)
      VALUES (?, ?, ?, ?, ?, 'processing')
    `,
      )
      .run(userId, pref.channelName, message, contact, new Date().toISOString())
      .lastInsertRowid as number;

    let result: { success: boolean; error?: string; messageId?: string; statusOverride?: string };

    try {
      if (pref.channelName === "SMS") {
        result = await notificationProvider.sendSMS(contact, message);
      } else if (pref.channelName === "WhatsApp") {
        result = await notificationProvider.sendWhatsApp(contact, message);
      } else if (pref.channelName === "Appel") {
        result = await notificationProvider.sendVoiceCall(contact, message);
        if (result.success) result.statusOverride = "calling";
      } else if (pref.channelName === "Push") {
        const pushResult = await sendPushToUser(userId, "Rappel TAKYMED", message, {
          type: "reminder",
          doseIds: ids.join(","),
        });
        result = {
          success: pushResult.success,
          messageId: pushResult.inAppId ? String(pushResult.inAppId) : undefined,
          error: pushResult.errors.join("; ") || undefined,
        };
      } else {
        result = { success: false, error: "Canal non supporté" };
      }
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      };
    }

    const finalStatus = result.statusOverride || (result.success ? "sent" : "failed");
    db.prepare(
      `UPDATE NotificationJobs SET status = ?, processed_at = datetime('now') WHERE id_job = ?`,
    ).run(finalStatus, jobId);

    const providerName = notificationProvider.constructor.name.includes("Orange")
      ? "orange"
      : "mock";

    try {
      db.prepare(
        `
        INSERT INTO NotificationLogs (id_job, provider, channel, to_contact, message, status, error_message, provider_message_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        jobId,
        providerName,
        pref.channelName,
        contact,
        message,
        finalStatus,
        result.error || null,
        result.messageId || null,
      );
    } catch (logError) {
      console.error("Failed to insert notification log:", logError);
    }

    if (result.success) {
      anySuccess = true;
      console.log(`✅ ${pref.channelName} sent for ${patientName}`);
    } else {
      console.log(`❌ ${pref.channelName} failed: ${result.error}`);
    }
  }

  if (anySuccess) {
    db.prepare(
      `
      UPDATE CalendrierPrises SET rappel_envoye = 1
      WHERE id_calendrier_prise IN (${placeholders})
    `,
    ).run(...ids);
  }
}

function dedupePreferences(
  prefs: Array<{ channelId: number; channelName: string; contact: string }>,
) {
  const seen = new Set<string>();
  return prefs.filter((pref) => {
    const key = `${pref.channelName}|${pref.contact}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function handleVoiceFallbacks() {
  try {
    const pendingCalls = db
      .prepare(
        `
      SELECT nj.*, nl.provider_message_id
      FROM NotificationJobs nj
      JOIN NotificationLogs nl ON nj.id_job = nl.id_job
      WHERE nj.channel = 'Appel'
        AND nj.status = 'calling'
        AND nj.created_at <= datetime('now', '-1 minute')
    `,
      )
      .all() as Array<{
      id_job: number;
      contact_value: string;
      message: string;
      id_utilisateur: number;
      provider_message_id: string;
    }>;

    for (const job of pendingCalls) {
      const statusCheck = await notificationProvider.checkStatus(
        job.provider_message_id,
        "Voice",
      );

      if (statusCheck.status === "answered") {
        db.prepare(`UPDATE NotificationJobs SET status = 'sent' WHERE id_job = ?`).run(
          job.id_job,
        );
      } else if (statusCheck.status === "no-answer") {
        db.prepare(`UPDATE NotificationJobs SET status = 'fallback_triggered' WHERE id_job = ?`).run(
          job.id_job,
        );

        const fallbackMsg = `${job.message}\n(Ceci est un message de rappel suite à notre tentative d'appel restée sans réponse.)`;
        const waResult = await notificationProvider.sendWhatsApp(job.contact_value, fallbackMsg);

        const providerName = notificationProvider.constructor.name.includes("Orange")
          ? "orange"
          : "mock";
        const fallbackJobId = db
          .prepare(
            `
          INSERT INTO NotificationJobs (id_utilisateur, channel, message, contact_value, scheduled_at, status, processed_at)
          VALUES (?, 'WhatsApp', ?, ?, datetime('now'), ?, datetime('now'))
        `,
          )
          .run(
            job.id_utilisateur,
            fallbackMsg,
            job.contact_value,
            waResult.success ? "sent" : "failed",
          ).lastInsertRowid;

        db.prepare(
          `
          INSERT INTO NotificationLogs (id_job, provider, channel, to_contact, message, status, error_message, provider_message_id)
          VALUES (?, ?, 'WhatsApp', ?, ?, ?, ?, ?)
        `,
        ).run(
          fallbackJobId,
          providerName,
          job.contact_value,
          fallbackMsg,
          waResult.success ? "sent" : "failed",
          waResult.error || null,
          waResult.messageId || null,
        );
      }
    }
  } catch (error) {
    console.error("Error in handleVoiceFallbacks:", error);
  }
}
