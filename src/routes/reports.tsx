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

  // Filter popup controls
  const [downloadModalOpen, setDownloadModalOpen] = React.useState(false);
  const [filterDevice, setFilterDevice] = React.useState("all");
  const [filterFromDate, setFilterFromDate] = React.useState("");
  const [filterToDate, setFilterToDate] = React.useState("");
  const [csvFormat, setCsvFormat] = React.useState<"format1" | "format2">("format1");
  const [downloading, setDownloading] = React.useState(false);

  // Download Feedback Responses report
  const handleBuildResponsesReport = async () => {
    setDownloading(true);
    try {
      const data = await Responses.reportList({
        device_id: filterDevice,
        from_date: filterFromDate || undefined,
        to_date: filterToDate || undefined,
      });

      const list = data.responses || [];
      if (list.length === 0) {
        toast.error("No responses found for the selected device and date range.");
        setDownloading(false);
        return;
      }

      if (csvFormat === "format1") {
        // Format 1: Unified Aligned Questions CSV
        const uniqueQuestions = new Set<string>();
        list.forEach((r) => {
          (r.template_questions || []).forEach((q: any) => {
            if (q.text) uniqueQuestions.add(q.text.trim());
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

        const csvRows = [headers];

        list.forEach((r) => {
          const rowData = [
            String(r.id),
            r.device || "Unassigned",
            r.template || "Unknown",
            r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "N/A",
            String(r.duration_seconds || 0),
            r.rating !== null ? String(r.rating) : "N/A",
          ];

          questionList.forEach((qText) => {
            const matchQ = (r.template_questions || []).find(
              (q: any) => q.text && q.text.trim() === qText,
            );
            const answerVal = matchQ ? r.answers?.[matchQ.id] : undefined;
            rowData.push(answerVal !== undefined && answerVal !== null ? String(answerVal) : "");
          });

          csvRows.push(rowData);
        });

        downloadCSV(`Feedback_Responses_Report_Aligned_${new Date().toISOString().slice(0, 10)}.csv`, csvRows);
      } else {
        // Format 2: Device-wise Grouped Vertical CSV
        const deviceGroups: Record<string, typeof list> = {};
        list.forEach((r) => {
          const dName = r.device || "Unassigned";
          if (!deviceGroups[dName]) deviceGroups[dName] = [];
          deviceGroups[dName].push(r);
        });

        const csvRows: string[][] = [];

        Object.entries(deviceGroups).forEach(([deviceName, resList]) => {
          // Device Header Section
          csvRows.push([`DEVICE SURVEYS SUMMARY: ${deviceName.toUpperCase()}`]);
          
          const uniqueQuestions = new Set<string>();
          resList.forEach((r) => {
            (r.template_questions || []).forEach((q: any) => {
              if (q.text) uniqueQuestions.add(q.text.trim());
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

            questionList.forEach((qText) => {
              const matchQ = (r.template_questions || []).find(
                (q: any) => q.text && q.text.trim() === qText,
              );
              const answerVal = matchQ ? r.answers?.[matchQ.id] : undefined;
              rowData.push(answerVal !== undefined && answerVal !== null ? String(answerVal) : "");
            });

            csvRows.push(rowData);
          });

          // Space rows
          csvRows.push([]);
          csvRows.push([]);
        });

        downloadCSV(`Feedback_Responses_Report_DeviceGrouped_${new Date().toISOString().slice(0, 10)}.csv`, csvRows);
      }

      toast.success("Feedback report downloaded successfully!");
      setDownloadModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to download responses report.");
    } finally {
      setDownloading(false);
    }
  };

  // Download Customer Sentiment & Stars Summary directly
  const handleDownloadSentimentSummary = async () => {
    try {
      const data = await Responses.reportList();
      const list = data.responses || [];
      if (list.length === 0) {
        toast.error("No survey response data to summarize.");
        return;
      }

      let starCount = 0;
      let starSum = 0;
      let promoters = 0;
      let passives = 0;
      let detractors = 0;

      list.forEach((r) => {
        if (r.rating !== null) {
          starCount++;
          starSum += r.rating;
        }

        // Loop inside answers to look for any NPS question type
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
      const npsScore = totalNps > 0 ? Math.round(((promoters - detractors) / totalNps) * 100) : "N/A";
      const avgStars = starCount > 0 ? (starSum / starCount).toFixed(2) : "N/A";

      const csvRows = [
        ["Sentiment Metric Summary Report"],
        ["Generated At", new Date().toLocaleString()],
        [],
        ["Metric Title", "Computed Value", "Sample Size Count"],
        ["Average Stars Rating", avgStars, String(starCount)],
        ["NPS Score (-100 to 100)", String(npsScore), String(totalNps)],
        ["NPS Promoters (9-10)", String(promoters), String(promoters)],
        ["NPS Passives (7-8)", String(passives), String(passives)],
        ["NPS Detractors (0-6)", String(detractors), String(detractors)],
      ];

      downloadCSV(`Customer_Sentiment_Report_${new Date().toISOString().slice(0, 10)}.csv`, csvRows);
      toast.success("Sentiment summary report downloaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to download summary.");
    }
  };

  // Download Device performance directory directly
  const handleDownloadDevicePerformance = () => {
    if (devices.length === 0) {
      toast.error("No active devices found to build directory.");
      return;
    }

    const headers = [
      "Device ID",
      "Device Name",
      "Sync Code",
      "Current Status",
      "Assigned Template ID",
      "Last Activity (Sync)",
    ];

    const csvRows = [
      ["Registered Devices and Performance Log"],
      ["Generated At", new Date().toLocaleString()],
      [],
      headers,
    ];

    devices.forEach((d) => {
      csvRows.push([
        String(d.id),
        d.name,
        d.pairing_code || "Paired",
        d.status || "offline",
        d.template_id ? String(d.template_id) : "None",
        d.last_sync ? new Date(d.last_sync).toLocaleString() : "Never",
      ]);
    });

    downloadCSV(`Devices_Performance_Report_${new Date().toISOString().slice(0, 10)}.csv`, csvRows);
    toast.success("Devices directory downloaded successfully!");
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Reports Control Center"
        description="Build and extract premium CSV summaries of reviews, tablets, and customer answers."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Card 1: Feedback Responses Report (Recommended) */}
        <GlassCard className="flex flex-col justify-between border border-white/5 relative group overflow-hidden">
          <div className="absolute top-3 right-3 bg-primary/20 text-primary border border-primary/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
            Recommended
          </div>
          <div>
            <div className="size-10 rounded-xl bg-primary/10 grid place-items-center mb-4 border border-primary/20">
              <FileText className="size-5 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
              Feedback Responses Report
              <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full font-medium">
                CSV
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-sm">
              A complete person-wise view of survey answers, rating stars, and duration logs. Includes customizable device and date range selections.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Info className="size-3.5" /> Generates unified or grouped grids
            </span>
            <Button
              size="sm"
              className="text-xs h-8 text-primary border border-primary/20 hover:bg-primary/5 bg-transparent font-medium"
              onClick={() => setDownloadModalOpen(true)}
            >
              <Download className="size-3.5 mr-1" /> Build report
            </Button>
          </div>
        </GlassCard>

        {/* Card 2: Customer Sentiment & Stars Summary */}
        <GlassCard className="flex flex-col justify-between border border-white/5">
          <div>
            <div className="size-10 rounded-xl bg-emerald-500/10 grid place-items-center mb-4 border border-emerald-500/20">
              <Sparkles className="size-5 text-emerald-400" />
            </div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
              Sentiment & NPS Report
              <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full font-medium">
                CSV
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-sm">
              Aggregated ratings overview detailing the Net Promoter Score (NPS) breakdown, average star scores, and promoter ratios.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Info className="size-3.5" /> Quick calculation on active reviews
            </span>
            <Button
              size="sm"
              className="text-xs h-8 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/5 bg-transparent font-medium"
              onClick={handleDownloadSentimentSummary}
            >
              <Download className="size-3.5 mr-1" /> Build report
            </Button>
          </div>
        </GlassCard>

        {/* Card 3: Device Performance Directory */}
        <GlassCard className="flex flex-col justify-between border border-white/5">
          <div>
            <div className="size-10 rounded-xl bg-blue-500/10 grid place-items-center mb-4 border border-blue-500/20">
              <Smartphone className="size-5 text-blue-400" />
            </div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
              Devices Directory Log
              <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full font-medium">
                CSV
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-sm">
              Detailed registry of paired device terminals, current synchronization status codes, templates linked, and total activity levels.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Info className="size-3.5" /> Sync timestamps and pairing codes
            </span>
            <Button
              size="sm"
              className="text-xs h-8 text-blue-400 border border-blue-500/20 hover:bg-blue-500/5 bg-transparent font-medium"
              onClick={handleDownloadDevicePerformance}
            >
              <Download className="size-3.5 mr-1" /> Build report
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* ======================================================== */}
      {/* DIALOG: Build Responses CSV Options                      */}
      {/* ======================================================== */}
      <Dialog open={downloadModalOpen} onOpenChange={setDownloadModalOpen}>
        <DialogContent className="max-w-md border border-white/10 bg-[#0d0f12]/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle>Configure Export Options</DialogTitle>
            <DialogDescription>
              Select devices, date filters, and formats to build your CSV feedback log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Device Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Device Filter</Label>
              <select
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
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

            {/* Date Range Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">From Date</Label>
                <Input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-xs h-9 text-foreground focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">To Date</Label>
                <Input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-xs h-9 text-foreground focus-visible:ring-primary/40"
                />
              </div>
            </div>

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
                    Matches similar question texts across different templates into clean aligned columns. Perfect for global cross-tablet aggregates.
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
