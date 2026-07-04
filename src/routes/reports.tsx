import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Download,
  Calendar,
  Smartphone,
  Sparkles,
  ArrowUpRight,
  Info,
  Clock,
} from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Responses, Devices } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  Printer,
  FileSpreadsheet,
  Star,
  Clock,
  TrendingUp,
  Award,
  Calendar,
  Sparkles,
  BarChart3,
  PieChart as PieIcon,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

// CSV download helper
function downloadCSV(filename: string, rows: string[][]) {
  const content = rows
    .map((row) =>
      row
        .map((val) => {
          if (val === undefined || val === null) return "";
          const str = String(val).replace(/"/g, '""');
          return str.includes(",") || str.includes("\n") || str.includes('"') ? `"${str}"` : str;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function ReportsPage() {
  const devicesQ = useQuery({
    queryKey: ["devices"],
    queryFn: () => Devices.list(),
  });

  const devices = devicesQ.data?.devices ?? [];

  // Filters state
  const [filterDevice, setFilterDevice] = React.useState("all");
  const [filterFromDate, setFilterFromDate] = React.useState("");
  const [filterToDate, setFilterToDate] = React.useState("");

  // Export CSV options
  const [downloadModalOpen, setDownloadModalOpen] = React.useState(false);
  const [csvFormat, setCsvFormat] = React.useState<"format1" | "format2">("format1");
  const [downloading, setDownloading] = React.useState(false);

  // Live Query for Analytics Data
  const reportQ = useQuery({
    queryKey: ["reports-list", filterDevice, filterFromDate, filterToDate],
    queryFn: () =>
      Responses.reportList({
        device_id: filterDevice,
        from_date: filterFromDate || undefined,
        to_date: filterToDate || undefined,
      }),
  });

  const list = reportQ.data?.responses ?? [];
  const isLoading = reportQ.isLoading;

  // Print PDF Trigger
  const handlePrintPDF = () => {
    window.print();
  };

  // Build CSV logic
  const handleBuildResponsesReport = async () => {
    setDownloading(true);
    try {
      if (list.length === 0) {
        toast.error("No responses found for the selected filter combination.");
        setDownloading(false);
        return;
      }

      if (csvFormat === "format1") {
        const uniqueQuestions = new Set<string>();
        list.forEach((r) => {
          (r.template_questions || []).forEach((q: any) => {
            if (q.label) uniqueQuestions.add(q.label.trim());
          });
        });
        const questionList = Array.from(uniqueQuestions);

        const headers = [
          "Response ID",
          "Device Name",
          "Template Name",
          "Submitted At",
          "Duration (sec)",
          "Rating (Stars)",
          ...questionList,
        ];

        const csvRows = [
          ["Feedback Responses Report (Aligned columns)"],
          ["Generated At", new Date().toLocaleString()],
          ["Filter Device ID", filterDevice],
          ["Filter Date Range", `${filterFromDate || "Start"} to ${filterToDate || "End"}`],
          [],
          headers
        ];

        list.forEach((r) => {
          const rowData = [
            String(r.id),
            r.device || "Unassigned",
            r.template || "Unknown",
            r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "N/A",
            String(r.duration_seconds || 0),
            r.rating !== null ? String(r.rating) : "N/A",
          ];

          questionList.forEach((qLabel) => {
            const matchQ = (r.template_questions || []).find(
              (q: any) => q.label && q.label.trim() === qLabel,
            );
            const answerVal = matchQ ? r.answers?.[matchQ.id] : undefined;
            rowData.push(answerVal !== undefined && answerVal !== null ? String(answerVal) : "");
          });

          csvRows.push(rowData);
        });

        downloadCSV(`Feedback_Responses_Aligned_${new Date().toISOString().slice(0, 10)}.csv`, csvRows);
      } else {
        const deviceGroups: Record<string, typeof list> = {};
        list.forEach((r) => {
          const dName = r.device || "Unassigned";
          if (!deviceGroups[dName]) deviceGroups[dName] = [];
          deviceGroups[dName].push(r);
        });

        const csvRows: string[][] = [
          ["Feedback Responses Report (Device grouped)"],
          ["Generated At", new Date().toLocaleString()],
          ["Filter Date Range", `${filterFromDate || "Start"} to ${filterToDate || "End"}`],
          [],
        ];

        Object.entries(deviceGroups).forEach(([deviceName, resList]) => {
          csvRows.push([`DEVICE SURVEYS SUMMARY: ${deviceName.toUpperCase()}`]);
          
          const uniqueQuestions = new Set<string>();
          resList.forEach((r) => {
            (r.template_questions || []).forEach((q: any) => {
              if (q.label) uniqueQuestions.add(q.label.trim());
            });
          });
          const questionList = Array.from(uniqueQuestions);

          const headers = [
            "Response ID",
            "Template Name",
            "Submitted At",
            "Duration (sec)",
            "Rating (Stars)",
            ...questionList,
          ];
          csvRows.push(headers);

          resList.forEach((r) => {
            const rowData = [
              String(r.id),
              r.template || "Unknown",
              r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "N/A",
              String(r.duration_seconds || 0),
              r.rating !== null ? String(r.rating) : "N/A",
            ];

            questionList.forEach((qLabel) => {
              const matchQ = (r.template_questions || []).find(
                (q: any) => q.label && q.label.trim() === qLabel,
              );
              const answerVal = matchQ ? r.answers?.[matchQ.id] : undefined;
              rowData.push(answerVal !== undefined && answerVal !== null ? String(answerVal) : "");
            });

            csvRows.push(rowData);
          });

          csvRows.push([]);
          csvRows.push([]);
        });

        downloadCSV(`Feedback_Responses_DeviceGrouped_${new Date().toISOString().slice(0, 10)}.csv`, csvRows);
      }

      toast.success("CSV report downloaded successfully!");
      setDownloadModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to download responses report.");
    } finally {
      setDownloading(false);
    }
  };

  // KPIs Calculations
  const totalCount = list.length;
  
  const ratedResponses = list.filter((r) => r.rating !== null);
  const avgStars =
    ratedResponses.length > 0
      ? (ratedResponses.reduce((sum, r) => sum + (r.rating || 0), 0) / ratedResponses.length).toFixed(1)
      : "0.0";

  const avgDuration =
    list.length > 0
      ? Math.round(list.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) / list.length)
      : 0;

  // NPS computations
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  list.forEach((r) => {
    (r.template_questions || []).forEach((q: any) => {
      if (q.type === "nps") {
        const val = Number(r.answers?.[q.id]);
        if (!isNaN(val)) {
          if (val >= 9) promoters++;
          else if (val >= 7) passives++;
          else detractors++;
        }
      }
    });
  });
  const totalNps = promoters + passives + detractors;
  const npsScore = totalNps > 0 ? Math.round(((promoters - detractors) / totalNps) * 100) : null;

  // Trend Grouping (By Date)
  const trendData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    list.forEach((r) => {
      if (!r.submitted_at) return;
      const d = new Date(r.submitted_at);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .reverse(); // Order from oldest to newest
  }, [list]);

  // Stars Distribution Data
  const starsData = React.useMemo(() => {
    const starCounts = [0, 0, 0, 0, 0]; // 1, 2, 3, 4, 5 Stars
    ratedResponses.forEach((r) => {
      const val = Math.min(5, Math.max(1, r.rating || 0));
      starCounts[val - 1]++;
    });
    return [
      { stars: "1 ⭐", count: starCounts[0] },
      { stars: "2 ⭐", count: starCounts[1] },
      { stars: "3 ⭐", count: starCounts[2] },
      { stars: "4 ⭐", count: starCounts[3] },
      { stars: "5 ⭐", count: starCounts[4] },
    ];
  }, [ratedResponses]);

  // NPS Split Data for Pie
  const npsPieData = [
    { name: "Promoters (9-10)", value: promoters, color: "#10b981" },
    { name: "Passives (7-8)", value: passives, color: "#f59e0b" },
    { name: "Detractors (0-6)", value: detractors, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  // Parse questions for charts and commentary text answers
  const parsedQuestions = React.useMemo(() => {
    const questionsMap: Record<
      string,
      { label: string; type: string; answers: Record<string, number>; textAnswers: string[] }
    > = {};

    list.forEach((r) => {
      (r.template_questions || []).forEach((q: any) => {
        if (!q.label) return;
        const qLabel = q.label.trim();
        if (!questionsMap[qLabel]) {
          questionsMap[qLabel] = {
            label: qLabel,
            type: q.type,
            answers: {},
            textAnswers: [],
          };
        }

        const answer = r.answers?.[q.id];
        if (answer === undefined || answer === null || answer === "") return;

        if (q.type === "multiple_choice" || q.type === "emoji" || q.type === "nps") {
          const ansKey = String(answer);
          questionsMap[qLabel].answers[ansKey] = (questionsMap[qLabel].answers[ansKey] || 0) + 1;
        } else if (q.type === "long_text" || q.type === "short_text") {
          questionsMap[qLabel].textAnswers.push(String(answer));
        }
      });
    });

    return Object.values(questionsMap);
  }, [list]);

  return (
    <DashboardLayout>
      {/* Dynamic styles injected specifically for print layouts */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-full {
            width: 100% !important;
            max-width: 100% !important;
            grid-template-columns: 1fr !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-card {
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            color: #000000 !important;
            border-radius: 8px !important;
          }
          .print-text {
            color: #000000 !important;
          }
          .recharts-responsive-container {
            width: 100% !important;
            height: 280px !important;
          }
          svg {
            filter: grayscale(100%) !important; /* Premium classic high contrast print styling */
          }
        }
      `}} />

      {/* Header section (hidden on print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5 no-print">
        <PageHeader
          title="Reports Control Center"
          description="Build visual charts, download PDF reports, or export structured CSV spreadsheets of responses."
        />
        <div className="flex items-center gap-2 self-start md:self-center">
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 text-xs h-9 text-muted-foreground hover:text-foreground"
            onClick={() => setDownloadModalOpen(true)}
          >
            <FileSpreadsheet className="size-4 mr-1.5 text-emerald-500" />
            Export CSV
          </Button>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs h-9 font-semibold shadow-lg"
            onClick={handlePrintPDF}
          >
            <Printer className="size-4 mr-1.5" />
            Download PDF Report
          </Button>
        </div>
      </div>

      {/* Printable Heading Block (Visible ONLY during print) */}
      <div className="hidden print:block mb-8">
        <h1 className="text-3xl font-extrabold text-black">ReviewOS — Performance Report</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generated At: {new Date().toLocaleString()} | Filter Device: {filterDevice === "all" ? "All Connected" : filterDevice}
        </p>
        <hr className="mt-4 border-gray-300" />
      </div>

      {/* Filters Toolbar (hidden on print) */}
      <GlassCard className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 mt-6 no-print border-white/5">
        <div className="flex flex-wrap items-center gap-4">
          {/* Device Selector */}
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Device Select</span>
            <select
              value={filterDevice}
              onChange={(e) => setFilterDevice(e.target.value)}
              className="w-48 bg-white/5 border border-white/10 rounded-lg h-9 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
            >
              <option value="all" className="bg-[#0d0f12]">All Connected Devices</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id} className="bg-[#0d0f12]">
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date range filters */}
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">From Date</span>
            <Input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="bg-white/5 border-white/10 text-xs h-9 w-36 text-foreground"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">To Date</span>
            <Input
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="bg-white/5 border-white/10 text-xs h-9 w-36 text-foreground"
            />
          </div>
        </div>

        {totalCount > 0 && (
          <div className="text-[11px] text-muted-foreground bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 self-end md:self-center">
            Found <strong className="text-foreground">{totalCount}</strong> responses matching filters
          </div>
        )}
      </GlassCard>

      {/* Main Analytics Cards & Charts Panel */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-xs text-muted-foreground">Gathering reporting records...</span>
        </div>
      ) : totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="size-12 rounded-full bg-white/5 grid place-items-center mb-4 border border-white/10">
            <AlertCircle className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No Response Data Captured</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Try adjusting your device selection, selecting a broader date filter, or verify your tablet is synced.
          </p>
        </div>
      ) : (
        <div className="print-full mt-6 space-y-6">
          {/* KPI CARDS GRID */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print-full">
            {/* Card 1: Total Feedbacks */}
            <GlassCard className="p-5 border-white/5 print-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium print-text">Total Responses</span>
                <span className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/10">
                  <BarChart3 className="size-4" />
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-bold tracking-tight text-foreground print-text">{totalCount}</h3>
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingUp className="size-3 text-emerald-500" /> Active feedback collections
                </p>
              </div>
            </GlassCard>

            {/* Card 2: Average Rating */}
            <GlassCard className="p-5 border-white/5 print-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium print-text">Avg Rating</span>
                <span className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/10">
                  <Star className="size-4" />
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-bold tracking-tight text-foreground print-text flex items-center gap-1">
                  {avgStars} <span className="text-sm font-normal text-muted-foreground">/ 5</span>
                </h3>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Based on {ratedResponses.length} rated answers
                </p>
              </div>
            </GlassCard>

            {/* Card 3: Net Promoter Score */}
            <GlassCard className="p-5 border-white/5 print-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium print-text">NPS Index</span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/10">
                  <Award className="size-4" />
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-bold tracking-tight text-foreground print-text">
                  {npsScore !== null ? `${npsScore > 0 ? "+" : ""}${npsScore}` : "N/A"}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {totalNps > 0 ? `${promoters} Promoters, ${detractors} Detractors` : "No NPS question active"}
                </p>
              </div>
            </GlassCard>

            {/* Card 4: Avg Session Duration */}
            <GlassCard className="p-5 border-white/5 print-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium print-text">Avg Duration</span>
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/10">
                  <Clock className="size-4" />
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-bold tracking-tight text-foreground print-text">
                  {avgDuration} <span className="text-xs text-muted-foreground font-normal">sec</span>
                </h3>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Per customer survey completion
                </p>
              </div>
            </GlassCard>
          </div>

          {/* MAIN CHARTS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-full">
            {/* Chart 1: Daily Response Volumes */}
            <GlassCard className="p-5 border-white/5 col-span-1 lg:col-span-2 print-card">
              <h3 className="text-sm font-semibold text-foreground print-text mb-4">Response Volume Trend</h3>
              <div className="h-72 w-full print-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#00f2fe" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "#0d0f12",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.6)", fontSize: "11px" }}
                      itemStyle={{ color: "#fff", fontSize: "12px" }}
                    />
                    <Area type="monotone" dataKey="count" name="Feedbacks" stroke="#00f2fe" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Chart 2: Net Promoter Score Split */}
            <GlassCard className="p-5 border-white/5 print-card">
              <h3 className="text-sm font-semibold text-foreground print-text mb-4">Sentiment Distribution</h3>
              <div className="h-72 w-full flex flex-col justify-between print-chart">
                {totalNps === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <PieIcon className="size-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">No NPS scores registered in this date range.</span>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={npsPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={75}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {npsPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "#0d0f12",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                            }}
                            itemStyle={{ fontSize: "12px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* NPS legend */}
                    <div className="space-y-1.5 pt-2 border-t border-white/5 no-print">
                      {npsPieData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                            {d.name}
                          </span>
                          <span className="font-semibold text-foreground">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-full">
            {/* Chart 3: Stars Rating Breakdown */}
            <GlassCard className="p-5 border-white/5 print-card">
              <h3 className="text-sm font-semibold text-foreground print-text mb-4">Stars Distribution</h3>
              <div className="h-72 w-full print-chart">
                {ratedResponses.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <Star className="size-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">No star reviews submitted.</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={starsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="stars" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "#0d0f12",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "rgba(255,255,255,0.6)", fontSize: "11px" }}
                        itemStyle={{ color: "#f59e0b", fontSize: "12px" }}
                      />
                      <Bar dataKey="count" name="Feedbacks" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </GlassCard>

            {/* Visual breakdown for each question answers (Aligning all active questions) */}
            <div className="col-span-1 lg:col-span-2 space-y-6 print-full">
              <GlassCard className="p-5 border-white/5 print-card">
                <h3 className="text-sm font-semibold text-foreground print-text mb-4">Question Answers Distribution</h3>
                <div className="space-y-6 max-h-[310px] overflow-y-auto pr-2">
                  {parsedQuestions.filter((q) => Object.keys(q.answers).length > 0).length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-10">
                      <Sparkles className="size-8 text-muted-foreground mb-2" />
                      <span className="text-xs text-muted-foreground">No multiple-choice questions answers yet.</span>
                    </div>
                  ) : (
                    parsedQuestions
                      .filter((q) => Object.keys(q.answers).length > 0)
                      .map((q, idx) => {
                        const chartData = Object.entries(q.answers).map(([option, count]) => ({
                          option: option.length > 20 ? option.slice(0, 18) + ".." : option,
                          count,
                        }));
                        return (
                          <div key={idx} className="space-y-2 pb-4 border-b border-white/5 last:border-b-0">
                            <h4 className="text-xs font-semibold text-foreground print-text flex items-center justify-between">
                              <span>Q: {q.label}</span>
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 bg-white/5 rounded">
                                {q.type.replace("_", " ")}
                              </span>
                            </h4>
                            <div className="h-32 w-full print-chart">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="yaml" data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                  <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} />
                                  <YAxis dataKey="option" type="category" stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} width={80} />
                                  <Tooltip
                                    contentStyle={{
                                      background: "#0d0f12",
                                      border: "1px solid rgba(255,255,255,0.1)",
                                      borderRadius: "8px",
                                    }}
                                    itemStyle={{ fontSize: "11px" }}
                                  />
                                  <Bar dataKey="count" fill="#10b981" radius={[0, 3, 3, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </GlassCard>
            </div>
          </div>

          {/* CUSTOMER WRITTEN FEEDBACK LOG COMMENTS */}
          <GlassCard className="p-5 border-white/5 print-card">
            <div className="flex items-center gap-1.5 mb-4">
              <MessageSquare className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground print-text">Written Customer Comments</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
              {parsedQuestions
                .filter((q) => q.type === "long_text" || q.type === "short_text")
                .flatMap((q) => q.textAnswers)
                .length === 0 ? (
                <div className="col-span-2 py-8 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <span className="text-xs">No written text feedback submitted in this window.</span>
                </div>
              ) : (
                parsedQuestions
                  .filter((q) => q.type === "long_text" || q.type === "short_text")
                  .flatMap((q) =>
                    q.textAnswers.map((txt, textIdx) => (
                      <div
                        key={textIdx}
                        className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-2 print-card"
                      >
                        <p className="text-xs text-foreground italic leading-relaxed print-text">
                          "{txt}"
                        </p>
                        <span className="text-[9px] text-muted-foreground uppercase font-semibold">
                          Question ID / Label context: {q.label}
                        </span>
                      </div>
                    ))
                  )
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ======================================================== */}
      {/* DIALOG: Build Responses CSV Options                      */}
      {/* ======================================================== */}
      <Dialog open={downloadModalOpen} onOpenChange={setDownloadModalOpen}>
        <DialogContent className="max-w-md border border-white/10 bg-[#0d0f12]/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle>Configure Export Options</DialogTitle>
            <DialogDescription>
              Select formats to generate your CSV feedback log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Format Selection Layout */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-semibold">Report Columns Format</Label>
              <div className="grid grid-cols-1 gap-2.5">
                {/* Format 1 Button */}
                <button
                  type="button"
                  onClick={() => setCsvFormat("format1")}
                  className={cn(
                    "p-3 rounded-xl border text-left flex flex-col gap-1 transition-all",
                    csvFormat === "format1"
                      ? "bg-primary/10 border-primary/30 text-foreground"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/[0.08]",
                  )}
                >
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Format 1: Unified Aligned Questions
                  </span>
                  <span className="text-[10px] leading-relaxed text-muted-foreground">
                    Matches similar question labels across different templates into clean aligned columns. Perfect for global cross-tablet aggregates.
                  </span>
                </button>

                {/* Format 2 Button */}
                <button
                  type="button"
                  onClick={() => setCsvFormat("format2")}
                  className={cn(
                    "p-3 rounded-xl border text-left flex flex-col gap-1 transition-all",
                    csvFormat === "format2"
                      ? "bg-primary/10 border-primary/30 text-foreground"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/[0.08]",
                  )}
                >
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Format 2: Device-wise Grouped Sections
                  </span>
                  <span className="text-[10px] leading-relaxed text-muted-foreground">
                    Groups survey reviews vertically by device. Outputs specific columns for each device's template questions. Prevents sparse spreadsheets.
                  </span>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button
              variant="outline"
              className="border-white/10 text-xs h-9"
              onClick={() => setDownloadModalOpen(false)}
              disabled={downloading}
            >
              Cancel
            </Button>
            <Button
              className="text-xs h-9 bg-primary text-primary-foreground font-semibold"
              onClick={handleBuildResponsesReport}
              disabled={downloading}
            >
              {downloading ? "Compiling..." : "Generate and Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
