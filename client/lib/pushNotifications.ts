function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerWebPush(userId: number): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.register("/sw.js");
    const keyRes = await fetch("/api/notifications/vapid-public-key");
    const { publicKey } = await keyRes.json();

    if (!publicKey) {
      console.warn("Web Push: clés VAPID non configurées côté serveur");
      return false;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await fetch("/api/notifications/register-device", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId.toString(),
      },
      body: JSON.stringify({
        platform: "web",
        token: JSON.stringify(subscription.toJSON()),
        deviceLabel: navigator.userAgent.slice(0, 120),
      }),
    });

    return true;
  } catch (error) {
    console.error("Web Push registration failed:", error);
    return false;
  }
}

export async function ensurePushIfSelected(
  userId: number,
  channels: string[],
): Promise<void> {
  if (channels.includes("push")) {
    await registerWebPush(userId);
  }
}

export type NotificationChannel = "sms" | "whatsapp" | "call" | "push";

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  call: "Appel vocal",
  push: "Notification push",
};
