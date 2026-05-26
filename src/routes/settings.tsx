import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const auth = useAuth();
  if (!auth) return null;
  return (
    <DashboardLayout>
      <PageHeader title="Settings" description="Profile, notifications, and workspace preferences." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <h3 className="font-semibold mb-4">Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full name" defaultValue={auth.name} />
            <Field label="Email" defaultValue={auth.email} />
            <Field label="Organization" defaultValue="ReviewOS Demo Co." />
            <Field label="Timezone" defaultValue="UTC+05:30" />
          </div>
          <Button className="mt-5">Save changes</Button>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-4">Notifications</h3>
          <div className="space-y-4">
            <Toggle label="New review submitted" defaultChecked />
            <Toggle label="Low rating alert (≤2★)" defaultChecked />
            <Toggle label="Device offline" defaultChecked />
            <Toggle label="Weekly summary email" />
            <Toggle label="Sync failures" defaultChecked />
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-3">
          <h3 className="font-semibold mb-1">Security</h3>
          <p className="text-xs text-muted-foreground mb-4">Manage password and two-factor authentication.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Current password" type="password" defaultValue="" />
            <Field label="New password" type="password" defaultValue="" />
            <Field label="Confirm new password" type="password" defaultValue="" />
          </div>
          <div className="flex items-center justify-between mt-5 pt-5 border-t border-white/5">
            <div>
              <div className="font-medium text-sm">Two-factor authentication</div>
              <div className="text-xs text-muted-foreground">Add an extra layer of security to your account.</div>
            </div>
            <Switch />
          </div>
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

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
