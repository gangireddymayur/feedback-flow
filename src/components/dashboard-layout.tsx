import * as React from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Smartphone,
  MessageSquare,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Search,
  Bell,
  Sparkles,
  CalendarClock,
  Tv,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuth, useAuth, logout } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Templates, Devices } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"super" | "sub">;
};

// Role split:
//  - Super admin oversees the org: manages sub-admins + sees analytics.
//    Does NOT create templates and does NOT browse raw responses.
//  - Sub admin runs day-to-day: templates, devices, responses.
const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["super", "sub"] },
  { to: "/templates", label: "Templates", icon: FileText, roles: ["sub"] },
  { to: "/devices", label: "Devices", icon: Smartphone, roles: ["sub"] },
  { to: "/schedule", label: "Schedule", icon: CalendarClock, roles: ["sub"] },
  { to: "/responses", label: "Responses", icon: MessageSquare, roles: ["sub"] },
  { to: "/customers", label: "Customers", icon: Users, roles: ["sub"] },
  { to: "/reports", label: "Reports", icon: FileText, roles: ["super", "sub"] },
  { to: "/screensaver", label: "Screen Saver", icon: Tv, roles: ["sub"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["super"] },
  { to: "/admins", label: "Sub Admins", icon: Users, roles: ["super"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["super", "sub"] },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Keyboard listener for Cmd+K / Ctrl+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { data: tData } = useQuery({
    queryKey: ["templates-search"],
    queryFn: () => Templates.list(),
    enabled: searchOpen && auth?.role === "sub",
  });
  const { data: dData } = useQuery({
    queryKey: ["devices-search"],
    queryFn: () => Devices.list(),
    enabled: searchOpen && auth?.role === "sub",
  });

  const templates = tData?.templates ?? [];
  const devices = dData?.devices ?? [];

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDevices = devices.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.location || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const navigateTo = (to: string, search?: any) => {
    setSearchOpen(false);
    setSearchQuery("");
    router.navigate({ to, search });
  };

  React.useEffect(() => {
    if (typeof window !== "undefined" && getAuth() === null) {
      router.navigate({ to: "/login", replace: true });
    }
  }, [auth, router]);

  React.useEffect(() => {
    if (auth?.trial_info?.isExpired && auth.role !== "super" && pathname !== "/settings") {
      router.navigate({ to: "/settings" });
    }
  }, [auth?.trial_info?.isExpired, auth?.role, pathname, router]);

  if (!auth) return null;

  const items = NAV.filter((n) => n.roles.includes(auth.role));

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col lg:flex-row antialiased select-none">
      <aside className="w-full lg:w-64 p-4 lg:p-6 flex flex-col gap-4 shrink-0">
        <div className="flex items-center gap-3 px-2">
          <img src="/logo.png" className="h-10 rounded-lg shadow-md object-contain" alt="FAM Logo" />
          <div>
            <div className="font-semibold text-sm tracking-tight flex items-center gap-1.5">
              <span>FAM</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                v2.4
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {auth.role === "super" ? "Super Admin" : "Sub Admin"}
            </div>
          </div>
        </div>
        <nav className="glass rounded-2xl p-2 flex flex-col gap-0.5 flex-1">
          {items.map((it) => {
            const active = pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to));
            const Icon = it.icon;
            const isLocked = auth?.trial_info?.isExpired && auth.role !== "super" && it.to !== "/settings";

            if (isLocked) {
              return (
                <div
                  key={it.to}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-muted-foreground/40 cursor-not-allowed select-none opacity-50"
                  title="Trial Expired — Contact Administrator to Unlock"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 opacity-40" />
                    <span>{it.label}</span>
                  </div>
                  <span className="text-[9px] bg-rose-500/20 text-rose-300 font-bold px-1.5 py-0.5 rounded">Locked</span>
                </div>
              );
            }

            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-white/10 text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                )}
              >
                <Icon className={cn("size-4", active && "text-primary")} />
                <span>{it.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="glass rounded-2xl p-3 flex items-center gap-3">
          <div className="size-9 rounded-full bg-gradient-to-br from-fuchsia-400/40 to-cyan-400/40 grid place-items-center text-xs font-semibold">
            {auth.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{auth.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{auth.email}</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 lg:p-6 lg:pl-0">
        <header className="glass rounded-2xl px-4 py-3 flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xl cursor-pointer" onClick={() => setSearchOpen(true)}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              readOnly
              placeholder={auth.role === "sub" ? "Search templates, devices… (⌘K)" : "Search analytics & reports… (⌘K)"}
              className="pl-9 bg-white/5 border-white/10 focus-visible:ring-primary/40 cursor-pointer text-xs h-9"
            />
          </div>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4" />
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary" />
          </Button>
          <span className="text-[11px] text-muted-foreground hidden md:inline capitalize px-2 py-1 rounded-full bg-white/5 border border-white/10">
            {auth.role === "super" ? "Super Admin" : "Sub Admin"}
          </span>
        </header>
        <div className="space-y-6">
          {auth?.trial_info?.isExpired && auth.role !== "super" && (
            <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-4 text-rose-200 flex items-center justify-between gap-4 select-none">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-rose-500/20 grid place-items-center text-rose-400 shrink-0 font-bold">
                  7D
                </div>
                <div>
                  <div className="font-semibold text-sm text-rose-100 flex items-center gap-2">
                    <span>7-Day Free Trial Expired</span>
                    <span className="text-[10px] bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded-full font-bold">Limit Reached</span>
                  </div>
                  <div className="text-xs text-rose-300/90 mt-0.5">
                    Your 7-day free trial period has ended. Please contact your system administrator to grant full access for your account.
                  </div>
                </div>
              </div>
              <div className="text-xs font-semibold bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/40 shrink-0">
                Contact Admin to Unlock
              </div>
            </div>
          )}
          {children}
        </div>
      </main>

      <Dialog open={searchOpen} onOpenChange={(openVal) => {
        setSearchOpen(openVal);
        if (!openVal) setSearchQuery("");
      }}>
        <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800 text-foreground p-0 overflow-hidden">
          <div className="flex items-center border-b border-white/10 px-3 py-3">
            <Search className="size-4 text-muted-foreground mr-2 shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type template or device name to search…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto p-2 space-y-4">
            {auth.role === "sub" ? (
              <>
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Templates
                  </div>
                  {filteredTemplates.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                      No matching templates found
                    </div>
                  ) : (
                    filteredTemplates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => navigateTo("/templates/builder", { templateId: t.id })}
                        className="w-full text-left px-2 py-2 text-xs rounded-xl hover:bg-white/5 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="size-3.5 text-primary shrink-0" />
                          <span className="font-medium truncate">{t.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase bg-white/5 px-1.5 py-0.5 rounded">{t.category}</span>
                      </button>
                    ))
                  )}
                </div>

                <div className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Devices
                  </div>
                  {filteredDevices.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                      No matching devices found
                    </div>
                  ) : (
                    filteredDevices.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => navigateTo("/devices")}
                        className="w-full text-left px-2 py-2 text-xs rounded-xl hover:bg-white/5 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Smartphone className="size-3.5 text-emerald-400 shrink-0" />
                          <span className="font-medium truncate">{d.name}</span>
                        </div>
                        {d.location && (
                          <span className="text-[10px] text-muted-foreground truncate">{d.location}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Navigation
                </div>
                <button
                  onClick={() => navigateTo("/reports")}
                  className="w-full text-left px-2 py-2 text-xs rounded-xl hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <FileText className="size-3.5 text-primary shrink-0" />
                  <span className="font-medium">Go to Reports</span>
                </button>
                <button
                  onClick={() => navigateTo("/analytics")}
                  className="w-full text-left px-2 py-2 text-xs rounded-xl hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <BarChart3 className="size-3.5 text-sky-400 shrink-0" />
                  <span className="font-medium">Go to Analytics</span>
                </button>
                <button
                  onClick={() => navigateTo("/settings")}
                  className="w-full text-left px-2 py-2 text-xs rounded-xl hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Settings className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">Go to Settings</span>
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-gradient">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function GlassCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-2xl p-5", className)} {...props} />;
}
