import { U as reactExports, L as jsxRuntimeExports } from "./server-BjZrcKJ1.js";
import { u as useQuery } from "./useQuery-DN6GGuBd.js";
import { l as createLucideIcon, W as useQueryClient, a as Admins, D as DashboardLayout, P as PageHeader, B as Button, I as Input, d as LoadingState, E as ErrorState, G as GlassCard } from "./router-Cu5MaWKe.js";
import { u as useMutation, E as Ellipsis } from "./ellipsis-ChjkptmS.js";
import { D as Dialog, f as DialogTrigger, a as DialogContent, d as DialogHeader, e as DialogTitle, c as DialogFooter } from "./dialog-CrDvHtry.js";
import { L as Label } from "./label-CUb57ZAf.js";
import { t as toast } from "./index-Be89TqLj.js";
import { P as Plus } from "./plus-C7QChGYs.js";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./index-DmCPkdnE.js";
const __iconNode = [
  ["path", { d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7", key: "132q7q" }],
  ["rect", { x: "2", y: "4", width: "20", height: "16", rx: "2", key: "izxlao" }]
];
const Mail = createLucideIcon("mail", __iconNode);
function AdminsPage() {
  const qc = useQueryClient();
  const {
    data,
    isLoading,
    error
  } = useQuery({
    queryKey: ["admins"],
    queryFn: () => Admins.list()
  });
  const admins = data?.admins ?? [];
  const [open, setOpen] = reactExports.useState(false);
  const [form, setForm] = reactExports.useState({
    name: "",
    email: "",
    password: ""
  });
  const create = useMutation({
    mutationFn: () => Admins.create({
      ...form,
      role: "sub"
    }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admins"]
      });
      toast.success("Admin invited");
      setOpen(false);
      setForm({
        name: "",
        email: "",
        password: ""
      });
    },
    onError: (e) => toast.error(e.message)
  });
  const setStatus = useMutation({
    mutationFn: ({
      id,
      status
    }) => Admins.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({
      queryKey: ["admins"]
    })
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DashboardLayout, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(PageHeader, { title: "Sub Admins", description: "Create, disable, and monitor admin accounts across the platform.", actions: /* @__PURE__ */ jsxRuntimeExports.jsxs(Dialog, { open, onOpenChange: setOpen, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { className: "size-4" }),
        " Invite Admin"
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { className: "glass-strong border-white/10 sm:max-w-md", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(DialogHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { children: "Invite a Sub Admin" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3 pt-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Name" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { className: "bg-white/5 border-white/10", value: form.name, onChange: (e) => setForm({
            ...form,
            name: e.target.value
          }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Email" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "email", className: "bg-white/5 border-white/10", value: form.email, onChange: (e) => setForm({
            ...form,
            email: e.target.value
          }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Temporary password" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "password", className: "bg-white/5 border-white/10", value: form.password, onChange: (e) => setForm({
            ...form,
            password: e.target.value
          }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DialogFooter, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { className: "w-full", disabled: create.isPending || !form.email || form.password.length < 8, onClick: () => create.mutate(), children: create.isPending ? "Creating…" : "Create admin" }) })
      ] })
    ] }) }),
    isLoading && /* @__PURE__ */ jsxRuntimeExports.jsx(LoadingState, {}),
    error && /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorState, { message: error.message }),
    !isLoading && !error && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", children: [
      admins.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(GlassCard, { className: "text-sm text-muted-foreground", children: "No sub admins yet." }),
      admins.map((a) => /* @__PURE__ */ jsxRuntimeExports.jsxs(GlassCard, { className: "hover:bg-white/[0.07] transition-colors", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-12 rounded-2xl bg-gradient-to-br from-cyan-400/40 to-fuchsia-400/40 grid place-items-center font-semibold", children: a.name.split(" ").map((p) => p[0]).slice(0, 2).join("") }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-semibold truncate", children: a.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-xs text-muted-foreground inline-flex items-center gap-1 truncate", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Mail, { className: "size-3" }),
              " ",
              a.email
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "icon", className: "size-8", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Ellipsis, { className: "size-4" }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-white/5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase text-muted-foreground", children: "Devices" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-semibold mt-0.5", children: a.devices })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase text-muted-foreground", children: "Templates" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-semibold mt-0.5", children: a.templates })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between mt-4 text-xs", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-muted-foreground", children: [
            "Joined ",
            new Date(a.created_at).toLocaleDateString()
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setStatus.mutate({
            id: a.id,
            status: a.status === "active" ? "disabled" : "active"
          }), className: `px-2 py-0.5 rounded-full ${a.status === "active" ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`, children: a.status })
        ] })
      ] }, a.id))
    ] })
  ] });
}
export {
  AdminsPage as component
};
