import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Mail, Copy, Power, PowerOff } from "lucide-react";
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
import { Admins } from "@/lib/api";
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
  const create = useMutation({
    mutationFn: () =>
      Admins.create({
        ...form,
        role: "sub",
        max_devices: form.local_mode === "multi" ? form.max_devices : 1,
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

  return (
    <DashboardLayout>
      <PageHeader
        title="Sub Admins"
        description="Create, disable, and monitor admin accounts across the platform."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.open("/api/downloads/local-server-pkg", "_blank")}
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
                    onChange={(e) =>
                      setForm({ ...form, local_mode: e.target.value as any })
                    }
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

                  {form.local_mode === "multi" && (
                    <>
                      <Label>Max Allowed Tablets</Label>
                      <Input
                        type="number"
                        min={1}
                        className="bg-white/5 border-white/10"
                        value={form.max_devices}
                        onChange={(e) =>
                          setForm({ ...form, max_devices: Number(e.target.value) })
                        }
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
                    {a.devices} / {a.local_mode === "none" ? "∞" : a.max_devices}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Templates</div>
                  <div className="font-semibold mt-0.5 text-xs">{a.templates}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Mode</div>
                  <div className="font-semibold mt-0.5 text-[10px] truncate uppercase">
                    {a.local_mode === "single" ? "Solo" : a.local_mode === "multi" ? "Network" : "Cloud"}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 text-xs">
                <span className="text-muted-foreground">
                  Joined {new Date(a.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() =>
                    setStatus.mutate({
                      id: a.id,
                      status: a.status === "active" ? "disabled" : "active",
                    })
                  }
                  className={`px-2 py-0.5 rounded-full ${a.status === "active" ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}
                >
                  {a.status}
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
