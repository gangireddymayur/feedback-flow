import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Star,
  Download,
  Filter,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Smartphone,
  FileText,
  MapPin,
  X,
  MessageSquare,
  Sparkles,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Responses, ApiResponse } from "@/lib/api";
import { LoadingState, ErrorState } from "@/routes/templates";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/responses")({ component: ResponsesPage });

function ResponsesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["responses"],
    queryFn: () => Responses.list(),
    refetchInterval: 10000,
  });

  const [q, setQ] = React.useState("");
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>("all");
  const [selectedDevice, setSelectedDevice] = React.useState<string>("all");
  const [minRating, setMinRating] = React.useState<number>(0); // 0 = any

  const all = data?.responses ?? [];

  // Derived filter lists
  const templatesList = React.useMemo(() => {
    const set = new Set<string>();
    all.forEach((r) => {
      if (r.template) set.add(r.template);
    });
    return Array.from(set);
  }, [all]);

  const devicesList = React.useMemo(() => {
    const set = new Set<string>();
    all.forEach((r) => {
      if (r.device) set.add(r.device);
    });
    return Array.from(set);
  }, [all]);

  // Apply filters
  const list = React.useMemo(() => {
    return all.filter((r) => {
      if (minRating > 0 && (r.rating ?? 0) < minRating) return false;
      if (selectedTemplate !== "all" && r.template !== selectedTemplate) return false;
      if (selectedDevice !== "all" && r.device !== selectedDevice) return false;

      if (q.trim()) {
        const needle = q.toLowerCase();
        const matchesBasic =
          r.template.toLowerCase().includes(needle) ||
          r.device.toLowerCase().includes(needle) ||
          (r.answers && JSON.stringify(r.answers).toLowerCase().includes(needle));
        if (!matchesBasic) return false;
      }
      return true;
    });
  }, [all, q, selectedTemplate, selectedDevice, minRating]);

  // Calculate live stats based on the filtered list
  const stats = React.useMemo(() => {
    const total = list.length;
    const ratings = list.map((r) => r.rating ?? 0).filter((n) => n > 0);
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    const durations = list.map((r) => r.duration_seconds).filter((d) => d > 0);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // NPS score calculation
    const promoters = ratings.filter((r) => r >= 5).length;
    const detractors = ratings.filter((r) => r <= 3).length;
    const nps = ratings.length ? Math.round(((promoters - detractors) / ratings.length) * 100) : 0;

    return {
      total,
      avgRating,
      avgDuration,
      nps,
      totalRatings: ratings.length,
      promoters,
      detractors,
    };
  }, [list]);

  const hasActiveFilters =
    q !== "" || selectedTemplate !== "all" || selectedDevice !== "all" || minRating !== 0;

  const resetFilters = () => {
    setQ("");
    setSelectedTemplate("all");
    setSelectedDevice("all");
    setMinRating(0);
    toast.info("Filters cleared");
  };

  function exportCsv() {
    if (list.length === 0) return toast.error("Nothing to export");
    const header = [
      "id",
      "template",
      "device",
      "rating",
      "submitted_at",
      "duration_seconds",
      "answers_json",
    ];
    const rows = list.map((r) =>
      [
        r.id,
        esc(r.template),
        esc(r.device),
        r.rating ?? "",
        new Date(r.submitted_at).toISOString(),
        r.duration_seconds,
        esc(JSON.stringify(r.answers || {})),
      ].join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `responses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} responses to CSV`);
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Responses"
        description="Browse detailed customer answers, monitor feedback trends, and export responses."
        actions={
          <div className="flex flex-wrap gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={resetFilters}
                className="text-xs text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                <X className="size-3.5 mr-1" /> Clear Filters
              </Button>
            )}
            <Button onClick={exportCsv} disabled={list.length === 0}>
              <Download className="size-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={(error as Error).message} />}

      {!isLoading && !error && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard className="relative overflow-hidden">
              <div className="absolute -top-8 -right-8 size-24 rounded-full bg-primary/10 blur-2xl" />
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <MessageSquare className="size-3.5" /> Total Responses
              </div>
              <div className="text-2xl lg:text-3xl font-semibold tracking-tight mt-2 text-primary">
                {stats.total.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {all.length !== stats.total ? `${all.length} total raw responses` : "across all paired terminals"}
              </div>
            </GlassCard>

            <GlassCard className="relative overflow-hidden">
              <div className="absolute -top-8 -right-8 size-24 rounded-full bg-emerald-400/10 blur-2xl" />
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Star className="size-3.5 text-emerald-300" /> Avg. Rating
              </div>
              <div className="text-2xl lg:text-3xl font-semibold tracking-tight mt-2 text-emerald-300">
                {stats.avgRating ? `${stats.avgRating.toFixed(1)} ★` : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {stats.totalRatings > 0 ? `based on ${stats.totalRatings} ratings` : "no ratings logged"}
              </div>
            </GlassCard>

            <GlassCard className="relative overflow-hidden">
              <div className="absolute -top-8 -right-8 size-24 rounded-full bg-indigo-400/10 blur-2xl" />
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Sparkles className="size-3.5 text-indigo-300" /> Net Promoter Score (NPS)
              </div>
              <div className="text-2xl lg:text-3xl font-semibold tracking-tight mt-2 text-indigo-300">
                {stats.totalRatings > 0 ? stats.nps : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {stats.totalRatings > 0
                  ? `Promoters: ${stats.promoters} · Detractors: ${stats.detractors}`
                  : "requires star responses"}
              </div>
            </GlassCard>

            <GlassCard className="relative overflow-hidden">
              <div className="absolute -top-8 -right-8 size-24 rounded-full bg-amber-400/10 blur-2xl" />
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Clock className="size-3.5 text-amber-300" /> Avg. Duration
              </div>
              <div className="text-2xl lg:text-3xl font-semibold tracking-tight mt-2 text-amber-300">
                {stats.avgDuration ? `${stats.avgDuration}s` : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                time elapsed from start to submit
              </div>
            </GlassCard>
          </div>

          {/* Filters Bar */}
          <GlassCard className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search comments, devices..."
                  className="pl-9 bg-white/5 border-white/10 text-sm focus-visible:ring-primary/40"
                />
              </div>

              {/* Template Select */}
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="bg-white/5 border-white/10 text-sm h-10">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="All Templates" />
                  </div>
                </SelectTrigger>
                <SelectContent className="glass-strong border-white/10">
                  <SelectItem value="all">All Templates</SelectItem>
                  {templatesList.map((tpl) => (
                    <SelectItem key={tpl} value={tpl}>
                      {tpl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Device Select */}
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger className="bg-white/5 border-white/10 text-sm h-10">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Smartphone className="size-4 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="All Devices" />
                  </div>
                </SelectTrigger>
                <SelectContent className="glass-strong border-white/10">
                  <SelectItem value="all">All Devices</SelectItem>
                  {devicesList.map((dev) => (
                    <SelectItem key={dev} value={dev}>
                      {dev}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Rating Select */}
              <Select value={String(minRating)} onValueChange={(val) => setMinRating(Number(val))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-sm h-10">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Star className="size-4 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Any Rating" />
                  </div>
                </SelectTrigger>
                <SelectContent className="glass-strong border-white/10">
                  <SelectItem value="0">Any Rating</SelectItem>
                  <SelectItem value="5">5★ Only</SelectItem>
                  <SelectItem value="4">4★ or higher</SelectItem>
                  <SelectItem value="3">3★ or higher</SelectItem>
                  <SelectItem value="2">2★ or higher</SelectItem>
                  <SelectItem value="1">1★ or higher</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </GlassCard>

          {/* Responses List */}
          <div className="space-y-3">
            {list.length === 0 && (
              <GlassCard className="text-center text-muted-foreground py-16 text-sm">
                {all.length === 0
                  ? "No responses recorded yet."
                  : "No responses match your search or filters."}
              </GlassCard>
            )}

            {list.map((r) => (
              <ResponseDetailCard key={r.id} r={r} />
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// Sub-component for individual expandable response cards
function ResponseDetailCard({ r }: { r: ApiResponse }) {
  const [expanded, setExpanded] = React.useState(false);
  const answers = r.answers || {};
  const questions = r.template_questions || [];

  // Parse any text feedback out for a quick preview bubble
  const textFeedbackList = React.useMemo(() => {
    const list: Array<{ label: string; text: string }> = [];

    // Search template question mappings for text content
    questions.forEach((q) => {
      const val = answers[q.id];
      if (
        val &&
        typeof val === "string" &&
        val.trim() &&
        (q.type === "short_text" || q.type === "long_text")
      ) {
        list.push({ label: q.label, text: val });
      }
    });

    // Check fallback/legacy 'comment' field in answers
    if (answers.comment && typeof answers.comment === "string" && answers.comment.trim()) {
      const hasComment = list.some((item) => item.text === answers.comment);
      if (!hasComment) {
        list.push({ label: "Comment", text: answers.comment });
      }
    }

    return list;
  }, [questions, answers]);

  // Identify any extra fields not defined in the template questions
  const extraAnswers = React.useMemo(() => {
    const extra: Array<{ key: string; value: any }> = [];
    const questionIds = new Set(questions.map((q) => q.id));

    Object.entries(answers).forEach(([k, v]) => {
      if (questionIds.has(k)) return;
      if (k === "comment" && textFeedbackList.some((item) => item.label === "Comment")) return;
      if (v != null && String(v).trim()) {
        extra.push({ key: k, value: v });
      }
    });
    return extra;
  }, [answers, questions, textFeedbackList]);

  // Renders beautiful inline formatted answers
  const renderAnswerValue = (qType: string, val: any, options?: string[]) => {
    if (val == null) return null;

    switch (qType) {
      case "rating": {
        const score = Number(val) || 0;
        return (
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Star
                key={idx}
                className={cn(
                  "size-4",
                  idx < score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
                )}
              />
            ))}
          </div>
        );
      }

      case "nps": {
        const score = Number(val);
        let badgeColor = "bg-rose-400/15 text-rose-300 border-rose-400/20";
        if (score >= 9) {
          badgeColor = "bg-emerald-400/15 text-emerald-300 border-emerald-400/20";
        } else if (score >= 7) {
          badgeColor = "bg-amber-400/15 text-amber-300 border-amber-400/20";
        }
        return (
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", badgeColor)}>
            NPS Score: {score} / 10
          </span>
        );
      }

      case "emoji": {
        const valStr = String(val);
        const emojiMap: Record<string, string> = {
          "1": "😡 Very Unsatisfied",
          "2": "😕 Unsatisfied",
          "3": "😐 Neutral",
          "4": "🙂 Satisfied",
          "5": "😍 Extremely Satisfied",
          "😡": "😡 Very Unsatisfied",
          "😕": "😕 Unsatisfied",
          "😐": "😐 Neutral",
          "🙂": "🙂 Satisfied",
          "😍": "😍 Extremely Satisfied",
        };
        const label = emojiMap[valStr] || valStr;
        return <span className="text-sm font-medium text-amber-200">{label}</span>;
      }

      case "yes_no": {
        const yes = String(val).toLowerCase() === "yes" || val === true || String(val) === "1";
        return (
          <Badge
            variant="secondary"
            className={cn(
              "text-xs px-2 py-0.5 font-medium border",
              yes
                ? "bg-emerald-400/10 text-emerald-300 border-emerald-400/20"
                : "bg-rose-400/10 text-rose-300 border-rose-400/20",
            )}
          >
            {yes ? "Yes" : "No"}
          </Badge>
        );
      }

      case "single_choice":
      case "multiple_choice": {
        const vals = Array.isArray(val)
          ? val
          : typeof val === "string"
            ? val.split(",").map((v) => v.trim())
            : [String(val)];
        return (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {vals.map((v, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="bg-white/5 border-white/10 text-xs py-0.5 px-2 font-normal"
              >
                {v}
              </Badge>
            ))}
          </div>
        );
      }

      case "short_text":
      case "long_text":
      default:
        return (
          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-sm text-foreground/90 max-w-xl italic whitespace-pre-wrap leading-relaxed shadow-sm">
            "{val}"
          </div>
        );
    }
  };

  return (
    <GlassCard
      onClick={() => setExpanded(!expanded)}
      className={cn(
        "cursor-pointer hover:bg-white/[0.04] transition-all border duration-200",
        expanded ? "border-primary/20 bg-white/[0.03] shadow-lg" : "border-white/5 bg-white/[0.01]",
      )}
    >
      <div className="flex items-center gap-4 flex-wrap select-none w-full">
        {/* Main score rating */}
        <div className="flex items-center gap-0.5 shrink-0 w-24">
          {r.rating ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <Star
                key={idx}
                className={cn(
                  "size-4",
                  idx < (r.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
                )}
              />
            ))
          ) : (
            <HelpCircle className="size-4 text-muted-foreground/30" />
          )}
        </div>

        {/* Template info */}
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-sm truncate text-foreground flex items-center gap-2">
            <span>{r.template}</span>
            {textFeedbackList.length > 0 && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] px-1.5 py-0 uppercase font-bold tracking-wider rounded">
                Comment
              </Badge>
            )}
          </h4>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <span className="flex items-center gap-1">
              <Smartphone className="size-3 text-muted-foreground/75" /> {r.device}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3 text-muted-foreground/75" /> Completed in {r.duration_seconds}s
            </span>
          </div>
        </div>

        {/* Timestamp & Accordion state */}
        <div className="flex items-center gap-4 ml-auto shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium text-foreground/90">
              {new Date(r.submitted_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {new Date(r.submitted_at).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full border border-white/5 bg-white/5 hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Scannable one-line text feedback summary (when collapsed) */}
      {!expanded && textFeedbackList.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground/80 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 italic truncate max-w-4xl">
          "{textFeedbackList[0].text}"
        </div>
      )}

      {/* Detailed Expanded Q&A Panel */}
      {expanded && (
        <div
          className="mt-4 pt-4 border-t border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-4">
            {questions.length === 0 && textFeedbackList.length === 0 && extraAnswers.length === 0 && (
              <div className="text-xs text-muted-foreground italic py-2">
                No detailed answers recorded for this response.
              </div>
            )}

            {/* Render matched template questions */}
            {questions.map((q, idx) => {
              const val = answers[q.id];
              if (val == null || String(val).trim() === "") return null;
              return (
                <div key={q.id} className="space-y-1.5">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 select-none">
                    <span>
                      Q{idx + 1}: {q.label}
                    </span>
                    {q.required && (
                      <Badge className="bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[8px] px-1 py-0 uppercase">
                        Required
                      </Badge>
                    )}
                  </div>
                  <div className="pl-0.5">{renderAnswerValue(q.type, val, q.options)}</div>
                </div>
              );
            })}

            {/* Render unmatched legacy comments (fallback logic) */}
            {questions.length === 0 &&
              textFeedbackList.map((feedback, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                    {feedback.label}
                  </div>
                  <div className="pl-0.5">{renderAnswerValue("long_text", feedback.text)}</div>
                </div>
              ))}

              {/* Render unmapped custom metadata fields */}
              {extraAnswers.map(({ key, value }) => (
                <div key={key} className="space-y-1.5">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                    {key.replace(/_/g, " ").toUpperCase()}
                  </div>
                  <div className="pl-0.5">
                    {typeof value === "object" ? (
                      <pre className="text-xs bg-white/5 p-2.5 rounded border border-white/5 overflow-auto text-foreground/80 font-mono">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    ) : (
                      renderAnswerValue("short_text", value)
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function esc(s: string) {
  if (s == null) return "";
  const needs = /[",\n]/.test(s);
  const v = s.replace(/"/g, '""');
  return needs ? `"${v}"` : v;
}
