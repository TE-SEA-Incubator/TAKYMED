import webpush from "web-push";
import { db } from "../db";

export interface PushSendResult {
  success: boolean;
  delivered: number;
  errors: string[];
  inAppId?: number;
}

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return Boolean(process.env.WEB_PUSH_PUBLIC_KEY);

  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.WEB_PUSH_SUBJECT || "mailto:support@takymed.com",
    publicKey,
    privateKey,
  );
  vapidConfigured = true;
  return true;
}

export function getWebPushPublicKey(): string | null {
  return process.env.WEB_PUSH_PUBLIC_KEY || null;
}

function createInAppNotification(
  userId: number,
  title: string,
  body: string,
  type: string,
  payload?: Record<string, unknown>,
): number {
  const result = db
    .prepare(
      `
    INSERT INTO Notifications (id_utilisateur, titre, contenu, type_notif, payload, est_lu, est_pousse)
    VALUES (?, ?, ?, ?, ?, 0, 0)
  `,
    )
    .run(userId, title, body, type, payload ? JSON.stringify(payload) : null);

  return result.lastInsertRowid as number;
}

async function sendFcm(token: string, title: string, body: string, data?: Record<string, string>) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    return { success: false, error: "FCM_SERVER_KEY not configured" };
  }

  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      notification: { title, body },
      data: data || {},
      priority: "high",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: text };
  }

  const json = (await response.json()) as { success?: number; failure?: number };
  return { success: (json.success ?? 0) > 0, messageId: `fcm-${Date.now()}` };
}

async function sendWebPushSubscription(
  subscriptionJson: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  if (!configureVapid()) {
    return { success: false, error: "Web Push VAPID keys not configured" };
  }

  const subscription = JSON.parse(subscriptionJson);
  await webpush.sendNotification(
    subscription,
    JSON.stringify({ title, body, data: data || {} }),
  );
  return { success: true, messageId: `webpush-${Date.now()}` };
}

/** Envoie une push notification à tous les appareils enregistrés de l'utilisateur. */
export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<PushSendResult> {
  const errors: string[] = [];
  let delivered = 0;

  const inAppId = createInAppNotification(userId, title, body, "reminder", data);

  const devices = db
    .prepare(
      `
    SELECT id, platform, token
    FROM DeviceTokens
    WHERE id_utilisateur = ? AND est_active = 1
  `,
    )
    .all(userId) as { id: number; platform: string; token: string }[];

  for (const device of devices) {
    try {
      let result: { success: boolean; error?: string };
      if (device.platform === "web") {
        result = await sendWebPushSubscription(device.token, title, body, data);
      } else {
        result = await sendFcm(device.token, title, body, data);
      }

      if (result.success) {
        delivered += 1;
        db.prepare(
          "UPDATE DeviceTokens SET mis_a_jour_le = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(device.id);
      } else if (result.error) {
        errors.push(`${device.platform}: ${result.error}`);
        if (result.error.includes("410") || result.error.includes("NotRegistered")) {
          db.prepare("UPDATE DeviceTokens SET est_active = 0 WHERE id = ?").run(device.id);
        }
      }
    } catch (error) {
      errors.push(
        `${device.platform}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  // In-app toujours disponible (polling mobile / feed web)
  delivered += 1;

  if (delivered > 0) {
    db.prepare("UPDATE Notifications SET est_pousse = 1 WHERE id_notification = ?").run(inAppId);
  }

  return {
    success: delivered > 0,
    delivered,
    errors,
    inAppId,
  };
}

export function registerDeviceToken(
  userId: number,
  platform: "web" | "android" | "ios",
  token: string,
  deviceLabel?: string,
) {
  db.prepare(
    `
    INSERT INTO DeviceTokens (id_utilisateur, platform, token, device_label, est_active, mis_a_jour_le)
    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(id_utilisateur, platform, token) DO UPDATE SET
      est_active = 1,
      device_label = excluded.device_label,
      mis_a_jour_le = CURRENT_TIMESTAMP
  `,
  ).run(userId, platform, token, deviceLabel || null);
}

export function unregisterDeviceToken(userId: number, token: string) {
  db.prepare(
    `
    UPDATE DeviceTokens SET est_active = 0, mis_a_jour_le = CURRENT_TIMESTAMP
    WHERE id_utilisateur = ? AND token = ?
  `,
  ).run(userId, token);
}

export function getPendingPushNotifications(userId: number, since?: string) {
  let query = `
    SELECT id_notification as id, titre as title, contenu as body, type_notif as type, payload, cree_le as createdAt
    FROM Notifications
    WHERE id_utilisateur = ?
      AND est_lu = 0
      AND type_notif IN ('reminder', 'push', 'general', 'message', 'sms', 'whatsapp')
  `;
  const params: Array<number | string> = [userId];

  if (since) {
    query += " AND cree_le > ?";
    params.push(since);
  } else {
    query += " AND cree_le >= datetime('now', '-15 minutes')";
  }

  query += " ORDER BY cree_le DESC LIMIT 20";

  return db.prepare(query).all(...params) as Array<{
    id: number;
    title: string;
    body: string;
    type: string;
    payload: string | null;
    createdAt: string;
  }>;
}

export function acknowledgePushNotifications(userId: number, ids: number[]) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(
    `
    UPDATE Notifications SET est_lu = 1, est_pousse = 1
    WHERE id_utilisateur = ? AND id_notification IN (${placeholders})
  `,
  ).run(userId, ...ids);
}
