import { createFileRoute } from "@tanstack/react-router";
import { Star, Download, Filter, Search } from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { responses } from "@/lib/mock-data";

export const Route = createFileRoute("/responses")({ component: ResponsesPage });

function ResponsesPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Responses"
        description="Real-time customer feedback across all paired tablets."
        actions={
          <>
            <Button variant="outline" className="bg-white/5 border-white/10"><Filter className="size-4" /> Filter</Button>
            <Button><Download className="size-4" /> Export</Button>
          </>
        }
      />

      <GlassCard className="p-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search responses, devices, comments…" className="pl-9 bg-white/5 border-white/10" />
        </div>
      </GlassCard>

      <div className="space-y-3">
        {responses.map((r) => (
          <GlassCard key={r.id} className="flex flex-wrap items-center gap-4 hover:bg-white/[0.07] transition-colors">
            <div className="flex items-center gap-0.5 shrink-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`size-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">{r.template}</div>
              <div className="text-xs text-muted-foreground">{r.device}</div>
            </div>
            {r.comment && (
              <div className="w-full lg:w-auto lg:flex-[2] text-sm text-muted-foreground italic">
                "{r.comment}"
              </div>
            )}
            <div className="text-right">
              <div className="text-sm">{r.submittedAt}</div>
              <div className="text-xs text-muted-foreground">{r.duration}</div>
            </div>
          </GlassCard>
        ))}
      </div>
    </DashboardLayout>
  );
}
