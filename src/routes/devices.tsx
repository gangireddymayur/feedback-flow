import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MoreHorizontal, MapPin, Smartphone, Trash2, FileText } from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Devices, Templates } from "@/lib/api";
import { LoadingState, ErrorState } from "@/routes/templates";
import { toast } from "sonner";

export const Route = createFileRoute("/devices")({ component: DevicesPage });

function DevicesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["devices"], queryFn: () => Devices.list(), refetchInterval: 15000 });
  const templatesQ = useQuery({ queryKey: ["templates"], queryFn: () => Templates.list() });
  const devices = data?.devices ?? [];
  const templates = templatesQ.data?.templates ?? [];

  const assign = useMutation({
    mutationFn: ({ id, template_id }: { id: number; template_id: number | null }) =>
      Devices.assignTemplate(id, template_id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); toast.success("Template assigned"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");

  const pair = useMutation({
    mutationFn: () => Devices.pair(code, name, location),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Device paired");
      setOpen(false); setCode(""); setName(""); setLocation("");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (id: number) => Devices.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); toast.success("Removed"); },
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Devices"
        description="Pair Android-based review devices, monitor health, push templates instantly."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> Pair Device</Button></DialogTrigger>
            <DialogContent className="glass-strong border-white/10 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Pair a new device</DialogTitle>
                <DialogDescription>Enter the 6-digit code shown by the ReviewOS app on the device.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <Label htmlFor="code">Pairing code</Label>
                <Input id="code" placeholder="• • • • • •" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-2xl tracking-[0.5em] bg-white/5 border-white/10 h-14" />
                <Label htmlFor="dname">Device name</Label>
                <Input id="dname" value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-white/10" placeholder="Lobby Tablet" />
                <Label htmlFor="dloc">Location</Label>
                <Input id="dloc" value={location} onChange={(e) => setLocation(e.target.value)} className="bg-white/5 border-white/10" placeholder="Downtown Branch" />
              </div>
              <DialogFooter>
                <Button className="w-full" onClick={() => pair.mutate()} disabled={pair.isPending || code.length !== 6 || !name}>
                  {pair.isPending ? "Pairing…" : "Pair device"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={(error as Error).message} />}

      {!isLoading && !error && (
        <>
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
                    <th className="text-left font-medium px-3 py-3">Active Template</th>
                    <th className="text-left font-medium px-3 py-3">Last sync</th>
                    <th className="text-right font-medium px-3 py-3">Today</th>
                    <th className="px-3" />
                  </tr>
                </thead>
                <tbody>
                  {devices.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No devices yet. Click "Pair Device" to add one.</td></tr>
                  )}
                  {devices.map((d) => {
                    const current = templates.find((t) => t.id === d.template_id);
                    return (
                    <tr key={d.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-lg bg-white/5 grid place-items-center">
                            <Smartphone className="size-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium">{d.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="size-3" /> {d.location || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4"><StatusPill status={d.status} /></td>
                      <td className="px-3 py-4">
                        <Select
                          value={d.template_id ? String(d.template_id) : "none"}
                          onValueChange={(v) =>
                            assign.mutate({ id: d.id, template_id: v === "none" ? null : Number(v) })
                          }
                        >
                          <SelectTrigger className="h-8 w-[200px] bg-white/5 border-white/10 text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText className="size-3.5 text-muted-foreground shrink-0" />
                              <SelectValue placeholder="No template" />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="glass-strong border-white/10">
                            <SelectItem value="none">No template</SelectItem>
                            {templates.map((t) => (
                              <SelectItem key={t.id} value={String(t.id)} disabled={t.status !== "active"}>
                                {t.name} {t.status !== "active" && <span className="text-muted-foreground">({t.status})</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {current && (
                          <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[200px]">
                            Showing on device · {(current.questions ?? []).length} questions
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-4 text-muted-foreground">{d.last_sync ? new Date(d.last_sync).toLocaleString() : "never"}</td>
                      <td className="px-3 py-4 text-right font-semibold">{d.responses_today}</td>
                      <td className="px-3 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-7 text-rose-300" onClick={() => del.mutate(d.id)}><Trash2 className="size-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="size-7"><MoreHorizontal className="size-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}
    </DashboardLayout>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "warn" | "danger" }) {
  const cls = { default: "text-primary", success: "text-emerald-300", warn: "text-amber-300", danger: "text-rose-300" }[tone];
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
