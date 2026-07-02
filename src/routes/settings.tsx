import * as React from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuth, logout } from "@/lib/auth-store";
import { Auth, Profile, Upload } from "@/lib/api";
import { toast } from "sonner";
import { LogOut, Edit2, X, Save, Image as ImageIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const router = useRouter();

  const [logoutOpen, setLogoutOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: () => Profile.get(),
    enabled: !!auth,
  });

  const [formState, setFormState] = React.useState({
    name: "",
    organization: "",
    timezone: "IST",
    avatar_url: "",
    show_brand_header: 0,
  });

  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" });

  React.useEffect(() => {
    if (!auth) return;
    setFormState({
      name: auth.name,
      organization: profileQ.data?.profile.organization ?? "",
      timezone: "IST",
      avatar_url: profileQ.data?.profile.avatar_url ?? "",
      show_brand_header: profileQ.data?.profile.show_brand_header ?? 0,
    });
  }, [auth, profileQ.data]);

  const originalState = React.useMemo(() => {
    if (!profileQ.data) return null;
    return {
      organization: profileQ.data.profile.organization ?? "",
      timezone: "IST",
      avatar_url: profileQ.data.profile.avatar_url ?? "",
      show_brand_header: profileQ.data.profile.show_brand_header ?? 0,
    };
  }, [profileQ.data]);

  const hasChanges = React.useMemo(() => {
    if (!originalState) return false;
    return (
      formState.organization !== originalState.organization ||
      formState.avatar_url !== originalState.avatar_url ||
      formState.show_brand_header !== originalState.show_brand_header
    );
  }, [formState, originalState]);

  const saveProfile = useMutation({
    mutationFn: () =>
      Profile.update({
        organization: formState.organization,
        timezone: "IST",
        avatar_url: formState.avatar_url || null,
        show_brand_header: formState.show_brand_header,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const changePw = useMutation({
    mutationFn: () => Auth.changePassword(pw.current, pw.next),
    onSuccess: () => {
      toast.success("Password updated successfully");
      setPw({ current: "", next: "", confirm: "" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Str = (reader.result as string).split(",")[1];
          const res = await Upload.file(file.name, base64Str);
          setFormState((prev) => ({ ...prev, avatar_url: res.url }));
          toast.success("Logo uploaded successfully");
        } catch (err) {
          toast.error("Logo upload failed: " + (err as Error).message);
        } finally {
          setUploadingLogo(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error("File reading failed");
      setUploadingLogo(false);
    }
  };

  function onChangePassword() {
    if (!pw.current || pw.next.length < 8) return toast.error("New password must be 8+ characters");
    if (pw.next !== pw.confirm) return toast.error("Passwords don't match");
    changePw.mutate();
  }

  function handleLogout() {
    setLogoutOpen(false);
    logout();
    router.navigate({ to: "/login" });
  }

  if (!auth) return null;

  return (
    <DashboardLayout>
      <PageHeader
        title="Settings"
        description="Profile, branding preferences, and security options."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile and Branding Settings Card */}
        <GlassCard className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="font-semibold text-lg">Profile & Branding</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Manage organization info and logo asset settings.</p>
            </div>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-8 border-white/10 text-xs">
                <Edit2 className="size-3.5 mr-1.5" /> Edit Info
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => {
                  setIsEditing(false);
                  if (originalState) {
                    setFormState((prev) => ({
                      ...prev,
                      organization: originalState.organization,
                      timezone: "IST",
                      avatar_url: originalState.avatar_url,
                      show_brand_header: originalState.show_brand_header,
                    }));
                  }
                }} className="h-8 text-xs text-muted-foreground">
                  <X className="size-3.5 mr-1.5" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveProfile.mutate()}
                  disabled={!hasChanges || saveProfile.isPending}
                  className="h-8 text-xs font-semibold bg-primary hover:bg-primary/90"
                >
                  <Save className="size-3.5 mr-1.5" /> Save Changes
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Full Name"
              value={formState.name}
              disabled
              className="bg-white/5 border-white/5 opacity-70"
            />
            <Field label="Email Address" value={auth.email} disabled className="bg-white/5 border-white/5 opacity-70" />
            <Field
              label="Organization Name"
              value={formState.organization}
              onChange={(e) => setFormState({ ...formState, organization: e.target.value })}
              disabled={!isEditing}
              placeholder="Your company/org name"
              className={`md:col-span-2 ${!isEditing ? "bg-white/[0.02] border-white/5 opacity-80" : ""}`}
            />
          </div>

          {/* Logo upload and preview */}
          <div className="space-y-3 pt-3 border-t border-white/5">
            <Label className="text-xs font-semibold text-muted-foreground">Company Logo</Label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="size-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-content-center overflow-hidden shrink-0 relative">
                {formState.avatar_url ? (
                  <img
                    src={formState.avatar_url}
                    alt="Company logo preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="size-8 text-muted-foreground" />
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="space-y-2 text-center sm:text-left">
                <p className="text-[11px] text-muted-foreground">
                  Recommended size: 250x250 pixels. PNG or JPG format.
                </p>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={!isEditing || uploadingLogo}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    id="logo-file-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-white/10"
                    disabled={!isEditing || uploadingLogo}
                  >
                    Choose Image
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Brand Header Toggle */}
          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            <div>
              <Label className="text-sm font-semibold text-foreground">Show Brand Header on Devices</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Display logo, organization name, and local clock on tablet screens.</p>
            </div>
            <Switch
              disabled={!isEditing}
              checked={formState.show_brand_header === 1}
              onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, show_brand_header: checked ? 1 : 0 }))}
            />
          </div>
        </GlassCard>

        {/* Security Password Card */}
        <div className="space-y-6">
          <GlassCard>
            <h3 className="font-semibold text-lg mb-1">Security</h3>
            <p className="text-xs text-muted-foreground mb-4">Update your account password.</p>
            <div className="space-y-4">
              <Field
                label="Current Password"
                type="password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
              <Field
                label="New Password"
                type="password"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
              <Field
                label="Confirm New Password"
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
              <Button className="w-full mt-2 h-9 text-xs" onClick={onChangePassword} disabled={changePw.isPending}>
                {changePw.isPending ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </GlassCard>

          {/* Session Management / Log Out Card */}
          <GlassCard className="border-red-500/20 bg-red-500/[0.01]">
            <h3 className="font-semibold text-red-400 text-lg mb-1">Session</h3>
            <p className="text-xs text-muted-foreground mb-4">Log out of your current session on this device.</p>
            <Button variant="destructive" className="w-full h-9 text-xs" onClick={() => setLogoutOpen(true)}>
              <LogOut className="size-4 mr-2" /> Log Out
            </Button>
          </GlassCard>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="max-w-sm bg-zinc-950 border-zinc-800 text-foreground">
          <DialogHeader>
            <DialogTitle>Confirm Log Out</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs pt-1">
              Are you sure you want to log out? You will need to enter your credentials to access the dashboard again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-3 border-t border-white/5 mt-4">
            <Button variant="outline" size="sm" onClick={() => setLogoutOpen(false)} className="h-8 text-xs border-white/10">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout} className="h-8 text-xs font-semibold">
              Log Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Field({ label, className, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input {...props} className={`bg-white/5 border-white/10 text-xs h-9 ${className || ""}`} />
    </div>
  );
}
