import type { UserDTO } from "../../shared/api";
import type { AuthUserRow } from "./phone";

const reverseTypeMap: Record<
  string,
  "standard" | "professional" | "admin" | "commercial"
> = {
  Standard: "standard",
  Professionnel: "professional",
  Administrateur: "admin",
  Commercial: "commercial",
};

export function toUserDTO(user: AuthUserRow): UserDTO {
  const frontendType = reverseTypeMap[user.nom_type] || "standard";
  return {
    id: user.id_utilisateur,
    email: user.email || `${frontendType}@takymed.com`,
    phone: user.numero_telephone,
    type: frontendType,
    name: user.nom_complet || "Utilisateur",
  };
}
