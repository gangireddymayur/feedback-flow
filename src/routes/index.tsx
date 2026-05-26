import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import {
  Star, MessageSquare, Smartphone, FileText, TrendingUp, AlertTriangle,
  ArrowUpRight, Sparkles,
} from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  KPIS, responseTrend, ratingDistribution, peakHours, responses, devices,
} from "@/lib/mock-data";

export const Route = createFileRoute("/")({ component: DashboardPage });

function DashboardPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Overview"
        description="Live review pulse across all your devices."
        actions={
          <>
            <Button variant="outline" className="bg-white/5 border-white/10">Export</Button>
            <Button asChild>
              <Link to="/templates">
                <Sparkles className="size-4" /> New Template
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={MessageSquare} label="Total Reviews" value={KPIS.totalReviews.toLocaleString()} delta="+12.4%" />
        <Kpi icon={Star} label="Avg. Rating" value={KPIS.avgRating.toFixed(1)} delta="+0.2" tone="success" />
        <Kpi icon={Smartphone} label="Active Devices" value={KPIS.totalDevices.toString()} delta="2 offline" tone="warn" />
        <Kpi icon={FileText} label="Active Templates" value={KPIS.activeTemplates.toString()} delta="+1 this week" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Response Trend</h3>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </div>
            <Badge variant="secondary" className="bg-white/5">
              <TrendingUp className="size-3 mr-1" /> +18.2%
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={responseTrend} margin={{ left: -20, right: 0, top: 10 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.82 0.16 200)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.82 0.16 200)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                <XAxis dataKey="day" stroke="oklch(0.7 0.025 255)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.7 0.025 255)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.035 260 / 0.9)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 12,
                    backdropFilter: "blur(12px)",
                  }}
                />
                <Area type="monotone" dataKey="responses" stroke="oklch(0.82 0.16 200)" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-4">
            <h3 className="font-semibold">Rating Distribution</h3>
            <p className="text-xs text-muted-foreground">All time</p>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ratingDistribution} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {ratingDistribution.map((d, i) => (
                    <Cell key={i} fill={`var(--color-chart-${i + 1})`} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.035 260 / 0.9)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-5 gap-1 mt-2">
            {ratingDistribution.map((d, i) => (
              <div key={i} className="text-center">
                <div className="text-xs text-muted-foreground">{d.rating}</div>
                <div className="text-sm font-medium">{d.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <div className="mb-4">
            <h3 className="font-semibold">Peak Response Hours</h3>
            <p className="text-xs text-muted-foreground">When customers actually leave feedback</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours} margin={{ left: -20 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                <XAxis dataKey="hour" stroke="oklch(0.7 0.025 255)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.7 0.025 255)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.035 260 / 0.9)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="responses" fill="oklch(0.78 0.18 300)" radius={[6, 6, 0, 0]} />
              </BarChart>
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
            {responses.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-start gap-3 text-sm">
                <div className="flex items-center gap-0.5 shrink-0 w-14">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`size-3 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{r.comment ?? `${r.template} response`}</div>
                  <div className="text-[11px] text-muted-foreground">{r.device} · {r.submittedAt}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <div className="mb-4">
            <h3 className="font-semibold">Device Activity</h3>
            <p className="text-xs text-muted-foreground">Best & worst performers today</p>
          </div>
          <div className="space-y-2">
            {[...devices].sort((a, b) => b.responsesToday - a.responsesToday).slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                <span className={`size-2 rounded-full ${d.status === "online" ? "bg-emerald-400" : d.status === "syncing" ? "bg-amber-400" : "bg-rose-400"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{d.location} · {d.template}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{d.responsesToday}</div>
                  <div className="text-[11px] text-muted-foreground">today</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="bg-gradient-to-br from-rose-500/10 to-transparent border-rose-400/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-4 text-rose-300" />
            <h3 className="font-semibold">Negative Review Alert</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">3 reviews rated ≤2★ in the last hour. Customer satisfaction score dipped to <span className="text-rose-300 font-medium">68</span>.</p>
          <Button variant="outline" className="bg-white/5 border-white/10 w-full" asChild>
            <Link to="/responses">Investigate</Link>
          </Button>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}

function Kpi({
  icon: Icon, label, value, delta, tone = "default",
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; delta: string; tone?: "default" | "success" | "warn" }) {
  const toneCls =
    tone === "success" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-primary";
  return (
    <GlassCard className="relative overflow-hidden">
      <div className="absolute -top-8 -right-8 size-24 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="text-2xl lg:text-3xl font-semibold tracking-tight mt-2">{value}</div>
      <div className={`text-xs mt-1 ${toneCls}`}>{delta}</div>
    </GlassCard>
  );
}
