import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, Download, Filter, Search, Check } from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Responses } from "@/lib/api";
import { LoadingState, ErrorState } from "@/routes/templates";
import { toast } from "sonner";

export const Route = createFileRoute("/responses")({ component: ResponsesPage });

function ResponsesPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["responses"], queryFn: () => Responses.list(), refetchInterval: 10000 });
  const [q, setQ] = React.useState("");
  const [minRating, setMinRating] = React.useState(0); // 0 = any

  const all = data?.responses ?? [];
  const list = all.filter((r) => {
    if (minRating > 0 && (r.rating ?? 0) < minRating) return false;
    if (!q) return true;
    const needle = q.toLowerCase();
    return r.template.toLowerCase().includes(needle) || r.device.toLowerCase().includes(needle);
  });

  function exportCsv() {
    if (list.length === 0) return toast.error("Nothing to export");
    const header = ["id", "template", "device", "rating", "submitted_at", "duration_seconds"];
    const rows = list.map((r) => [
      r.id, esc(r.template), esc(r.device), r.rating ?? "",
      new Date(r.submitted_at).toISOString(), r.duration_seconds,
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `responses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} responses`);
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Responses"
        description="Real-time customer feedback across all paired devices."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-white/5 border-white/10">
                  <Filter className="size-4" /> Filter{minRating > 0 ? ` · ≥${minRating}★` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-strong border-white/10">
                <DropdownMenuLabel>Minimum rating</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <DropdownMenuItem key={n} onClick={() => setMinRating(n)}>
                    {n === 0 ? "Any rating" : `${n}★ or higher`}
                    {minRating === n && <Check className="size-3.5 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={exportCsv}><Download className="size-4" /> Export</Button>
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
            <GlassCard className="text-center text-muted-foreground py-10 text-sm">
              {all.length === 0 ? "No responses yet." : "No responses match your filters."}
            </GlassCard>
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

function esc(s: string) {
  if (s == null) return "";
  const needs = /[",\n]/.test(s);
  const v = s.replace(/"/g, '""');
  return needs ? `"${v}"` : v;
}
