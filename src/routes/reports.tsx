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
import { Responses, Devices, Templates } from "@/lib/api";
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
  AlertCircle,
  FileText,
  Download,
  Info
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

  const templatesQ = useQuery({
    queryKey: ["templates"],
    queryFn: () => Templates.list(),
  });

  // Calculate oldest template creation date and today's date
  const oldestTemplateDate = React.useMemo(() => {
    const tList = templatesQ.data?.templates ?? [];
    if (tList.length === 0) return "";
    let oldest = new Date();
    tList.forEach((t) => {
      if (t.created_at) {
        const d = new Date(t.created_at);
        if (d < oldest) oldest = d;
      }
    });
    const yyyy = oldest.getFullYear();
    const mm = String(oldest.getMonth() + 1).padStart(2, "0");
    const dd = String(oldest.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, [templatesQ.data?.templates]);

  const currentDate = React.useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // CSV Export configuration state
  const [csvModalOpen, setCsvModalOpen] = React.useState(false);
  const [csvDevice, setCsvDevice] = React.useState("all");
  const [csvFromDate, setCsvFromDate] = React.useState("");
  const [csvToDate, setCsvToDate] = React.useState("");
  const [csvFormat, setCsvFormat] = React.useState<"format1" | "format2">("format1");
  const [csvDownloading, setCsvDownloading] = React.useState(false);

  // PDF Export configuration state and live background query
  const [pdfModalOpen, setPdfModalOpen] = React.useState(false);
  const [pdfDevice, setPdfDevice] = React.useState("all");
  const [pdfFromDate, setPdfFromDate] = React.useState("");
  const [pdfToDate, setPdfToDate] = React.useState("");
  const [pdfCompiling, setPdfCompiling] = React.useState(false);

  const pdfReportQ = useQuery({
    queryKey: ["pdf-report-responses", pdfDevice, pdfFromDate, pdfToDate],
    queryFn: () =>
      Responses.reportList({
        device_id: pdfDevice,
        from_date: pdfFromDate || undefined,
        to_date: pdfToDate || undefined,
      }),
  });

  const pdfData = pdfReportQ.data?.responses ?? [];

  // Apply default dates automatically
  React.useEffect(() => {
    if (oldestTemplateDate) {
      if (!csvFromDate) setCsvFromDate(oldestTemplateDate);
      if (!pdfFromDate) setPdfFromDate(oldestTemplateDate);
    }
  }, [oldestTemplateDate]);

  React.useEffect(() => {
    if (!csvToDate) setCsvToDate(currentDate);
    if (!pdfToDate) setPdfToDate(currentDate);
  }, [currentDate]);

  // Trigger PDF print session
  const handleBuildPDFReport = async () => {
    if (pdfData.length === 0) {
      toast.error("No response data found matching your PDF filters.");
      return;
    }
    setPdfCompiling(true);
    // Delay slightly to ensure browser focus
    setTimeout(() => {
      window.print();
      setPdfCompiling(false);
      setPdfModalOpen(false);
    }, 400);
  };

  // Trigger CSV compilation
  const handleBuildCSVReport = async () => {
    setCsvDownloading(true);
    try {
      const data = await Responses.reportList({
        device_id: csvDevice,
        from_date: csvFromDate || undefined,
        to_date: csvToDate || undefined,
      });

      const list = data.responses || [];
      if (list.length === 0) {
        toast.error("No responses found for the selected CSV parameters.");
        setCsvDownloading(false);
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
          ["Filter Device ID", csvDevice],
          ["Filter Date Range", `${csvFromDate || "Start"} to ${csvToDate || "End"}`],
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
          ["Filter Date Range", `${csvFromDate || "Start"} to ${csvToDate || "End"}`],
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
      setCsvModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to download responses report.");
    } finally {
      setCsvDownloading(false);
    }
  };

  // Print Calculations (Compiled dynamically for PDF document output)
  const totalCount = pdfData.length;
  const ratedResponses = pdfData.filter((r) => r.rating !== null);
  const avgStars =
    ratedResponses.length > 0
      ? (ratedResponses.reduce((sum, r) => sum + (r.rating || 0), 0) / ratedResponses.length).toFixed(1)
      : "0.0";
  const avgDuration =
    pdfData.length > 0
      ? Math.round(pdfData.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) / pdfData.length)
      : 0;

  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  pdfData.forEach((r) => {
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

  const trendData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    pdfData.forEach((r) => {
      if (!r.submitted_at) return;
      const d = new Date(r.submitted_at);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .reverse();
  }, [pdfData]);

  const starsData = React.useMemo(() => {
    const starCounts = [0, 0, 0, 0, 0];
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

  const npsPieData = [
    { name: "Promoters", value: promoters, color: "#10b981" },
    { name: "Passives", value: passives, color: "#f59e0b" },
    { name: "Detractors", value: detractors, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  const parsedQuestions = React.useMemo(() => {
    const questionsMap: Record<
      string,
      { label: string; type: string; answers: Record<string, number>; textAnswers: string[] }
    > = {};

    pdfData.forEach((r) => {
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
  }, [pdfData]);

  return (
    <DashboardLayout>
      {/* Styles to place printable summary offscreen under normal state and display on print */}
      {/* Styles to cleanly hide sidebar and top menu headers during reports print */}
      <style dangerouslySetInnerHTML={{ __html: `
        .offscreen-print-container {
          position: absolute !important;
          left: -9999px !important;
          top: -9999px !important;
          width: 1024px !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        @media print {
          aside, header, footer, nav, [data-radix-portal], [role="dialog"], .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .offscreen-print-container {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            opacity: 1 !important;
            display: block !important;
            width: 100% !important;
          }
        }
      `}} />

      {/* Reports Control Center Screen Header */}
      <div className="print:hidden">
        <PageHeader
          title="Reports Control Center"
          description="Download feedback answers as clean CSV spreadsheets, or build visual summary PDF reports."
        />

        {/* 2-Column reports selector panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-3xl">
          {/* Card 1: CSV Export */}
          <GlassCard className="flex flex-col justify-between border border-white/5 relative group p-5">
            <div>
              <div className="size-10 rounded-xl bg-emerald-500/10 grid place-items-center mb-4 border border-emerald-500/20">
                <FileSpreadsheet className="size-5 text-emerald-500" />
              </div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Feedback CSV Spreadsheets
                <span className="text-[9px] text-muted-foreground bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full font-medium">
                  CSV Log
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Download a clean raw dataset of user feedback. Supports aligned unified columns for multi-tablet comparisons, or device-grouped vertical tables.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="size-3.5" /> Aligned columns or device sections
              </span>
              <Button
                size="sm"
                className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                onClick={() => setCsvModalOpen(true)}
              >
                <Download className="size-3.5 mr-1" /> Configure CSV
              </Button>
            </div>
          </GlassCard>

          {/* Card 2: PDF Export */}
          <GlassCard className="flex flex-col justify-between border border-white/5 relative group p-5">
            <div>
              <div className="size-10 rounded-xl bg-primary/10 grid place-items-center mb-4 border border-primary/20">
                <FileText className="size-5 text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Visual Executive PDF Summary
                <span className="text-[9px] text-muted-foreground bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full font-medium">
                  PDF Report
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Build an elegant graphical executive overview. Includes response trends, NPS index distributions, star breakdown charts, and text comment logs.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="size-3.5 text-primary" /> Visual charts & trend graphics
              </span>
              <Button
                size="sm"
                className="text-xs h-8 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"
                onClick={() => setPdfModalOpen(true)}
              >
                <Printer className="size-3.5 mr-1" /> Download Visual PDF
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DIALOG: Configure CSV Export Option                      */}
      {/* ======================================================== */}
      <Dialog open={csvModalOpen} onOpenChange={setCsvModalOpen}>
        <DialogContent className="max-w-md border border-white/10 bg-[#0d0f12]/95 backdrop-blur-md no-print">
          <DialogHeader>
            <DialogTitle>Configure CSV Export</DialogTitle>
            <DialogDescription>
              Select devices, date filters, and formats to build your CSV feedback log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Device Filter</Label>
              <select
                value={csvDevice}
                onChange={(e) => setCsvDevice(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl h-9 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
              >
                <option value="all" className="bg-[#0d0f12]">All Connected Devices</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id} className="bg-[#0d0f12]">
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">From Date</Label>
                <Input
                  type="date"
                  value={csvFromDate}
                  onChange={(e) => setCsvFromDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-xs h-9 text-foreground focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">To Date</Label>
                <Input
                  type="date"
                  value={csvToDate}
                  onChange={(e) => setCsvToDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-xs h-9 text-foreground focus-visible:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-semibold">Report Columns Format</Label>
              <div className="grid grid-cols-1 gap-2.5">
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
              onClick={() => setCsvModalOpen(false)}
              disabled={csvDownloading}
            >
              Cancel
            </Button>
            <Button
              className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleBuildCSVReport}
              disabled={csvDownloading}
            >
              {csvDownloading ? "Compiling..." : "Generate and Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG: Configure PDF Report Export                      */}
      {/* ======================================================== */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="max-w-md border border-white/10 bg-[#0d0f12]/95 backdrop-blur-md no-print">
          <DialogHeader>
            <DialogTitle>Configure Visual PDF Report</DialogTitle>
            <DialogDescription>
              Select devices and date ranges to build your graphical report document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Device Filter</Label>
              <select
                value={pdfDevice}
                onChange={(e) => setPdfDevice(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl h-9 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
              >
                <option value="all" className="bg-[#0d0f12]">All Connected Devices</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id} className="bg-[#0d0f12]">
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">From Date</Label>
                <Input
                  type="date"
                  value={pdfFromDate}
                  onChange={(e) => setPdfFromDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-xs h-9 text-foreground focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">To Date</Label>
                <Input
                  type="date"
                  value={pdfToDate}
                  onChange={(e) => setPdfToDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-xs h-9 text-foreground focus-visible:ring-primary/40"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button
              variant="outline"
              className="border-white/10 text-xs h-9"
              onClick={() => setPdfModalOpen(false)}
              disabled={pdfCompiling}
            >
              Cancel
            </Button>
            <Button
              className="text-xs h-9 bg-primary text-primary-foreground font-semibold"
              onClick={handleBuildPDFReport}
              disabled={pdfCompiling}
            >
              {pdfCompiling ? "Compiling..." : "Generate and Print PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* OFF-SCREEN PRINT CONTAINER                               */}
      {/* ======================================================== */}
      <div className="offscreen-print-container bg-white text-black p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-300">
            <div>
              <h1 className="text-2xl font-bold text-black uppercase tracking-tight">ReviewOS Performance Summary</h1>
              <p className="text-xs text-gray-500 mt-1">
                Report generated on: {new Date().toLocaleString()} | Device: {pdfDevice === "all" ? "All Connected" : pdfDevice}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2.5 py-1 rounded">
                Executive Report
              </span>
            </div>
          </div>

          {/* KPI summaries row */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-gray-400">Total Feedbacks</span>
              <h2 className="text-xl font-bold text-black mt-1">{totalCount}</h2>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-gray-400">Avg Rating Stars</span>
              <h2 className="text-xl font-bold text-black mt-1">{avgStars} / 5</h2>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-gray-400">NPS Score Index</span>
              <h2 className="text-xl font-bold text-black mt-1">
                {npsScore !== null ? `${npsScore > 0 ? "+" : ""}${npsScore}` : "N/A"}
              </h2>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-gray-400">Avg Session Duration</span>
              <h2 className="text-xl font-bold text-black mt-1">{avgDuration} sec</h2>
            </div>
          </div>

          {/* Core Analytics Visual Trends */}
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 p-4 border border-gray-200 rounded-lg">
              <h3 className="text-xs font-bold text-gray-600 uppercase mb-3">Response Volumes Trend</h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                    <Area type="monotone" dataKey="count" stroke="#000000" strokeWidth={1.5} fill="#f1f5f9" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg flex flex-col justify-between">
              <h3 className="text-xs font-bold text-gray-600 uppercase mb-2">Sentiment Split</h3>
              {totalNps === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 italic">
                  No NPS scores.
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={npsPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={55}
                          paddingAngle={3}
                          dataKey="value"
                          isAnimationActive={false}
                        >
                          {npsPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 border-t border-gray-200 pt-2 text-[10px]">
                    {npsPieData.map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-gray-400 flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
                          {d.name}
                        </span>
                        <span className="font-bold text-black">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="text-xs font-bold text-gray-600 uppercase mb-3">Stars Split</h3>
              <div className="h-56 w-full">
                {ratedResponses.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">
                    No stars rating.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={starsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="stars" stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} allowDecimals={false} />
                      <Bar dataKey="count" fill="#475569" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="col-span-2 p-4 border border-gray-200 rounded-lg">
              <h3 className="text-xs font-bold text-gray-600 uppercase mb-3">Unified Survey Questions Split</h3>
              <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2">
                {parsedQuestions.filter((q) => Object.keys(q.answers).length > 0).length === 0 ? (
                  <div className="text-xs text-gray-400 italic text-center py-8">
                    No question distributions.
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
                        <div key={idx} className="space-y-1.5 pb-2 border-b border-gray-100 last:border-0 last:pb-0">
                          <span className="text-[10px] font-bold text-gray-700">Q: {q.label} ({q.type})</span>
                          <div className="h-20 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart layout="yaml" data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis type="number" stroke="#94a3b8" fontSize={8} tickLine={false} />
                                <YAxis dataKey="option" type="category" stroke="#94a3b8" fontSize={8} tickLine={false} width={80} />
                                <Bar dataKey="count" fill="#0284c7" radius={[0, 2, 2, 0]} isAnimationActive={false} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>

          {/* Text feedback lists */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-xs font-bold text-gray-600 uppercase mb-3">Customer Written Comments</h3>
            <div className="grid grid-cols-2 gap-4 max-h-[180px] overflow-y-auto pr-1">
              {parsedQuestions
                .filter((q) => q.type === "long_text" || q.type === "short_text")
                .flatMap((q) => q.textAnswers)
                .length === 0 ? (
                <div className="col-span-2 text-xs text-gray-400 italic">No written feedback.</div>
              ) : (
                parsedQuestions
                  .filter((q) => q.type === "long_text" || q.type === "short_text")
                  .flatMap((q) =>
                    q.textAnswers.map((txt, idx) => (
                      <div key={idx} className="p-2.5 bg-gray-50 rounded border border-gray-100 text-[10px] text-gray-700 italic">
                        "{txt}"
                        <span className="block mt-1.5 not-italic text-[8px] font-semibold text-gray-400 uppercase">
                          Source Context: {q.label}
                        </span>
                      </div>
                    ))
                  )
              )}
            </div>
          </div>
        </div>
    </DashboardLayout>
  );
}
