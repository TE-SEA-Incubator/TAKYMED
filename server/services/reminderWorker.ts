import { db } from "../db";
import { notificationProvider } from "./notificationProvider";
import { getActiveNotificationPreferences } from "./notificationPreferencesService";
import { sendPushToUser } from "./pushNotificationService";

/**
 * CRON DE RAPPELS — Logique temporelle précise
 *
 * Le cron s'exécute toutes les 60 secondes.
 * À chaque tick à l'instant T_now, il envoie les rappels dont l'heure_prevue
 * est dans l'intervalle SEMI-OUVERT : [ T_now - 60s, T_now [
 *
 * Autrement dit :
 *   - Un rappel prévu à exactement T_now ne sera PAS envoyé lors de ce tick.
 *   - Il sera envoyé lors du tick suivant (à T_now + 60s).
 *   - Cela garantit qu'un rappel n'est jamais "manqué" lors du tick
 *     qui coïncide pile avec son heure.
 *
 * De plus, une borne minimale date-du-jour est appliquée pour ne jamais
 * renvoyer de rappels dont la date est antérieure à aujourd'hui (évite
 * de renvoyer des rappels d'hier en cas de redémarrage serveur).
 */

// Intervalle modifiable à chaud par l'admin (en millisecondes)
// Valeur par défaut : 1 minute. Min: 30s, Max: 60min.
let cronIntervalMs = 60 * 1000;
let cronTimer: NodeJS.Timeout | null = null;
let isProcessing = false;

/** Retourne l'intervalle cron actuel en millisecondes. */
export function getCronIntervalMs(): number {
  return cronIntervalMs;
}

/**
 * Modifie l'intervalle cron à chaud et redémarre le timer.
 * @param intervalMs Intervalle en ms. Doit être compris entre 30 000 ms (30s) et 3 600 000 ms (60min).
 */
export function setCronIntervalMs(intervalMs: number): void {
  const MIN = 30 * 1000;       // 30 secondes
  const MAX = 60 * 60 * 1000; // 60 minutes
  const clamped = Math.min(MAX, Math.max(MIN, Math.round(intervalMs)));
  if (clamped === cronIntervalMs) return;

  cronIntervalMs = clamped;
  console.log(`⏱️ Cron interval updated to ${clamped / 1000}s — restarting timer.`);

  // Redémarre proprement le timer si le cron était déjà actif
  if (cronTimer) {
    clearTimeout(cronTimer);
    cronTimer = null;
    startReminderWorker();
  }
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

// ─── Message builder ──────────────────────────────────────────────────────────

function generateCombinedReminderMessage(
  patientName: string,
  items: DueDoseRow[]
): string {
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

// ─── Start / Stop ─────────────────────────────────────────────────────────────

export function startReminderWorker() {
  if (cronTimer) {
    console.log("ℹ️ Reminder cron already running.");
    return;
  }

  console.log(`🚀 Starting reminder cron (${cronIntervalMs / 1000}s interval)...`);

  const tick = async () => {
    try {
      await checkAndSendReminders();
      await handleVoiceFallbacks();
    } catch (err) {
      console.error("💥 Error in reminder cron tick:", err);
    }
    // Re-schedule using current interval (may have changed at runtime)
    cronTimer = setTimeout(tick, cronIntervalMs);
  };

  // First run immediately so we don't wait 1 min after server start
  tick();
}

export function stopReminderWorker() {
  if (cronTimer) {
    clearTimeout(cronTimer);
    cronTimer = null;
    console.log("🛑 Reminder cron stopped.");
  }
}

// ─── Core check ───────────────────────────────────────────────────────────────

async function checkAndSendReminders() {
  if (isProcessing) {
    console.log("⏭️ Reminder check skipped (previous run still active)");
    return;
  }
  isProcessing = true;

  try {
    const now = new Date();

    /**
     * Fenêtre de sélection :
     *   windowStart = now - 60s  (inclus)
     *   windowEnd   = now        (EXCLU — le rappel prévu à exactly "now"
     *                             sera traité lors du prochain tick)
     *
     * De plus on ne sélectionne que les rappels dont la date (jour)
     * est >= aujourd'hui (ignorer complètement les jours passés).
     */
    const windowEnd = now; // exclusif dans la requête (< windowEnd)
    const windowStart = new Date(now.getTime() - CRON_INTERVAL_MS); // inclus

    // Borne minimale : début du jour courant en UTC pour éviter les rappels
    // de jours précédents après un redémarrage. On utilise la date locale
    // et on la convertit en ISO pour SQLite.
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Cooldown de retry : ne pas re-tenter un rappel échoué avant 5 min
    const retryCooldown = new Date(now.getTime() - 5 * 60 * 1000);

    const windowStartStr = windowStart.toISOString();
    const windowEndStr   = windowEnd.toISOString();
    const todayStartStr  = todayStart.toISOString();
    const retryCooldownStr = retryCooldown.toISOString();

    console.log(
      `🕐 Reminder cron tick at ${now.toISOString()} — window: [${windowStartStr}, ${windowEndStr})`
    );

    const dueDoses = db
      .prepare(
        `
        SELECT
          cp.id_calendrier_prise,
          cp.heure_prevue,
          cp.dose,
          u.nom_unite,
          m.nom AS med_name,
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
        WHERE
          cp.rappel_envoye = 0
          AND cp.tentatives_rappel < 3
          AND (cp.dernier_essai IS NULL OR cp.dernier_essai <= ?)
          AND cp.heure_prevue >= ?
          AND cp.heure_prevue >= ?
          AND cp.heure_prevue <  ?
          AND o.est_active = 1
        ORDER BY cp.heure_prevue ASC
      `
      )
      .all(
        retryCooldownStr,
        todayStartStr,   // ne jamais aller chercher avant aujourd'hui
        windowStartStr,  // borne basse inclusive
        windowEndStr     // borne haute exclusive (le tick de "now" sera envoyé lors du suivant)
      ) as DueDoseRow[];

    if (dueDoses.length === 0) {
      console.log("✅ No reminders due in this window.");
      return;
    }

    console.log(`📋 Found ${dueDoses.length} due dose(s) to process.`);

    // Grouper par (utilisateur, patient, heure_prevue) pour messages combinés
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
    console.error("💥 Critical error in reminder check:", error);
  } finally {
    isProcessing = false;
  }
}

// ─── Send ─────────────────────────────────────────────────────────────────────

async function sendCombinedReminders(items: DueDoseRow[]) {
  const patientName = items[0].nom_patient;
  const userId = items[0].id_utilisateur;
  const message = generateCombinedReminderMessage(patientName, items);
  const ids = items.map((i) => i.id_calendrier_prise);
  const placeholders = ids.map(() => "?").join(",");

  // Marquer la tentative
  db.prepare(
    `
    UPDATE CalendrierPrises
    SET tentatives_rappel = tentatives_rappel + 1,
        dernier_essai = datetime('now')
    WHERE id_calendrier_prise IN (${placeholders})
  `
  ).run(...ids);

  const prefs = getActiveNotificationPreferences(userId);
  const uniquePrefs = dedupePreferences(prefs);

  console.log(
    `📤 Sending reminders to user ${userId} [${patientName}] via ${uniquePrefs
      .map((p) => p.channelName)
      .join(", ")} — ${items.length} dose(s)`
  );

  let anySuccess = false;

  for (const pref of uniquePrefs) {
    const contact = pref.contact || items[0].numero_telephone;
    const jobId = db
      .prepare(
        `
        INSERT INTO NotificationJobs (id_utilisateur, channel, message, contact_value, scheduled_at, status)
        VALUES (?, ?, ?, ?, ?, 'processing')
      `
      )
      .run(userId, pref.channelName, message, contact, new Date().toISOString())
      .lastInsertRowid as number;

    let result: {
      success: boolean;
      error?: string;
      messageId?: string;
      statusOverride?: string;
    };

    try {
      if (pref.channelName === "SMS") {
        result = await notificationProvider.sendSMS(contact, message);
      } else if (pref.channelName === "WhatsApp") {
        result = await notificationProvider.sendWhatsApp(contact, message);
      } else if (pref.channelName === "Appel") {
        result = await notificationProvider.sendVoiceCall(contact, message);
        if (result.success) result.statusOverride = "calling";
      } else if (pref.channelName === "Push") {
        const pushResult = await sendPushToUser(
          userId,
          "Rappel TAKYMED",
          message,
          { type: "reminder", doseIds: ids.join(",") }
        );
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
      `UPDATE NotificationJobs SET status = ?, processed_at = datetime('now') WHERE id_job = ?`
    ).run(finalStatus, jobId);

    const providerName = notificationProvider.constructor.name.includes("Orange")
      ? "orange"
      : "mock";

    try {
      db.prepare(
        `
        INSERT INTO NotificationLogs (id_job, provider, channel, to_contact, message, status, error_message, provider_message_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        jobId,
        providerName,
        pref.channelName,
        contact,
        message,
        finalStatus,
        result.error || null,
        result.messageId || null
      );
    } catch (logError) {
      console.error("⚠️ Failed to insert notification log:", logError);
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
    `
    ).run(...ids);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dedupePreferences(
  prefs: Array<{ channelId: number; channelName: string; contact: string }>
) {
  const seen = new Set<string>();
  return prefs.filter((pref) => {
    const key = `${pref.channelName}|${pref.contact}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Voice fallback ───────────────────────────────────────────────────────────

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
      `
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
        "Voice"
      );

      if (statusCheck.status === "answered") {
        db.prepare(`UPDATE NotificationJobs SET status = 'sent' WHERE id_job = ?`).run(
          job.id_job
        );
      } else if (statusCheck.status === "no-answer") {
        db.prepare(
          `UPDATE NotificationJobs SET status = 'fallback_triggered' WHERE id_job = ?`
        ).run(job.id_job);

        const fallbackMsg = `${job.message}\n(Ceci est un message de rappel suite à notre tentative d'appel restée sans réponse.)`;
        const waResult = await notificationProvider.sendWhatsApp(
          job.contact_value,
          fallbackMsg
        );

        const providerName = notificationProvider.constructor.name.includes("Orange")
          ? "orange"
          : "mock";

        const fallbackJobId = db
          .prepare(
            `
            INSERT INTO NotificationJobs (id_utilisateur, channel, message, contact_value, scheduled_at, status, processed_at)
            VALUES (?, 'WhatsApp', ?, ?, datetime('now'), ?, datetime('now'))
          `
          )
          .run(
            job.id_utilisateur,
            fallbackMsg,
            job.contact_value,
            waResult.success ? "sent" : "failed"
          ).lastInsertRowid;

        db.prepare(
          `
          INSERT INTO NotificationLogs (id_job, provider, channel, to_contact, message, status, error_message, provider_message_id)
          VALUES (?, ?, 'WhatsApp', ?, ?, ?, ?, ?)
        `
        ).run(
          fallbackJobId,
          providerName,
          job.contact_value,
          fallbackMsg,
          waResult.success ? "sent" : "failed",
          waResult.error || null,
          waResult.messageId || null
        );
      }
    }
  } catch (error) {
    console.error("⚠️ Error in handleVoiceFallbacks:", error);
  }
}
