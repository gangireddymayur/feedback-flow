import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MapPin, Smartphone, Trash2, Pause, Play, Calendar, Settings, RefreshCw } from "lucide-react";
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
import { Auth, Devices, Templates, ApiDevice } from "@/lib/api";
import { refreshAuth, useAuth } from "@/lib/auth-store";
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

  // Unpair confirm state
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);
  const [syncingCloud, setSyncingCloud] = React.useState(false);

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
      toast.success("Device unpaired successfully");
      setDeleteConfirmId(null);
    },
    onError: (e) => toast.error((e as Error).message),
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

  const auth = useAuth();
  const isSoloMode = auth?.local_mode === "solo";
  const isLocalNetworkServer =
    auth?.local_mode === "network" &&
    typeof window !== "undefined" &&
    window.location.protocol === "http:";
  const deviceLimit = auth?.max_devices && auth.max_devices > 0 ? auth.max_devices : null;

  const handleCloudSync = async () => {
    setSyncingCloud(true);
    try {
      const result = await Auth.syncCloudEntitlements();
      await refreshAuth();
      await qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success(`Maximum devices updated to ${result.max_devices}`, {
        description: "Local devices, templates, responses, schedules, and files were left unchanged.",
      });
    } catch (error) {
      toast.error((error as Error).message || "Cloud entitlement sync failed");
    } finally {
      setSyncingCloud(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Devices"
        description="Pair Android-based review devices, monitor health, push templates instantly."
        actions={
          isSoloMode ? null : (
            <div className="flex items-center gap-2">
              {isLocalNetworkServer && (
                <Button
                  variant="outline"
                  onClick={handleCloudSync}
                  disabled={syncingCloud}
                >
                  <RefreshCw className={cn("size-4 mr-2", syncingCloud && "animate-spin")} />
                  {syncingCloud ? "Syncing..." : "Sync from Cloud"}
                </Button>
              )}
              <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4 mr-2" /> Pair Device
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-strong border-white/10 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Pair FAM Device</DialogTitle>
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
            </div>
          )
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Stat
              label="Paired / maximum"
              value={deviceLimit ? `${devices.length} / ${deviceLimit}` : devices.length}
            />
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
                          <Link
                            to="/schedule"
                            className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1.5 font-medium"
                          >
                            <Calendar className="size-3.5 text-primary" /> Managed via Schedule
                          </Link>
                        </td>
                        <td className="px-3 py-4 text-muted-foreground">
                          {d.last_sync ? new Date(d.last_sync).toLocaleString() : "never"}
                        </td>
                        <td className="px-3 py-4 text-right font-semibold">{d.responses_today}</td>
                        <td className="px-3 py-4">
                          <div className="flex items-center justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 hover:bg-white/5"
                              onClick={() => handleEditClick(d)}
                              title="Device Settings"
                            >
                              <Settings className="size-3.5 text-muted-foreground" />
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

          {/* Device Settings Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="glass-strong border-white/10 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Device Settings</DialogTitle>
                <DialogDescription>
                  {isSoloMode 
                    ? "Modify device configuration name and location." 
                    : "Modify configurations, pause surveys, or unpair this tablet device."}
                </DialogDescription>
              </DialogHeader>
              {editDevice && (
                <div className="space-y-4 py-2">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="device-name">Friendly Name</Label>
                      <Input
                        id="device-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="e.g. Lobby Entrance Tablet"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="device-loc">Location</Label>
                      <Input
                        id="device-loc"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        placeholder="e.g. Front Desk / Reception"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <Button
                      type="button"
                      className="w-full text-xs h-9 font-semibold"
                      onClick={() => {
                        updateMut.mutate({
                          id: editDevice.id,
                          name: editName,
                          location: editLocation || null,
                        }, {
                          onSuccess: () => {
                            setEditOpen(false);
                          }
                        });
                      }}
                      disabled={updateMut.isPending || !editName}
                    >
                      {updateMut.isPending ? "Saving..." : "Save Settings"}
                    </Button>

                    {!isSoloMode && (
                      <>
                        <Button
                          type="button"
                          variant={editDevice.status === "paused" ? "default" : "outline"}
                          className={cn(
                            "w-full text-xs h-9 font-semibold",
                            editDevice.status !== "paused" && "text-amber-300 hover:text-amber-400 border-amber-500/20 hover:bg-amber-500/10"
                          )}
                          onClick={() => {
                            const newStatus = editDevice.status === "paused" ? "online" : "paused";
                            updateMut.mutate({
                              id: editDevice.id,
                              name: editName,
                              location: editLocation || null,
                              status: newStatus,
                            }, {
                              onSuccess: () => {
                                setEditOpen(false);
                              }
                            });
                          }}
                          disabled={updateMut.isPending}
                        >
                          {editDevice.status === "paused" ? (
                            <>
                              <Play className="size-3.5 mr-1.5" /> Resume Playback
                            </>
                          ) : (
                            <>
                              <Pause className="size-3.5 mr-1.5" /> Pause Playback
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="destructive"
                          className="w-full text-xs h-9 font-semibold"
                          onClick={() => {
                            if (confirm(`WARNING: Deleting device ${editDevice.name} will unpair it and clear all its schedules. This cannot be undone. Do you want to proceed?`)) {
                              del.mutate(editDevice.id, {
                                onSuccess: () => {
                                  setEditOpen(false);
                                }
                              });
                            }
                          }}
                          disabled={del.isPending}
                        >
                          <Trash2 className="size-3.5 mr-1.5" /> Delete Screen / Logout
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
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

// ConfirmUnpairDialog deleted
