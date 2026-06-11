import { cn } from "@/lib/utils";
import { AccountType } from "@shared/api";

const AFRICAN_PALETTE: Record<
  AccountType,
  { bg: string; ring: string; text: string }
> = {
  standard: { bg: "#C75B12", ring: "#F59E0B", text: "#FFF7ED" },
  professional: { bg: "#8B5E3C", ring: "#D6A46A", text: "#FFFAF0" },
  pharmacist: { bg: "#1F7A5C", ring: "#34D399", text: "#ECFDF5" },
  commercial: { bg: "#0F766E", ring: "#2DD4BF", text: "#F0FDFA" },
  admin: { bg: "#2C3E8F", ring: "#60A5FA", text: "#EFF6FF" },
};

export function AccountAvatar({
  name,
  type,
  className,
}: {
  name?: string | null;
  type: AccountType;
  className?: string;
}) {
  const palette = AFRICAN_PALETTE[type] ?? AFRICAN_PALETTE.standard;
  const initial = (name || "U").trim().charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border-2 shadow-sm",
        className,
      )}
      style={{
        background: palette.bg,
        color: palette.text,
        borderColor: palette.ring,
      }}
      title={`Avatar ${type}`}
    >
      {initial}
    </div>
  );
}
