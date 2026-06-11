import { Router } from "express";
import { db } from "../db";
import { notificationProvider } from "../services/notificationProvider";
import {
  findUserByPhone,
  generatePin,
  isValidUserPin,
  normalizePhone,
  pinExpiryIso,
} from "../utils/phone";
import { toUserDTO } from "../utils/authUser";

const router = Router();

const typeMap: Record<string, string> = {
  standard: "Standard",
  professional: "Professionnel",
  pro: "Professionnel",
  pharmacist: "Professionnel",
  pharmacy: "Professionnel",
  admin: "Administrateur",
  commercial: "Commercial",
};

router.get("/account-types", (_req, res) => {
  try {
    const types = db
      .prepare(
        `
          SELECT
            tc.id_type_compte as id,
            tc.nom_type as name,
            tc.description as description,
            tc.necessite_paiement as requiresPayment,
            tc.max_pharmacies as maxPharmacies,
            tc.max_ordonnances as maxOrdonnances,
            tc.max_rappels as maxNotifications,
            COALESCE(f.montant, 0) as price,
            COALESCE(f.devise, 'FCFA') as currency
          FROM TypesComptes tc
          LEFT JOIN FraisComptesProfessionnels f ON tc.id_type_compte = f.id_type_compte
          WHERE tc.nom_type <> 'Administrateur'
          ORDER BY tc.id_type_compte ASC
        `,
      )
      .all();

    res.json({ types });
  } catch (error) {
    console.error("Account types error:", error);
    res.status(500).json({ error: "Failed to fetch account types" });
  }
});

async function sendPinSms(phone: string, pin: string, context: "register" | "regenerate" | "expired") {
  const messages = {
    register: `Bienvenue sur TAKYMED ! Votre code PIN de connexion est : ${pin}. Gardez-le précieusement.`,
    regenerate: `🔐 Nouveau PIN TAKYMED : ${pin}\nValable 30 jours. Conservez-le précieusement.`,
    expired: `🔐 Votre PIN TAKYMED a expiré. Nouveau PIN : ${pin}\nValable 30 jours. Conservez-le précieusement.`,
  };

  const result = await notificationProvider.sendSMS(phone, messages[context]);
  if (!result.success) {
    console.error(`[Auth SMS] Échec envoi (${context}) vers ${phone}:`, result.error);
  }
  return result;
}

// Register route
router.post("/register", async (req, res) => {
  const { phone, type, name, pin: clientPin, email } = req.body;

  try {
    const normalizedPhone = normalizePhone(typeof phone === "string" ? phone : "");
    if (!normalizedPhone) {
      return res.status(400).json({ error: "Le numéro de téléphone est requis" });
    }

    if (findUserByPhone(normalizedPhone)) {
      return res.status(409).json({ error: "Ce numéro est déjà utilisé" });
    }

    const dbType = typeMap[String(type || "standard").toLowerCase()] || "Standard";
    const typeRecord = db
      .prepare(
        "SELECT id_type_compte, nom_type FROM TypesComptes WHERE nom_type = ?",
      )
      .get(dbType) as { id_type_compte: number; nom_type: string } | undefined;

    if (!typeRecord) {
      return res.status(400).json({ error: "Type de compte invalide" });
    }

    const pin = isValidUserPin(clientPin) ? clientPin.trim() : generatePin();
    const userChosePin = isValidUserPin(clientPin);
    const expiresAt = pinExpiryIso();
    const updatedAt = new Date().toISOString();
    const displayName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : `User ${normalizedPhone.slice(-4)}`;

    const info = db
      .prepare(
        `
          INSERT INTO Utilisateurs (numero_telephone, email, pin_hash, pin_expires_at, pin_updated_at, id_type_compte, est_pharmacien, est_valide)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `,
      )
      .run(
        normalizedPhone,
        email && email.trim() !== "" ? email.trim() : null,
        pin,
        expiresAt,
        updatedAt,
        typeRecord.id_type_compte,
        0,
      );

    db.prepare(
      "INSERT INTO ProfilsUtilisateurs (id_utilisateur, nom_complet) VALUES (?, ?)",
    ).run(info.lastInsertRowid, displayName);

    const smsResult = await sendPinSms(normalizedPhone, pin, "register");

    const createdUser = findUserByPhone(normalizedPhone);
    const response: Record<string, unknown> = {
      success: true,
      message: userChosePin
        ? "Compte créé avec succès"
        : smsResult.success
          ? "Compte créé. Votre PIN a été envoyé par SMS."
          : "Compte créé. Vérifiez votre SMS ou contactez le support si vous n'avez pas reçu votre PIN.",
      pinSent: smsResult.success,
    };

    // Mobile : PIN choisi par l'utilisateur → connexion immédiate
    if (userChosePin && createdUser) {
      response.user = toUserDTO(createdUser);
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("❌ Register error for phone:", phone, error);
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.get("/pin-info", async (req, res) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  try {
    const user = db
      .prepare("SELECT pin_expires_at FROM Utilisateurs WHERE id_utilisateur = ?")
      .get(userId as string) as { pin_expires_at: string | null } | undefined;

    if (!user) {
      return res.status(401).json({ error: "Session invalide ou utilisateur non trouvé. Veuillez vous reconnecter." });
    }

    res.json({ expiresAt: user.pin_expires_at });
  } catch (error) {
    console.error("PIN info error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des informations PIN" });
  }
});

router.post("/regenerate-pin", async (req, res) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  try {
    const user = db
      .prepare("SELECT numero_telephone, id_utilisateur FROM Utilisateurs WHERE id_utilisateur = ?")
      .get(userId as string) as { numero_telephone: string; id_utilisateur: number } | undefined;

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const newPin = generatePin();
    const expiresAt = pinExpiryIso();
    const updatedAt = new Date().toISOString();

    db.prepare(`
      UPDATE Utilisateurs
      SET pin_hash = ?, pin_expires_at = ?, pin_updated_at = ?
      WHERE id_utilisateur = ?
    `).run(newPin, expiresAt, updatedAt, userId);

    await sendPinSms(user.numero_telephone, newPin, "regenerate");

    res.json({
      success: true,
      expiresAt,
      message: "Nouveau PIN généré et envoyé par SMS",
    });
  } catch (error) {
    console.error("PIN regeneration error:", error);
    res.status(500).json({ error: "Erreur lors de la régénération du PIN" });
  }
});

router.post("/login", async (req, res) => {
  const { phone, pin } = req.body;

  try {
    const normalizedPhone = normalizePhone(typeof phone === "string" ? phone : "");
    if (!normalizedPhone) {
      return res.status(400).json({ error: "Le numéro de téléphone est requis" });
    }

    if (!pin || typeof pin !== "string" || !pin.trim()) {
      return res.status(400).json({ error: "Le PIN est requis" });
    }

    const pinValue = pin.trim();

    // Compte admin système (admin / ADMIN_PHONE)
    if (normalizedPhone === "admin") {
      const adminUser = findUserByPhone("admin");
      if (adminUser && pinValue === adminUser.pin_hash) {
        return res.json(toUserDTO(adminUser));
      }
      return res.status(401).json({ error: "PIN incorrect" });
    }

    const user = findUserByPhone(normalizedPhone);

    if (!user) {
      return res.status(401).json({
        error: "Aucun compte trouvé avec ce numéro. Veuillez vous inscrire d'abord.",
      });
    }

    if (user.pin_expires_at) {
      const expirationDate = new Date(user.pin_expires_at);
      if (expirationDate < new Date()) {
        const newPin = generatePin();
        const newExpiresAt = pinExpiryIso();
        const newUpdatedAt = new Date().toISOString();

        db.prepare(`
          UPDATE Utilisateurs
          SET pin_hash = ?, pin_expires_at = ?, pin_updated_at = ?
          WHERE id_utilisateur = ?
        `).run(newPin, newExpiresAt, newUpdatedAt, user.id_utilisateur);

        await sendPinSms(user.numero_telephone, newPin, "expired");

        return res.status(401).json({
          error: "Votre PIN a expiré. Un nouveau PIN a été envoyé par SMS.",
          pinRegenerated: true,
        });
      }
    }

    if (!user.pin_hash || pinValue !== user.pin_hash) {
      return res.status(401).json({ error: "PIN incorrect" });
    }

    if (user.est_valide === 0) {
      return res.status(403).json({
        error: "Votre compte n'est pas encore validé. Veuillez contacter votre agent commercial.",
      });
    }

    res.json(toUserDTO(user));
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.post("/upgrade-request", (req, res) => {
  const { requestedType } = req.body;
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  if (!requestedType || !["Standard", "standard", "Pro", "Professionnel", "Commercial"].includes(requestedType)) {
    return res.status(400).json({ error: "Type de compte invalide" });
  }

  try {
    const existingRequest = db
      .prepare(
        "SELECT * FROM UpgradeRequests WHERE id_utilisateur = ? AND status = 'pending'",
      )
      .get(userId as string);

    if (existingRequest) {
      return res.status(400).json({ error: "Vous avez déjà une demande en attente" });
    }

    db.prepare(
      "INSERT INTO UpgradeRequests (id_utilisateur, requested_type, motive) VALUES (?, ?, ?)",
    ).run(userId, requestedType, req.body.motive || null);

    res.json({ success: true, message: "Demande envoyée avec succès" });
  } catch (error) {
    console.error("Upgrade request error:", error);
    res.status(500).json({ error: "Erreur lors de la demande" });
  }
});

router.patch("/profile", (req, res) => {
  const { name, phone, email } = req.body;
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  try {
    const transaction = db.transaction(() => {
      if (name !== undefined) {
        const result = db
          .prepare(
            "UPDATE ProfilsUtilisateurs SET nom_complet = ? WHERE id_utilisateur = ?",
          )
          .run(name, userId as string);

        if (result.changes === 0) {
          db.prepare(
            "INSERT INTO ProfilsUtilisateurs (id_utilisateur, nom_complet) VALUES (?, ?)",
          ).run(userId, name);
        }
      }

      if (phone) {
        const normalizedPhone = normalizePhone(phone);

        const existingUser = db
          .prepare(
            "SELECT id_utilisateur FROM Utilisateurs WHERE numero_telephone = ? AND id_utilisateur <> ?",
          )
          .get(normalizedPhone, userId);

        if (existingUser) {
          throw new Error("PHONE_TAKEN");
        }

        db.prepare(
          "UPDATE Utilisateurs SET numero_telephone = ? WHERE id_utilisateur = ?",
        ).run(normalizedPhone, userId);
      }

      if (email !== undefined) {
        const cleanEmail = email.trim() === "" ? null : email.trim();
        if (cleanEmail) {
          const existingUser = db
            .prepare(
              "SELECT id_utilisateur FROM Utilisateurs WHERE email = ? AND id_utilisateur <> ?",
            )
            .get(cleanEmail, userId);

          if (existingUser) {
            throw new Error("EMAIL_TAKEN");
          }
        }
        db.prepare(
          "UPDATE Utilisateurs SET email = ? WHERE id_utilisateur = ?",
        ).run(cleanEmail, userId);
      }
    });

    transaction();
    res.json({ success: true, message: "Profil mis à jour" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "PHONE_TAKEN") {
      return res.status(409).json({
        error: "Ce numéro de téléphone est déjà utilisé par un autre compte",
      });
    }
    if (error instanceof Error && error.message === "EMAIL_TAKEN") {
      return res.status(409).json({
        error: "Cette adresse e-mail est déjà utilisée par un autre compte",
      });
    }
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du profil" });
  }
});

export const authRouter = router;
