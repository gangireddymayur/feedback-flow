import { U as reactExports, L as jsxRuntimeExports } from "./server-BjZrcKJ1.js";
import { u as useQuery } from "./useQuery-DN6GGuBd.js";
import { l as createLucideIcon, D as DashboardLayout, P as PageHeader, B as Button, G as GlassCard, S as Search, I as Input, d as LoadingState, E as ErrorState, e as Responses } from "./router-Cu5MaWKe.js";
import { S as Star } from "./star-CTKRvx-8.js";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
const __iconNode$1 = [
  ["path", { d: "M12 15V3", key: "m9g1x1" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["path", { d: "m7 10 5 5 5-5", key: "brsn70" }]
];
const Download = createLucideIcon("download", __iconNode$1);
const __iconNode = [
  [
    "path",
    {
      d: "M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z",
      key: "sc7q7i"
    }
  ]
];
const Funnel = createLucideIcon("funnel", __iconNode);
function ResponsesPage() {
  const {
    data,
    isLoading,
    error
  } = useQuery({
    queryKey: ["responses"],
    queryFn: () => Responses.list(),
    refetchInterval: 1e4
  });
  const [q, setQ] = reactExports.useState("");
  const list = (data?.responses ?? []).filter((r) => !q || r.template.toLowerCase().includes(q.toLowerCase()) || r.device.toLowerCase().includes(q.toLowerCase()));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DashboardLayout, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(PageHeader, { title: "Responses", description: "Real-time customer feedback across all paired devices.", actions: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "outline", className: "bg-white/5 border-white/10", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Funnel, { className: "size-4" }),
        " Filter"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { className: "size-4" }),
        " Export"
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(GlassCard, { className: "p-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative max-w-md", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: q, onChange: (e) => setQ(e.target.value), placeholder: "Search responses, devices…", className: "pl-9 bg-white/5 border-white/10" })
    ] }) }),
    isLoading && /* @__PURE__ */ jsxRuntimeExports.jsx(LoadingState, {}),
    error && /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorState, { message: error.message }),
    !isLoading && !error && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
      list.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(GlassCard, { className: "text-center text-muted-foreground py-10 text-sm", children: "No responses yet." }),
      list.map((r) => {
        const rating = r.rating ?? 0;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs(GlassCard, { className: "flex flex-wrap items-center gap-4 hover:bg-white/[0.07] transition-colors", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-0.5 shrink-0", children: Array.from({
            length: 5
          }).map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Star, { className: `size-4 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}` }, i)) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium text-sm", children: r.template }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground", children: r.device })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-right", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-sm", children: new Date(r.submitted_at).toLocaleString() }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-xs text-muted-foreground", children: [
              r.duration_seconds,
              "s"
            ] })
          ] })
        ] }, r.id);
      })
    ] })
  ] });
}
export {
  ResponsesPage as component
};
