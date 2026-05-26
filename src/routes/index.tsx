import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Star, MessageSquare, Smartphone, FileText, TrendingUp, ArrowUpRight, Sparkles, Users, ShieldCheck, Activity } from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Admins, Devices, Responses, Templates } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/")({ component: DashboardPage });

function DashboardPage() {
  const auth = useAuth();
  if (!auth) return null;
  return auth.role === "super" ? <SuperDashboard /> : <SubDashboard />;
}

function SubDashboard() {
  const devicesQ = useQuery({ queryKey: ["devices"], queryFn: () => Devices.list() });
  const responsesQ = useQuery({ queryKey: ["responses"], queryFn: () => Responses.list(), refetchInterval: 15000 });
  const templatesQ = useQuery({ queryKey: ["templates"], queryFn: () => Templates.list() });

  const devices = devicesQ.data?.devices ?? [];
  const responses = responsesQ.data?.responses ?? [];
  const templates = templatesQ.data?.templates ?? [];

  const totalReviews = responses.length;
  const ratings = responses.map((r) => r.rating ?? 0).filter((n) => n > 0);
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
  const onlineDevices = devices.filter((d) => d.status === "online").length;
  const activeTemplates = templates.filter((t) => t.status === "active").length;

  // 7-day trend from real data
  const trend = React.useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const buckets: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    for (const r of responses) {
      const key = new Date(r.submitted_at).toISOString().slice(0, 10);
      if (key in buckets) buckets[key]++;
    }
    return Object.entries(buckets).map(([k, v]) => ({ day: days[new Date(k).getDay()], responses: v }));
  }, [responses]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Overview"
        description="Live review pulse across all your devices."
        actions={
          <Button asChild>
            <Link to="/templates/builder"><Sparkles className="size-4" /> New Template</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={MessageSquare} label="Total Reviews" value={totalReviews.toLocaleString()} />
        <Kpi icon={Star} label="Avg. Rating" value={avgRating ? avgRating.toFixed(1) : "—"} tone="success" />
        <Kpi icon={Smartphone} label="Online Devices" value={`${onlineDevices} / ${devices.length}`} tone="warn" />
        <Kpi icon={FileText} label="Active Templates" value={activeTemplates.toString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Response Trend</h3>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </div>
            <Badge variant="secondary" className="bg-white/5"><TrendingUp className="size-3 mr-1" /> Live</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -20, right: 0, top: 10 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.82 0.16 200)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.82 0.16 200)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                <XAxis dataKey="day" stroke="oklch(0.7 0.025 255)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.7 0.025 255)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.035 260 / 0.9)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="responses" stroke="oklch(0.82 0.16 200)" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Live Feedback</h3>
            <Link to="/responses" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
              View all <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-3 max-h-64 overflow-auto pr-1">
            {responses.length === 0 && <div className="text-xs text-muted-foreground">No responses yet.</div>}
            {responses.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-start gap-3 text-sm">
                <div className="flex items-center gap-0.5 shrink-0 w-14">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`size-3 ${i < (r.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{r.template}</div>
                  <div className="text-[11px] text-muted-foreground">{r.device} · {new Date(r.submitted_at).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="mb-4">
          <h3 className="font-semibold">Device Activity</h3>
          <p className="text-xs text-muted-foreground">Best performers today</p>
        </div>
        <div className="space-y-2">
          {devices.length === 0 && <div className="text-xs text-muted-foreground">Pair your first device to get started.</div>}
          {[...devices].sort((a, b) => b.responses_today - a.responses_today).slice(0, 5).map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
              <span className={`size-2 rounded-full ${d.status === "online" ? "bg-emerald-400" : d.status === "syncing" ? "bg-amber-400" : "bg-rose-400"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground truncate">{d.location ?? "—"}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{d.responses_today}</div>
                <div className="text-[11px] text-muted-foreground">today</div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </DashboardLayout>
  );
}

function Kpi({
  icon: Icon, label, value, tone = "default",
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: "default" | "success" | "warn" }) {
  const toneCls = tone === "success" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-primary";
  return (
    <GlassCard className="relative overflow-hidden">
      <div className="absolute -top-8 -right-8 size-24 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className={`text-2xl lg:text-3xl font-semibold tracking-tight mt-2 ${toneCls}`}>{value}</div>
    </GlassCard>
  );
}
