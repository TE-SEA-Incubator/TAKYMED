import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  getUserNotificationPreferencesForApi,
  saveUserNotificationPreferences,
} from "../services/notificationPreferencesService";
import {
  acknowledgePushNotifications,
  getPendingPushNotifications,
  getWebPushPublicKey,
  registerDeviceToken,
  sendPushToUser,
  unregisterDeviceToken,
} from "../services/pushNotificationService";
import { notificationProvider } from "../services/notificationProvider";

const router = Router();

function getUserId(req: { headers: Record<string, unknown> }): number | null {
  const raw = req.headers["x-user-id"];
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

router.get("/", (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

  try {
    const notifications = db
      .prepare(
        `
            SELECT id_notification as id, titre, contenu, type_notif as type, est_lu as isRead, cree_le as createdAt
            FROM Notifications
            WHERE id_utilisateur = ?
            ORDER BY cree_le DESC
            LIMIT 100
        `,
      )
      .all(userId);
    res.json({ notifications });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/preferences", (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

  try {
    res.json(getUserNotificationPreferencesForApi(userId));
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/preferences", (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

  const body = z
    .object({
      recipients: z.array(z.string()).optional(),
      channels: z.array(z.enum(["sms", "whatsapp", "call", "push"])).min(1),
    })
    .parse(req.body);

  try {
    saveUserNotificationPreferences(userId, body);
    res.json({ success: true, ...getUserNotificationPreferencesForApi(userId) });
  } catch (error) {
    console.error("Failed to save notification preferences:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/vapid-public-key", (_req, res) => {
  res.json({ publicKey: getWebPushPublicKey() });
});

router.post("/register-device", (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

  const body = z
    .object({
      platform: z.enum(["web", "android", "ios"]),
      token: z.string().min(1),
      deviceLabel: z.string().optional(),
    })
    .parse(req.body);

  try {
    registerDeviceToken(userId, body.platform, body.token, body.deviceLabel);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to register device:", error);
    res.status(500).json({ error: "Erreur enregistrement appareil" });
  }
});

router.post("/unregister-device", (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

  const body = z.object({ token: z.string().min(1) }).parse(req.body);
  unregisterDeviceToken(userId, body.token);
  res.json({ success: true });
});

router.get("/pending-push", (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

  const since = typeof req.query.since === "string" ? req.query.since : undefined;
  res.json({ notifications: getPendingPushNotifications(userId, since) });
});

router.post("/ack-push", (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

  const body = z.object({ ids: z.array(z.number()) }).parse(req.body);
  acknowledgePushNotifications(userId, body.ids);
  res.json({ success: true });
});

router.patch("/:id/read", (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  try {
    db.prepare(
      "UPDATE Notifications SET est_lu = 1 WHERE id_notification = ? AND id_utilisateur = ?",
    ).run(id, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/:id", (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });
  const { id } = req.params;

  try {
    db.prepare(
      "DELETE FROM Notifications WHERE id_notification = ? AND id_utilisateur = ?",
    ).run(id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete notification:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/test-send", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

  try {
    const body = z
      .object({
        channel: z.enum(["SMS", "WhatsApp", "Voice", "Push"]),
        to: z.string().optional(),
        message: z.string().min(1),
      })
      .parse(req.body);

    let result: { success: boolean; messageId?: string; error?: string };

    switch (body.channel) {
      case "SMS":
        result = await notificationProvider.sendSMS(body.to || "", body.message);
        break;
      case "WhatsApp":
        result = await notificationProvider.sendWhatsApp(body.to || "", body.message);
        break;
      case "Voice":
        result = await notificationProvider.sendVoiceCall(body.to || "", body.message);
        break;
      case "Push":
        result = await sendPushToUser(userId, "Test TAKYMED", body.message);
        break;
    }

    res.json(result);
  } catch (error) {
    console.error("Test notification error:", error);
    res.status(400).json({ error: "Données invalides" });
  }
});

export const notificationRouter = router;
