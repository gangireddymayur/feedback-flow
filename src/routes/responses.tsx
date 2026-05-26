import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, Download, Filter, Search } from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Responses } from "@/lib/api";
import { LoadingState, ErrorState } from "@/routes/templates";

export const Route = createFileRoute("/responses")({ component: ResponsesPage });

function ResponsesPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["responses"], queryFn: () => Responses.list(), refetchInterval: 10000 });
  const [q, setQ] = React.useState("");
  const list = (data?.responses ?? []).filter((r) =>
    !q || r.template.toLowerCase().includes(q.toLowerCase()) || r.device.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Responses"
        description="Real-time customer feedback across all paired devices."
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search responses, devices…" className="pl-9 bg-white/5 border-white/10" />
        </div>
      </GlassCard>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={(error as Error).message} />}

      {!isLoading && !error && (
        <div className="space-y-3">
          {list.length === 0 && (
            <GlassCard className="text-center text-muted-foreground py-10 text-sm">No responses yet.</GlassCard>
          )}
          {list.map((r) => {
            const rating = r.rating ?? 0;
            return (
              <GlassCard key={r.id} className="flex flex-wrap items-center gap-4 hover:bg-white/[0.07] transition-colors">
                <div className="flex items-center gap-0.5 shrink-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`size-4 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{r.template}</div>
                  <div className="text-xs text-muted-foreground">{r.device}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{new Date(r.submitted_at).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{r.duration_seconds}s</div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
