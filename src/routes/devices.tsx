import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MapPin, Smartphone, Trash2, Edit2, Pause, Play, Calendar } from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Devices, Templates, ApiDevice } from "@/lib/api";
import { LoadingState, ErrorState } from "@/routes/templates";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/devices")({ component: DevicesPage });

function DevicesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["devices"],
    queryFn: () => Devices.list(),
    refetchInterval: 15000,
  });
  const templatesQ = useQuery({ queryKey: ["templates"], queryFn: () => Templates.list() });
  const devices = data?.devices ?? [];
  const templates = templatesQ.data?.templates ?? [];

  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");

  // Edit states
  const [editOpen, setEditOpen] = React.useState(false);
  const [editDevice, setEditDevice] = React.useState<ApiDevice | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editLocation, setEditLocation] = React.useState("");

  const updateMut = useMutation({
    mutationFn: ({
      id,
      name,
      location,
      status,
    }: {
      id: number;
      name: string;
      location: string | null;
      status?: ApiDevice["status"];
    }) => Devices.update(id, { name, location, status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Device updated");
      setEditOpen(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: (id: number) => Devices.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Removed");
    },
  });

  const handleEditClick = (d: ApiDevice) => {
    setEditDevice(d);
    setEditName(d.name);
    setEditLocation(d.location || "");
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (editDevice && editName) {
      updateMut.mutate({
        id: editDevice.id,
        name: editName,
        location: editLocation || null,
      });
    }
  };

  const handleTogglePause = (d: ApiDevice) => {
    const newStatus = d.status === "paused" ? "online" : "paused";
    updateMut.mutate({
      id: d.id,
      name: d.name,
      location: d.location,
      status: newStatus,
    });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Devices"
        description="Pair Android-based review devices, monitor health, push templates instantly."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4 mr-2" /> Pair Device
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-white/10 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Pair Review OS Device</DialogTitle>
                <DialogDescription>
                  Enter the 6-digit pairing code shown on the tablet, and give this device a friendly name.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pair-code">Pairing Code</Label>
                  <Input
                    id="pair-code"
                    placeholder="123 456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="bg-white/5 border-white/10 text-center text-lg font-semibold tracking-widest uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="device-name">Device Name</Label>
                  <Input
                    id="device-name"
                    placeholder="Front Desk Tablet"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="device-loc">Location / Department</Label>
                  <Input
                    id="device-loc"
                    placeholder="Lobby / Reception"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="w-full"
                  onClick={async () => {
                    if (!code || !name) return toast.error("Code and Name are required");
                    try {
                      await Devices.pair(code, name, location);
                      toast.success("Device paired successfully!");
                      qc.invalidateQueries({ queryKey: ["devices"] });
                      setCode("");
                      setName("");
                      setLocation("");
                      setOpen(false);
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  Pair Device
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Stat label="Total paired" value={devices.length} />
            <Stat
              label="Online"
              value={devices.filter((d) => d.status === "online").length}
              tone="success"
            />
            <Stat
              label="Paused"
              value={devices.filter((d) => d.status === "paused").length}
              tone="warn"
            />
            <Stat
              label="Offline"
              value={devices.filter((d) => d.status === "offline").length}
              tone="danger"
            />
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
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                        No devices yet. Click "Pair Device" to add one.
                      </td>
                    </tr>
                  )}
                  {devices.map((d) => {
                    const current = templates.find((t) => t.id === d.template_id);
                    return (
                      <tr
                        key={d.id}
                        className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                      >
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
                        <td className="px-3 py-4">
                          <StatusPill status={d.status} />
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-col gap-1">
                            {current ? (
                              <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                                <span className="size-1.5 rounded-full bg-emerald-400" />
                                {current.name}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground font-medium">
                                No fallback template
                              </div>
                            )}
                            <Link
                              to="/schedule"
                              className="text-[10px] text-muted-foreground hover:text-primary transition flex items-center gap-1"
                            >
                              <Calendar className="size-3" /> Managed via Scheduler
                            </Link>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-muted-foreground">
                          {d.last_sync ? new Date(d.last_sync).toLocaleString() : "never"}
                        </td>
                        <td className="px-3 py-4 text-right font-semibold">{d.responses_today}</td>
                        <td className="px-3 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {/* Pause / Play button */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "size-7",
                                d.status === "paused"
                                  ? "text-emerald-300 hover:text-emerald-200"
                                  : "text-amber-300 hover:text-amber-200",
                              )}
                              onClick={() => handleTogglePause(d)}
                              title={
                                d.status === "paused"
                                  ? "Resume survey sessions"
                                  : "Temporarily pause tablet survey"
                              }
                            >
                              {d.status === "paused" ? (
                                <Play className="size-3.5" />
                              ) : (
                                <Pause className="size-3.5" />
                              )}
                            </Button>

                            {/* Edit Config button */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-primary hover:text-primary/80"
                              onClick={() => handleEditClick(d)}
                              title="Edit Device Details"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>

                            {/* Delete/Logout button */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-rose-300 hover:text-rose-200"
                              onClick={() => del.mutate(d.id)}
                              title="Unpair & delete device record"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Edit Device Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="glass-strong border-white/10 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Tablet Details</DialogTitle>
                <DialogDescription>
                  Modify the client-facing tablet details below.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <Label htmlFor="edit-dname">Device name</Label>
                <Input
                  id="edit-dname"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-white/5 border-white/10"
                  placeholder="Lobby Tablet"
                />
                <Label htmlFor="edit-dloc">Location</Label>
                <Input
                  id="edit-dloc"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="bg-white/5 border-white/10"
                  placeholder="Downtown Branch"
                />
              </div>
              <DialogFooter>
                <Button
                  className="w-full"
                  onClick={handleEditSave}
                  disabled={updateMut.isPending || !editName}
                >
                  {updateMut.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </DashboardLayout>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warn" | "danger";
}) {
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

function StatusPill({ status }: { status: ApiDevice["status"] }) {
  const map = {
    online: ["bg-emerald-400/15 text-emerald-300", "Online"],
    offline: ["bg-rose-400/15 text-rose-300", "Offline"],
    syncing: ["bg-amber-400/15 text-amber-300", "Syncing"],
    paused: ["bg-amber-500/15 text-amber-400 border border-amber-500/20", "Paused"],
  } as const;
  const [cls, label] = map[status] || map.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${cls}`}>
      <span
        className={cn("size-1.5 rounded-full bg-current", status === "online" && "animate-pulse")}
      />{" "}
      {label}
    </span>
  );
}
