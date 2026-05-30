import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Mail, Copy, Power, PowerOff } from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Admins } from "@/lib/api";
import { LoadingState, ErrorState } from "@/routes/templates";
import { toast } from "sonner";

export const Route = createFileRoute("/admins")({ component: AdminsPage });

function AdminsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["admins"], queryFn: () => Admins.list() });
  const admins = data?.admins ?? [];

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", password: "" });
  const create = useMutation({
    mutationFn: () => Admins.create({ ...form, role: "sub" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admins"] }); toast.success("Admin invited"); setOpen(false); setForm({ name: "", email: "", password: "" }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "active" | "disabled" }) => Admins.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admins"] }),
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Sub Admins"
        description="Create, disable, and monitor admin accounts across the platform."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> Invite Admin</Button></DialogTrigger>
            <DialogContent className="glass-strong border-white/10 sm:max-w-md">
              <DialogHeader><DialogTitle>Invite a Sub Admin</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <Label>Name</Label>
                <Input className="bg-white/5 border-white/10" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Label>Email</Label>
                <Input type="email" className="bg-white/5 border-white/10" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Label>Temporary password</Label>
                <Input type="password" className="bg-white/5 border-white/10" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <DialogFooter>
                <Button className="w-full" disabled={create.isPending || !form.email || form.password.length < 8} onClick={() => create.mutate()}>
                  {create.isPending ? "Creating…" : "Create admin"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={(error as Error).message} />}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {admins.length === 0 && <GlassCard className="text-sm text-muted-foreground">No sub admins yet.</GlassCard>}
          {admins.map((a) => (
            <GlassCard key={a.id} className="hover:bg-white/[0.07] transition-colors">
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-2xl bg-gradient-to-br from-cyan-400/40 to-fuchsia-400/40 grid place-items-center font-semibold">
                  {a.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate">
                    <Mail className="size-3" /> {a.email}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-white/5">
                <div><div className="text-[10px] uppercase text-muted-foreground">Devices</div><div className="font-semibold mt-0.5">{a.devices}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Templates</div><div className="font-semibold mt-0.5">{a.templates}</div></div>
              </div>
              <div className="flex items-center justify-between mt-4 text-xs">
                <span className="text-muted-foreground">Joined {new Date(a.created_at).toLocaleDateString()}</span>
                <button
                  onClick={() => setStatus.mutate({ id: a.id, status: a.status === "active" ? "disabled" : "active" })}
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
