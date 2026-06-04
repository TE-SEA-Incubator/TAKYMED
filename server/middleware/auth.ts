import { RequestHandler } from "express";
import { getUserAccountContext } from "../services/prescriptionAccessService";

/**
 * Middleware to verify if the user has one of the allowed roles.
 * Expects 'x-user-id' header to be present.
 */
export const verifyRole = (allowedTypes: string[]): RequestHandler => {
  return (req, res, next) => {
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({ error: "Authentification requise (ID manquant)" });
    }

    try {
      const numericUserId = Number(userId);
      if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
        return res.status(401).json({ error: "Identifiant utilisateur invalide" });
      }

      const user = getUserAccountContext(numericUserId);

      if (!user) {
        return res.status(401).json({ error: "Utilisateur non trouvé" });
      }

      const userRole = user.typeName;
      const normalizedAllowed = allowedTypes.map((t) => t.toLowerCase().replace(/_old$/, ""));

      if (!normalizedAllowed.includes(userRole)) {
        console.warn(`[Security] Access denied for user ${userId} (Role: ${userRole}) to ${req.originalUrl}`);
        return res.status(403).json({ error: "Accès refusé. Privilèges insuffisants." });
      }

      next();
    } catch (error) {
      console.error("verifyRole middleware error:", error);
      res.status(500).json({ error: "Erreur interne de vérification des rôles" });
    }
  };
};
