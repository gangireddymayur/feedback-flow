import { L as jsxRuntimeExports } from "./server-BjZrcKJ1.js";
import { U as useAuth, D as DashboardLayout, P as PageHeader, G as GlassCard, B as Button, I as Input } from "./router-Cu5MaWKe.js";
import { L as Label } from "./label-CUb57ZAf.js";
import { S as Switch } from "./switch-ByVfNcy1.js";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./index-DmCPkdnE.js";
function SettingsPage() {
  const auth = useAuth();
  if (!auth) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DashboardLayout, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(PageHeader, { title: "Settings", description: "Profile, notifications, and workspace preferences." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(GlassCard, { className: "lg:col-span-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "font-semibold mb-4", children: "Profile" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Full name", defaultValue: auth.name }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Email", defaultValue: auth.email }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Organization", defaultValue: "ReviewOS Demo Co." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Timezone", defaultValue: "UTC+05:30" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { className: "mt-5", children: "Save changes" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(GlassCard, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "font-semibold mb-4", children: "Notifications" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Toggle, { label: "New review submitted", defaultChecked: true }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Toggle, { label: "Low rating alert (≤2★)", defaultChecked: true }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Toggle, { label: "Device offline", defaultChecked: true }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Toggle, { label: "Weekly summary email" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Toggle, { label: "Sync failures", defaultChecked: true })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(GlassCard, { className: "lg:col-span-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "font-semibold mb-1", children: "Security" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mb-4", children: "Manage password and two-factor authentication." }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Current password", type: "password", defaultValue: "" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "New password", type: "password", defaultValue: "" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Confirm new password", type: "password", defaultValue: "" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between mt-5 pt-5 border-t border-white/5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium text-sm", children: "Two-factor authentication" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground", children: "Add an extra layer of security to your account." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Switch, {})
        ] })
      ] })
    ] })
  ] });
}
function Field({
  label,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { ...props, className: "bg-white/5 border-white/10" })
  ] });
}
function Toggle({
  label,
  defaultChecked
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Switch, { defaultChecked })
  ] });
}
export {
  SettingsPage as component
};
