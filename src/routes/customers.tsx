import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Star,
  Search,
  Clock,
  Smartphone,
  FileText,
  MapPin,
  X,
  User,
  Mail,
  Phone,
  Calendar,
  Filter,
  CheckCircle2,
} from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Responses, Devices, Templates, ApiResponse, ApiTemplate } from "@/lib/api";
import { LoadingState, ErrorState } from "@/routes/templates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/customers")({ component: CustomersPage });

function CustomersPage() {
  const responsesQ = useQuery({
    queryKey: ["responses"],
    queryFn: () => Responses.list(),
    refetchInterval: 10000,
  });

  const devicesQ = useQuery({
    queryKey: ["devices"],
    queryFn: () => Devices.list(),
  });

  const templatesQ = useQuery({
    queryKey: ["templates"],
    queryFn: () => Templates.list(),
  });

  const [q, setQ] = React.useState("");
  const [selectedRating, setSelectedRating] = React.useState<string>("all");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("all");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<number | null>(null);

  const allResponses = responsesQ.data?.responses ?? [];
  const devices = devicesQ.data?.devices ?? [];
  const templates = templatesQ.data?.templates ?? [];

  const isLoading = responsesQ.isLoading || devicesQ.isLoading || templatesQ.isLoading;
  const isError = responsesQ.isError || devicesQ.isError || templatesQ.isError;
  const errorObj = responsesQ.error || devicesQ.error || templatesQ.error;

  // Map raw responses to flat customer list
  const customers = React.useMemo(() => {
    const list: Array<{
      id: number; // response ID
      name: string;
      email: string;
      phone: string;
      rating: number | null;
      submittedAt: string;
      device: string;
      deviceLocation: string;
      template: string;
      answers: Record<string, unknown>;
      templateQuestions: ApiTemplate["questions"];
      response: ApiResponse;
    }> = [];

    allResponses.forEach((r) => {
      const name = (r.answers?.customer_name as string) || (r.answers?.name as string) || "";
      const email = (r.answers?.customer_email as string) || (r.answers?.email as string) || "";
      const phone = (r.answers?.customer_phone as string) || (r.answers?.phone as string) || "";

      if (name || email || phone) {
        // Resolve location
        const dev = devices.find((d) => d.id === r.device_id);
        list.push({
          id: r.id,
          name: name.trim() || "Anonymous Customer",
          email: email.trim() || "—",
          phone: phone.trim() || "—",
          rating: r.rating,
          submittedAt: r.submitted_at,
          device: r.device,
          deviceLocation: dev?.location || "—",
          template: r.template,
          answers: r.answers || {},
          templateQuestions: r.template_questions || [],
          response: r,
        });
      }
    });

    return list;
  }, [allResponses, devices]);

  // Apply filters
  const filteredCustomers = React.useMemo(() => {
    return customers.filter((c) => {
      // 1. Text Search Filter
      if (q.trim()) {
        const needle = q.toLowerCase();
        const match =
          c.name.toLowerCase().includes(needle) ||
          c.email.toLowerCase().includes(needle) ||
          c.phone.toLowerCase().includes(needle) ||
          c.device.toLowerCase().includes(needle) ||
          c.template.toLowerCase().includes(needle);
        if (!match) return false;
      }

      // 2. Rating Filter
      if (selectedRating !== "all") {
        if (selectedRating === "satisfied") {
          if (c.rating !== null && c.rating < 4) return false;
        } else if (selectedRating === "unsatisfied") {
          if (c.rating === null || c.rating >= 4) return false;
        }
      }

      // 3. Template Filter
      if (selectedTemplateId !== "all") {
        if (String(c.response.template_id) !== selectedTemplateId) return false;
      }

      return true;
    });
  }, [customers, q, selectedRating, selectedTemplateId]);

  // Handle selected customer details
  const selectedCustomer = React.useMemo(() => {
    if (selectedCustomerId === null) return null;
    return customers.find((c) => c.id === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);

  // Auto-select first customer
  React.useEffect(() => {
    if (selectedCustomerId === null && filteredCustomers.length > 0) {
      setSelectedCustomerId(filteredCustomers[0].id);
    }
  }, [filteredCustomers, selectedCustomerId]);

  // Renders inline formatted answer values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderAnswerValue = (qItem: any, val: any) => {
    if (val == null) return null;
    const qType = typeof qItem === "string" ? qItem : qItem?.type;

    switch (qType) {
      case "rating": {
        const score = Number(val) || 0;
        const totalStars = (typeof qItem === "object" && qItem?.maxStars) || 5;
        const starLabels = (typeof qItem === "object" && qItem?.starLabels) || [];
        const label = starLabels[score - 1];
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {Array.from({ length: totalStars }).map((_, idx) => (
                  <Star
                    key={idx}
                    className={cn(
                      "size-4.5",
                      idx < score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
                    )}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold">
                ({score} / {totalStars})
              </span>
            </div>
            {label && (
              <span className="text-[10px] text-amber-200/90 italic -mt-0.5">
                Label: {label}
              </span>
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
        const customEmojis = (typeof qItem === "object" && qItem?.emojis) || [];
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
        };
        const label = emojiMap[valStr] || valStr;
        return <span className="text-sm font-medium text-amber-200">{label}</span>;
      }

      case "yes_no": {
        const yes = String(val).toLowerCase() === "yes" || val === true || String(val) === "1";
        const customYes = (typeof qItem === "object" && qItem?.yesLabel) || "Yes";
        const customNo = (typeof qItem === "object" && qItem?.noLabel) || "No";
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
            ? val.split(",").map((v: string) => v.trim())
            : [String(val)];
        return (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {vals.map((v: string, idx: number) => (
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

  const errorMessage = (err: unknown) => (err as Error).message || "Server error";

  return (
    <DashboardLayout>
      <PageHeader
        title="Customer Directory"
        description="View contact information submitted by customers paired with their survey responses."
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={errorMessage(errorObj)} />}

      {!isLoading && !isError && (
        <div className="grid grid-cols-12 gap-5">
          {/* Main customers list column */}
          <div className={cn(selectedCustomer ? "col-span-12 lg:col-span-7" : "col-span-12")}>
            <GlassCard className="p-4 space-y-4">
              {/* Search & Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, email, phone..."
                    className="pl-9 bg-white/5 border-white/10 text-xs focus-visible:ring-primary/40 h-9"
                  />
                </div>

                <select
                  value={selectedRating}
                  onChange={(e) => setSelectedRating(e.target.value)}
                  className="bg-white/5 border border-white/10 text-xs rounded-xl h-9 px-3 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 cursor-pointer"
                >
                  <option value="all" className="bg-popover text-foreground">
                    All Ratings
                  </option>
                  <option value="satisfied" className="bg-popover text-foreground">
                    Satisfied (4+ Stars)
                  </option>
                  <option value="unsatisfied" className="bg-popover text-foreground">
                    Unsatisfied (≤3 Stars)
                  </option>
                </select>

                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="bg-white/5 border border-white/10 text-xs rounded-xl h-9 px-3 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 cursor-pointer max-w-[200px]"
                >
                  <option value="all" className="bg-popover text-foreground">
                    All Surveys
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={String(t.id)} className="bg-popover text-foreground">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Table list */}
              <div className="overflow-x-auto border-t border-white/5 pt-2">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground uppercase tracking-wider border-b border-white/5 text-[10px]">
                    <tr>
                      <th className="text-left font-semibold px-3 py-3">Customer</th>
                      <th className="text-left font-semibold px-3 py-3">Contact</th>
                      <th className="text-left font-semibold px-3 py-3 hidden sm:table-cell">Survey Info</th>
                      <th className="text-left font-semibold px-3 py-3 w-16">Score</th>
                      <th className="text-right font-semibold px-3 py-3">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground italic">
                          No customer contact details found matching criteria.
                        </td>
                      </tr>
                    )}
                    {filteredCustomers.map((c) => {
                      const isActive = selectedCustomerId === c.id;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedCustomerId(c.id)}
                          className={cn(
                            "border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors cursor-pointer",
                            isActive && "bg-primary/[0.06] border-primary/20",
                          )}
                        >
                          <td className="px-3 py-3.5 font-medium flex items-center gap-2">
                            <div className="size-6 rounded-full bg-primary/10 grid place-items-center text-primary shrink-0">
                              <User className="size-3" />
                            </div>
                            <span className="truncate max-w-[150px] font-semibold text-foreground">
                              {c.name}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex flex-col gap-0.5 max-w-[180px]">
                              {c.email !== "—" && (
                                <span className="flex items-center gap-1 text-muted-foreground truncate">
                                  <Mail className="size-3" /> {c.email}
                                </span>
                              )}
                              {c.phone !== "—" && (
                                <span className="flex items-center gap-1 text-muted-foreground truncate">
                                  <Phone className="size-3" /> {c.phone}
                                </span>
                              )}
                              {c.email === "—" && c.phone === "—" && (
                                <span className="text-muted-foreground/45">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3.5 hidden sm:table-cell">
                            <div className="flex flex-col gap-0.5 text-muted-foreground max-w-[180px]">
                              <span className="flex items-center gap-1 truncate text-foreground/90 font-medium">
                                <FileText className="size-3 text-muted-foreground" /> {c.template}
                              </span>
                              <span className="flex items-center gap-1 truncate text-[10px]">
                                <Smartphone className="size-3" /> {c.device} ({c.deviceLocation})
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            {c.rating ? (
                              <div className="flex items-center gap-0.5">
                                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                                <span className="font-bold text-amber-200">{c.rating}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-right text-muted-foreground">
                            <div>
                              {new Date(c.submittedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </div>
                            <div className="text-[10px] opacity-75 mt-0.5">
                              {new Date(c.submittedAt).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>

          {/* Customer review details sidebar column */}
          {selectedCustomer && (
            <div className="col-span-12 lg:col-span-5 animate-in slide-in-from-right-3 duration-300">
              <GlassCard className="p-5 space-y-5 border border-white/10 relative">
                {/* Close button */}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSelectedCustomerId(null)}
                  className="absolute top-4 right-4 size-8 border border-white/5 bg-white/5 hover:bg-white/10 cursor-pointer rounded-full"
                >
                  <X className="size-4" />
                </Button>

                <div>
                  <h3 className="font-semibold text-base text-foreground">Review Details</h3>
                  <p className="text-xs text-muted-foreground">Review session #{selectedCustomer.id}</p>
                </div>

                {/* Customer contact card */}
                <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 space-y-2.5">
                  <div className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                    <User className="size-3.5" /> Customer Contact Info
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    <div className="text-sm font-bold text-foreground">{selectedCustomer.name}</div>
                    {selectedCustomer.email !== "—" && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 select-all">
                        <Mail className="size-3.5" /> {selectedCustomer.email}
                      </div>
                    )}
                    {selectedCustomer.phone !== "—" && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 select-all">
                        <Phone className="size-3.5" /> {selectedCustomer.phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Device & session metadata */}
                <div className="grid grid-cols-2 gap-3 text-xs border-t border-b border-white/5 py-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Terminal Tablet</span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <Smartphone className="size-3.5 text-muted-foreground" /> {selectedCustomer.device}
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      <MapPin className="size-3 inline" /> {selectedCustomer.deviceLocation}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Date & Time</span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      {new Date(selectedCustomer.submittedAt).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(selectedCustomer.submittedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Responses list */}
                <div className="space-y-4 pt-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 text-primary" /> Survey Questionnaire Responses
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {selectedCustomer.templateQuestions.map((qItem) => {
                      const val = selectedCustomer.answers[qItem.id];
                      if (val === undefined || val === null) return null;
                      if (["customer_info"].includes(qItem.type)) return null; // skip contact info card rendering

                      return (
                        <div key={qItem.id} className="space-y-1 bg-white/[0.01] border border-white/5 rounded-xl p-3">
                          <label className="text-xs font-semibold text-muted-foreground block leading-normal">
                            {qItem.label}
                          </label>
                          <div className="pt-0.5">{renderAnswerValue(qItem, val)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
