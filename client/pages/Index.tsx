import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import Logo from "@/components/Logo";
import {
  BellRing,
  MessageSquare,
  Search,
  PlusCircle,
  ShieldCheck,
  Stethoscope,
  Clock,
  LayoutDashboard,
  Store,
  ArrowRight
} from "lucide-react";

export default function Index() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 md:py-24 lg:py-32 bg-slate-50">
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/10 to-secondary/10" />
        <div className="container relative z-10 mx-auto px-4 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex justify-center mb-4 md:mb-6">
            <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary animate-fade-in border border-primary/20">
              <span className="flex h-2.5 w-2.5 rounded-full bg-primary mr-2 animate-pulse shadow-[0_0_8px_rgba(0,114,206,0.8)]" />
              {t('index.badge')}
            </div>
          </div>
          <Logo size="large" className="mx-auto mb-4 md:mb-6" />
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.1]">
            {t('index.heroTitle1')}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              TAKYMED
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 md:mb-12 max-w-2xl mx-auto leading-relaxed">
            {t('index.heroSubtitle')}
          </p>
          {user ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/dashboard">
                <Button size="lg" className="h-14 px-8 text-lg font-black shadow-2xl shadow-primary/30 rounded-2xl transition-all hover:scale-[1.05]">
                  {t('index.goToDashboard')}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              {user.type === "admin" && (
                <Link to="/admin">
                  <Button variant="outline" size="lg" className="h-14 px-8 text-lg font-black border-2 rounded-2xl border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white transition-all">
                    <ShieldCheck className="mr-2 w-5 h-5" />
                    {t('index.adminPanel')}
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="h-14 px-8 text-lg font-black shadow-2xl shadow-primary/30 rounded-2xl transition-all hover:scale-[1.05]">
                  {t('index.startFree')}
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="h-14 px-8 text-lg font-black border-2 rounded-2xl transition-all">
                  {t('index.signIn')}
                </Button>
              </Link>
            </div>
          )}
        </div>
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl opacity-50" />
      </section>

      {/* Quick Access Grid */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('index.featuresTitle')}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('index.featuresSubtitle')}
            </p>
            {!user && (
              <p className="text-amber-600 text-sm font-bold mt-4 bg-amber-50 inline-block px-4 py-1 rounded-full border border-amber-100">
                {t('index.loginPrompt')}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<BellRing className="w-8 h-8 text-primary" />}
              title={t('index.feature1Title')}
              description={t('index.feature1Desc')}
              link={user ? "/prescription" : "/login"}
              learnMore={t('index.learnMore')}
            />
            <FeatureCard
              icon={<Search className="w-8 h-8 text-secondary" />}
              title={t('index.feature2Title')}
              description={t('index.feature2Desc')}
              link={user ? "/search" : "/login"}
              learnMore={t('index.learnMore')}
            />
            <FeatureCard
              icon={<LayoutDashboard className="w-8 h-8 text-secondary" />}
              title={t('index.feature3Title')}
              description={t('index.feature3Desc')}
              link={user ? "/ads" : "/login"}
              learnMore={t('index.learnMore')}
            />
          </div>
        </div>
      </section>

      {/* Prescription Teaser */}
      <section className="py-20 bg-slate-50 border-y">
        <div className="container mx-auto px-4 flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl font-bold leading-tight">
              {t('index.prescTitle')}
            </h2>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <div className="bg-primary/10 p-1 rounded-full text-primary">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span>{t('index.prescStep1')}</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="bg-primary/10 p-1 rounded-full text-primary">
                  <Clock className="w-5 h-5" />
                </div>
                <span>{t('index.prescStep2')}</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="bg-primary/10 p-1 rounded-full text-primary">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <span>{t('index.prescStep3')}</span>
              </li>
            </ul>
            <Link to="/prescription">
              <Button size="lg" className="h-12 px-6">{t('index.tryNow')}</Button>
            </Link>
          </div>
          <div className="flex-1 w-full max-w-lg aspect-video bg-white rounded-2xl shadow-2xl border p-6 flex items-center justify-center">
            <div className="text-center">
              <Stethoscope className="w-16 h-16 text-primary/20 mb-4 mx-auto" />
              <p className="text-muted-foreground">{t('index.prescPreview')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Account Types */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('index.accountsTitle')}</h2>
            <p className="text-muted-foreground">{t('index.accountsSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Standard Account */}
            <div className="relative group border rounded-3xl p-8 hover:border-primary/50 transition-all hover:shadow-xl bg-white flex flex-col">
              <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-6 text-primary font-bold">S</div>
              <h3 className="text-xl font-bold mb-2">{t('index.standardTitle')}</h3>
              <p className="text-muted-foreground mb-6 text-sm flex-grow">{t('index.standardDesc')}</p>
              <ul className="space-y-3 mb-8 text-xs">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <span>{t('index.standardFeat1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <span>{t('index.standardFeat2')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <span>{t('index.standardFeat3')}</span>
                </li>
              </ul>
              <Link to={user ? "/dashboard" : "/register"} className="w-full">
                <Button variant="outline" className="w-full">
                  {user ? t('index.viewAccount') : t('index.chooseStandard')}
                </Button>
              </Link>
            </div>

            {/* Professional Account */}
            <div className="relative group border rounded-3xl p-8 border-primary shadow-lg bg-primary/5 flex flex-col transition-all hover:shadow-2xl z-10">
              <div className="absolute -top-4 right-8 bg-primary text-white text-[10px] font-bold py-1 px-3 rounded-full uppercase">{t('index.recommended')}</div>
              <div className="bg-primary w-12 h-12 rounded-2xl flex items-center justify-center mb-6 text-white font-bold">P</div>
              <h3 className="text-xl font-bold mb-2">{t('index.proTitle')}</h3>
              <p className="text-muted-foreground mb-6 text-sm flex-grow">{t('index.proDesc')}</p>
              <ul className="space-y-3 mb-8 text-xs">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>{t('index.proFeat1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>{t('index.proFeat2')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>{t('index.proFeat3')}</span>
                </li>
              </ul>
              <Link to={user ? "/dashboard" : "/register"} className="w-full">
                <Button className="w-full shadow-lg shadow-primary/20">
                  {user ? t('index.viewAccount') : t('index.goPro')}
                </Button>
              </Link>
            </div>

            {/* Commercial Account */}
            <div className="relative group border rounded-3xl p-8 hover:border-secondary/50 transition-all hover:shadow-xl bg-white flex flex-col">
              <div className="bg-secondary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-6 text-secondary font-bold">C</div>
              <h3 className="text-xl font-bold mb-2">{t('index.commercialTitle')}</h3>
              <p className="text-muted-foreground mb-6 text-sm flex-grow">{t('index.commercialDesc')}</p>
              <ul className="space-y-3 mb-8 text-xs">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-secondary" />
                  <span>{t('index.commercialFeat1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-secondary" />
                  <span>{t('index.commercialFeat2')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-secondary" />
                  <span>{t('index.commercialFeat3')}</span>
                </li>
              </ul>
              <Link to={user ? (user.type === 'commercial' ? "/commercial" : "/dashboard") : "/register"} className="w-full">
                <Button variant="outline" className="w-full border-secondary text-secondary hover:bg-secondary/5">
                  {user ? t('index.viewSpace') : t('index.becomeAgent')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description, link, learnMore }: { icon: React.ReactNode, title: string, description: string, link: string, learnMore: string }) {
  return (
    <Link to={link} className="block group">
      <div className="p-8 border rounded-[32px] bg-white hover:shadow-2xl hover:shadow-primary/10 transition-all h-full flex flex-col border-slate-100 hover:border-primary/20">
        <div className="mb-6 transform group-hover:scale-110 transition-transform bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:bg-primary/5">
          {icon}
        </div>
        <h3 className="text-xl font-black mb-3 group-hover:text-primary transition-colors tracking-tight">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed flex-grow font-medium">{description}</p>
        <div className="mt-6 flex items-center text-primary font-bold text-sm bg-primary/5 w-fit px-4 py-2 rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
          {learnMore}
          <PlusCircle className="w-4 h-4 ml-2 group-hover:rotate-90 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
