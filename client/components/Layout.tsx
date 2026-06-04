import { useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import Logo from "./Logo1";
import { Button } from "./ui/button";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import {
  Menu,
  LayoutDashboard,
  Bell,
  Shield,
  Search,
  User as UserIcon,
  LogOut,
  Crown,
  FileText,
  Languages,
} from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalAdRails } from "@/components/GlobalAdRails";
import { AccountAvatar } from "@/components/AccountAvatar";
import {
  isNavRouteActive,
  type NavMatchMode,
} from "@/hooks/use-responsive-nav";

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  mobilePriority?: number;
  matchMode?: NavMatchMode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { t, toggleLanguage, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const primaryNavItems = useMemo<NavItem[]>(() => {
    if (!user) {
      return [
        {
          to: "/",
          label: t("nav.home"),
          icon: LayoutDashboard,
          mobilePriority: 0,
          matchMode: "exact" as const,
        },
        {
          to: "/search",
          label: t("nav.medications"),
          icon: Search,
          mobilePriority: 1,
        },
        {
          to: "/ads",
          label: t("nav.news"),
          icon: Bell,
          mobilePriority: 2,
        },
      ];
    }

    return [
      {
        to: "/dashboard",
        label: t("nav.dashboard"),
        icon: LayoutDashboard,
        mobilePriority: 0,
        matchMode: "exact",
      },
      {
        to: "/search",
        label: t("nav.medications"),
        icon: Search,
        mobilePriority: 1,
      },
      ...(user.type !== "standard"
        ? [
            {
              to: "/ordonnances",
              label: t("nav.prescriptions"),
              icon: FileText,
              mobilePriority: 2,
            },
          ]
        : []),
      ...(user.type === "admin"
        ? [
            {
              to: "/admin",
              label: t("nav.admin"),
              icon: Shield,
              mobilePriority: 2,
              matchMode: "exact" as const,
            },
          ]
        : []),
      {
        to: "/ads",
        label: t("nav.news"),
        icon: Bell,
        mobilePriority: 3,
      },
      ...(user.type === "commercial"
        ? [
            {
              to: "/commercial",
              label: t("nav.commercial"),
              icon: UserIcon,
              mobilePriority: 2,
            },
          ]
        : []),
      ...(user.type !== "admin"
        ? [
            {
              to: "/upgrade",
              label: t("nav.upgrade"),
              icon: Crown,
              mobilePriority: 5,
            },
          ]
        : []),
      {
        to: "/profile",
        label: t("nav.profile"),
        icon: UserIcon,
        mobilePriority: 4,
        matchMode: "exact",
      },
    ];
  }, [t, user]);

  const isActiveRoute = (item: NavItem) =>
    isNavRouteActive(location.pathname, item.to, item.matchMode);

  const activeItem =
    primaryNavItems.find((item) => isActiveRoute(item)) || primaryNavItems[0];
  const mobileVisibleNavItems = primaryNavItems.slice(0, 3);
  const mobileOverflowNavItems = primaryNavItems.slice(3);
  const hasOverflow = mobileOverflowNavItems.length > 0;

  const handleLogout = () => {
    setIsMobileMenuOpen(false);
    logout();
    navigate("/");
  };

  const shouldShowGlobalAds = !["/", "/login", "/register"].includes(
    location.pathname,
  );

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {shouldShowGlobalAds && <GlobalAdRails />}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/60 bg-background/80 backdrop-blur-xl transition-all duration-500 hover:bg-background/95">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4 transition-all duration-500 md:h-20">
          <Link
            to="/"
            className="group flex h-full items-center gap-3 md:gap-4 active:scale-95 transition-transform shrink-0"
          >
            <div className="relative flex h-full items-center justify-center py-1 transition-all duration-700 hover:rotate-1">
              <Logo size="nav" badge />
            </div>
          </Link>

          <div className="hidden min-w-0 flex-1 lg:flex lg:justify-center">
            <nav className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 p-2 text-[13px] font-semibold shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl xl:text-sm">
              {primaryNavItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 transition-all",
                    isActiveRoute(item)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-600 hover:bg-primary/5 hover:text-primary",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <div className="hidden max-w-[180px] min-w-0 rounded-full border border-primary/10 bg-primary/[0.07] px-3 py-2 text-right lg:block">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">
                TAKYMED
              </p>
              <p className="truncate text-xs font-semibold text-slate-700">
                {activeItem?.label || t("nav.menu")}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="hidden rounded-full h-10 border border-white/70 bg-white/80 px-3 text-xs font-bold shadow-sm transition-all hover:bg-primary/10 hover:text-primary md:flex"
              title={
                language === "fr" ? "Switch to English" : "Passer en français"
              }
            >
              <Languages className="h-4 w-4" />
              {t("language.switchTo")}
            </Button>

            {!user ? (
              <>
                <Link
                  to="/login"
                  className="hidden sm:block lg:hidden xl:block"
                >
                  <Button variant="ghost" size="sm" className="rounded-full">
                    {t("nav.login")}
                  </Button>
                </Link>
                <Link to="/register" className="hidden sm:block">
                  <Button size="sm" className="rounded-full px-6 shadow-sm">
                    {t("nav.register")}
                  </Button>
                </Link>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 gap-2 rounded-full border border-white/70 bg-white/80 px-2 md:px-4 shadow-sm"
                  >
                    <AccountAvatar
                      name={user.name || user.email}
                      type={user.type}
                      className="h-6 w-6 rounded-md border"
                    />
                    <span className="hidden max-w-[120px] truncate md:inline">
                      {user.name || user.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                  <DropdownMenuLabel>{t("nav.myAccount")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => navigate("/profile")}
                  >
                    <UserIcon className="h-4 w-4" /> {t("nav.profile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => navigate("/dashboard")}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {t("nav.dashboard")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" /> {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <div className="flex items-center gap-2 lg:hidden">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleLanguage}
                className="h-10 w-10 rounded-full border-white/70 bg-white/85 shadow-sm md:hidden"
                title={
                  language === "fr" ? "Switch to English" : "Passer en français"
                }
              >
                <Languages className="h-4 w-4" />
              </Button>

              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative h-10 w-10 rounded-full border-white/70 bg-white/85 shadow-sm"
                    aria-label={t("nav.menu")}
                  >
                    <Menu className="h-5 w-5" />
                    {hasOverflow && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white shadow-sm">
                        {mobileOverflowNavItems.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-full max-w-sm overflow-y-auto border-l border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,248,252,0.96)_100%)] px-5 pb-24 pt-12"
                >
                  <SheetHeader className="mb-6 text-left">
                    <div className="mb-4 flex justify-center">
                      <Logo size="small" badge />
                    </div>
                    <div className="rounded-[1.75rem] border border-primary/10 bg-white/90 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <SheetTitle className="truncate text-left text-lg">
                            {t("nav.menu")}
                          </SheetTitle>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            {activeItem?.label || t("nav.home")}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-primary/10 px-3 py-2 text-right">
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">
                            Mobile
                          </p>
                          <p className="text-sm font-semibold text-primary">
                            {primaryNavItems.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="grid gap-6">
                    {hasOverflow && (
                      <details className="rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]" open>
                        <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                          {t("nav.menu")}
                        </summary>
                        <div className="mt-3 grid gap-2">
                          {mobileOverflowNavItems.map((item) => (
                            <SheetClose asChild key={`overflow-${item.to}`}>
                              <Link
                                to={item.to}
                                className={cn(
                                  "group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all",
                                  isActiveRoute(item)
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-slate-700 hover:bg-primary/5 hover:text-primary",
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-2xl transition-colors",
                                    isActiveRoute(item)
                                      ? "bg-white/15"
                                      : "bg-primary/10 text-primary group-hover:bg-primary/15",
                                  )}
                                >
                                  <item.icon className="h-5 w-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold">
                                    {item.label}
                                  </p>
                                  <p
                                    className={cn(
                                      "truncate text-xs",
                                      isActiveRoute(item)
                                        ? "text-primary-foreground/80"
                                        : "text-slate-500",
                                    )}
                                  >
                                    {item.to}
                                  </p>
                                </div>
                              </Link>
                            </SheetClose>
                          ))}
                        </div>
                      </details>
                    )}

                    <details className="rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]" open>
                      <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                        {t("nav.myAccount")}
                      </summary>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {!user ? (
                        <>
                          <SheetClose asChild>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-12 rounded-2xl border-white/80 bg-white/90 font-bold shadow-sm"
                            >
                              <Link to="/login">{t("nav.login")}</Link>
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button
                              asChild
                              size="sm"
                              className="h-12 rounded-2xl font-bold shadow-sm"
                            >
                              <Link to="/register">{t("nav.register")}</Link>
                            </Button>
                          </SheetClose>
                        </>
                      ) : (
                        <>
                          <SheetClose asChild>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-12 rounded-2xl border-white/80 bg-white/90 font-bold shadow-sm"
                            >
                              <Link to="/profile">
                                <UserIcon className="mr-2 h-4 w-4" />
                                {t("nav.profile")}
                              </Link>
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-12 rounded-2xl border-white/80 bg-white/90 font-bold shadow-sm"
                            >
                              <Link to="/dashboard">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                {t("nav.dashboard")}
                              </Link>
                            </Button>
                          </SheetClose>
                          <Button
                            variant="destructive"
                            className="h-12 rounded-2xl font-bold shadow-sm"
                            onClick={handleLogout}
                          >
                            <LogOut className="mr-2 h-5 w-5" />
                            {t("nav.logout")}
                          </Button>
                        </>
                      )}
                    </div>
                    </details>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "pt-16 md:pt-20",
          "pb-[calc(6.75rem+env(safe-area-inset-bottom))] lg:pb-0",
          shouldShowGlobalAds ? "2xl:px-[176px] 2xl:pb-0" : "",
        )}
      >
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/70 bg-white/85 p-2 shadow-[0_-18px_45px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
          <nav
            className="flex w-full justify-center gap-1 overflow-x-auto pb-1"
          >
            {mobileVisibleNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex min-h-[4.25rem] min-w-[88px] flex-col items-center justify-center gap-1 rounded-[1.5rem] px-2 text-[10px] font-bold transition-all",
                  isActiveRoute(item)
                    ? "bg-gradient-to-br from-primary/15 via-primary/10 to-secondary/15 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                    : "text-slate-500 hover:bg-primary/5 hover:text-primary",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-2xl transition-colors",
                    isActiveRoute(item)
                      ? "bg-white/80 shadow-sm"
                      : "bg-transparent group-hover:bg-white/80",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <footer className="bg-muted py-12 border-t hidden md:block">
        <div className="container mx-auto grid grid-cols-1 gap-8 px-4 md:grid-cols-4">
          <div className="col-span-1 space-y-6 md:col-span-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black tracking-tighter text-slate-800">
                TAKYMED
              </span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              TAKYMED : {t("footer.description")}
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold">{t("footer.services")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/search" className="hover:text-primary">
                  {t("nav.medications")}
                </Link>
              </li>
              <li>
                <Link to="/ads" className="hover:text-primary">
                  {t("footer.news")}
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold">{t("footer.legal")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>{t("footer.privacy")}</li>
              <li>{t("footer.terms")}</li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto mt-8 border-t px-4 pt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} TAKYMED. {t("footer.rights")}
        </div>
      </footer>
    </div>
  );
}
