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
  HelpCircle,
  Database,
  History,
  ArrowUpRight,
  Filter,
  User,
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

type ViewMode = "explorer" | "fullscreen";

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

  const [selectedDeviceId, setSelectedDeviceId] = React.useState<number | "all">("all");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<number | "all">("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("explorer");
  const [q, setQ] = React.useState("");
  const [dynamicFilters, setDynamicFilters] = React.useState<Record<string, string>>({});

  const allResponses = responsesQ.data?.responses ?? [];
  const devices = devicesQ.data?.devices ?? [];
  const templates = templatesQ.data?.templates ?? [];

  const isLoading = responsesQ.isLoading || devicesQ.isLoading || templatesQ.isLoading;
  const isError = responsesQ.isError || devicesQ.isError || templatesQ.isError;
  const errorObj = responsesQ.error || devicesQ.error || templatesQ.error;

  // Clear dynamic filters when selected tablet or template changes
  React.useEffect(() => {
    setDynamicFilters({});
  }, [selectedDeviceId, selectedTemplateId]);

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
    const templatesMap = new Map<
      number | "all",
      { id: number | "all"; name: string; isActive: boolean; responseCount: number }
    >();

    templatesMap.set("all", {
      id: "all",
      name: "All Templates",
      isActive: selectedTemplateId === "all",
      responseCount: allResponses.length,
    });

    if (selectedDeviceId === "all") {
      allResponses.forEach((r) => {
        if (r.template_id) {
          const existing = templatesMap.get(r.template_id);
          if (existing) {
            existing.responseCount++;
          } else {
            templatesMap.set(r.template_id, {
              id: r.template_id,
              name: r.template || `Template #${r.template_id}`,
              isActive: r.template_id === selectedTemplateId,
              responseCount: 1,
            });
          }
        }
      });
      return Array.from(templatesMap.values());
    }

    const device = devices.find((d) => d.id === selectedDeviceId);
    const activeTemplateId = device?.template_id;

    if (activeTemplateId) {
      const activeTpl = templates.find((t) => t.id === activeTemplateId);
      templatesMap.set(activeTemplateId, {
        id: activeTemplateId,
        name: activeTpl?.name || `Template #${activeTemplateId}`,
        isActive: activeTemplateId === selectedTemplateId,
        responseCount: 0,
      });
    }

    allResponses.forEach((r) => {
      if (r.device_id === selectedDeviceId && r.template_id) {
        const existing = templatesMap.get(r.template_id);
        if (existing) {
          existing.responseCount++;
        } else {
          templatesMap.set(r.template_id, {
            id: r.template_id,
            name: r.template || `Template #${r.template_id}`,
            isActive: r.template_id === selectedTemplateId,
            responseCount: 1,
          });
        }
      }
    });

    return Array.from(templatesMap.values());
  }, [selectedDeviceId, devices, allResponses, templates, selectedTemplateId]);

  // Resolve dynamic questions list for the selected template
  const selectedTemplateQuestions = React.useMemo(() => {
    if (selectedTemplateId === "all") {
      // Gather all distinct questions from all templates/responses
      const questionsMap = new Map<string, any>();
      templates.forEach((t) => {
        t.questions?.forEach((q) => questionsMap.set(q.id, q));
      });
      allResponses.forEach((r) => {
        r.template_questions?.forEach((q) => questionsMap.set(q.id, q));
      });
      return Array.from(questionsMap.values());
    }

    // Look up in loaded templates list first
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (tpl?.questions && tpl.questions.length > 0) {
      return tpl.questions;
    }

    // Fallback: look up in responses list for a matching response template
    const match = allResponses.find((r) => r.template_id === selectedTemplateId);
    return match?.template_questions || [];
  }, [selectedTemplateId, templates, allResponses]);

  const handleDeviceSelect = (devId: number) => {
    setSelectedDeviceId(devId);
    const dev = devices.find((d) => d.id === devId);
    if (dev?.template_id) {
      setSelectedTemplateId(dev.template_id);
    } else {
      setSelectedTemplateId(null);
    }
    setQ("");
    setDynamicFilters({});
  };

  // 3. Filter responses based on selected device, template, search query, and dynamic filters
  const list = React.useMemo(() => {
    return allResponses.filter((r) => {
      if (selectedDeviceId !== "all" && r.device_id !== selectedDeviceId) return false;
      if (selectedTemplateId !== "all" && r.template_id !== selectedTemplateId) return false;

      // Text search match
      if (q.trim()) {
        const needle = q.toLowerCase();
        const matchesSearch =
          (r.template || "").toLowerCase().includes(needle) ||
          (r.device || "").toLowerCase().includes(needle) ||
          (r.answers && JSON.stringify(r.answers).toLowerCase().includes(needle));
        if (!matchesSearch) return false;
      }

      // Dynamic question-level filters
      for (const [qId, filterVal] of Object.entries(dynamicFilters)) {
        if (filterVal === "all") continue;

        const ans = r.answers?.[qId];
        const qDef = selectedTemplateQuestions.find((qt) => qt.id === qId);
        if (!qDef) continue;

        if (ans === undefined || ans === null) return false;

        // Star Ratings
        if (qDef.type === "rating") {
          if (String(ans) !== filterVal) return false;
        }
        // NPS score ranges
        else if (qDef.type === "nps") {
          const score = Number(ans);
          if (filterVal === "promoters") {
            if (score < 9) return false;
          } else if (filterVal === "passives") {
            if (score !== 7 && score !== 8) return false;
          } else if (filterVal === "detractors") {
            if (score > 6) return false;
          } else {
            if (String(score) !== filterVal) return false;
          }
        }
        // Emojis options
        else if (qDef.type === "emoji") {
          const ansStr = String(ans).trim();
          if (filterVal === "5" && ansStr !== "5" && ansStr !== "😍") return false;
          if (filterVal === "4" && ansStr !== "4" && ansStr !== "🙂") return false;
          if (filterVal === "3" && ansStr !== "3" && ansStr !== "😐") return false;
          if (filterVal === "2" && ansStr !== "2" && ansStr !== "😕") return false;
          if (filterVal === "1" && ansStr !== "1" && ansStr !== "😡") return false;
        }
        // Yes / No values
        else if (qDef.type === "yes_no") {
          const ansStr = String(ans).toLowerCase();
          const yes = ansStr === "yes" || ans === true || ansStr === "1";
          const filterYes = filterVal === "yes";
          if (yes !== filterYes) return false;
        }
        // Choice selection options
        else if (qDef.type === "single_choice" || qDef.type === "multiple_choice") {
          if (Array.isArray(ans)) {
            if (!ans.includes(filterVal)) return false;
          } else {
            const ansStr = String(ans);
            if (!ansStr.includes(filterVal)) return false;
          }
        }
      }

      return true;
    });
  }, [
    allResponses,
    selectedDeviceId,
    selectedTemplateId,
    q,
    dynamicFilters,
    selectedTemplateQuestions,
  ]);

  const hasActiveFilters = q !== "" || Object.values(dynamicFilters).some((v) => v !== "all");

  const resetFilters = () => {
    setQ("");
    setDynamicFilters({});
    toast.info("All filters cleared");
  };

  const handleDynamicFilterChange = (qId: string, val: string) => {
    setDynamicFilters((prev) => ({
      ...prev,
      [qId]: val,
    }));
  };

  function exportCsv() {
    if (list.length === 0) return toast.error("Nothing to export");
    const activeDevice = selectedDeviceId === "all" ? { name: "All Tablets" } : devices.find((d) => d.id === selectedDeviceId);
    const activeTpl = selectedTemplateId === "all" ? { name: "All Templates" } : deviceTemplates.find((t) => t.id === selectedTemplateId);

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
        esc(r.template || ""),
        esc(r.device || "Unpaired Terminal"),
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

  const selectedDeviceObj = selectedDeviceId === "all" ? { name: "All Tablets" } : devices.find((d) => d.id === selectedDeviceId);
  const selectedTemplateObj = selectedTemplateId === "all" ? { name: "All Templates" } : deviceTemplates.find((t) => t.id === selectedTemplateId);

  // Renders dynamic selector dropdowns for the selected template's questions
  const renderDynamicFilters = () => {
    if (selectedTemplateQuestions.length === 0) return null;

    // Filter out text/unfilterable types
    const filterableQuestions = selectedTemplateQuestions.filter(
      (q) => !["short_text", "long_text"].includes(q.type),
    );

    if (filterableQuestions.length === 0) return null;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/5">
        {filterableQuestions.map((qItem) => {
          const currentVal = dynamicFilters[qItem.id] || "all";
          return (
            <div key={qItem.id} className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block truncate select-none">
                {qItem.label}
              </label>
              <select
                value={currentVal}
                onChange={(e) => handleDynamicFilterChange(qItem.id, e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-xs rounded-xl h-8 px-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              >
                <option value="all" className="bg-popover text-foreground">
                  Any
                </option>
                {qItem.type === "rating" && (
                  <>
                    <option value="5" className="bg-popover text-foreground">
                      5 Stars
                    </option>
                    <option value="4" className="bg-popover text-foreground">
                      4 Stars
                    </option>
                    <option value="3" className="bg-popover text-foreground">
                      3 Stars
                    </option>
                    <option value="2" className="bg-popover text-foreground">
                      2 Stars
                    </option>
                    <option value="1" className="bg-popover text-foreground">
                      1 Star
                    </option>
                  </>
                )}
                {qItem.type === "nps" && (
                  <>
                    <option value="promoters" className="bg-popover text-foreground">
                      9-10 (Promoter)
                    </option>
                    <option value="passives" className="bg-popover text-foreground">
                      7-8 (Passive)
                    </option>
                    <option value="detractors" className="bg-popover text-foreground">
                      0-6 (Detractor)
                    </option>
                    {Array.from({ length: 11 }).map((_, n) => (
                      <option key={n} value={String(n)} className="bg-popover text-foreground">
                        Score: {n}
                      </option>
                    ))}
                  </>
                )}
                {qItem.type === "emoji" && (
                  <>
                    <option value="5" className="bg-popover text-foreground">
                      😍 Extremely Satisfied
                    </option>
                    <option value="4" className="bg-popover text-foreground">
                      🙂 Satisfied
                    </option>
                    <option value="3" className="bg-popover text-foreground">
                      😐 Neutral
                    </option>
                    <option value="2" className="bg-popover text-foreground">
                      😕 Unsatisfied
                    </option>
                    <option value="1" className="bg-popover text-foreground">
                      😡 Very Unsatisfied
                    </option>
                  </>
                )}
                {qItem.type === "yes_no" && (
                  <>
                    <option value="yes" className="bg-popover text-foreground">
                      Yes
                    </option>
                    <option value="no" className="bg-popover text-foreground">
                      No
                    </option>
                  </>
                )}
                {(qItem.type === "single_choice" || qItem.type === "multiple_choice") &&
                  (qItem.options ?? []).map((opt) => (
                    <option key={opt} value={opt} className="bg-popover text-foreground">
                      {opt}
                    </option>
                  ))}
              </select>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={viewMode === "fullscreen" ? "Responses Explorer (Full View)" : "Responses Explorer"}
        description="Browse structured review logs grouped by physical tablet terminal and template versions."
        actions={
          viewMode === "explorer" &&
          selectedDeviceObj &&
          selectedTemplateObj && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="bg-white/5 border-white/10"
                onClick={() => setViewMode("fullscreen")}
              >
                <ArrowUpRight className="size-4 mr-1" /> Full View
              </Button>
              <Button onClick={exportCsv} disabled={list.length === 0}>
                <Download className="size-4" /> Export CSV
              </Button>
            </div>
          )
        }
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={errorMessage(errorObj)} />}

      {!isLoading && !isError && (
        <>
          {viewMode === "fullscreen" ? (
            /* FULLSCREEN LAYOUT */
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Breadcrumbs / Mode selector bar */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setViewMode("explorer")}
                    className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium"
                  >
                    <History className="size-3.5" /> Explorer
                  </button>
                  <span className="text-muted-foreground/35 select-none">/</span>
                  <span className="text-muted-foreground flex items-center gap-1 select-none">
                    <Smartphone className="size-3.5" /> {selectedDeviceObj?.name}
                  </span>
                  <span className="text-muted-foreground/35 select-none">/</span>
                  <span className="text-foreground font-semibold flex items-center gap-1 select-none">
                    <FileText className="size-3.5 text-primary" /> {selectedTemplateObj?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="bg-white/5 border-white/10 text-xs h-8"
                    onClick={() => setViewMode("explorer")}
                  >
                    <X className="size-3.5 mr-1" /> Exit Full View
                  </Button>
                  <Button onClick={exportCsv} disabled={list.length === 0} className="text-xs h-8">
                    <Download className="size-3.5 mr-1" /> Export CSV
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* Fullscreen Filters Left panel */}
                <div className="xl:col-span-4 space-y-4">
                  <GlassCard className="p-4 space-y-4 border border-white/10 bg-white/[0.02]">
                    <div>
                      <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        <Filter className="size-3.5 text-primary" /> Advanced Filters
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Refining {list.length} matches
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block select-none">
                          Text Search
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search comments and answers..."
                            className="pl-9 bg-white/5 border-white/10 text-xs focus-visible:ring-primary/40 h-8"
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
                      </div>

                      {/* Render dynamic question selects */}
                      {renderDynamicFilters()}
                    </div>

                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        onClick={resetFilters}
                        className="w-full text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/5 h-8 border border-dashed border-rose-500/20"
                      >
                        <X className="size-3.5 mr-1" /> Clear All Filters
                      </Button>
                    )}
                  </GlassCard>
                </div>

                {/* Fullscreen Feed Right Panel (No height constraint except screen viewport) */}
                <div className="xl:col-span-8 space-y-3">
                  <div className="flex items-center justify-between px-1 text-xs text-muted-foreground select-none">
                    <span>Responses list</span>
                    <span>Showing {list.length} results</span>
                  </div>

                  <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-1 custom-scrollbar">
                    {list.length === 0 ? (
                      <GlassCard className="text-center text-muted-foreground py-24 text-sm">
                        No responses match your filter conditions.
                      </GlassCard>
                    ) : (
                      list.map((r) => <ResponseDetailCard key={r.id} r={r} />)
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* EXPLORER LAYOUT (Capped to max 5 items in viewport scrollboxes) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch animate-in fade-in duration-300">
              {/* Column 1: Devices list (Capped to 5 items height scrollbox) */}
              <div className="lg:col-span-4 xl:col-span-3 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    1. Tablets
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-white/5 text-[10px] text-muted-foreground"
                  >
                    {devices.length} paired
                  </Badge>
                </div>
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                  {/* Virtual "All Tablets" selector */}
                  <div
                    onClick={() => {
                      setSelectedDeviceId("all");
                      setSelectedTemplateId("all");
                      setQ("");
                      setDynamicFilters({});
                    }}
                    className={cn(
                      "group p-3 rounded-2xl cursor-pointer border transition-all duration-200 select-none",
                      selectedDeviceId === "all"
                        ? "border-primary/30 bg-primary/[0.06] shadow-md shadow-primary/5"
                        : "border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.03]",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "size-8 rounded-xl grid place-items-center shrink-0 transition-colors",
                          selectedDeviceId === "all"
                            ? "bg-primary/20 text-primary"
                            : "bg-white/5 text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        <Database className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">All Tablets</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Including logged out/unpaired terminals
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5 text-[10px]">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active Database
                      </span>
                      <span className="text-muted-foreground font-medium flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded">
                        <MessageSquare className="size-2.5" /> {allResponses.length} reviews
                      </span>
                    </div>
                  </div>

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
                              isSelected
                                ? "bg-primary/20 text-primary"
                                : "bg-white/5 text-muted-foreground group-hover:text-foreground",
                            )}
                          >
                            <Smartphone className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm truncate">{d.name}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                              <MapPin className="size-3 shrink-0" />{" "}
                              {d.location || "No location set"}
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

              {/* Column 2: Template History list (Capped to 5 items height scrollbox) */}
              <div className="lg:col-span-4 xl:col-span-3 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    2. Template History
                  </span>
                  {selectedDeviceObj && (
                    <Badge
                      variant="secondary"
                      className="bg-white/5 text-[10px] text-muted-foreground"
                    >
                      {deviceTemplates.length} templates
                    </Badge>
                  )}
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {selectedDeviceId === null ? (
                    <GlassCard className="py-12 text-center text-xs text-muted-foreground italic flex flex-col items-center justify-center gap-2">
                      <Smartphone className="size-5 text-muted-foreground/30" />
                      Select a tablet to load templates.
                    </GlassCard>
                  ) : deviceTemplates.length === 0 ? (
                    <GlassCard className="py-12 text-center text-xs text-muted-foreground italic">
                      No templates recorded on this tablet.
                    </GlassCard>
                  ) : (
                    deviceTemplates.map((t) => {
                      const isSelected = selectedTemplateId === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTemplateId(t.id)}
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
                                isSelected
                                  ? "bg-primary/20 text-primary"
                                  : "bg-white/5 text-muted-foreground group-hover:text-foreground",
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
                                  <Badge
                                    variant="outline"
                                    className="text-muted-foreground border-white/5 text-[8px] px-1 py-0 uppercase tracking-wide"
                                  >
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

              {/* Column 3: Detailed Feedback Feed (Capped to 5 items height scrollbox with More link) */}
              <div className="lg:col-span-4 xl:col-span-6 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    3. Detailed Survey Responses
                  </span>
                  {selectedDeviceObj && selectedTemplateObj && list.length > 5 && (
                    <button
                      onClick={() => setViewMode("fullscreen")}
                      className="text-xs text-primary hover:text-primary-foreground font-semibold flex items-center gap-1 hover:underline select-none"
                    >
                      More <ArrowUpRight className="size-3" />
                    </button>
                  )}
                </div>

                {selectedDeviceId === null || selectedTemplateId === null ? (
                  <GlassCard className="py-24 text-center text-xs text-muted-foreground italic flex flex-col items-center justify-center gap-3">
                    <Database className="size-8 text-muted-foreground/20" />
                    <div>
                      Select a tablet on the left and a template version from history to view
                      responses.
                    </div>
                  </GlassCard>
                ) : (
                  <div className="space-y-4">
                    {/* Selected context header, search & dynamic filter options */}
                    <GlassCard className="p-4 space-y-3">
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                            {selectedTemplateObj?.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Showing responses on{" "}
                            <span className="text-foreground font-medium">
                              {selectedDeviceObj?.name}
                            </span>
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-white/5 text-xs">
                          {list.length} results
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search comments and raw answers..."
                            className="pl-9 bg-white/5 border-white/10 text-xs focus-visible:ring-primary/40 h-8"
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

                        {/* Render dynamic selects */}
                        {renderDynamicFilters()}

                        {hasActiveFilters && (
                          <Button
                            variant="ghost"
                            onClick={resetFilters}
                            className="w-full text-[10px] text-rose-300 hover:text-rose-200 h-6 mt-1 border border-dashed border-rose-500/20"
                          >
                            <X className="size-3 mr-1" /> Clear All Filters
                          </Button>
                        )}
                      </div>
                    </GlassCard>

                    {/* Responses scrollbox (Capped at 5 items height scrollbox) */}
                    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
                      {list.length === 0 ? (
                        <GlassCard className="text-center text-muted-foreground py-16 text-sm">
                          {q.trim() || hasActiveFilters
                            ? "No responses match your search and filter parameters."
                            : "No responses recorded yet for this survey on this tablet."}
                        </GlassCard>
                      ) : (
                        list.map((r) => <ResponseDetailCard key={r.id} r={r} />)
                      )}

                      {list.length > 5 && (
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            className="w-full bg-white/5 border-white/10 text-xs h-9 text-muted-foreground hover:text-foreground hover:bg-white/10"
                            onClick={() => setViewMode("fullscreen")}
                          >
                            View All {list.length} Responses in Full View
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
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

  const customerInfo = React.useMemo(() => {
    const toStr = (v: unknown) => (v == null ? "" : String(v));
    const name = toStr(answers.customer_name || answers.name || answers.customerName);
    const email = toStr(answers.customer_email || answers.email || answers.customerEmail);
    const phone = toStr(answers.customer_phone || answers.phone || answers.customerPhone);
    if (name || email || phone) {
      return { name, email, phone };
    }
    return null;
  }, [answers]);

  // Identify any extra fields not defined in the template questions
  const extraAnswers = React.useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extra: Array<{ key: string; value: any }> = [];
    const questionIds = new Set(questions.map((q) => q.id));

    Object.entries(answers).forEach(([k, v]) => {
      if (questionIds.has(k)) return;
      if (k === "comment" && textFeedbackList.some((item) => item.label === "Comment")) return;
      if (
        [
          "customer_name",
          "customer_email",
          "customer_phone",
          "name",
          "email",
          "phone",
          "customerName",
          "customerEmail",
          "customerPhone",
        ].includes(k)
      )
        return;
      if (v != null && String(v).trim()) {
        extra.push({ key: k, value: v });
      }
    });
    return extra;
  }, [answers, questions, textFeedbackList]);

  // Renders beautiful inline formatted answers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderAnswerValue = (q: any, val: any) => {
    if (val == null) return null;
    const qType = typeof q === "string" ? q : q?.type;

    switch (qType) {
      case "rating": {
        const score = Number(val) || 0;
        const totalStars = (typeof q === "object" && q?.maxStars) || 5;
        const starLabels = (typeof q === "object" && q?.starLabels) || [];
        const label = starLabels[score - 1];
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {Array.from({ length: totalStars }).map((_, idx) => (
                  <Star
                    key={idx}
                    className={cn(
                      "size-4",
                      idx < score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
                    )}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold">({score} / {totalStars})</span>
            </div>
            {label && (
              <span className="text-[10px] text-amber-200/90 italic -mt-0.5">Label: {label}</span>
            )}
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
        const valStr = String(val).trim();
        const customEmojis = (typeof q === "object" && q?.emojis) || [];
        const found = customEmojis.find(
          (item: any) =>
            item.emoji === valStr ||
            item.label === valStr ||
            String(customEmojis.indexOf(item) + 1) === valStr
        );
        if (found) {
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-base">{found.emoji}</span>
              <span className="text-xs font-semibold text-amber-200">{found.label}</span>
            </div>
          );
        }
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
        const customYes = (typeof q === "object" && q?.yesLabel) || "Yes";
        const customNo = (typeof q === "object" && q?.noLabel) || "No";
        const displayLabel = yes ? customYes : customNo;
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
            {displayLabel}
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
          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-sm text-foreground/90 max-w-xl whitespace-pre-wrap leading-relaxed shadow-sm">
            {String(val)}
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
                  idx < (r.rating ?? 0)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30",
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
              <Clock className="size-3 text-muted-foreground/75" /> Completed in{" "}
              {r.duration_seconds}s
            </span>
            <span className="flex items-center gap-1 truncate max-w-[150px]">
              <Smartphone className="size-3 text-muted-foreground/75" /> {r.device || "Logged Out Terminal"}
            </span>
            <span className="flex items-center gap-1 truncate max-w-[150px]">
              <FileText className="size-3 text-muted-foreground/75" /> {r.template || "Draft Survey"}
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
          &ldquo;{textFeedbackList[0].text}&rdquo;
        </div>
      )}

      {/* Detailed Expanded Q&A Panel */}
      {expanded && (
        <div
          className="mt-4 pt-4 border-t border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-4">
            {/* Customer Details Section */}
            {customerInfo && (
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5 space-y-2">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="size-3.5" /> Customer Contact Information
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {customerInfo.name && (
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">
                        Name
                      </span>
                      <span className="font-medium text-foreground">{customerInfo.name}</span>
                    </div>
                  )}
                  {customerInfo.email && (
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">
                        Email
                      </span>
                      <a
                        href={`mailto:${customerInfo.email}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {customerInfo.email}
                      </a>
                    </div>
                  )}
                  {customerInfo.phone && (
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">
                        Phone
                      </span>
                      <a
                        href={`tel:${customerInfo.phone}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {customerInfo.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {questions.length === 0 &&
              textFeedbackList.length === 0 &&
              extraAnswers.length === 0 &&
              !customerInfo && (
                <div className="text-xs text-muted-foreground italic py-2">
                  No detailed answers recorded for this response.
                </div>
              )}

            {/* Render matched template questions */}
            {questions.map((q, idx) => {
              const val = answers[q.id];
              if (val == null || String(val).trim() === "") return null;
              // Skip customer_info questions — already shown in Contact Information section above
              if (q.type === "customer_info") return null;
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
                  <div className="pl-0.5">{renderAnswerValue(q, val)}</div>
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

function StatusIndicator({ status }: { status: "online" | "offline" | "syncing" | "paused" }) {
  const map = {
    online: ["bg-emerald-400", "text-emerald-300", "Online"],
    offline: ["bg-rose-400", "text-rose-300", "Offline"],
    syncing: ["bg-amber-400", "text-amber-300", "Syncing"],
    paused: ["bg-slate-400", "text-slate-300", "Paused"],
  } as const;
  const [dotCls, txtCls, label] = map[status] || ["bg-rose-400", "text-rose-300", "Offline"];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground select-none">
      <span
        className={cn("size-1.5 rounded-full", dotCls, status === "online" && "animate-pulse")}
      />
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
