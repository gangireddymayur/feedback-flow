import { createFileRoute } from "@tanstack/react-router";
import { Plus, RefreshCw, MoreHorizontal, BatteryLow, Battery, MapPin } from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { devices } from "@/lib/mock-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/devices")({ component: DevicesPage });

function DevicesPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Tablets"
        description="Pair Android tablets, monitor health, push templates instantly."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> Pair Tablet</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-white/10 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Pair a new tablet</DialogTitle>
                <DialogDescription>
                  Open the ReviewOS app on the tablet, then enter the 6-digit code shown on screen.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <Label htmlFor="code">Pairing code</Label>
                <Input id="code" placeholder="• • • • • •" maxLength={6} className="text-center text-2xl tracking-[0.5em] bg-white/5 border-white/10 h-14" />
                <Button className="w-full">Pair tablet</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total" value={devices.length} />
        <Stat label="Online" value={devices.filter((d) => d.status === "online").length} tone="success" />
        <Stat label="Syncing" value={devices.filter((d) => d.status === "syncing").length} tone="warn" />
        <Stat label="Offline" value={devices.filter((d) => d.status === "offline").length} tone="danger" />
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-white/5">
              <tr>
                <th className="text-left font-medium px-5 py-3">Device</th>
                <th className="text-left font-medium px-3 py-3">Status</th>
                <th className="text-left font-medium px-3 py-3">Template</th>
                <th className="text-left font-medium px-3 py-3">Battery</th>
                <th className="text-left font-medium px-3 py-3">Last sync</th>
                <th className="text-right font-medium px-3 py-3">Today</th>
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="size-3" /> {d.location}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <StatusPill status={d.status} />
                  </td>
                  <td className="px-3 py-4 text-muted-foreground">{d.template}</td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1.5">
                      {d.battery < 20 ? (
                        <BatteryLow className="size-4 text-rose-400" />
                      ) : (
                        <Battery className="size-4 text-emerald-400" />
                      )}
                      <span className={d.battery < 20 ? "text-rose-300" : ""}>{d.battery}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-muted-foreground">{d.lastSync}</td>
                  <td className="px-3 py-4 text-right font-semibold">{d.responsesToday}</td>
                  <td className="px-3 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-7"><RefreshCw className="size-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="size-7"><MoreHorizontal className="size-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </DashboardLayout>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "warn" | "danger" }) {
  const cls = {
    default: "text-primary",
    success: "text-emerald-300",
    warn: "text-amber-300",
    danger: "text-rose-300",
  }[tone];
  return (
    <GlassCard>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${cls}`}>{value}</div>
    </GlassCard>
  );
}

function StatusPill({ status }: { status: "online" | "offline" | "syncing" }) {
  const map = {
    online: ["bg-emerald-400/15 text-emerald-300", "Online"],
    offline: ["bg-rose-400/15 text-rose-300", "Offline"],
    syncing: ["bg-amber-400/15 text-amber-300", "Syncing"],
  } as const;
  const [cls, label] = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${cls}`}>
      <span className="size-1.5 rounded-full bg-current animate-pulse" /> {label}
    </span>
  );
}
