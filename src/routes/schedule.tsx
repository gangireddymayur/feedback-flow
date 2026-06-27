import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Copy as CopyIcon,
  Save,
  CalendarDays,
} from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Devices, Templates, Schedules, type ApiSchedule, type RepeatMode } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/schedule")({ component: SchedulePage });

// ---------- helpers ----------
const STEP_MIN = 15; // 15-minute granularity
const HOURS = 24;
const PX_PER_HOUR = 56; // 24 * 56 = 1344px tall timeline
const PX_PER_MIN = PX_PER_HOUR / 60;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PALETTE = [
  "oklch(0.78 0.18 200)",
  "oklch(0.78 0.18 300)",
  "oklch(0.82 0.16 140)",
  "oklch(0.82 0.16 60)",
  "oklch(0.78 0.18 20)",
  "oklch(0.78 0.18 340)",
];

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseHHMM(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function toHHMM(mins: number) {
  const m = Math.max(0, Math.min(24 * 60, mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${String(h).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function snap(mins: number) {
  return Math.round(mins / STEP_MIN) * STEP_MIN;
}

function scheduleActiveOn(s: ApiSchedule, dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  const start = new Date(s.start_date + "T00:00:00");
  if (d < start) return false;
  if (s.repeat_mode === "once") return s.start_date === dateISO;
  if (s.repeat_mode === "every_day") return true;
  if (s.repeat_mode === "weekdays") {
    return Array.isArray(s.weekdays) && s.weekdays.includes(d.getDay());
  }
  if (s.repeat_mode === "n_days") {
    const diff = Math.floor((d.getTime() - start.getTime()) / 86400000);
    return diff >= 0 && diff < (s.days_count || 1);
  }
  return false;
}

// ---------- page ----------
function SchedulePage() {
  const qc = useQueryClient();
  const devicesQ = useQuery({ queryKey: ["devices"], queryFn: () => Devices.list() });
  const templatesQ = useQuery({ queryKey: ["templates"], queryFn: () => Templates.list() });

  const devices = devicesQ.data?.devices ?? [];
  const templates = (templatesQ.data?.templates ?? []).filter((t) => t.status !== "inactive");

  const [deviceId, setDeviceId] = React.useState<number | null>(null);
  const [year, setYear] = React.useState<number>(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = React.useState<string>(toISO(new Date()));

  React.useEffect(() => {
    if (deviceId === null && devices.length > 0) setDeviceId(devices[0].id);
  }, [devices, deviceId]);

  const schedulesQ = useQuery({
    queryKey: ["schedules", deviceId],
    queryFn: () => Schedules.list(deviceId!),
    enabled: deviceId !== null,
  });
  const schedules = schedulesQ.data?.schedules ?? [];

  // Build a color map by template id (stable across the page)
  const templateColor = React.useMemo(() => {
    const m = new Map<number, string>();
    templates.forEach((t, i) => m.set(t.id, PALETTE[i % PALETTE.length]));
    return m;
  }, [templates]);

  // Windows active on the selected day (already includes repeats expanded)
  const dayWindows = React.useMemo(
    () => schedules.filter((s) => scheduleActiveOn(s, selectedDate)),
    [schedules, selectedDate],
  );

  // Days with any schedule (for highlighting on year calendar)
  const daysWithSchedule = React.useMemo(() => {
    const set = new Map<string, string[]>(); // ISO -> array of template colors
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = toISO(d);
      const matches = schedules.filter((s) => scheduleActiveOn(s, iso));
      if (matches.length) set.set(iso, matches.map((m) => templateColor.get(m.template_id) || "#888"));
    }
    return set;
  }, [schedules, year, templateColor]);

  if (devicesQ.isLoading || templatesQ.isLoading) {
    return (
      <DashboardLayout>
        <PageHeader title="Schedule" />
        <GlassCard>Loading…</GlassCard>
      </DashboardLayout>
    );
  }

  if (devices.length === 0) {
    return (
      <DashboardLayout>
        <PageHeader title="Schedule" />
        <GlassCard>
          <div className="text-sm text-muted-foreground">
            Pair a device first to start scheduling.
          </div>
        </GlassCard>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Schedule"
        description="Pick a device, click a day on the year calendar, then drag on the timeline to schedule which template plays when."
        actions={
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground hidden sm:block">Device</Label>
            <Select
              value={deviceId !== null ? String(deviceId) : ""}
              onValueChange={(v) => setDeviceId(Number(v))}
            >
              <SelectTrigger className="w-[240px] bg-white/5 border-white/10">
                <SelectValue placeholder="Select a device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name} {d.location ? `· ${d.location}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6">
        <YearCalendar
          year={year}
          onYearChange={setYear}
          selected={selectedDate}
          onSelect={setSelectedDate}
          marks={daysWithSchedule}
        />
        <DayEditor
          dateISO={selectedDate}
          deviceId={deviceId}
          devices={devices}
          templates={templates}
          schedules={schedules}
          windows={dayWindows}
          templateColor={templateColor}
          onChanged={() => qc.invalidateQueries({ queryKey: ["schedules", deviceId] })}
        />
      </div>
    </DashboardLayout>
  );
}

// ============================================================
//  Year calendar (left side)
// ============================================================
function YearCalendar({
  year,
  onYearChange,
  selected,
  onSelect,
  marks,
}: {
  year: number;
  onYearChange: (y: number) => void;
  selected: string;
  onSelect: (iso: string) => void;
  marks: Map<string, string[]>;
}) {
  const todayISO = toISO(new Date());
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" />
          <div className="font-medium">{year}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-7" onClick={() => onYearChange(year - 1)}>
            ‹
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => onYearChange(new Date().getFullYear())}>
            Today
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => onYearChange(year + 1)}>
            ›
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {MONTHS.map((name, mi) => (
          <MonthMini
            key={mi}
            year={year}
            month={mi}
            name={name}
            selected={selected}
            today={todayISO}
            onSelect={onSelect}
            marks={marks}
          />
        ))}
      </div>
    </GlassCard>
  );
}

function MonthMini({
  year,
  month,
  name,
  selected,
  today,
  onSelect,
  marks,
}: {
  year: number;
  month: number;
  name: string;
  selected: string;
  today: string;
  onSelect: (iso: string) => void;
  marks: Map<string, string[]>;
}) {
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISO(new Date(year, month, d));
    cells.push({ iso, day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2">
      <div className="text-[11px] font-medium text-muted-foreground mb-1 px-1">{name}</div>
      <div className="grid grid-cols-7 gap-[2px] text-[10px] text-muted-foreground/70 px-[2px] mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[2px]">
        {cells.map((c, i) =>
          c === null ? (
            <div key={i} className="aspect-square" />
          ) : (
            <button
              key={i}
              onClick={() => onSelect(c.iso)}
              className={cn(
                "aspect-square rounded-md text-[11px] flex items-center justify-center relative transition-colors",
                c.iso === selected
                  ? "bg-primary text-primary-foreground font-semibold"
                  : c.iso === today
                    ? "bg-white/10 text-foreground"
                    : "text-foreground/80 hover:bg-white/5",
              )}
            >
              {c.day}
              {marks.has(c.iso) && c.iso !== selected && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full"
                  style={{ background: marks.get(c.iso)![0] }}
                />
              )}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

// ============================================================
//  Day editor (right side)
// ============================================================
type DraftWindow = {
  template_id: number;
  start_min: number;
  end_min: number;
  repeat_mode: RepeatMode;
  weekdays: number[];
  days_count: number;
};

function DayEditor({
  dateISO,
  deviceId,
  devices,
  templates,
  schedules,
  windows,
  templateColor,
  onChanged,
}: {
  dateISO: string;
  deviceId: number | null;
  devices: { id: number; name: string }[];
  templates: { id: number; name: string }[];
  schedules: ApiSchedule[];
  windows: ApiSchedule[];
  templateColor: Map<number, string>;
  onChanged: () => void;
}) {
  const [draft, setDraft] = React.useState<DraftWindow | null>(null);
  const [applyDevices, setApplyDevices] = React.useState<number[]>([]);
  const [copyOpen, setCopyOpen] = React.useState(false);
  const [copyTargets, setCopyTargets] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (deviceId !== null) setApplyDevices([deviceId]);
  }, [deviceId]);

  const createMut = useMutation({
    mutationFn: (body: Parameters<typeof Schedules.create>[0]) => Schedules.create(body),
    onSuccess: () => {
      toast.success("Schedule saved");
      setDraft(null);
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => Schedules.remove(id),
    onSuccess: () => {
      toast.success("Window removed");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const copyMut = useMutation({
    mutationFn: () =>
      Schedules.copyDay({
        device_id: deviceId!,
        source_date: dateISO,
        target_dates: copyTargets,
      }),
    onSuccess: (r) => {
      toast.success(`Copied to ${r.created} day(s)`);
      setCopyOpen(false);
      setCopyTargets([]);
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // ---- drag-to-create on timeline ----
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{ startY: number; baseMin: number } | null>(null);

  function pxToMin(y: number) {
    return snap(y / PX_PER_MIN);
  }
  function handleTrackMouseDown(e: React.MouseEvent) {
    if (templates.length === 0) {
      toast.error("Create a template first");
      return;
    }
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const base = pxToMin(y);
    dragRef.current = { startY: y, baseMin: base };
    setDraft({
      template_id: templates[0].id,
      start_min: base,
      end_min: Math.min(24 * 60, base + 60),
      repeat_mode: "once",
      weekdays: [],
      days_count: 7,
    });
  }
  function handleTrackMouseMove(e: React.MouseEvent) {
    if (!dragRef.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const cur = pxToMin(y);
    setDraft((d) =>
      d
        ? {
            ...d,
            start_min: Math.min(dragRef.current!.baseMin, cur),
            end_min: Math.max(dragRef.current!.baseMin + STEP_MIN, cur),
          }
        : d,
    );
  }
  function handleTrackMouseUp() {
    dragRef.current = null;
  }

  const friendly = new Date(dateISO + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <div className="text-xs text-muted-foreground">Selected day</div>
          <div className="font-medium">{friendly}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-white/10 bg-white/5"
            onClick={() => setCopyOpen(true)}
            disabled={windows.length === 0}
          >
            <CopyIcon className="size-3.5 mr-1.5" /> Copy day
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[64px_1fr] gap-2">
        {/* hour labels */}
        <div className="flex flex-col text-[10px] text-muted-foreground/70 select-none">
          {Array.from({ length: HOURS + 1 }).map((_, h) => (
            <div
              key={h}
              style={{ height: h === HOURS ? 0 : PX_PER_HOUR }}
              className="border-r border-white/5 pr-1 text-right -mt-1.5"
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* timeline track */}
        <div
          ref={trackRef}
          onMouseDown={handleTrackMouseDown}
          onMouseMove={handleTrackMouseMove}
          onMouseUp={handleTrackMouseUp}
          onMouseLeave={handleTrackMouseUp}
          className="relative rounded-xl bg-white/[0.02] border border-white/5 select-none cursor-crosshair"
          style={{ height: HOURS * PX_PER_HOUR }}
        >
          {/* hour grid lines */}
          {Array.from({ length: HOURS }).map((_, h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-white/[0.04]"
              style={{ top: h * PX_PER_HOUR }}
            />
          ))}
          {/* saved windows */}
          {windows.map((w) => {
            const top = parseHHMM(w.start_time) * PX_PER_MIN;
            const height = (parseHHMM(w.end_time) - parseHHMM(w.start_time)) * PX_PER_MIN;
            const color = templateColor.get(w.template_id) || "oklch(0.78 0.18 200)";
            return (
              <div
                key={w.id}
                className="absolute left-1 right-1 rounded-lg p-2 text-xs overflow-hidden group"
                style={{
                  top,
                  height,
                  background: `color-mix(in oklch, ${color} 35%, transparent)`,
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{w.template_name}</div>
                    <div className="text-[10px] opacity-80">
                      {w.start_time} → {w.end_time}
                      {w.repeat_mode !== "once" && (
                        <span className="ml-1 px-1 rounded bg-white/10">
                          {w.repeat_mode === "every_day"
                            ? "daily"
                            : w.repeat_mode === "weekdays"
                              ? (w.weekdays || []).map((d) => WEEKDAYS[d][0]).join("")
                              : `${w.days_count}d`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMut.mutate(w.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition rounded p-0.5 hover:bg-white/10"
                    title="Remove"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {/* draft window */}
          {draft && (
            <div
              className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-primary/80 bg-primary/10 pointer-events-none"
              style={{
                top: draft.start_min * PX_PER_MIN,
                height: (draft.end_min - draft.start_min) * PX_PER_MIN,
              }}
            />
          )}
        </div>
      </div>

      {/* Draft editor */}
      {draft && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium text-sm">New window</div>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Template</Label>
              <Select
                value={String(draft.template_id)}
                onValueChange={(v) => setDraft({ ...draft, template_id: Number(v) })}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TimeStepper
              label="Start"
              valueMin={draft.start_min}
              onChange={(m) =>
                setDraft({ ...draft, start_min: Math.min(m, draft.end_min - STEP_MIN) })
              }
            />
            <TimeStepper
              label="End"
              valueMin={draft.end_min}
              onChange={(m) =>
                setDraft({ ...draft, end_min: Math.max(m, draft.start_min + STEP_MIN) })
              }
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Repeat</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(
                [
                  ["once", "Just this day"],
                  ["every_day", "Every day"],
                  ["weekdays", "Weekdays"],
                  ["n_days", "For N days"],
                ] as Array<[RepeatMode, string]>
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setDraft({ ...draft, repeat_mode: k })}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs border transition",
                    draft.repeat_mode === k
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white/5 border-white/10 hover:bg-white/10",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>

            {draft.repeat_mode === "weekdays" && (
              <div className="flex gap-1 mt-2">
                {WEEKDAYS.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const has = draft.weekdays.includes(i);
                      setDraft({
                        ...draft,
                        weekdays: has
                          ? draft.weekdays.filter((x) => x !== i)
                          : [...draft.weekdays, i].sort(),
                      });
                    }}
                    className={cn(
                      "size-8 rounded-md text-xs border",
                      draft.weekdays.includes(i)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white/5 border-white/10 hover:bg-white/10",
                    )}
                  >
                    {d[0]}
                  </button>
                ))}
              </div>
            )}

            {draft.repeat_mode === "n_days" && (
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-xs text-muted-foreground">For</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={draft.days_count}
                  onChange={(e) =>
                    setDraft({ ...draft, days_count: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="w-20 bg-white/5 border-white/10 h-8"
                />
                <span className="text-xs text-muted-foreground">days starting {dateISO}</span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Apply to devices</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {devices.map((d) => {
                const on = applyDevices.includes(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() =>
                      setApplyDevices(on ? applyDevices.filter((x) => x !== d.id) : [...applyDevices, d.id])
                    }
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs border",
                      on
                        ? "bg-primary/20 border-primary/60 text-foreground"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (applyDevices.length === 0) {
                  toast.error("Pick at least one device");
                  return;
                }
                if (draft.repeat_mode === "weekdays" && draft.weekdays.length === 0) {
                  toast.error("Pick at least one weekday");
                  return;
                }
                createMut.mutate({
                  device_ids: applyDevices,
                  template_id: draft.template_id,
                  start_time: toHHMM(draft.start_min),
                  end_time: toHHMM(draft.end_min),
                  repeat_mode: draft.repeat_mode,
                  start_date: dateISO,
                  weekdays: draft.repeat_mode === "weekdays" ? draft.weekdays : null,
                  days_count: draft.repeat_mode === "n_days" ? draft.days_count : null,
                });
              }}
              disabled={createMut.isPending}
            >
              <Save className="size-4 mr-1.5" />
              Save window
            </Button>
          </div>
        </div>
      )}

      {!draft && (
        <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
          <Plus className="size-3.5" />
          Tip: click and drag on the timeline above to create a window.
        </div>
      )}

      <CopyDayDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        sourceDate={dateISO}
        targets={copyTargets}
        setTargets={setCopyTargets}
        onConfirm={() => copyMut.mutate()}
        pending={copyMut.isPending}
      />
    </GlassCard>
  );
}

// ---------- subcomponents ----------
function TimeStepper({
  label,
  valueMin,
  onChange,
}: {
  label: string;
  valueMin: number;
  onChange: (m: number) => void;
}) {
  const h = Math.floor(valueMin / 60);
  const m = valueMin % 60;
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-stretch gap-1 mt-1">
        <Stepper value={h} onChange={(nv) => onChange(snap(nv * 60 + m))} max={23} pad />
        <span className="self-center text-muted-foreground">:</span>
        <Stepper
          value={m}
          step={STEP_MIN}
          onChange={(nv) => onChange(snap(h * 60 + nv))}
          max={60 - STEP_MIN}
          pad
        />
      </div>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  max,
  step = 1,
  pad,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
  step?: number;
  pad?: boolean;
}) {
  return (
    <div className="flex flex-col items-center rounded-md border border-white/10 bg-white/5 px-2 py-1">
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <div className="text-sm font-mono w-7 text-center">
        {pad ? String(value).padStart(2, "0") : value}
      </div>
      <button
        onClick={() => onChange(Math.max(0, value - step))}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className="size-3.5" />
      </button>
    </div>
  );
}

function CopyDayDialog({
  open,
  onOpenChange,
  sourceDate,
  targets,
  setTargets,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  sourceDate: string;
  targets: string[];
  setTargets: (t: string[]) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const [picker, setPicker] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy {sourceDate}</DialogTitle>
          <DialogDescription>
            Copies all one-off windows from this day to the dates you list below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="date"
              value={picker}
              onChange={(e) => setPicker(e.target.value)}
              className="bg-white/5 border-white/10"
            />
            <Button
              variant="outline"
              className="border-white/10 bg-white/5"
              onClick={() => {
                if (!picker) return;
                if (!targets.includes(picker)) setTargets([...targets, picker]);
                setPicker("");
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {targets.map((t) => (
              <span
                key={t}
                className="text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 flex items-center gap-1.5"
              >
                {t}
                <button
                  onClick={() => setTargets(targets.filter((x) => x !== t))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </span>
            ))}
            {targets.length === 0 && (
              <div className="text-xs text-muted-foreground">No target dates yet.</div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-white/10" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending || targets.length === 0}>
            <CopyIcon className="size-4 mr-1.5" /> Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
