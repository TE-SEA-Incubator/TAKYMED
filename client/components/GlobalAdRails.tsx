import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Megaphone, Pill } from "lucide-react";

interface NewMed {
  id: number;
  name: string;
  description?: string;
  price?: string;
  photoUrl?: string;
}

export function GlobalAdRails() {
  const [items, setItems] = useState<NewMed[]>([]);

  useEffect(() => {
    async function loadAds() {
      try {
        const res = await fetch("/api/medications?new=true");
        if (!res.ok) return;
        const data = await res.json();
        setItems(data.medications || []);
      } catch {
        // Keep silent: ads are non-blocking UI
      }
    }
    loadAds();
  }, []);

  const left = items[0];
  const right = items[1] ?? items[0];
  const mobile = useMemo(() => items[0], [items]);

  if (items.length === 0) return null;

  return (
    <>
      <AdRail ad={left} side="left" />
      <AdRail ad={right} side="right" />

      {/* AdCard suppressed on mobile as per user request */}
      {/* 
      <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40">
        <div className="mx-auto max-w-md">
          <AdCard ad={mobile} />
        </div>
      </div>
      */}
    </>
  );
}

function AdRail({ ad, side }: { ad?: NewMed; side: "left" | "right" }) {
  if (!ad) return null;

  const railBg =
    side === "left"
      ? "from-[#006093] via-[#0078A8] to-[#00A859] border-r border-white/30"
      : "from-[#00A859] via-[#009C7A] to-[#006093] border-l border-white/30";

  return (
    <Link
      to={`/search?q=${ad.name}`}
      className={`hidden 2xl:flex fixed ${side}-0 top-20 bottom-0 z-30 w-[176px] bg-gradient-to-b ${railBg} group`}
      aria-label={`Voir la publicité pour ${ad.name}`}
    >
      <div className="w-full h-full flex flex-col text-white">
        <div className="p-4">
          <div className="text-[10px] uppercase tracking-wider font-bold opacity-90 flex items-center gap-1.5">
            <Megaphone className="w-3 h-3" />
            Publicité
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {/* Upper half - Product Image */}
          <div className="h-1/2 relative overflow-hidden">
            {ad.photoUrl ? (
              <img
                src={ad.photoUrl}
                alt={ad.name}
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Pill className="w-16 h-16" />
              </div>
            )}
          </div>

          {/* Lower half - Text Info */}
          <div className="h-1/2 flex flex-col justify-center text-center gap-3 p-4">
            <p className="font-black text-base leading-tight">{ad.name}</p>
            <p className="text-xs leading-relaxed line-clamp-4 opacity-95">{ad.description || "Nouveau ce mois-ci"}</p>
          </div>
        </div>

        <div className="p-4 border-t border-white/30">
          <p className="text-xs font-bold truncate">{ad.price || "Prix en pharmacie"}</p>
          <p className="text-[11px] font-semibold mt-1 group-hover:underline">Voir le produit</p>
        </div>
      </div>
    </Link>
  );
}

function AdCard({ ad }: { ad?: NewMed }) {
  if (!ad) return null;

  return (
    <div className="bg-white/95 backdrop-blur border rounded-2xl shadow-xl w-full lg:w-[210px] overflow-hidden">
      {/* Upper half - Product Image */}
      <div className="h-24 relative overflow-hidden">
        {ad.photoUrl ? (
          <img
            src={ad.photoUrl}
            alt={ad.name}
            className="w-full h-full object-contain p-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-emerald-500/20 flex items-center justify-center">
            <Pill className="w-10 h-10 text-primary" />
          </div>
        )}
      </div>

      {/* Lower half - Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-primary">
          <Megaphone className="w-3 h-3" />
          Publicité
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black truncate">{ad.name}</p>
          <p className="text-[11px] text-muted-foreground line-clamp-2">{ad.description || "Nouveau ce mois-ci"}</p>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-primary truncate">{ad.price || "Prix en pharmacie"}</span>
        </div>
        <Link to={`/search?q=${ad.name}`}>
          <Button size="sm" className="w-full h-8 rounded-xl text-xs font-bold">
            Voir
          </Button>
        </Link>
      </div>
    </div>
  );
}
