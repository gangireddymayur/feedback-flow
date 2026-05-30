import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { Auth, Profile, Notifications } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const SUPER_TOGGLES = [
  { name: "new_sub_admin", label: "New sub-admin invited", def: true },
  { name: "sub_disabled", label: "Sub-admin disabled", def: true },
  { name: "weekly_summary", label: "Org weekly summary", def: true },
  { name: "billing", label: "Billing & usage alerts", def: true },
  { name: "security", label: "Security sign-in alerts", def: true },
];
const SUB_TOGGLES = [
  { name: "new_review", label: "New review submitted", def: true },
  { name: "low_rating", label: "Low rating alert (≤2★)", def: true },
  { name: "device_offline", label: "Device offline", def: true },
  { name: "weekly_email", label: "Weekly summary email", def: false },
  { name: "sync_fail", label: "Sync failures", def: true },
];

function SettingsPage() {
  const auth = useAuth();
  const qc = useQueryClient();

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => Profile.get(), enabled: !!auth });
  const prefsQ = useQuery({ queryKey: ["notif-prefs"], queryFn: () => Notifications.get(), enabled: !!auth });

  const [profile, setProfile] = React.useState({ name: "", email: "", organization: "", timezone: "UTC" });
  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" });

  React.useEffect(() => {
    if (!auth) return;
    setProfile({
      name: auth.name,
      email: auth.email,
      organization: profileQ.data?.profile.organization ?? "",
      timezone: profileQ.data?.profile.timezone ?? "UTC",
    });
  }, [auth, profileQ.data]);

  const saveProfile = useMutation({
    mutationFn: () =>
      Profile.update({ organization: profile.organization, timezone: profile.timezone, avatar_url: null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Profile updated"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const changePw = useMutation({
    mutationFn: () => Auth.changePassword(pw.current, pw.next),
    onSuccess: () => { toast.success("Password updated"); setPw({ current: "", next: "", confirm: "" }); },
    onError: (e) => toast.error((e as Error).message),
  });

  function onChangePassword() {
    if (!pw.current || pw.next.length < 8) return toast.error("New password must be 8+ characters");
    if (pw.next !== pw.confirm) return toast.error("Passwords don't match");
    changePw.mutate();
  }

  if (!auth) return null;
  const toggles = auth.role === "super" ? SUPER_TOGGLES : SUB_TOGGLES;

  return (
    <DashboardLayout>
      <PageHeader title="Settings" description="Profile, notifications, and workspace preferences." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <h3 className="font-semibold mb-4">Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <Field label="Email" value={profile.email} disabled />
            <Field label="Organization" value={profile.organization} onChange={(e) => setProfile({ ...profile, organization: e.target.value })} />
            <Field label="Timezone" value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} />
          </div>
          <Button className="mt-5" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending ? "Saving…" : "Save changes"}
          </Button>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-1">Notifications</h3>
          <p className="text-xs text-muted-foreground mb-4">
            {auth.role === "super" ? "Org-level alerts only." : "Operational alerts for your devices."}
          </p>
          <div className="space-y-4">
            {toggles.map((t) => (
              <Toggle
                key={t.name}
                name={t.name}
                label={t.label}
                checked={prefsQ.data?.prefs[t.name] ?? t.def}
              />
            ))}
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-3">
          <h3 className="font-semibold mb-1">Security</h3>
          <p className="text-xs text-muted-foreground mb-4">Update your account password.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Current password" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <Field label="New password" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <Field label="Confirm new password" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </div>
          <Button className="mt-5" onClick={onChangePassword} disabled={changePw.isPending}>
            {changePw.isPending ? "Updating…" : "Update password"}
          </Button>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input {...props} className="bg-white/5 border-white/10" />
    </div>
  );
}

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (v: boolean) => Notifications.update({ [name]: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["notif-prefs"] });
      const prev = qc.getQueryData<{ prefs: Record<string, boolean> }>(["notif-prefs"]);
      qc.setQueryData(["notif-prefs"], { prefs: { ...(prev?.prefs ?? {}), [name]: v } });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["notif-prefs"], ctx.prev); toast.error("Couldn't save"); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-prefs"] }),
  });
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={(v) => m.mutate(v)} />
    </div>
  );
}
