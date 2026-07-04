import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Play,
  Trash2,
  Clock,
  Sparkles,
  Tv,
  Check,
  Video,
  Image as ImageIcon,
} from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Screensavers, type ApiScreensaver } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/screensaver")({ component: ScreensaverPage });

const TIMEOUT_OPTIONS = [
  { label: "30 Seconds", value: 30 },
  { label: "1 Minute", value: 60 },
  { label: "2 Minutes", value: 120 },
  { label: "5 Minutes", value: 300 },
  { label: "10 Minutes", value: 600 },
  { label: "15 Minutes", value: 900 },
  { label: "30 Minutes", value: 1800 },
];

function ScreensaverPage() {
  const qc = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [uploadName, setUploadName] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

  // Fetch screensavers list
  const listQ = useQuery({
    queryKey: ["screensavers"],
    queryFn: () => Screensavers.list(),
  });

  const screensavers = listQ.data?.screensavers ?? [];
  const activeScreensaver = screensavers.find((s) => s.is_active === 1);
  const [timeoutSeconds, setTimeoutSeconds] = React.useState(300);

  // Sync state timeout when active screensaver is loaded
  React.useEffect(() => {
    if (activeScreensaver) {
      setTimeoutSeconds(activeScreensaver.timeout_seconds);
    }
  }, [activeScreensaver]);

  // Activate / Save timeout mutation
  const activateMut = useMutation({
    mutationFn: (payload: { id: number; timeout_seconds: number }) =>
      Screensavers.activate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screensavers"] });
      toast.success("Screensaver settings updated successfully!");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update screensaver settings"),
  });

  // Deactivate mutation
  const deactivateMut = useMutation({
    mutationFn: () => Screensavers.deactivate(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screensavers"] });
      toast.success("Screensaver disabled");
    },
    onError: (e: any) => toast.error(e.message || "Failed to disable screensaver"),
  });

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: (id: number) => Screensavers.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screensavers"] });
      toast.success("Screensaver deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete screensaver"),
  });

  // Handle file select and upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: max 20MB
    const limit = 20 * 1024 * 1024;
    if (file.size > limit) {
      toast.error("File is too large. Max size allowed is 20MB.");
      return;
    }

    const type = file.type.startsWith("video/") ? "video" : "image";
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Unsupported file format. Please upload an image or video file.");
      return;
    }

    setUploading(true);
    try {
      await Screensavers.upload(
        file,
        uploadName.trim() || file.name.split(".")[0],
        type
      );

      toast.success("Screensaver uploaded successfully!");
      setUploadName("");
      qc.invalidateQueries({ queryKey: ["screensavers"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload screensaver media.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleTimeoutChange = (seconds: number) => {
    setTimeoutSeconds(seconds);
    if (activeScreensaver) {
      activateMut.mutate({ id: activeScreensaver.id, timeout_seconds: seconds });
    }
  };

  const handleActivate = (id: number) => {
    activateMut.mutate({ id, timeout_seconds: timeoutSeconds });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Screen Saver Settings"
        description="Configure standby content to show when the tablet is not in use."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Left Side: Upload & Global Config */}
        <div className="lg:col-span-1 space-y-6">
          {/* Section: Upload Media */}
          <GlassCard className="border border-white/5 space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Upload className="size-4.5 text-primary" /> Upload Standby Media
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload images or short videos to use as screen savers on connected devices. (Max size 20MB)
            </p>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">Media Label / Name</Label>
                <Input
                  placeholder="e.g. Welcome Promo Video"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="bg-white/5 border-white/10 text-xs h-9"
                  disabled={uploading}
                />
              </div>

              <div>
                <input
                  type="file"
                  accept="image/*,video/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-xs font-semibold h-9"
                  disabled={uploading}
                >
                  {uploading ? (
                    "Processing Upload..."
                  ) : (
                    <>
                      <Upload className="size-3.5 mr-1.5" /> Choose Media File
                    </>
                  )}
                </Button>
              </div>
            </div>
          </GlassCard>

          {/* Section: Timeout Selector */}
          <GlassCard className="border border-white/5 space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Clock className="size-4.5 text-emerald-400" /> Standby Timeout
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select how much time of inactivity must pass before the screen saver automatically starts playing.
            </p>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">Inactivity Delay</Label>
                <select
                  value={timeoutSeconds}
                  onChange={(e) => handleTimeoutChange(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl h-9 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
                >
                  {TIMEOUT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#0d0f12]">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {activeScreensaver ? (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 leading-relaxed flex items-start gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" />
                  <div>
                    Active screensaver: <strong className="font-semibold text-foreground">{activeScreensaver.name}</strong>. Plays after {TIMEOUT_OPTIONS.find(o => o.value === timeoutSeconds)?.label.toLowerCase() || `${timeoutSeconds} seconds`} of inactivity.
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] text-muted-foreground leading-relaxed">
                  Screen saver is currently disabled. Select a media card from the playlist to enable.
                </div>
              )}

              {activeScreensaver && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-white/10 h-8"
                  onClick={() => deactivateMut.mutate()}
                  disabled={deactivateMut.isPending}
                >
                  Disable Standby Mode
                </Button>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Right Side: Media List & Playlist */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="border border-white/5 space-y-4 min-h-[400px]">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Tv className="size-4.5 text-blue-400" /> Screen Saver Playlist
              </h2>
              <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-medium text-muted-foreground">
                {screensavers.length} Items
              </span>
            </div>

            {screensavers.length === 0 ? (
              <div className="h-[300px] border border-dashed border-white/10 rounded-2xl grid place-items-center text-center px-4">
                <div>
                  <Sparkles className="size-8 text-muted-foreground mx-auto mb-3 opacity-40 animate-pulse" />
                  <h3 className="text-sm font-semibold text-foreground">No Media Uploaded</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1">
                    Upload image or video files using the upload panel on the left to start configuring your screen saver.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {screensavers.map((item) => {
                  const isActive = item.is_active === 1;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "relative group flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 bg-white/[0.02]",
                        isActive ? "border-primary shadow-lg shadow-primary/5" : "border-white/5 hover:border-white/10",
                      )}
                    >
                      {/* Media Preview Box */}
                      <div className="aspect-video w-full relative bg-black/40 overflow-hidden border-b border-white/5">
                        {item.type === "video" ? (
                          <div className="w-full h-full relative">
                            <video
                              src={item.url}
                              className="w-full h-full object-cover"
                              muted
                              loop
                              playsInline
                            />
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm size-6 rounded-lg grid place-items-center text-[10px] text-white">
                              <Video className="size-3.5 text-blue-400" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full relative">
                            <img
                              src={item.url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm size-6 rounded-lg grid place-items-center text-[10px] text-white">
                              <ImageIcon className="size-3.5 text-emerald-400" />
                            </div>
                          </div>
                        )}

                        {/* Top Indicator */}
                        {isActive && (
                          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md animate-in fade-in duration-200">
                            <Check className="size-3" /> Active
                          </div>
                        )}
                      </div>

                      {/* Footer Info */}
                      <div className="p-3.5 flex flex-col gap-3">
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold text-foreground truncate">{item.name}</h3>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Added {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="size-8 bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this screensaver media?")) {
                                deleteMut.mutate(item.id);
                              }
                            }}
                            disabled={deleteMut.isPending}
                          >
                            <Trash2 className="size-4" />
                          </Button>

                          {!isActive && (
                            <Button
                              size="sm"
                              className="text-[11px] h-8 font-semibold bg-primary hover:bg-primary/95 text-primary-foreground px-4"
                              onClick={() => handleActivate(item.id)}
                              disabled={activateMut.isPending}
                            >
                              <Play className="size-3 mr-1" /> Use Screensaver
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
