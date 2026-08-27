import * as React from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuth, logout } from "@/lib/auth-store";
import { Auth, Profile, Upload, Backup } from "@/lib/api";
import { toast } from "sonner";
import {
  LogOut,
  Edit2,
  X,
  Save,
  Image as ImageIcon,
  Loader2,
  SlidersHorizontal,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Globe,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

  const [activeTab, setActiveTab] = React.useState<"general" | "about">("general");
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
    brand_header_placement: "top",
  });

  const [showPlacementSettings, setShowPlacementSettings] = React.useState(false);
  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" });

  React.useEffect(() => {
    if (!auth) return;
    const rawSb = profileQ.data?.profile.show_brand_header;
    const parsedSb = rawSb === 1 || rawSb === true || rawSb === "1" || String(rawSb).toLowerCase() === "true" ? 1 : 0;
    setFormState({
      name: auth.name,
      organization: profileQ.data?.profile.organization ?? "",
      timezone: "IST",
      avatar_url: profileQ.data?.profile.avatar_url ?? "",
      show_brand_header: parsedSb,
      brand_header_placement: profileQ.data?.profile.brand_header_placement ?? "top",
    });
  }, [auth, profileQ.data]);

  const originalState = React.useMemo(() => {
    if (!profileQ.data) return null;
    const rawSb = profileQ.data.profile.show_brand_header;
    const parsedSb = rawSb === 1 || rawSb === true || rawSb === "1" || String(rawSb).toLowerCase() === "true" ? 1 : 0;
    return {
      organization: profileQ.data.profile.organization ?? "",
      timezone: "IST",
      avatar_url: profileQ.data.profile.avatar_url ?? "",
      show_brand_header: parsedSb,
      brand_header_placement: profileQ.data.profile.brand_header_placement ?? "top",
    };
  }, [profileQ.data]);

  const hasChanges = React.useMemo(() => {
    if (!originalState) return false;
    return (
      formState.organization !== originalState.organization ||
      formState.avatar_url !== originalState.avatar_url ||
      formState.show_brand_header !== originalState.show_brand_header ||
      formState.brand_header_placement !== originalState.brand_header_placement
    );
  }, [formState, originalState]);

  const saveProfile = useMutation({
    mutationFn: () =>
      Profile.update({
        organization: formState.organization,
        timezone: "IST",
        avatar_url: formState.avatar_url || null,
        show_brand_header: formState.show_brand_header,
        brand_header_placement: formState.brand_header_placement,
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

  const [restoring, setRestoring] = React.useState(false);

  const handleDownloadBackup = async () => {
    try {
      const data = await Backup.download();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `fam_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded successfully");
    } catch (err) {
      toast.error("Failed to generate backup: " + (err as Error).message);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = window.confirm(
      "WARNING: Restoring backup will import all templates, devices, responses, and schedules from the file. Do you want to proceed?",
    );
    if (!ok) return;

    setRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await Backup.restore(payload);
      toast.success("Data restored successfully! Refreshing dashboard...");
      qc.invalidateQueries();
      router.invalidate();
    } catch (err) {
      toast.error("Failed to restore backup: " + (err as Error).message);
    } finally {
      setRestoring(false);
      e.target.value = "";
    }
  };

  if (!auth) return null;

  return (
    <DashboardLayout>
      <PageHeader
        title="Settings"
        description="Profile, branding preferences, and security options."
      />

      <div className="flex gap-2 border-b border-white/5 pb-4 mb-6">
        <button
          onClick={() => setActiveTab("general")}
          className={cn(
            "px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer",
            activeTab === "general"
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
          )}
        >
          General Settings
        </button>
        <button
          onClick={() => setActiveTab("about")}
          className={cn(
            "px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer",
            activeTab === "about"
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
          )}
        >
          Developer Info
        </button>
      </div>

      {activeTab === "general" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile and Branding Settings Card */}
          <GlassCard className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="font-semibold text-lg">Profile & Branding</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage organization info and logo asset settings.
              </p>
            </div>
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-8 border-white/10 text-xs"
              >
                <Edit2 className="size-3.5 mr-1.5" /> Edit Info
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    if (originalState) {
                      setFormState((prev) => ({
                        ...prev,
                        organization: originalState.organization,
                        timezone: "IST",
                        avatar_url: originalState.avatar_url,
                        show_brand_header: originalState.show_brand_header,
                        brand_header_placement: originalState.brand_header_placement,
                      }));
                      setShowPlacementSettings(false);
                    }
                  }}
                  className="h-8 text-xs text-muted-foreground"
                >
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
            <Field
              label="Email Address"
              value={auth.email}
              disabled
              className="bg-white/5 border-white/5 opacity-70"
            />
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
          <div className="space-y-3 border-t border-white/5 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold text-foreground">
                  Show Brand Header on Devices
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Display logo, organization name, and local clock on tablet screens.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {formState.show_brand_header === 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!isEditing}
                    onClick={() => setShowPlacementSettings(!showPlacementSettings)}
                    className={cn(
                      "h-8 w-8 rounded-full border border-white/5 transition-colors",
                      showPlacementSettings
                        ? "bg-white/10 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                )}
                <Switch
                  disabled={!isEditing}
                  checked={formState.show_brand_header === 1}
                  onCheckedChange={(checked) => {
                    setFormState((prev) => ({ ...prev, show_brand_header: checked ? 1 : 0 }));
                    if (!checked) setShowPlacementSettings(false);
                  }}
                />
              </div>
            </div>

            {formState.show_brand_header === 1 && showPlacementSettings && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Header Placement</Label>
                  <select
                    disabled={!isEditing}
                    value={formState.brand_header_placement}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, brand_header_placement: e.target.value }))
                    }
                    className="w-full bg-background border border-white/10 rounded-xl h-9 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
                  >
                    <option value="top">Top (Default)</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left Sidebar</option>
                    <option value="right">Right Sidebar</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Adjusts the position of the branding bar on all active tablet displays.
                  </p>
                </div>
              </div>
            )}
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
              <Button
                className="w-full mt-2 h-9 text-xs"
                onClick={onChangePassword}
                disabled={changePw.isPending}
              >
                {changePw.isPending ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </GlassCard>

          {/* Backup & Restore Card */}
          <GlassCard>
            <h3 className="font-semibold text-lg mb-1">Backup & Restore</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Export or import your complete account data (templates, devices, and responses).
            </p>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-9 text-xs border-white/10"
                onClick={handleDownloadBackup}
              >
                Download Backup
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreBackup}
                  disabled={restoring}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  id="backup-file-input"
                />
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs border-white/10"
                  disabled={restoring}
                >
                  {restoring ? "Restoring Data…" : "Upload Backup File"}
                </Button>
              </div>
            </div>
          </GlassCard>

          {/* Session Management / Log Out Card */}
          <GlassCard className="border-red-500/20 bg-red-500/[0.01]">
            <h3 className="font-semibold text-red-400 text-lg mb-1">Session</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Log out of your current session on this device.
            </p>
            <Button
              variant="destructive"
              className="w-full h-9 text-xs"
              onClick={() => setLogoutOpen(true)}
            >
              <LogOut className="size-4 mr-2" /> Log Out
            </Button>
          </GlassCard>
        </div>
      </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <GlassCard className="p-8 border border-white/10 relative overflow-hidden">
            {/* Background design elements */}
            <div className="absolute -top-24 -right-24 size-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 size-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

            {/* Advaitha Profile Banner Image */}
            <div className="w-full rounded-2xl border border-white/5 overflow-hidden bg-white/5 mb-6 shadow-xl">
              <img
                src="/advaitha.png"
                alt="Advaitha Automations Showcase"
                className="w-full h-auto object-contain"
              />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-white/5">
              <div className="space-y-2">
                <div className="inline-flex px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary tracking-wider uppercase">
                  System Developer Profile
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 via-emerald-400 to-indigo-400 bg-clip-text text-transparent">
                  ADVAITHA Automations
                </h2>
                <p className="text-sm font-semibold text-zinc-300">
                  ADVAITHA Designers N Networks
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <MapPin className="size-4 text-primary shrink-0" />
                  <span>Road No.12, Banjara Hills, Mithali Nagar, Hyderabad - 500034</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 shrink-0">
                <a
                  href="mailto:sree@advaitha.co.in"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Mail className="size-3.5" />
                  <span>sree@advaitha.co.in</span>
                </a>
                <a
                  href="tel:9490468368"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Phone className="size-3.5" />
                  <span>+91 9490468368</span>
                </a>
              </div>
            </div>

            {/* WhatsApp Integration Call to Action */}
            <div className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-bold text-emerald-300 flex items-center justify-center sm:justify-start gap-1.5">
                  <MessageSquare className="size-4 shrink-0" /> Instant Technical Support
                </h4>
                <p className="text-xs text-emerald-200/70 leading-normal max-w-md">
                  Have questions, feature requests, or need technical assistance? Chat directly with our engineering team on WhatsApp.
                </p>
              </div>
              <a
                href="https://wa.me/9490468368"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-extrabold hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                Chat on WhatsApp
                <ExternalLink className="size-3.5" />
              </a>
            </div>

            {/* Services Showcase Grid */}
            <div className="mt-8 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Our Solutions & Services
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2.5 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider">Enterprise & Operations</h4>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span>High-Performance Servers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span>IT Infrastructure & Managed Services</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span>Custom Software & Apps Development</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span>Evolis ID Card Printers & Consumables</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-2.5 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <h4 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider">Security & Digital Signage</h4>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-indigo-400" />
                      <span>SDWAN / Enterprise Firewalls</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-indigo-400" />
                      <span>CCTV Surveillance Systems</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-indigo-400" />
                      <span>Queue Management & Digital Kiosks</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-indigo-400" />
                      <span>Digital Signage & Biometric Attendance</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Strategic Partnerships Section */}
            <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">
                Strategic Technology Partnerships
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-semibold text-zinc-300">
                  Google Partner
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-semibold text-zinc-300">
                  Cisco Partner
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-semibold text-zinc-300">
                  Honeywell Partner
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-semibold text-zinc-300">
                  Microsoft Silver Partner
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-semibold text-zinc-300">
                  Evolis Partner
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="max-w-sm bg-zinc-950 border-zinc-800 text-foreground">
          <DialogHeader>
            <DialogTitle>Confirm Log Out</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs pt-1">
              Are you sure you want to log out? You will need to enter your credentials to access
              the dashboard again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-3 border-t border-white/5 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogoutOpen(false)}
              className="h-8 text-xs border-white/10"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLogout}
              className="h-8 text-xs font-semibold"
            >
              Log Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Field({
  label,
  className,
  ...props
}: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input {...props} className={`bg-white/5 border-white/10 text-xs h-9 ${className || ""}`} />
    </div>
  );
}
