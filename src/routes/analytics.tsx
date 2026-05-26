import { createFileRoute } from "@tanstack/react-router";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis, BarChart, Bar,
} from "recharts";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { responseTrend, peakHours, templates, KPIS } from "@/lib/mock-data";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

const npsData = [{ name: "NPS", value: KPIS.npsScore, fill: "oklch(0.78 0.18 300)" }];
const csatData = [{ name: "CSAT", value: 92, fill: "oklch(0.82 0.16 200)" }];

function AnalyticsPage() {
  return (
    <DashboardLayout>
      <PageHeader title="Analytics" description="Insights, satisfaction scores, and engagement trends." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-2">Net Promoter Score</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={npsData} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "oklch(1 0 0 / 0.06)" }} dataKey="value" cornerRadius={20} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center -mt-32 mb-12">
            <div className="text-4xl font-semibold text-gradient">{KPIS.npsScore}</div>
            <div className="text-xs text-muted-foreground">Excellent</div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground mb-2">Customer Satisfaction</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={csatData} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "oklch(1 0 0 / 0.06)" }} dataKey="value" cornerRadius={20} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center -mt-32 mb-12">
            <div className="text-4xl font-semibold text-gradient">92%</div>
            <div className="text-xs text-muted-foreground">+4% week over week</div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground">Completion Rate</div>
          <div className="text-4xl font-semibold mt-2">87.4%</div>
          <Badge variant="secondary" className="bg-emerald-400/10 text-emerald-300 mt-3">+2.1%</Badge>
          <div className="text-xs text-muted-foreground mt-6">Avg. response time</div>
          <div className="text-xl font-semibold mt-1">42<span className="text-sm text-muted-foreground">s</span></div>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="font-semibold mb-4">Rating Trend</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={responseTrend} margin={{ left: -20 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
              <XAxis dataKey="day" stroke="oklch(0.7 0.025 255)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.7 0.025 255)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 5]} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.035 260 / 0.9)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
              <Line type="monotone" dataKey="rating" stroke="oklch(0.82 0.16 200)" strokeWidth={2.5} dot={{ r: 4, fill: "oklch(0.82 0.16 200)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="font-semibold mb-4">Template Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={templates.filter((t) => t.responses > 0)} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.06)" horizontal={false} />
                <XAxis type="number" stroke="oklch(0.7 0.025 255)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="oklch(0.7 0.025 255)" fontSize={11} tickLine={false} axisLine={false} width={140} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.035 260 / 0.9)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                <Bar dataKey="responses" fill="oklch(0.78 0.18 300)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard>
          <h3 className="font-semibold mb-4">Hourly Engagement</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours} margin={{ left: -20 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                <XAxis dataKey="hour" stroke="oklch(0.7 0.025 255)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.7 0.025 255)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.035 260 / 0.9)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                <Bar dataKey="responses" fill="oklch(0.82 0.16 200)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
