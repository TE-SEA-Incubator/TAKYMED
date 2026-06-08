import { Router } from "express";
import { db } from "../db";
import bcrypt from "bcrypt";
import { z } from "zod";
import { notificationProvider } from "../services/notificationProvider";
import { findUserByPhone, normalizePhone } from "../utils/phone";
import { toUserDTO } from "../utils/authUser";

const router = Router();

const otpRequestSchema = z.object({
    phone: z.string().min(3).max(20),
    channel: z.enum(["SMS", "WhatsApp", "Voice"]).default("SMS"),
});

// Generate random 6-digit OTP
function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash OTP for storage
async function hashOTP(otp: string): Promise<string> {
    return await bcrypt.hash(otp, 12);
}

// Verify OTP against hash
async function verifyOTP(otp: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(otp, hash);
}

// Send OTP via selected channel
async function sendOTP(phone: string, otp: string, channel: string): Promise<boolean> {
    const message = `Votre code de vérification TAKYMED est : ${otp}`;
    let result;

    if (channel === "SMS") {
        result = await notificationProvider.sendSMS(phone, message);
    } else if (channel === "WhatsApp") {
        result = await notificationProvider.sendWhatsApp(phone, message);
    } else {
        return false;
    }

    return result.success;
}

// Clean expired OTPs
function cleanupExpiredOTPs() {
    const now = new Date().toISOString();
    db.prepare("DELETE FROM OtpRequests WHERE expires_at < ? AND status != 'verified'").run(now);
}

// Request OTP
router.post("/pin/request", async (req, res) => {
    try {
        const parsed = otpRequestSchema.parse(req.body);
        const phone = normalizePhone(parsed.phone);
        const channel = parsed.channel;

        if (!phone) {
            return res.status(400).json({ error: "Numéro de téléphone invalide" });
        }

        cleanupExpiredOTPs();

        let user = findUserByPhone(phone);
        const isNewUser = !user;

        if (!user) {
            const standardType = db.prepare("SELECT id_type_compte FROM TypesComptes WHERE nom_type = 'Standard'").get() as { id_type_compte: number } | undefined;

            if (!standardType) {
                return res.status(500).json({ error: "Type de compte Standard non trouvé" });
            }

            const result = db.prepare(`
                INSERT INTO Utilisateurs (numero_telephone, id_type_compte, est_pharmacien, est_valide)
                VALUES (?, ?, 0, 1)
            `).run(phone, standardType.id_type_compte);

            db.prepare(`
                INSERT INTO ProfilsUtilisateurs (id_utilisateur, nom_complet)
                VALUES (?, ?)
            `).run(result.lastInsertRowid, `User ${phone.slice(-4)}`);

            user = findUserByPhone(phone);
        }

        const existingOtp = db.prepare(`
            SELECT id_otp, expires_at, attempts
            FROM OtpRequests
            WHERE phone = ? AND status = 'pending' AND expires_at > datetime('now')
            ORDER BY created_at DESC
            LIMIT 1
        `).get(phone) as { id_otp: number; expires_at: string; attempts: number } | undefined;

        if (existingOtp && existingOtp.attempts >= 3) {
            return res.status(429).json({ error: "Trop de tentatives. Réessayez dans 5 minutes." });
        }

        // Generate new OTP
        const otp = generateOTP();
        const otpHash = await hashOTP(otp);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes for OTP table

        // Store OTP in OtpRequests table
        const result = db.prepare(`
            INSERT INTO OtpRequests (phone, otp_hash, channel, expires_at)
            VALUES (?, ?, ?, ?)
        `).run(phone, otpHash, channel, expiresAt);

        // Send OTP
        const sent = await sendOTP(phone, otp, channel);
        if (!sent) {
            return res.status(500).json({ error: "Erreur d'envoi du code" });
        }

        res.json({
            success: true,
            message: `Code envoyé par ${channel}`,
            otpId: result.lastInsertRowid,
            isNewUser: isNewUser // Indicate if this is a new account
        });

    } catch (error) {
        console.error("OTP request error:", error);
        res.status(400).json({ error: "Données invalides" });
    }
});

// Verify OTP
router.post("/pin/verify", async (req, res) => {
    try {
        const { phone: rawPhone, otp, otpId } = z.object({
            phone: z.string().min(3).max(20),
            otp: z.string().length(6),
            otpId: z.number().optional()
        }).parse(req.body);

        const phone = normalizePhone(rawPhone);
        if (!phone) {
            return res.status(400).json({ error: "Numéro de téléphone invalide" });
        }

        // Find OTP request
        let otpRecord: { id_otp: number; phone: string; otp_hash: string; expires_at: string; attempts: number } | undefined;
        if (otpId) {
            otpRecord = db.prepare(`
                SELECT * FROM OtpRequests
                WHERE id_otp = ? AND phone = ? AND status = 'pending'
            `).get(otpId, phone) as any;
        } else {
            otpRecord = db.prepare(`
                SELECT * FROM OtpRequests
                WHERE phone = ? AND status = 'pending' AND expires_at > datetime('now')
                ORDER BY created_at DESC
                LIMIT 1
            `).get(phone) as any;
        }

        if (!otpRecord) {
            return res.status(400).json({ error: "Code expiré ou invalide" });
        }

        // Check attempts
        if (otpRecord.attempts >= 3) {
            db.prepare("UPDATE OtpRequests SET status = 'failed' WHERE id_otp = ?").run(otpRecord.id_otp);
            return res.status(429).json({ error: "Trop de tentatives. Demandez un nouveau code." });
        }

        // Verify OTP
        const isValid = await verifyOTP(otp, otpRecord.otp_hash);
        if (!isValid) {
            // Increment attempts
            db.prepare("UPDATE OtpRequests SET attempts = attempts + 1 WHERE id_otp = ?").run(otpRecord.id_otp);
            return res.status(400).json({ error: "Code incorrect" });
        }

        // Check expiration
        if (new Date() > new Date(otpRecord.expires_at)) {
            db.prepare("UPDATE OtpRequests SET status = 'expired' WHERE id_otp = ?").run(otpRecord.id_otp);
            return res.status(400).json({ error: "Code expiré" });
        }

        // Mark as verified
        db.prepare(`
            UPDATE OtpRequests
            SET status = 'verified', verified_at = datetime('now')
            WHERE id_otp = ?
        `).run(otpRecord.id_otp);

        const user = findUserByPhone(phone);

        if (!user) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        res.json({
            success: true,
            message: "Connexion réussie",
            user: toUserDTO(user),
            token: "jwt-token-placeholder",
        });

    } catch (error) {
        console.error("OTP verify error:", error);
        res.status(400).json({ error: "Données invalides" });
    }
});

export const otpRouter = router;
