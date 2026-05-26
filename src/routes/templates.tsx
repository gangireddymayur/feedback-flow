import { createFileRoute } from "@tanstack/react-router";
import { Plus, MoreHorizontal, Copy, Eye, Power } from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { templates } from "@/lib/mock-data";

export const Route = createFileRoute("/templates")({ component: TemplatesPage });

function TemplatesPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Templates"
        description="Drag-and-drop review forms — unlimited questions, conditional logic, live preview."
        actions={
          <Button>
            <Plus className="size-4" /> New Template
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t) => (
          <GlassCard key={t.id} className="group hover:bg-white/[0.07] transition-colors cursor-pointer relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="secondary" className="bg-white/5 text-[10px] uppercase tracking-wide">
                    {t.category}
                  </Badge>
                  <StatusBadge status={t.status} />
                </div>
                <h3 className="font-semibold tracking-tight truncate">{t.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
              </div>
              <Button size="icon" variant="ghost" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/5">
              <Stat label="Questions" value={t.questions} />
              <Stat label="Responses" value={t.responses.toLocaleString()} />
              <Stat label="Tablets" value={t.assignedTablets} />
            </div>

            <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
              <span>Updated {t.updatedAt}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="size-7"><Eye className="size-3.5" /></Button>
                <Button size="icon" variant="ghost" className="size-7"><Copy className="size-3.5" /></Button>
                <Button size="icon" variant="ghost" className="size-7"><Power className="size-3.5" /></Button>
              </div>
            </div>
          </GlassCard>
        ))}

        <GlassCard className="border-dashed border-white/10 grid place-items-center min-h-[220px] cursor-pointer hover:bg-white/5 transition-colors">
          <div className="text-center">
            <div className="size-12 rounded-2xl bg-white/5 grid place-items-center mx-auto mb-3">
              <Plus className="size-5 text-muted-foreground" />
            </div>
            <div className="font-medium">Create new template</div>
            <div className="text-xs text-muted-foreground mt-1">Start from scratch or clone existing</div>
          </div>
        </GlassCard>
      </div>
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
    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${map[status]}`}>
      {status}
    </span>
  );
}
