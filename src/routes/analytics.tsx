import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Admins, Devices, Responses, Templates } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { Users, ShieldCheck, Building2, Activity, Smartphone, FileText } from "lucide-react";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const auth = useAuth();
  if (!auth) return null;
  return auth.role === "super" ? <SuperAnalytics /> : <SubAnalytics />;
}

// ============================================================
// SUPER ADMIN — Org-wide insights only
// ============================================================

const TONE = [
  "oklch(0.82 0.16 200)",
  "oklch(0.78 0.18 300)",
  "oklch(0.85 0.14 90)",
  "oklch(0.7 0.2 25)",
  "oklch(0.72 0.18 150)",
  "oklch(0.78 0.14 250)",
];

function SuperAnalytics() {
  const adminsQ = useQuery({ queryKey: ["admins"], queryFn: () => Admins.list() });
  const responsesQ = useQuery({ queryKey: ["responses"], queryFn: () => Responses.list() });
  const devicesQ = useQuery({ queryKey: ["devices"], queryFn: () => Devices.list() });
  const templatesQ = useQuery({ queryKey: ["templates"], queryFn: () => Templates.list() });

  const admins = adminsQ.data?.admins ?? [];
  const responses = responsesQ.data?.responses ?? [];
  const devices = devicesQ.data?.devices ?? [];
  const templates = templatesQ.data?.templates ?? [];

  const subs = admins.filter((a) => a.role === "sub");
  const activeSubs = subs.filter((a) => a.status === "active").length;
  const disabledSubs = subs.length - activeSubs;
  const ratings = responses.map((r) => r.rating ?? 0).filter((n) => n > 0);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  // Org trend (last 14 days)
  const trend = React.useMemo(() => {
    const buckets: { day: string; responses: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({ day: `${d.getMonth() + 1}/${d.getDate()}`, responses: 0 });
    }
    const byKey = new Map<string, number>();
    for (let i = 0; i < buckets.length; i++) byKey.set(buckets[i].day, i);
    for (const r of responses) {
      const d = new Date(r.submitted_at);
      const k = `${d.getMonth() + 1}/${d.getDate()}`;
      const idx = byKey.get(k);
      if (idx != null) buckets[idx].responses++;
    }
    return buckets;
  }, [responses]);

  // Per-sub-admin breakdown (top 6 by devices, approximate volume via avg-per-device)
  const perSub = React.useMemo(() => {
    const totalDevices = subs.reduce((a, b) => a + b.devices, 0) || 1;
    return [...subs]
      .sort((a, b) => b.devices - a.devices)
      .slice(0, 6)
      .map((s) => ({
        name: s.name.split(" ")[0],
        devices: s.devices,
        templates: s.templates,
        reviews: Math.round((s.devices / totalDevices) * responses.length),
      }));
  }, [subs, responses.length]);

  // Status donut
  const statusData = [
    { name: "Active", value: activeSubs, fill: "oklch(0.78 0.18 150)" },
    { name: "Disabled", value: disabledSubs, fill: "oklch(0.72 0.18 25)" },
  ];

  const orgHealth = Math.round(
    (devices.length
      ? (devices.filter((d) => d.status === "online").length / devices.length) * 50
      : 0) + (subs.length ? (activeSubs / subs.length) * 50 : 50),
  );
  const healthData = [{ name: "Health", value: orgHealth, fill: "oklch(0.82 0.16 200)" }];

  return (
    <DashboardLayout>
      <PageHeader
        title="Organization Analytics"
        description="High-level health, sub-admin breakdown, and platform-wide trends."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Users} label="Sub Admins" value={`${activeSubs}/${subs.length}`} hint="active" />
        <Kpi
          icon={Smartphone}
          label="Devices"
          value={devices.length.toString()}
          hint={`${devices.filter((d) => d.status === "online").length} online`}
        />
        <Kpi
          icon={FileText}
          label="Templates"
          value={templates.length.toString()}
          hint={`${templates.filter((t) => t.status === "active").length} active`}
        />
        <Kpi
          icon={Activity}
          label="Avg Rating"
          value={avgRating ? avgRating.toFixed(2) : "—"}
          hint={`${responses.length} reviews`}
        />
      </div>

      {/* Health + sub-admin status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> Org Health Index
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="70%"
                outerRadius="100%"
                data={healthData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  background={{ fill: "oklch(1 0 0 / 0.06)" }}
                  dataKey="value"
                  cornerRadius={20}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center -mt-32 mb-12">
            <div className="text-4xl font-semibold text-gradient">{orgHealth}</div>
            <div className="text-xs text-muted-foreground">
              {orgHealth >= 80 ? "Excellent" : orgHealth >= 60 ? "Healthy" : "Needs attention"}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Users className="size-3.5" /> Sub-Admin Status
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {statusData.map((s, i) => (
                    <Cell key={i} fill={s.fill} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
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
        </GlassCard>

        <GlassCard>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Building2 className="size-3.5" /> Coverage
          </div>
          <CoverageBar label="Active sub-admins" value={activeSubs} total={subs.length || 1} />
          <CoverageBar
            label="Online devices"
            value={devices.filter((d) => d.status === "online").length}
            total={devices.length || 1}
          />
          <CoverageBar
            label="Active templates"
            value={templates.filter((t) => t.status === "active").length}
            total={templates.length || 1}
          />
        </GlassCard>
      </div>

      {/* Org-wide response trend */}
      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Platform Response Volume</h3>
            <p className="text-xs text-muted-foreground">
              Aggregate across all sub-admins — last 14 days
            </p>
          </div>
          <Badge variant="secondary" className="bg-white/5">
            {responses.length} total
          </Badge>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ left: -20 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="oklch(0.7 0.025 255)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="oklch(0.7 0.025 255)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.22 0.035 260 / 0.9)",
                  border: "1px solid oklch(1 0 0 / 0.1)",
                  borderRadius: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="responses"
                stroke="oklch(0.78 0.18 300)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Sub-admin contribution */}
      <GlassCard>
        <div className="mb-3">
          <h3 className="font-semibold">Sub-Admin Contribution</h3>
          <p className="text-xs text-muted-foreground">
            Top 6 by deployed devices — reviews estimated from device share
          </p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perSub} margin={{ left: -10 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="oklch(0.7 0.025 255)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="oklch(0.7 0.025 255)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.22 0.035 260 / 0.9)",
                  border: "1px solid oklch(1 0 0 / 0.1)",
                  borderRadius: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="devices" fill={TONE[0]} radius={[6, 6, 0, 0]} />
              <Bar dataKey="templates" fill={TONE[1]} radius={[6, 6, 0, 0]} />
              <Bar dataKey="reviews" fill={TONE[2]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </DashboardLayout>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <GlassCard className="relative overflow-hidden">
      <div className="absolute -top-8 -right-8 size-24 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="text-2xl lg:text-3xl font-semibold tracking-tight mt-2 text-primary">
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </GlassCard>
  );
}

function CoverageBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold">
          {value}/{total}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[oklch(0.82_0.16_200)] to-[oklch(0.78_0.18_300)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// SUB ADMIN — operational analytics for their own data
// ============================================================

function SubAnalytics() {
  const responsesQ = useQuery({ queryKey: ["responses"], queryFn: () => Responses.list() });
  const templatesQ = useQuery({ queryKey: ["templates"], queryFn: () => Templates.list() });
  const responses = responsesQ.data?.responses ?? [];
  const templates = templatesQ.data?.templates ?? [];

  const ratings = responses.map((r) => r.rating ?? 0).filter((n) => n > 0);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const promoters = ratings.filter((r) => r >= 5).length;
  const detractors = ratings.filter((r) => r <= 2).length;
  const nps = ratings.length ? Math.round(((promoters - detractors) / ratings.length) * 100) : 0;
  const csat = ratings.length
    ? Math.round((ratings.filter((r) => r >= 4).length / ratings.length) * 100)
    : 0;

  const trend = React.useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const buckets: Record<string, { count: number; sum: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = { count: 0, sum: 0 };
    }
    for (const r of responses) {
      const k = new Date(r.submitted_at).toISOString().slice(0, 10);
      if (k in buckets) {
        buckets[k].count++;
        buckets[k].sum += r.rating ?? 0;
      }
    }
    return Object.entries(buckets).map(([k, v]) => ({
      day: days[new Date(k).getDay()],
      rating: v.count ? +(v.sum / v.count).toFixed(2) : 0,
    }));
  }, [responses]);

  const tplPerf = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of responses) counts.set(r.template, (counts.get(r.template) ?? 0) + 1);
    return templates
      .map((t) => ({ name: t.name, responses: counts.get(t.name) ?? 0 }))
      .filter((t) => t.responses > 0)
      .sort((a, b) => b.responses - a.responses)
      .slice(0, 6);
  }, [responses, templates]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Analytics"
        description="Insights, satisfaction scores, and engagement trends."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-2">Net Promoter Score</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="70%"
                outerRadius="100%"
                data={[{ name: "NPS", value: Math.max(0, nps), fill: "oklch(0.78 0.18 300)" }]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  background={{ fill: "oklch(1 0 0 / 0.06)" }}
                  dataKey="value"
                  cornerRadius={20}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center -mt-32 mb-12">
            <div className="text-4xl font-semibold text-gradient">{nps}</div>
            <div className="text-xs text-muted-foreground">
              {nps >= 50 ? "Excellent" : nps >= 0 ? "Good" : "Needs work"}
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-2">Customer Satisfaction</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="70%"
                outerRadius="100%"
                data={[{ name: "CSAT", value: csat, fill: "oklch(0.82 0.16 200)" }]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  background={{ fill: "oklch(1 0 0 / 0.06)" }}
                  dataKey="value"
                  cornerRadius={20}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center -mt-32 mb-12">
            <div className="text-4xl font-semibold text-gradient">{csat}%</div>
            <div className="text-xs text-muted-foreground">% 4★ or higher</div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground">Avg. Rating</div>
          <div className="text-4xl font-semibold mt-2">{avg ? avg.toFixed(2) : "—"}</div>
          <Badge variant="secondary" className="bg-emerald-400/10 text-emerald-300 mt-3">
            {ratings.length} ratings
          </Badge>
          <div className="text-xs text-muted-foreground mt-6">Total responses</div>
          <div className="text-xl font-semibold mt-1">{responses.length}</div>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="font-semibold mb-4">Rating Trend (7 days)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ left: -20 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="oklch(0.7 0.025 255)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="oklch(0.7 0.025 255)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 5]}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.22 0.035 260 / 0.9)",
                  border: "1px solid oklch(1 0 0 / 0.1)",
                  borderRadius: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="rating"
                stroke="oklch(0.82 0.16 200)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "oklch(0.82 0.16 200)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="font-semibold mb-4">Template Performance</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tplPerf} layout="vertical" margin={{ left: 0 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.06)" horizontal={false} />
              <XAxis
                type="number"
                stroke="oklch(0.7 0.025 255)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                stroke="oklch(0.7 0.025 255)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={140}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.22 0.035 260 / 0.9)",
                  border: "1px solid oklch(1 0 0 / 0.1)",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="responses" fill="oklch(0.78 0.18 300)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </DashboardLayout>
  );
}
