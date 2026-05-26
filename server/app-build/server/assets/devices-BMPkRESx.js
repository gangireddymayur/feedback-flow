import { U as reactExports, L as jsxRuntimeExports } from "./server-BjZrcKJ1.js";
import { u as useQuery } from "./useQuery-DN6GGuBd.js";
import { l as createLucideIcon, W as useQueryClient, b as Devices, D as DashboardLayout, P as PageHeader, B as Button, I as Input, d as LoadingState, E as ErrorState, G as GlassCard, f as Smartphone } from "./router-Cu5MaWKe.js";
import { u as useMutation, E as Ellipsis } from "./ellipsis-ChjkptmS.js";
import { D as Dialog, f as DialogTrigger, a as DialogContent, d as DialogHeader, e as DialogTitle, b as DialogDescription, c as DialogFooter } from "./dialog-CrDvHtry.js";
import { L as Label } from "./label-CUb57ZAf.js";
import { t as toast } from "./index-Be89TqLj.js";
import { P as Plus } from "./plus-C7QChGYs.js";
import { T as Trash2 } from "./trash-2-YCV6HAnz.js";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./index-DmCPkdnE.js";
const __iconNode = [
  [
    "path",
    {
      d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
      key: "1r0f0z"
    }
  ],
  ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }]
];
const MapPin = createLucideIcon("map-pin", __iconNode);
function DevicesPage() {
  const qc = useQueryClient();
  const {
    data,
    isLoading,
    error
  } = useQuery({
    queryKey: ["devices"],
    queryFn: () => Devices.list(),
    refetchInterval: 15e3
  });
  const devices = data?.devices ?? [];
  const [open, setOpen] = reactExports.useState(false);
  const [code, setCode] = reactExports.useState("");
  const [name, setName] = reactExports.useState("");
  const [location, setLocation] = reactExports.useState("");
  const pair = useMutation({
    mutationFn: () => Devices.pair(code, name, location),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["devices"]
      });
      toast.success("Device paired");
      setOpen(false);
      setCode("");
      setName("");
      setLocation("");
    },
    onError: (e) => toast.error(e.message)
  });
  const del = useMutation({
    mutationFn: (id) => Devices.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["devices"]
      });
      toast.success("Removed");
    }
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DashboardLayout, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(PageHeader, { title: "Devices", description: "Pair Android-based review devices, monitor health, push templates instantly.", actions: /* @__PURE__ */ jsxRuntimeExports.jsxs(Dialog, { open, onOpenChange: setOpen, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { className: "size-4" }),
        " Pair Device"
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { className: "glass-strong border-white/10 sm:max-w-md", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { children: "Pair a new device" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { children: "Enter the 6-digit code shown by the ReviewOS app on the device." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3 pt-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "code", children: "Pairing code" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "code", placeholder: "• • • • • •", maxLength: 6, value: code, onChange: (e) => setCode(e.target.value.replace(/\D/g, "")), className: "text-center text-2xl tracking-[0.5em] bg-white/5 border-white/10 h-14" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "dname", children: "Device name" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "dname", value: name, onChange: (e) => setName(e.target.value), className: "bg-white/5 border-white/10", placeholder: "Lobby Tablet" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "dloc", children: "Location" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "dloc", value: location, onChange: (e) => setLocation(e.target.value), className: "bg-white/5 border-white/10", placeholder: "Downtown Branch" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DialogFooter, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { className: "w-full", onClick: () => pair.mutate(), disabled: pair.isPending || code.length !== 6 || !name, children: pair.isPending ? "Pairing…" : "Pair device" }) })
      ] })
    ] }) }),
    isLoading && /* @__PURE__ */ jsxRuntimeExports.jsx(LoadingState, {}),
    error && /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorState, { message: error.message }),
    !isLoading && !error && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Total", value: devices.length }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Online", value: devices.filter((d) => d.status === "online").length, tone: "success" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Syncing", value: devices.filter((d) => d.status === "syncing").length, tone: "warn" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Offline", value: devices.filter((d) => d.status === "offline").length, tone: "danger" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(GlassCard, { className: "p-0 overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { className: "text-xs text-muted-foreground border-b border-white/5", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "text-left font-medium px-5 py-3", children: "Device" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "text-left font-medium px-3 py-3", children: "Status" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "text-left font-medium px-3 py-3", children: "Android" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "text-left font-medium px-3 py-3", children: "Last sync" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "text-right font-medium px-3 py-3", children: "Today" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
          devices.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 6, className: "px-5 py-8 text-center text-muted-foreground", children: 'No devices yet. Click "Pair Device" to add one.' }) }),
          devices.map((d) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-5 py-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-8 rounded-lg bg-white/5 grid place-items-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Smartphone, { className: "size-4 text-muted-foreground" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium", children: d.name }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-xs text-muted-foreground flex items-center gap-1 mt-0.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(MapPin, { className: "size-3" }),
                  " ",
                  d.location || "—"
                ] })
              ] })
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(StatusPill, { status: d.status }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-4 text-muted-foreground", children: d.android_version ?? "—" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-4 text-muted-foreground", children: d.last_sync ? new Date(d.last_sync).toLocaleString() : "never" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-4 text-right font-semibold", children: d.responses_today }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-end gap-1", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "icon", variant: "ghost", className: "size-7 text-rose-300", onClick: () => del.mutate(d.id), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "size-3.5" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "icon", variant: "ghost", className: "size-7", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Ellipsis, { className: "size-3.5" }) })
            ] }) })
          ] }, d.id))
        ] })
      ] }) }) })
    ] })
  ] });
}
function Stat({
  label,
  value,
  tone = "default"
}) {
  const cls = {
    default: "text-primary",
    success: "text-emerald-300",
    warn: "text-amber-300",
    danger: "text-rose-300"
  }[tone];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(GlassCard, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `text-3xl font-semibold mt-1 ${cls}`, children: value })
  ] });
}
function StatusPill({
  status
}) {
  const map = {
    online: ["bg-emerald-400/15 text-emerald-300", "Online"],
    offline: ["bg-rose-400/15 text-rose-300", "Offline"],
    syncing: ["bg-amber-400/15 text-amber-300", "Syncing"]
  };
  const [cls, label] = map[status];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: `inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${cls}`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-1.5 rounded-full bg-current animate-pulse" }),
    " ",
    label
  ] });
}
export {
  DevicesPage as component
};
