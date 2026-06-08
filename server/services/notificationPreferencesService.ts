import { db } from "../db";

export const CHANNEL_MAP: Record<string, number> = {
  sms: 1,
  whatsapp: 2,
  call: 3,
  push: 4,
};

export const CHANNEL_NAME_BY_ID: Record<number, string> = {
  1: "SMS",
  2: "WhatsApp",
  3: "Appel",
  4: "Push",
};

export interface NotifConfigInput {
  recipients?: string[];
  phone?: string;
  channels?: string[];
  type?: string;
}

export interface UserNotificationPreference {
  channelId: number;
  channelName: string;
  contact: string;
}

export function saveUserNotificationPreferences(
  userId: number,
  notifConfig: NotifConfigInput,
): void {
  const recipients = Array.isArray(notifConfig.recipients)
    ? notifConfig.recipients.map((r) => (r || "").trim()).filter(Boolean)
    : notifConfig.phone
      ? [String(notifConfig.phone).trim()]
      : [];

  const channels = Array.isArray(notifConfig.channels)
    ? notifConfig.channels.filter((c) => CHANNEL_MAP[c])
    : notifConfig.type && CHANNEL_MAP[notifConfig.type]
      ? [notifConfig.type]
      : [];

  if (channels.length === 0) {
    throw new Error("No valid channels provided.");
  }

  db.prepare(`
    UPDATE PreferencesNotificationUtilisateurs
    SET est_active = 0
    WHERE id_utilisateur = ?
  `).run(userId);

  const insertPref = db.prepare(`
    INSERT OR REPLACE INTO PreferencesNotificationUtilisateurs (id_utilisateur, id_canal, valeur_contact, est_active)
    VALUES (?, ?, ?, 1)
  `);

  const needsPhone = channels.some((c) => c !== "push");

  if (needsPhone && recipients.length === 0) {
    const user = db
      .prepare("SELECT numero_telephone FROM Utilisateurs WHERE id_utilisateur = ?")
      .get(userId) as { numero_telephone?: string } | undefined;
    if (user?.numero_telephone) {
      recipients.push(user.numero_telephone);
    }
  }

        for (const channel of channels) {
        if (channel === "push") {
          insertPref.run(userId, CHANNEL_MAP['push'], `user:${userId}`);
          continue;
        }

        // Skip if no recipients for channels that require contact info
        if (recipients.length === 0) {
          console.warn(`No recipients found for channel ${channel}, skipping insert.`);
          continue;
        }
        for (const recipient of recipients) {
          insertPref.run(userId, CHANNEL_MAP[channel], recipient);
        }
      }
}

export function getActiveNotificationPreferences(
  userId: number,
): UserNotificationPreference[] {
  const rows = db
    .prepare(
      `
    SELECT pnu.id_canal as channelId, cn.nom_canal as channelName, pnu.valeur_contact as contact
    FROM PreferencesNotificationUtilisateurs pnu
    JOIN CanauxNotification cn ON pnu.id_canal = cn.id_canal
    WHERE pnu.id_utilisateur = ? AND pnu.est_active = 1
  `,
    )
    .all(userId) as UserNotificationPreference[];

  if (rows.length > 0) return rows;

  const user = db
    .prepare("SELECT numero_telephone FROM Utilisateurs WHERE id_utilisateur = ?")
    .get(userId) as { numero_telephone?: string } | undefined;

  if (user?.numero_telephone) {
    return [{ channelId: 1, channelName: "SMS", contact: user.numero_telephone }];
  }

  return [];
}

export function getUserNotificationPreferencesForApi(userId: number) {
  const prefs = getActiveNotificationPreferences(userId);
  const recipients = [
    ...new Set(
      prefs
        .filter((p) => p.channelName !== "Push")
        .map((p) => p.contact)
        .filter(Boolean),
    ),
  ];
  const channels = [
    ...new Set(
      prefs.map((p) => {
        const name = p.channelName.toLowerCase();
        if (name === "whatsapp") return "whatsapp";
        if (name === "appel") return "call";
        if (name === "push") return "push";
        return "sms";
      }),
    ),
  ];

  return { recipients, channels, preferences: prefs };
}
