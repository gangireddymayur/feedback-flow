import * as React from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, Tablet, MessageSquare, BarChart3,
  Users, Settings, LogOut, Search, Bell, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, setAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: Array<"super" | "sub"> };

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["super", "sub"] },
  { to: "/templates", label: "Templates", icon: FileText, roles: ["sub"] },
  { to: "/devices", label: "Tablets", icon: Tablet, roles: ["sub"] },
  { to: "/responses", label: "Responses", icon: MessageSquare, roles: ["sub"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["super", "sub"] },
  { to: "/admins", label: "Sub Admins", icon: Users, roles: ["super"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["super", "sub"] },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  React.useEffect(() => {
    if (auth === null && typeof window !== "undefined") {
      // initial check completed and no auth — redirect
      const stored = localStorage.getItem("rms_auth");
      if (!stored) router.navigate({ to: "/login" });
    }
  }, [auth, router]);

  if (!auth) return null;

  const items = NAV.filter((n) => n.roles.includes(auth.role));

  return (
    <div className="min-h-screen flex text-foreground">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col p-4 gap-2 sticky top-0 h-screen">
        <div className="glass-strong rounded-2xl p-4 flex items-center gap-3">
          <div className="size-9 rounded-xl bg-gradient-to-br from-[oklch(0.82_0.16_200)] to-[oklch(0.78_0.18_300)] grid place-items-center">
            <Sparkles className="size-4 text-background" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">ReviewOS</div>
            <div className="text-[11px] text-muted-foreground capitalize">{auth.role === "super" ? "Super Admin" : "Sub Admin"}</div>
          </div>
        </div>
        <nav className="glass rounded-2xl p-2 flex flex-col gap-0.5 flex-1">
          {items.map((it) => {
            const active = pathname === it.to;
            const Icon = it.icon;
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
            {auth.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{auth.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{auth.email}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => {
              setAuth(null);
              router.navigate({ to: "/login" });
            }}
            aria-label="Log out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 p-4 lg:p-6 lg:pl-0">
        <header className="glass rounded-2xl px-4 py-3 flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search templates, tablets, responses…"
              className="pl-9 bg-white/5 border-white/10 focus-visible:ring-primary/40"
            />
          </div>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4" />
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary" />
          </Button>
          <RoleSwitcher />
        </header>
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}

function RoleSwitcher() {
  const auth = useAuth();
  if (!auth) return null;
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1 text-xs">
      {(["sub", "super"] as const).map((r) => (
        <button
          key={r}
          onClick={() =>
            setAuth({
              ...auth,
              role: r,
              name: r === "super" ? "Alex Morgan" : "Aisha Khan",
              email: r === "super" ? "alex@reviewos.app" : "aisha@brand.co",
            })
          }
          className={cn(
            "px-3 py-1 rounded-full transition-colors",
            auth.role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r === "super" ? "Super" : "Sub"}
        </button>
      ))}
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
