import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  MoreHorizontal,
  Mail,
  Copy,
  Power,
  PowerOff,
  Download,
  Pencil,
  ShieldCheck,
  Clock,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Admins, getToken } from "@/lib/api";
import { LoadingState, ErrorState } from "@/routes/templates";
import { toast } from "sonner";

export const Route = createFileRoute("/admins")({ component: AdminsPage });

function AdminsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admins"],
    queryFn: () => Admins.list(),
  });
  const admins = data?.admins ?? [];

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    password: "",
    local_mode: "none" as "none" | "single" | "multi",
    max_devices: 5,
  });
  const [downloadOpen, setDownloadOpen] = React.useState(false);
  const [selectedSubAdmin, setSelectedSubAdmin] = React.useState<any>(null);
  const [downloadForm, setDownloadForm] = React.useState({
    email: "",
    password: "",
    max_devices: 5,
  });

  const [editOpen, setEditOpen] = React.useState(false);
  const [editingAdmin, setEditingAdmin] = React.useState<any>(null);
  const [editForm, setEditForm] = React.useState({
    name: "",
    email: "",
    password: "",
    local_mode: "none" as "none" | "single" | "multi",
    max_devices: 5,
  });

  const updateAdmin = useMutation({
    mutationFn: () =>
      Admins.update(editingAdmin.id, {
        name: editForm.name,
        email: editForm.email,
        password: editForm.password ? editForm.password : undefined,
        local_mode: editForm.local_mode,
        max_devices: editForm.local_mode === "single" ? 1 : editForm.max_devices,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Admin updated successfully");
      setEditOpen(false);
      setEditingAdmin(null);
      setEditForm({
        name: "",
        email: "",
        password: "",
        local_mode: "none",
        max_devices: 5,
      });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const create = useMutation({
    mutationFn: () =>
      Admins.create({
        ...form,
        role: "sub",
        max_devices: form.local_mode === "single" ? 1 : form.max_devices,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Admin invited");
      setOpen(false);
      setForm({
        name: "",
        email: "",
        password: "",
        local_mode: "none",
        max_devices: 5,
      });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "active" | "disabled" }) =>
      Admins.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admins"] }),
  });

  const setAccess = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "active" | "trial" | "expired" }) =>
      Admins.setAccessStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Account access updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Sub Admins"
        description="Create, disable, and monitor admin accounts across the platform."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const token = getToken();
                window.open(
                  `/api/downloads/local-server-pkg?token=${encodeURIComponent(token || "")}`,
                  "_blank",
                );
              }}
            >
              Download Local Server Package
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Invite Admin
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-strong border-white/10 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite a Sub Admin</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <Label>Name</Label>
                  <Input
                    className="bg-white/5 border-white/10"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <Label>Email</Label>
                  <Input
                    type="email"
                    className="bg-white/5 border-white/10"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  <Label>Password</Label>
                  <Input
                    type="password"
                    className="bg-white/5 border-white/10"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <Label>Deployment Mode</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-white"
                    value={form.local_mode}
                    onChange={(e) => setForm({ ...form, local_mode: e.target.value as any })}
                  >
                    <option value="none" className="bg-[#18181b]">
                      Cloud Mode (Standard)
                    </option>
                    <option value="single" className="bg-[#18181b]">
                      Local Single-Device (Solo)
                    </option>
                    <option value="multi" className="bg-[#18181b]">
                      Local Multi-Tablet (Network Cluster)
                    </option>
                  </select>

                  {form.local_mode !== "single" && (
                    <>
                      <Label>Max Allowed Tablets</Label>
                      <Input
                        type="number"
                        min={1}
                        className="bg-white/5 border-white/10"
                        value={form.max_devices}
                        onChange={(e) => setForm({ ...form, max_devices: Number(e.target.value) })}
                      />
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    className="w-full"
                    disabled={create.isPending || !form.email || form.password.length < 8}
                    onClick={() => create.mutate()}
                  >
                    {create.isPending ? "Creating…" : "Create admin"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={(error as Error).message} />}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {admins.length === 0 && (
            <GlassCard className="text-sm text-muted-foreground">No sub admins yet.</GlassCard>
          )}
          {admins.map((a) => (
            <GlassCard key={a.id} className="hover:bg-white/[0.07] transition-colors">
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-2xl bg-gradient-to-br from-cyan-400/40 to-fuchsia-400/40 grid place-items-center font-semibold">
                  {a.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate">
                    <Mail className="size-3" /> {a.email}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-strong border-white/10">
                    <DropdownMenuItem
                      onClick={() => {
                        navigator.clipboard.writeText(a.email);
                        toast.success("Email copied");
                      }}
                    >
                      <Copy className="size-3.5 mr-2" /> Copy email
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingAdmin(a);
                        setEditForm({
                          name: a.name,
                          email: a.email,
                          password: "",
                          local_mode: a.local_mode as any,
                          max_devices: a.max_devices || 5,
                        });
                        setEditOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5 mr-2" /> Edit Details
                    </DropdownMenuItem>
                    {a.local_mode !== "none" && (
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedSubAdmin(a);
                          setDownloadForm({
                            email: a.email,
                            password: "",
                            max_devices: a.max_devices,
                          });
                          setDownloadOpen(true);
                        }}
                      >
                        <Download className="size-3.5 mr-2" /> Download Local Server
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() =>
                        setStatus.mutate({
                          id: a.id,
                          status: a.status === "active" ? "disabled" : "active",
                        })
                      }
                    >
                      {a.status === "active" ? (
                        <>
                          <PowerOff className="size-3.5 mr-2" /> Disable
                        </>
                      ) : (
                        <>
                          <Power className="size-3.5 mr-2" /> Enable
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/5 text-center">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Devices</div>
                  <div className="font-semibold mt-0.5 text-xs">
                    {a.devices} / {a.local_mode === "single" ? 1 : a.max_devices}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Templates</div>
                  <div className="font-semibold mt-0.5 text-xs">{a.templates}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Mode</div>
                  <div className="font-semibold mt-0.5 text-[10px] truncate uppercase">
                    {a.local_mode === "single"
                      ? "Solo"
                      : a.local_mode === "multi"
                        ? "Network"
                        : "Cloud"}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 text-xs">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <Clock className="size-3" /> Joined {new Date(a.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() =>
                    setStatus.mutate({
                      id: a.id,
                      status: a.status === "active" ? "disabled" : "active",
                    })
                  }
                  className={`px-2 py-0.5 rounded-full font-medium ${a.status === "active" ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}
                >
                  {a.status}
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                    Access Level
                  </div>
                  {a.subscription_status === "active" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mt-1">
                      <ShieldCheck className="size-3" /> Full Access
                    </span>
                  ) : a.trial_info?.isExpired ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 mt-1">
                      <AlertTriangle className="size-3" /> Trial Expired
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 mt-1">
                      <Clock className="size-3" /> {a.trial_info?.daysLeft ?? 7}d Trial Left
                    </span>
                  )}
                </div>

                <div>
                  {a.subscription_status !== "active" ? (
                    <Button
                      size="sm"
                      onClick={() => setAccess.mutate({ id: a.id, status: "active" })}
                      className="h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer px-3"
                    >
                      <ShieldCheck className="size-3 mr-1" /> Grant Access
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAccess.mutate({ id: a.id, status: "trial" })}
                      className="h-7 text-[10px] font-semibold text-muted-foreground hover:text-white cursor-pointer border-white/10"
                    >
                      <RotateCcw className="size-3 mr-1" /> Reset Trial
                    </Button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
        <DialogContent className="glass-strong border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Local Server Download</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="text-xs text-muted-foreground mb-2">
              Generate a pre-configured local server package for{" "}
              <strong>{selectedSubAdmin?.name}</strong>. The user's account details and device limit
              will be securely hardcoded into the setup database package.
            </div>

            <Label>Email / Username</Label>
            <Input
              type="email"
              className="bg-white/5 border-white/10"
              value={downloadForm.email}
              onChange={(e) => setDownloadForm({ ...downloadForm, email: e.target.value })}
            />

            <Label>New Password (Optional override)</Label>
            <Input
              type="password"
              placeholder="Leave blank to keep existing password"
              className="bg-white/5 border-white/10"
              value={downloadForm.password}
              onChange={(e) => setDownloadForm({ ...downloadForm, password: e.target.value })}
            />

            <Label>Max Allowed Tablets</Label>
            <Input
              type="number"
              min={1}
              className="bg-white/5 border-white/10"
              value={downloadForm.max_devices}
              onChange={(e) =>
                setDownloadForm({ ...downloadForm, max_devices: Number(e.target.value) })
              }
            />
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => {
                const token = getToken();
                let url = `/api/downloads/local-server-pkg?token=${encodeURIComponent(token || "")}&userId=${selectedSubAdmin?.id}`;
                if (downloadForm.email.trim()) {
                  url += `&customEmail=${encodeURIComponent(downloadForm.email.trim())}`;
                }
                if (downloadForm.password) {
                  url += `&customPassword=${encodeURIComponent(downloadForm.password)}`;
                }
                if (downloadForm.max_devices >= 1) {
                  url += `&customMaxDevices=${downloadForm.max_devices}`;
                }
                window.open(url, "_blank");
                setDownloadOpen(false);
                toast.success("Generating package download...");
                // Reload list to sync any changed limits/emails on UI
                setTimeout(() => {
                  qc.invalidateQueries({ queryKey: ["admins"] });
                }, 2000);
              }}
            >
              Generate & Download ZIP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass-strong border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Sub Admin: {editingAdmin?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label>Name</Label>
            <Input
              className="bg-white/5 border-white/10"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
            <Label>Email</Label>
            <Input
              type="email"
              className="bg-white/5 border-white/10"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
            <Label>Password (Optional override)</Label>
            <Input
              type="password"
              placeholder="Leave blank to keep existing password"
              className="bg-white/5 border-white/10"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            />
            <Label>Deployment Mode</Label>
            <select
              className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-white"
              value={editForm.local_mode}
              onChange={(e) => setEditForm({ ...editForm, local_mode: e.target.value as any })}
            >
              <option value="none" className="bg-[#18181b]">
                Cloud Mode (Standard)
              </option>
              <option value="single" className="bg-[#18181b]">
                Local Single-Device (Solo)
              </option>
              <option value="multi" className="bg-[#18181b]">
                Local Multi-Tablet (Network Cluster)
              </option>
            </select>

            {editForm.local_mode !== "single" && (
              <>
                <Label>Max Allowed Tablets</Label>
                <Input
                  type="number"
                  min={1}
                  className="bg-white/5 border-white/10"
                  value={editForm.max_devices}
                  onChange={(e) =>
                    setEditForm({ ...editForm, max_devices: Number(e.target.value) })
                  }
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              disabled={updateAdmin.isPending || !editForm.email}
              onClick={() => updateAdmin.mutate()}
            >
              {updateAdmin.isPending ? "Saving changes…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
