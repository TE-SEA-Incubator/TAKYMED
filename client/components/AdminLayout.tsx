import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Pill,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User as UserIcon,
  BarChart3,
  Globe,
  MoreVertical,
  Tags,
  GitPullRequest,
  Briefcase,
  Languages,
  Menu,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Logo from "./Logo";
import { GlobalAdRails } from "@/components/GlobalAdRails";
import { AccountAvatar } from "@/components/AccountAvatar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  isNavRouteActive,
  type NavMatchMode,
} from "@/hooks/use-responsive-nav";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface AdminNavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  group: string;
  mobilePriority?: number;
  matchMode?: NavMatchMode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const { t, toggleLanguage, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = useMemo<AdminNavItem[]>(
    () => [
      {
        icon: LayoutDashboard,
        label: t("nav.dashboard"),
        path: "/admin",
        group: t("admin.main"),
        mobilePriority: 0,
        matchMode: "exact" as const,
      },
      {
        icon: Users,
        label: t("admin.users"),
        path: "/admin/clients",
        group: t("admin.management"),
        mobilePriority: 1,
      },
      {
        icon: Pill,
        label: t("admin.medications"),
        path: "/admin/catalogue",
        group: t("admin.management"),
        mobilePriority: 2,
      },
      {
        icon: BarChart3,
        label: t("admin.analytics"),
        path: "/admin/analytics",
        group: t("admin.main"),
        mobilePriority: 3,
        matchMode: "exact" as const,
      },
      {
        icon: Globe,
        label: t("admin.pharmacies"),
        path: "/admin/pharmacies",
        group: t("admin.management"),
        mobilePriority: 4,
      },
      {
        icon: Tags,
        label: t("admin.categories"),
        path: "/admin/categories",
        group: t("admin.management"),
        mobilePriority: 5,
      },
      {
        icon: GitPullRequest,
        label: t("admin.promoRequests"),
        path: "/admin/requests",
        group: t("admin.management"),
        mobilePriority: 6,
      },
      {
        icon: Briefcase,
        label: t("admin.commercials"),
        path: "/admin/commercials",
        group: t("admin.management"),
        mobilePriority: 7,
      },
      {
        icon: Settings,
        label: t("admin.settings"),
        path: "/admin/settings",
        group: t("admin.system"),
        mobilePriority: 8,
        matchMode: "exact" as const,
      },
      {
        icon: UserIcon,
        label: t("nav.profile"),
        path: "/profile",
        group: t("admin.system"),
        mobilePriority: 9,
        matchMode: "exact" as const,
      },
    ],
    [t],
  );

  const mobileNavItems = useMemo(
    () =>
      navItems.map(({ path, label, icon, mobilePriority, matchMode }) => ({
        to: path,
        label,
        icon,
        mobilePriority,
        matchMode,
      })),
    [navItems],
  );

  const isActiveRoute = (item: { to: string; matchMode?: NavMatchMode }) =>
    isNavRouteActive(location.pathname, item.to, item.matchMode);

  const activeItem =
    mobileNavItems.find((item) => isActiveRoute(item)) || mobileNavItems[0];
  const mobileVisibleNavItems = mobileNavItems.slice(0, 3);
  const mobileOverflowNavItems = mobileNavItems.slice(3);
  const hasOverflow = mobileOverflowNavItems.length > 0;

  const handleLogout = () => {
    setIsMobileMenuOpen(false);
    logout();
    navigate("/");
  };

  const currentSectionLabel = activeItem?.label || t("admin.title");

  return (
    <div className="flex min-h-screen overflow-hidden bg-[#f0f4f8] font-sans text-slate-800">
      <GlobalAdRails />
      <aside
        className={cn(
          "relative z-50 hidden flex-col border-r border-[#e2e8f0] bg-white shadow-xl transition-all duration-300 lg:flex",
          isSidebarCollapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex h-24 items-center justify-center border-b border-[#e2e8f0] px-4 py-3">
          {isSidebarCollapsed ? (
            <Logo size="small" />
          ) : (
            <Logo size="medium" className="mx-auto" />
          )}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
          {[t("admin.main"), t("admin.management"), t("admin.system")].map(
            (group) => {
              const groupItems = navItems.filter(
                (item) => item.group === group,
              );
              return (
                <div key={group}>
                  {!isSidebarCollapsed && (
                    <p className="mb-3 ml-3 text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">
                      {group}
                    </p>
                  )}
                  <nav className="space-y-1">
                    {groupItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-3 transition-all",
                          isActiveRoute({
                            to: item.path,
                            matchMode: item.matchMode,
                          })
                            ? "bg-gradient-to-br from-[#006093] to-[#00A859] text-white shadow-md"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!isSidebarCollapsed && (
                          <span className="text-sm font-semibold">
                            {item.label}
                          </span>
                        )}
                      </Link>
                    ))}
                  </nav>
                </div>
              );
            },
          )}
        </div>

        <div className="space-y-2 border-t border-[#e2e8f0] p-3">
          {!isSidebarCollapsed && (
            <div className="mb-2 rounded-xl bg-[#f0f4f8] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[#006093] bg-[#006093] font-extrabold text-white shadow-sm">
                  {(user?.name || "AD").substring(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-800">
                    {user?.name || "Administrateur"}
                  </p>
                  <p className="text-[10px] font-semibold text-[#006093]">
                    Super Admin
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="mt-2 flex w-full items-center gap-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:text-red-500"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t("nav.logout")}
              </button>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="flex w-full items-center justify-center rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {isSidebarCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
          </button>
        </div>
      </aside>

      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <header className="z-40 flex h-16 items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 md:h-20 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-[1.25rem] border border-slate-200 bg-white px-3 py-2 shadow-sm lg:hidden">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {t("admin.title")}
              </p>
              <p className="max-w-[10rem] truncate text-sm font-semibold text-slate-800">
                {currentSectionLabel}
              </p>
            </div>

            <div className="hidden rounded-full border border-[#006093]/10 bg-[#006093]/5 px-4 py-2 lg:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#006093]/60">
                Admin
              </p>
              <p className="max-w-[200px] truncate text-sm font-semibold text-slate-700">
                {currentSectionLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-10 rounded-full border-slate-200 bg-white px-3 font-bold text-slate-600 shadow-sm md:flex"
              onClick={toggleLanguage}
              title={
                language === "fr" ? "Switch to English" : "Passer en français"
              }
            >
              <Languages className="mr-2 h-4 w-4" />
              {t("language.switchTo")}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
                  <AccountAvatar name={user?.name || "Admin"} type="admin" />
                  <div className="hidden text-left sm:block">
                    <p className="mb-0.5 text-xs font-bold leading-none text-slate-800">
                      {user?.name || "Admin"}
                    </p>
                    <p className="text-[10px] font-semibold leading-none text-[#006093]">
                      Administrateur
                    </p>
                  </div>
                  <MoreVertical className="h-4 w-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 rounded-2xl border-slate-200 bg-white p-2 text-slate-700 shadow-xl"
              >
                <DropdownMenuLabel className="px-3 py-2 text-xs font-bold uppercase text-slate-400">
                  {t("nav.myAccount")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem
                  className="cursor-pointer gap-3 rounded-xl px-3 py-2.5 focus:bg-slate-50"
                  onClick={() => navigate("/profile")}
                >
                  <UserIcon size={15} /> {t("nav.profile")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-3 rounded-xl px-3 py-2.5 focus:bg-slate-50"
                  onClick={() => navigate("/admin/settings")}
                >
                  <Settings size={15} /> {t("admin.settings")}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem
                  className="cursor-pointer gap-3 rounded-xl px-3 py-2.5 text-red-500 focus:bg-red-50 focus:text-red-500"
                  onClick={handleLogout}
                >
                  <LogOut size={15} /> {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-2 lg:hidden">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-slate-200 bg-white shadow-sm md:hidden"
                onClick={toggleLanguage}
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
                    className="relative h-10 w-10 rounded-full border-slate-200 bg-white shadow-sm"
                    aria-label={t("nav.menu")}
                  >
                    <Menu className="h-5 w-5" />
                    {hasOverflow && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#006093] px-1.5 text-[10px] font-bold text-white shadow-sm">
                        {mobileOverflowNavItems.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,244,248,0.98)_100%)] px-5 pb-24 pt-12"
                >
                  <SheetHeader className="mb-6 text-left">
                    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <SheetTitle className="truncate text-left text-lg">
                            {t("admin.title")}
                          </SheetTitle>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            {currentSectionLabel}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[#006093]/10 px-3 py-2 text-right">
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#006093]/70">
                            Mobile
                          </p>
                          <p className="text-sm font-semibold text-[#006093]">
                            {mobileNavItems.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="grid gap-6">
                    {hasOverflow && (
                      <details className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]" open>
                        <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                          {t("nav.menu")}
                        </summary>
                        <div className="mt-3 grid gap-2">
                          {mobileOverflowNavItems.map((item) => (
                            <SheetClose asChild key={`admin-overflow-${item.to}`}>
                              <Link
                                to={item.to}
                                className={cn(
                                  "group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all",
                                  isActiveRoute(item)
                                    ? "bg-gradient-to-br from-[#006093] to-[#00A859] text-white shadow-md"
                                    : "text-slate-700 hover:bg-slate-50 hover:text-[#006093]",
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-2xl transition-colors",
                                    isActiveRoute(item)
                                      ? "bg-white/15"
                                      : "bg-[#006093]/10 text-[#006093] group-hover:bg-[#006093]/15",
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
                                        ? "text-white/80"
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

                    <details className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]" open>
                      <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                        {t("nav.myAccount")}
                      </summary>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-12 rounded-2xl border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm"
                        onClick={toggleLanguage}
                        title={
                          language === "fr"
                            ? "Switch to English"
                            : "Passer en français"
                        }
                      >
                        <Languages className="mr-2 h-4 w-4" />
                        {t("language.switchTo")}
                      </Button>

                      <SheetClose asChild>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-12 rounded-2xl border-slate-200 bg-white font-bold shadow-sm"
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
                          className="h-12 rounded-2xl border-slate-200 bg-white font-bold shadow-sm"
                        >
                          <Link to="/admin/settings">
                            <Settings className="mr-2 h-4 w-4" />
                            {t("admin.settings")}
                          </Link>
                        </Button>
                      </SheetClose>

                      <Button
                        variant="destructive"
                        className="h-12 rounded-2xl font-bold shadow-sm sm:col-span-2"
                        onClick={handleLogout}
                      >
                        <LogOut className="mr-2 h-5 w-5" />
                        {t("nav.logout")}
                      </Button>
                    </div>
                    </details>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <main className="custom-scrollbar flex-1 overflow-y-auto bg-[#f0f4f8] p-4 pb-[calc(6.75rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(6.75rem+env(safe-area-inset-bottom))] lg:p-8 lg:pb-8">
          <div className="mx-auto max-w-7xl space-y-8">{children}</div>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/70 bg-white/90 p-2 shadow-[0_-18px_45px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
          <nav
            className="flex w-full justify-center gap-1 overflow-x-auto pb-1"
          >
            {mobileVisibleNavItems.map((item) => {
              const isActive = isActiveRoute(item);
              return (
                <Link
                  key={`mobile-primary-${item.to}`}
                  to={item.to}
                  className={cn(
                    "group flex min-h-[4.25rem] min-w-[88px] flex-col items-center justify-center gap-1 rounded-[1.5rem] px-2 text-[10px] font-bold transition-all",
                    isActive
                      ? "bg-gradient-to-br from-[#006093]/15 via-[#006093]/10 to-[#00A859]/15 text-[#006093] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-[#006093]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-2xl transition-colors",
                      isActive
                        ? "bg-white shadow-sm"
                        : "bg-transparent group-hover:bg-white",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `,
        }}
      />
    </div>
  );
}
