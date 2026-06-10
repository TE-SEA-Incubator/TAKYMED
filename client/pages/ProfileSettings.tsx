import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Phone, Save, ShieldCheck, Bell, MessageSquare, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { ensurePushIfSelected, type NotificationChannel } from "@/lib/pushNotifications";
import { cn } from "@/lib/utils";

const CHANNEL_OPTIONS: { id: NotificationChannel; label: string; icon: React.ReactNode }[] = [
  { id: "sms", label: "SMS", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "call", label: "Appel", icon: <PhoneCall className="w-4 h-4" /> },
  { id: "push", label: "Push", icon: <Bell className="w-4 h-4" /> },
];

export default function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [isSaving, setIsSaving] = useState(false);
  const [notifPhone, setNotifPhone] = useState(user?.phone || "");
  const [channels, setChannels] = useState<NotificationChannel[]>(["push", "whatsapp"]);
  const [isSavingNotif, setIsSavingNotif] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetch("https://dev.takymed.com:3500/api/notifications/preferences", {
      headers: { "x-user-id": user.id.toString() },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.channels) && data.channels.length > 0) {
          setChannels(data.channels);
        }
        if (Array.isArray(data.recipients) && data.recipients[0]) {
          setNotifPhone(data.recipients[0]);
        }
      })
      .catch(() => undefined);
  }, [user?.id]);

  const accountTypeLabel: Record<string, string> = {
    standard: t("profile.standard"),
    professional: t("profile.professional"),
    admin: t("profile.admin"),
    commercial: t("profile.commercial"),
  };

  const toggleChannel = (id: NotificationChannel) => {
    setChannels((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((c) => c !== id)
          : prev
        : [...prev, id],
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error(t('profile.nameRequired'));
    if (!phone.trim()) return toast.error(t('profile.phoneRequired'));

    setIsSaving(true);
    try {
      const response = await fetch("https://dev.takymed.com:3500/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id.toString() || "",
        },
        body: JSON.stringify({ name, phone }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la mise à jour");
      }

      updateUser({ name, phone });
      toast.success(t('profile.success'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!user?.id) return;
    setIsSavingNotif(true);
    try {
      const needsPhone = channels.some((c) => c !== "push");
      const res = await fetch("https://dev.takymed.com:3500/api/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id.toString(),
        },
        body: JSON.stringify({
          channels,
          recipients: needsPhone ? [notifPhone.trim()] : [],
        }),
      });
      if (!res.ok) throw new Error("Échec de la sauvegarde");
      await ensurePushIfSelected(user.id, channels);
      toast.success("Préférences de notification enregistrées");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSavingNotif(false);
    }
  };

  const needsPhone = channels.some((c) => c !== "push");

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
      <div className="bg-white rounded-[2.5rem] border shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#006093] to-[#00A859] p-8 text-white relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <User className="w-8 h-8" />
                {t('profile.title')}
            </h1>
            <p className="opacity-80 mt-2 font-medium">{t('profile.subtitle')}</p>
        </div>
        
        <form onSubmit={handleSave} className="p-8 space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('profile.fullName')}</Label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-12 h-14 rounded-2xl border-slate-200 focus:ring-primary/20 bg-slate-50/50"
                  placeholder={t('profile.fullName')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('profile.phone')}</Label>
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-12 h-14 rounded-2xl border-slate-200 focus:ring-primary/20 bg-slate-50/50 font-mono"
                  placeholder="+225..."
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium ml-1">{t('profile.phoneHint')}</p>
            </div>

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-widest">{t('profile.accountType')}</p>
                <p className="text-sm font-black text-slate-800 uppercase mt-0.5">{accountTypeLabel[user?.type || "standard"] || user?.type}</p>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button 
                type="submit" 
                disabled={isSaving}
                className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              {isSaving ? t('profile.saving') : (
                  <span className="flex items-center gap-2">
                      <Save className="w-5 h-5" />
                      {t('profile.save')}
                  </span>
              )}
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-[2.5rem] border shadow-xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-black">Rappels & notifications</h2>
            <p className="text-sm text-muted-foreground">Choisissez un ou plusieurs canaux d&apos;envoi</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CHANNEL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleChannel(opt.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                channels.includes(opt.id)
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-slate-200 hover:border-primary/30",
              )}
            >
              {opt.icon}
              <span className="text-xs font-bold">{opt.label}</span>
            </button>
          ))}
        </div>

        {needsPhone && (
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
              Téléphone pour SMS / WhatsApp / Appel
            </Label>
            <Input
              value={notifPhone}
              onChange={(e) => setNotifPhone(e.target.value)}
              className="h-12 rounded-2xl font-mono"
              placeholder="+237..."
            />
          </div>
        )}

        <Button
          type="button"
          disabled={isSavingNotif || channels.length === 0}
          onClick={handleSaveNotifications}
          className="w-full h-12 rounded-2xl font-bold"
        >
          {isSavingNotif ? "Enregistrement..." : "Enregistrer les préférences de rappel"}
        </Button>
      </div>
    </div>
  );
}
