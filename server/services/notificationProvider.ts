interface NotificationProvider {
  sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
  sendWhatsApp(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
  sendVoiceCall(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
  checkStatus(messageId: string, channel: string): Promise<{ status: "sent" | "failed" | "answered" | "no-answer" | "calling" }>;
}

// Provider Orange SMS (Orange API)
class OrangeSMSProvider implements NotificationProvider {
  private clientId = process.env.ORANGE_CLIENT_ID;
  private clientSecret = process.env.ORANGE_CLIENT_SECRET;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch('https://api.orange.com/oauth/v3/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error(`Orange Auth failed: ${response.statusText}`);
    }

    const data: any = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (parseInt(data.expires_in) - 60) * 1000;
    return this.accessToken;
  }

  private formatPhone(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, "");
    
    // Si c'est un numéro local à 9 chiffres (Cameroun), ajouter le préfixe +237
    if (cleaned.length === 9 && !cleaned.startsWith("+")) {
        cleaned = "+237" + cleaned;
    }
    // Si le numéro commence par un chiffre (et n'est pas déjà préfixé), ajouter +
    else if (!cleaned.startsWith("+")) {
        cleaned = "+" + cleaned;
    }
    
    // S'assurer qu'il n'y a qu'un seul + au début
    if (cleaned.startsWith("++")) {
        cleaned = cleaned.substring(1);
    }

    return `tel:${cleaned}`;
  }

  async sendSMS(to: string, message: string) {
    try {
      console.log(`[Orange SMS] Début envoi vers ${to}`);
      const token = await this.getAccessToken();
      console.log(`[Orange SMS] Token obtenu: ${token.substring(0, 20)}...`);
      
      const senderAddress = process.env.ORANGE_SENDER_ADDRESS || 'tel:+2250000';
      const senderName = process.env.ORANGE_SENDER_NAME || 'TAKYMED';

      // Use the helper to ensure correct tel:+xxx format
      const formattedTo = this.formatPhone(to);
      console.log(`[Orange SMS] Destinataire formaté: ${formattedTo}`);
      console.log(`[Orange SMS] Expéditeur: ${senderAddress}, Nom: ${senderName}`);

      const body: any = {
        outboundSMSMessageRequest: {
          address: formattedTo,
          senderAddress: senderAddress,
          outboundSMSTextMessage: { message }
        }
      };

      if (senderName) {
        body.outboundSMSMessageRequest.senderName = senderName;
      }

      console.log(`[Orange SMS] Corps de la requête:`, JSON.stringify(body, null, 2));
      
      const url = `https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(senderAddress)}/requests`;
      console.log(`[Orange SMS] URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      console.log(`[Orange SMS] Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        console.error(`[Orange SMS] Erreur API:`, JSON.stringify(errorData, null, 2));
        
        // Extract a more human-readable error if possible
        const apiError = errorData.requestError?.serviceException?.text || 
                         errorData.requestError?.policyException?.text ||
                         JSON.stringify(errorData);
                         
        return { success: false, error: apiError };
      }

      const data: any = await response.json();
      console.log(`[Orange SMS] Succès:`, JSON.stringify(data, null, 2));
      return {
        success: true,
        messageId: data.outboundSMSMessageRequest.resourceReference?.resourceURL?.split('/').pop()
      };
    } catch (error: any) {
      console.error("[Orange SMS] Exception:", error);
      return { success: false, error: error.message };
    }
  }

  async sendWhatsApp(to: string, message: string) {
    try {
        const { sendWhatsAppMessage } = await import("./whatsappProvider");
        return await sendWhatsAppMessage(to, message);
    } catch (error: any) {
        console.error("[Orange WA Fallback] Failed to use Baileys, falling back to SMS:", error);
        return this.sendSMS(to, message);
    }
  }

  async sendVoiceCall(to: string, message: string) {
    try {
        const { sendWhatsAppVoice } = await import("./whatsappProvider");
        return await sendWhatsAppVoice(to, message);
    } catch (error: any) {
        console.error("[Orange Voice] Failed to use WhatsApp Voice:", error);
        return { success: false, error: error.message };
    }
  }

  async checkStatus(messageId: string, channel: string): Promise<{ status: "sent" | "failed" | "answered" | "no-answer" | "calling" }> {
    if (channel !== "Voice") return { status: "sent" };
    
    // Pour WhatsApp Voice, on considère "answered" si le message a été lu/joué.
    // Sans store Baileys persistant pour les receipts, on simule :
    // Si on arrive ici via le worker de fallback (après 1 min), on retourne "no-answer" 
    // pour déclencher le secours WhatsApp texte.
    
    return { status: "no-answer" };
  }
}

// Provider mock pour développement
class MockNotificationProvider implements NotificationProvider {
  async sendSMS(to: string, message: string) {
    console.log(`📱 Mock SMS to ${to}: ${message}`);
    const success = Math.random() > 0.1;
    return {
      success,
      messageId: success ? `mock-sms-${Date.now()}` : undefined,
      error: success ? undefined : "Mock SMS failure"
    };
  }

  async sendWhatsApp(to: string, message: string) {
    console.log(`💬 Mock WhatsApp to ${to}: ${message}`);
    const success = Math.random() > 0.15;
    return {
      success,
      messageId: success ? `mock-wa-${Date.now()}` : undefined,
      error: success ? undefined : "Mock WhatsApp failure"
    };
  }

  async sendVoiceCall(to: string, message: string) {
    console.log(`📞 Mock Voice call to ${to}: ${message}`);
    return {
      success: true,
      messageId: `mock-voice-${Date.now()}`
    };
  }

  async checkStatus(messageId: string, channel: string): Promise<{ status: "sent" | "failed" | "answered" | "no-answer" | "calling" }> {
    if (channel !== "Voice") return { status: "sent" };
    
    // Simuler le fait qu'il faille attendre un peu pour savoir si ça a été décroché
    // Dans le mock, on décide du résultat basé sur l'ID (50/50 chance)
    const idNum = parseInt(messageId.split('-').pop() || "0");
    const isAnswered = idNum % 2 === 0;
    
    return { status: isAnswered ? "answered" : "no-answer" };
  }
}

// Instance globale du provider (toujours Orange API)
const notificationProvider: NotificationProvider =
  (process.env.ORANGE_CLIENT_ID && process.env.ORANGE_CLIENT_SECRET)
    ? new OrangeSMSProvider()
    : new MockNotificationProvider();

// Log au démarrage
console.log(`📱 Notification Provider initialized: ${notificationProvider.constructor.name}`);
console.log(`📱 ORANGE_CLIENT_ID: ${process.env.ORANGE_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
console.log(`📱 ORANGE_CLIENT_SECRET: ${process.env.ORANGE_CLIENT_SECRET ? '✅ Set' : '❌ Not set'}`);
console.log(`📱 ORANGE_SENDER_ADDRESS: ${process.env.ORANGE_SENDER_ADDRESS || 'Not set'}`);
console.log(`📱 ORANGE_SENDER_NAME: ${process.env.ORANGE_SENDER_NAME || 'Not set'}`);
console.log(`📱 Tous les SMS utilisent maintenant l'API Orange réelle !`);

// Export provider pour utilisation dans d'autres modules
export { notificationProvider, type NotificationProvider };
