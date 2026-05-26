import { a6 as useRouter, U as reactExports, L as jsxRuntimeExports } from "./server-BjZrcKJ1.js";
import { l as createLucideIcon, g as Sparkles, I as Input, B as Button, c as LoaderCircle, A as API_BASE, u as loginWithApi } from "./router-Cu5MaWKe.js";
import { L as Label } from "./label-CUb57ZAf.js";
import { t as toast } from "./index-Be89TqLj.js";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
const __iconNode = [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]
];
const ArrowRight = createLucideIcon("arrow-right", __iconNode);
function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = reactExports.useState("admin@reviewos.app");
  const [password, setPassword] = reactExports.useState("");
  const [loading, setLoading] = reactExports.useState(false);
  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await loginWithApi(email, password);
      router.navigate({
        to: "/"
      });
    } catch (err) {
      toast.error("Sign-in failed", {
        description: err.message
      });
    } finally {
      setLoading(false);
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-h-screen grid place-items-center px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full max-w-md glass-strong rounded-3xl p-8 shadow-2xl", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 mb-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-11 rounded-2xl bg-gradient-to-br from-[oklch(0.82_0.16_200)] to-[oklch(0.78_0.18_300)] grid place-items-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "size-5 text-background" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-lg font-semibold tracking-tight", children: "ReviewOS" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground", children: "Review Management Platform" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Welcome back" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mt-1 mb-6", children: "Sign in to manage your reviews." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: submit, className: "space-y-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "email", children: "Email" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "email", type: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: "bg-white/5 border-white/10" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "password", children: "Password" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "password", type: "password", required: true, value: password, onChange: (e) => setPassword(e.target.value), className: "bg-white/5 border-white/10" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "submit", disabled: loading, className: "w-full mt-2 group", children: loading ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        "Sign in ",
        /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "size-4 transition-transform group-hover:translate-x-0.5" })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[11px] text-center text-muted-foreground break-all", children: [
        "API: ",
        API_BASE || /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-rose-300", children: "VITE_API_URL not set" })
      ] })
    ] })
  ] }) });
}
export {
  LoginPage as component
};
