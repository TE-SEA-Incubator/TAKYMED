import { RequestHandler } from "express";
import { db } from "../db";

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
      const user = db.prepare(`
        SELECT tc.nom_type 
        FROM Utilisateurs u 
        JOIN TypesComptes tc ON u.id_type_compte = tc.id_type_compte 
        WHERE u.id_utilisateur = ?
      `).get(userId) as { nom_type: string } | undefined;

      if (!user) {
        return res.status(401).json({ error: "Utilisateur non trouvé" });
      }

      const userRole = user.nom_type.toLowerCase().replace(/_old$/, "");
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
