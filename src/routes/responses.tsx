import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Star,
  Download,
  Search,
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
  Activity,
  CheckCircle,
  Database,
  History,
} from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Responses, Devices, Templates, ApiResponse } from "@/lib/api";
import { LoadingState, ErrorState } from "@/routes/templates";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/responses")({ component: ResponsesPage });

function ResponsesPage() {
  const responsesQ = useQuery({
    queryKey: ["responses"],
    queryFn: () => Responses.list(),
    refetchInterval: 10000,
  });

  const devicesQ = useQuery({
    queryKey: ["devices"],
    queryFn: () => Devices.list(),
    refetchInterval: 15000,
  });

  const templatesQ = useQuery({
    queryKey: ["templates"],
    queryFn: () => Templates.list(),
  });

  const [selectedDeviceId, setSelectedDeviceId] = React.useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<number | null>(null);
  const [q, setQ] = React.useState("");

  const allResponses = responsesQ.data?.responses ?? [];
  const devices = devicesQ.data?.devices ?? [];
  const templates = templatesQ.data?.templates ?? [];

  const isLoading = responsesQ.isLoading || devicesQ.isLoading || templatesQ.isLoading;
  const isError = responsesQ.isError || devicesQ.isError || templatesQ.isError;
  const errorObj = responsesQ.error || devicesQ.error || templatesQ.error;

  // 1. Calculate review counters for each device
  const deviceResponseCounts = React.useMemo(() => {
    const counts: Record<number, number> = {};
    allResponses.forEach((r) => {
      if (r.device_id) {
        counts[r.device_id] = (counts[r.device_id] || 0) + 1;
      }
    });
    return counts;
  }, [allResponses]);

  // 2. Calculate templates that have been linked/used by the selected device
  const deviceTemplates = React.useMemo(() => {
    if (selectedDeviceId === null) return [];
    const device = devices.find((d) => d.id === selectedDeviceId);
    const activeTemplateId = device?.template_id;

    // Map to track unique templates for this device
    const templatesMap = new Map<
      number,
      { id: number; name: string; isActive: boolean; responseCount: number }
    >();

    // Always include the current active template in the list if set on device
    if (activeTemplateId) {
      const activeTpl = templates.find((t) => t.id === activeTemplateId);
      templatesMap.set(activeTemplateId, {
        id: activeTemplateId,
        name: activeTpl?.name || `Template #${activeTemplateId}`,
        isActive: true,
        responseCount: 0,
      });
    }

    // Traverse responses to find any historical templates used by this device
    allResponses.forEach((r) => {
      if (r.device_id === selectedDeviceId && r.template_id) {
        const existing = templatesMap.get(r.template_id);
        if (existing) {
          existing.responseCount++;
        } else {
          templatesMap.set(r.template_id, {
            id: r.template_id,
            name: r.template || `Template #${r.template_id}`,
            isActive: r.template_id === activeTemplateId,
            responseCount: 1,
          });
        }
      }
    });

    return Array.from(templatesMap.values());
  }, [selectedDeviceId, devices, allResponses, templates]);

  // Auto-select the first device and its active template for convenience
  React.useEffect(() => {
    if (selectedDeviceId === null && devices.length > 0) {
      // Find the first device
      const firstDev = devices[0];
      setSelectedDeviceId(firstDev.id);

      // Auto-select active template if set
      if (firstDev.template_id) {
        setSelectedTemplateId(firstDev.template_id);
      }
    }
  }, [devices, selectedDeviceId]);

  // Reset selected template if we switch devices, and auto-select its active one if available
  const handleDeviceSelect = (devId: number) => {
    setSelectedDeviceId(devId);
    const dev = devices.find((d) => d.id === devId);
    if (dev?.template_id) {
      setSelectedTemplateId(dev.template_id);
    } else {
      setSelectedTemplateId(null);
    }
    setQ("");
  };

  // 3. Filter responses based on selected device, template, and search query
  const list = React.useMemo(() => {
    if (selectedDeviceId === null || selectedTemplateId === null) return [];
    return allResponses.filter((r) => {
      if (r.device_id !== selectedDeviceId || r.template_id !== selectedTemplateId) return false;

      if (q.trim()) {
        const needle = q.toLowerCase();
        const matchesSearch =
          r.template.toLowerCase().includes(needle) ||
          r.device.toLowerCase().includes(needle) ||
          (r.answers && JSON.stringify(r.answers).toLowerCase().includes(needle));
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [allResponses, selectedDeviceId, selectedTemplateId, q]);

  // Export responses specific to selected tablet + template
  function exportCsv() {
    if (list.length === 0) return toast.error("Nothing to export");
    const activeDevice = devices.find((d) => d.id === selectedDeviceId);
    const activeTpl = deviceTemplates.find((t) => t.id === selectedTemplateId);

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
    a.download = `responses-${activeDevice?.name || "device"}-${activeTpl?.name || "template"}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} responses to CSV`);
  }

  const selectedDeviceObj = devices.find((d) => d.id === selectedDeviceId);
  const selectedTemplateObj = deviceTemplates.find((t) => t.id === selectedTemplateId);

  return (
    <DashboardLayout>
      <PageHeader
        title="Responses Explorer"
        description="Browse structured review logs grouped by physical tablet terminal and template versions."
        actions={
          selectedDeviceObj &&
          selectedTemplateObj && (
            <Button onClick={exportCsv} disabled={list.length === 0}>
              <Download className="size-4" /> Export CSV
            </Button>
          )
        }
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={errorMessage(errorObj)} />}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Column 1: Devices list */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                1. Tablets
              </span>
              <Badge variant="secondary" className="bg-white/5 text-[10px] text-muted-foreground">
                {devices.length} paired
              </Badge>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {devices.length === 0 && (
                <GlassCard className="py-8 text-center text-xs text-muted-foreground italic">
                  No tablets paired. Go to Devices tab to pair one.
                </GlassCard>
              )}
              {devices.map((d) => {
                const isSelected = selectedDeviceId === d.id;
                const reviewCount = deviceResponseCounts[d.id] || 0;
                return (
                  <div
                    key={d.id}
                    onClick={() => handleDeviceSelect(d.id)}
                    className={cn(
                      "group p-3 rounded-2xl cursor-pointer border transition-all duration-200 select-none",
                      isSelected
                        ? "border-primary/30 bg-primary/[0.06] shadow-md shadow-primary/5"
                        : "border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.03]",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "size-8 rounded-xl grid place-items-center shrink-0 transition-colors",
                          isSelected ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        <Smartphone className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{d.name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="size-3 shrink-0" /> {d.location || "No location set"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5 text-[10px]">
                      <StatusIndicator status={d.status} />
                      <span className="text-muted-foreground font-medium flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded">
                        <MessageSquare className="size-2.5" /> {reviewCount} reviews
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Template History list */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                2. Template History
              </span>
              {selectedDeviceObj && (
                <Badge variant="secondary" className="bg-white/5 text-[10px] text-muted-foreground">
                  {deviceTemplates.length} templates
                </Badge>
              )}
            </div>
            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {selectedDeviceId === null ? (
                <GlassCard className="py-12 text-center text-xs text-muted-foreground italic flex flex-col items-center justify-center gap-2">
                  <Smartphone className="size-5 text-muted-foreground/30" />
                  Select a tablet to load its templates.
                </GlassCard>
              ) : deviceTemplates.length === 0 ? (
                <GlassCard className="py-12 text-center text-xs text-muted-foreground italic">
                  No templates recorded on this tablet yet.
                </GlassCard>
              ) : (
                deviceTemplates.map((t) => {
                  const isSelected = selectedTemplateId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTemplateId(t.id);
                        setQ("");
                      }}
                      className={cn(
                        "group p-3 rounded-2xl cursor-pointer border transition-all duration-200 select-none",
                        isSelected
                          ? "border-primary/30 bg-primary/[0.06] shadow-md shadow-primary/5"
                          : "border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.03]",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={cn(
                            "size-8 rounded-xl grid place-items-center shrink-0 transition-colors",
                            isSelected ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          <FileText className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm truncate">{t.name}</div>
                          <div className="flex items-center gap-1.5 mt-2">
                            {t.isActive ? (
                              <Badge className="bg-emerald-400/10 text-emerald-300 border border-emerald-400/20 text-[8px] px-1 py-0 uppercase tracking-wide">
                                Active Now
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-white/5 text-[8px] px-1 py-0 uppercase tracking-wide">
                                Past Version
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto bg-white/5 px-1.5 py-0.5 rounded">
                              {t.responseCount} reviews
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: Detailed Feedback Feed */}
          <div className="lg:col-span-4 xl:col-span-6 space-y-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              3. Detailed Survey Responses
            </div>

            {selectedDeviceId === null || selectedTemplateId === null ? (
              <GlassCard className="py-24 text-center text-xs text-muted-foreground italic flex flex-col items-center justify-center gap-3">
                <Database className="size-8 text-muted-foreground/20" />
                <div>
                  Select a tablet on the left and a template version from history to view responses.
                </div>
              </GlassCard>
            ) : (
              <div className="space-y-4">
                {/* Selected context header & search */}
                <GlassCard className="p-4 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        {selectedTemplateObj?.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Showing responses recorded on{" "}
                        <span className="text-foreground font-medium">
                          {selectedDeviceObj?.name}
                        </span>
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-white/5 text-xs">
                      {list.length} matches
                    </Badge>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search comments and raw answers..."
                      className="pl-9 bg-white/5 border-white/10 text-xs focus-visible:ring-primary/40"
                    />
                    {q && (
                      <button
                        onClick={() => setQ("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </GlassCard>

                {/* Responses scrollbox */}
                <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                  {list.length === 0 ? (
                    <GlassCard className="text-center text-muted-foreground py-16 text-sm">
                      {q.trim()
                        ? "No responses match your search text."
                        : "No responses recorded yet for this survey on this tablet."}
                    </GlassCard>
                  ) : (
                    list.map((r) => <ResponseDetailCard key={r.id} r={r} />
                  ))}
                </div>
              </div>
            )}
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

        {/* Short info */}
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 font-medium text-foreground">
              Review #{r.id}
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

function StatusIndicator({ status }: { status: "online" | "offline" | "syncing" }) {
  const map = {
    online: ["bg-emerald-400", "text-emerald-300", "Online"],
    offline: ["bg-rose-400", "text-rose-300", "Offline"],
    syncing: ["bg-amber-400", "text-amber-300", "Syncing"],
  } as const;
  const [dotCls, txtCls, label] = map[status] || ["bg-rose-400", "text-rose-300", "Offline"];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground select-none">
      <span className={cn("size-1.5 rounded-full", dotCls, status === "online" && "animate-pulse")} />
      <span className={txtCls}>{label}</span>
    </span>
  );
}

function esc(s: string) {
  if (s == null) return "";
  const needs = /[",\n]/.test(s);
  const v = s.replace(/"/g, '""');
  return needs ? `"${v}"` : v;
}

function errorMessage(e: unknown): string {
  if (e == null) return "An error occurred";
  if (e instanceof Error) return e.message;
  return String(e);
}
