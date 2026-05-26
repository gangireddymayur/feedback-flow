import { L as jsxRuntimeExports } from "./server-BjZrcKJ1.js";
import { G as GlassCard, c as LoaderCircle, W as useQueryClient, D as DashboardLayout, P as PageHeader, B as Button, L as Link, T as Templates } from "./router-Cu5MaWKe.js";
import { u as useQuery } from "./useQuery-DN6GGuBd.js";
import { u as useMutation, E as Ellipsis } from "./ellipsis-ChjkptmS.js";
import { B as Badge } from "./badge-BoQSRN5B.js";
import { t as toast } from "./index-Be89TqLj.js";
import { P as Plus } from "./plus-C7QChGYs.js";
import { T as Trash2 } from "./trash-2-YCV6HAnz.js";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
function TemplatesPage() {
  const qc = useQueryClient();
  const {
    data,
    isLoading,
    error
  } = useQuery({
    queryKey: ["templates"],
    queryFn: () => Templates.list()
  });
  const del = useMutation({
    mutationFn: (id) => Templates.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["templates"]
      });
      toast.success("Template deleted");
    },
    onError: (e) => toast.error(e.message)
  });
  const templates = data?.templates ?? [];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DashboardLayout, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(PageHeader, { title: "Templates", description: "Drag-and-drop review forms — unlimited questions, live preview.", actions: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/templates/builder", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { className: "size-4" }),
      " New Template"
    ] }) }) }),
    isLoading && /* @__PURE__ */ jsxRuntimeExports.jsx(LoadingState, {}),
    error && /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorState, { message: error.message }),
    !isLoading && !error && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", children: [
      templates.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(GlassCard, { className: "group hover:bg-white/[0.07] transition-colors relative", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-1.5", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "secondary", className: "bg-white/5 text-[10px] uppercase tracking-wide", children: t.category }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(StatusBadge, { status: t.status })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "font-semibold tracking-tight truncate", children: t.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-1 line-clamp-2", children: t.description })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "icon", variant: "ghost", className: "size-8", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Ellipsis, { className: "size-4" }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-white/5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Questions", value: (t.questions ?? []).length }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Updated", value: new Date(t.updated_at).toLocaleDateString() })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-end mt-4 gap-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "icon", variant: "ghost", className: "size-7 text-rose-300", onClick: () => del.mutate(t.id), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "size-3.5" }) }) })
      ] }, t.id)),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/templates/builder", className: "glass rounded-2xl p-5 border border-dashed border-white/10 grid place-items-center min-h-[220px] hover:bg-white/5 transition-colors", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-center", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-12 rounded-2xl bg-white/5 grid place-items-center mx-auto mb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { className: "size-5 text-muted-foreground" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium", children: "Create new template" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground mt-1", children: "Open drag & drop builder" })
      ] }) })
    ] })
  ] });
}
function Stat({
  label,
  value
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-wide text-muted-foreground", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-sm font-semibold mt-0.5", children: value })
  ] });
}
function StatusBadge({
  status
}) {
  const map = {
    active: "bg-emerald-400/15 text-emerald-300 border-emerald-400/20",
    inactive: "bg-rose-400/15 text-rose-300 border-rose-400/20",
    draft: "bg-amber-400/15 text-amber-300 border-amber-400/20"
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${map[status]}`, children: status });
}
function LoadingState() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(GlassCard, { className: "grid place-items-center py-16 text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "size-5 animate-spin" }) });
}
function ErrorState({
  message
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(GlassCard, { className: "py-8 text-center border border-rose-400/20 bg-rose-500/5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-sm font-medium text-rose-300", children: "Couldn't load data" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground mt-1 break-all", children: message })
  ] });
}
export {
  ErrorState,
  LoadingState,
  TemplatesPage as component
};
