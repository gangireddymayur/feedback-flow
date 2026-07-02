import * as React from "react";
import { createFileRoute, Link, Outlet, useRouterState, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Trash2, Loader2, Power, PowerOff, Copy, Edit2 } from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Templates, ApiTemplate } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/templates")({ component: TemplatesPage });

function TemplatesPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [newCat, setNewCat] = React.useState("General");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setOpen(false);
    router.navigate({
      to: "/templates/builder",
      search: {
        name: newName,
        description: newDesc,
        category: newCat,
      },
    });
    setNewName("");
    setNewDesc("");
    setNewCat("General");
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["templates"],
    queryFn: () => Templates.list(),
  });
  const del = useMutation({
    mutationFn: (id: number) => Templates.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template deleted");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const updateStatus = useMutation({
    mutationFn: (args: { id: number; status: "active" | "inactive" }) =>
      Templates.update(args.id, { status: args.status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Status updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const update = useMutation({
    mutationFn: (t: ApiTemplate) =>
      Templates.update(t.id, {
        name: t.name,
        description: t.description,
        category: t.category,
        status: t.status,
        questions: t.questions ?? [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const dup = useMutation({
    mutationFn: (t: ApiTemplate) =>
      Templates.create({
        name: `${t.name} (copy)`,
        description: t.description,
        category: t.category,
        status: "draft",
        questions: t.questions ?? [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template duplicated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const templates = data?.templates ?? [];

  if (pathname !== "/templates") return <Outlet />;

  return (
    <DashboardLayout>
      <PageHeader
        title="Templates"
        description="Drag-and-drop review forms — unlimited questions, live preview."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New Template
          </Button>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-foreground">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Give your new feedback template a name and category to start designing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name" className="text-xs text-muted-foreground font-semibold">
                Template Name
              </Label>
              <Input
                id="tpl-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Cafe Dining Review"
                required
                className="bg-white/5 border-white/10 text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-cat" className="text-xs text-muted-foreground font-semibold">
                Category
              </Label>
              <select
                id="tpl-cat"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl h-9 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
              >
                <option value="General" className="bg-[#0d0f12]">General</option>
                <option value="F&B" className="bg-[#0d0f12]">F&B (Dining)</option>
                <option value="Retail" className="bg-[#0d0f12]">Retail / Shopping</option>
                <option value="Hospitality" className="bg-[#0d0f12]">Hospitality / Hotel</option>
                <option value="Services" className="bg-[#0d0f12]">Services / Salon</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc" className="text-xs text-muted-foreground font-semibold">
                Description (Optional)
              </Label>
              <Textarea
                id="tpl-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief description of this customer survey..."
                className="bg-white/5 border-white/10 text-xs min-h-16 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-white/5 pt-3 mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="h-8 text-xs border-white/10">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-8 text-xs font-semibold bg-primary hover:bg-primary/95 text-primary-foreground">
                Start Building
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={(error as Error).message} />}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <GlassCard
              key={t.id}
              className="group hover:bg-white/[0.07] transition-colors relative"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge
                      variant="secondary"
                      className="bg-white/5 text-[10px] uppercase tracking-wide"
                    >
                      {t.category}
                    </Badge>
                    <StatusBadge status={t.status} />
                    <Switch
                      checked={t.status === "active"}
                      onCheckedChange={(checked) =>
                        setStatusMut.mutate({
                          id: t.id,
                          status: checked ? "active" : "inactive",
                          t,
                        })
                      }
                      disabled={setStatusMut.isPending}
                      className="scale-75 cursor-pointer"
                    />
                  </div>
                  <h3 className="font-semibold tracking-tight truncate">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-strong border-white/10">
                    <DropdownMenuItem
                      onClick={() =>
                        setStatusMut.mutate({
                          id: t.id,
                          status: t.status === "active" ? "inactive" : "active",
                          t,
                        })
                      }
                    >
                      {t.status === "active" ? (
                        <>
                          <PowerOff className="size-3.5 mr-2" /> Deactivate
                        </>
                      ) : (
                        <>
                          <Power className="size-3.5 mr-2" /> Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => dup.mutate(t)}>
                      <Copy className="size-3.5 mr-2" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => del.mutate(t.id)}
                      className="text-rose-300 focus:text-rose-200"
                    >
                      <Trash2 className="size-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-white/5">
                <Stat label="Questions" value={(t.questions ?? []).length} />
                <Stat label="Updated" value={new Date(t.updated_at).toLocaleDateString()} />
              </div>

              <div className="flex items-center justify-end mt-4 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-primary hover:text-primary/80"
                  asChild
                  title="Edit Template in Builder"
                >
                  <Link to="/templates/builder" search={{ templateId: t.id }}>
                    <Edit2 className="size-3.5" />
                  </Link>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-rose-300 hover:text-rose-200"
                  onClick={() => del.mutate(t.id)}
                  title="Delete Template"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </GlassCard>
          ))}

          <Link
            to="/templates/builder"
            className="glass rounded-2xl p-5 border border-dashed border-white/10 grid place-items-center min-h-[220px] hover:bg-white/5 transition-colors"
          >
            <div className="text-center">
              <div className="size-12 rounded-2xl bg-white/5 grid place-items-center mx-auto mb-3">
                <Plus className="size-5 text-muted-foreground" />
              </div>
              <div className="font-medium">Create new template</div>
              <div className="text-xs text-muted-foreground mt-1">Open drag &amp; drop builder</div>
            </div>
          </Link>
        </div>
      )}
    </DashboardLayout>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "inactive" | "draft" }) {
  const map = {
    active: "bg-emerald-400/15 text-emerald-300 border-emerald-400/20",
    inactive: "bg-rose-400/15 text-rose-300 border-rose-400/20",
    draft: "bg-amber-400/15 text-amber-300 border-amber-400/20",
  } as const;
  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${map[status]}`}
    >
      {status}
    </span>
  );
}

export function LoadingState() {
  return (
    <GlassCard className="grid place-items-center py-16 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </GlassCard>
  );
}
export function ErrorState({ message }: { message: string }) {
  return (
    <GlassCard className="py-8 text-center border border-rose-400/20 bg-rose-500/5">
      <div className="text-sm font-medium text-rose-300">Couldn't load data</div>
      <div className="text-xs text-muted-foreground mt-1 break-all">{message}</div>
    </GlassCard>
  );
}
