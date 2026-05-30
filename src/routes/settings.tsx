import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const auth = useAuth();
  const [profile, setProfile] = React.useState({ name: "", email: "", organization: "ReviewOS Demo Co.", timezone: "UTC+05:30" });
  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" });

  React.useEffect(() => {
    if (!auth) return;
    const extra = (() => {
      try { return JSON.parse(localStorage.getItem("rms_profile_extra") || "{}"); } catch { return {}; }
    })();
    setProfile({
      name: auth.name,
      email: auth.email,
      organization: extra.organization ?? "ReviewOS Demo Co.",
      timezone: extra.timezone ?? "UTC+05:30",
    });
  }, [auth]);

  if (!auth) return null;

  function saveProfile() {
    if (!profile.name || !profile.email) return toast.error("Name and email required");
    localStorage.setItem(
      "rms_profile_extra",
      JSON.stringify({ organization: profile.organization, timezone: profile.timezone }),
    );
    toast.success("Profile updated");
  }

  function changePassword() {
    if (!pw.current || pw.next.length < 8) return toast.error("New password must be 8+ characters");
    if (pw.next !== pw.confirm) return toast.error("Passwords don't match");
    toast.success("Password change requested");
    setPw({ current: "", next: "", confirm: "" });
  }

  return (
    <DashboardLayout>
      <PageHeader title="Settings" description="Profile, notifications, and workspace preferences." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <h3 className="font-semibold mb-4">Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <Field label="Email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            <Field label="Organization" value={profile.organization} onChange={(e) => setProfile({ ...profile, organization: e.target.value })} />
            <Field label="Timezone" value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} />
          </div>
          <Button className="mt-5" onClick={saveProfile}>Save changes</Button>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-1">Notifications</h3>
          <p className="text-xs text-muted-foreground mb-4">
            {auth.role === "super" ? "Org-level alerts only." : "Operational alerts for your devices."}
          </p>
          <div className="space-y-4">
            {auth.role === "super" ? (
              <>
                <Toggle name="new_sub_admin" label="New sub-admin invited" defaultChecked />
                <Toggle name="sub_disabled" label="Sub-admin disabled" defaultChecked />
                <Toggle name="weekly_summary" label="Org weekly summary" defaultChecked />
                <Toggle name="billing" label="Billing & usage alerts" defaultChecked />
                <Toggle name="security" label="Security sign-in alerts" defaultChecked />
              </>
            ) : (
              <>
                <Toggle name="new_review" label="New review submitted" defaultChecked />
                <Toggle name="low_rating" label="Low rating alert (≤2★)" defaultChecked />
                <Toggle name="device_offline" label="Device offline" defaultChecked />
                <Toggle name="weekly_email" label="Weekly summary email" />
                <Toggle name="sync_fail" label="Sync failures" defaultChecked />
              </>
            )}
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
          <Button className="mt-5" onClick={changePassword}>Update password</Button>
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

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  const key = `rms_notif_${name}`;
  const [on, setOn] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return !!defaultChecked;
    const v = localStorage.getItem(key);
    return v == null ? !!defaultChecked : v === "1";
  });
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch
        checked={on}
        onCheckedChange={(v) => { setOn(v); localStorage.setItem(key, v ? "1" : "0"); }}
      />
    </div>
  );
}
