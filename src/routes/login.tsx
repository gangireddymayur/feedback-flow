import * as React from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginWithApi, verifyCodeWithApi, signupWithApi } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const router = useRouter();

  // Detect Cloud vs Local solo/multi environment
  const isCloud = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    const port = window.location.port;
    const host = window.location.hostname;
    return !(port === "8080" || port === "3000" || host === "localhost" || host === "127.0.0.1");
  }, []);

  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [orgName, setOrgName] = React.useState("");
  const [adminName, setAdminName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [requireCode, setRequireCode] = React.useState(false);
  const [codeUnavailable, setCodeUnavailable] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "signup" && isCloud) {
      if (!email.trim() || !password) {
        setError("Enter your email address and password.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify.");
        return;
      }

      setLoading(true);
      try {
        const displayName = adminName.trim() || orgName.trim() || email.trim().split("@")[0];
        await signupWithApi(displayName, email.trim(), password);
        toast.success("Account created successfully! Enjoy your 7-day free trial.");
        router.navigate({ to: "/" });
      } catch (err) {
        const message = (err as Error).message;
        setError(message);
        toast.error("Sign-up failed", { description: message });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (requireCode) {
      if (!code.trim() || code.length !== 4) {
        setError("Enter the 4-digit verification code.");
        return;
      }
      setLoading(true);
      try {
        await verifyCodeWithApi(email, password, code);
        router.navigate({ to: "/" });
      } catch (err) {
        const message = (err as Error).message;
        setError(message);
        toast.error("Verification failed", { description: message });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError("Enter your email and password to sign in.");
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithApi(email, password);
      if (res && "require_code" in res && res.require_code) {
        if ((res as any).no_code_available) {
          setCodeUnavailable(true);
        } else {
          setRequireCode(true);
        }
      } else {
        router.navigate({ to: "/" });
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error("Sign-in failed", { description: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-8 relative overflow-hidden bg-background">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg glass-strong rounded-3xl p-8 shadow-2xl relative z-10 border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <img
            src="/logo.png"
            className="h-11 rounded-xl shadow-md object-contain"
            alt="FAM Logo"
          />
          <div>
            <div className="text-lg font-bold tracking-tight">Feedback Action Management</div>
            <div className="text-xs text-muted-foreground">Action Management Platform</div>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "signup" && isCloud ? "Create Cloud Account" : "Welcome back"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {mode === "signup" && isCloud
              ? "Sign up now and get full access with a 7-day free trial."
              : "Sign in to manage your reviews."}
          </p>
        </div>

        {/* Mode Switcher Tabs with smooth pill indicator (Cloud Only) */}
        {isCloud && !requireCode && !codeUnavailable && (
          <div className="relative flex items-center p-1 bg-white/5 rounded-2xl w-full max-w-[280px] mx-auto mb-6 border border-white/10 shadow-inner">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 ease-out shadow-md ${
                mode === "login"
                  ? "left-1 bg-primary text-primary-foreground"
                  : "left-[calc(50%+2px)] bg-emerald-500 shadow-emerald-500/25"
              }`}
            />
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-xl transition-colors duration-200 text-center whitespace-nowrap cursor-pointer select-none ${
                mode === "login"
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
              }}
              className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-xl transition-colors duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer select-none ${
                mode === "signup"
                  ? "text-white font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className={`size-3.5 transition-transform duration-300 ${mode === "signup" ? "text-white scale-110" : "text-muted-foreground"}`} />
              <span>Sign Up</span>
            </button>
          </div>
        )}

        {codeUnavailable ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-4 text-sm text-amber-200 space-y-1">
              <p className="font-semibold">Verification code required</p>
              <p className="text-xs text-amber-300/80">
                Your account requires a one-time code to log in on this device. Please ask your
                Super Admin to generate a code from the cloud console.
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2 cursor-pointer"
              onClick={() => {
                setCodeUnavailable(false);
                setError("");
              }}
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            {mode === "signup" && isCloud && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-400 flex items-center gap-3 shadow-inner mb-4">
                <div className="size-8 rounded-xl bg-emerald-500/20 grid place-items-center shrink-0 text-emerald-400">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="leading-snug">
                  <span className="font-bold text-white">Includes 7-Day Free Cloud Trial</span> with full dashboard features.
                </div>
              </div>
            )}

            {!requireCode ? (
              <>
                {mode === "signup" && isCloud && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="orgName" className="text-xs font-semibold text-muted-foreground">
                        Organization Name
                      </Label>
                      <Input
                        id="orgName"
                        type="text"
                        placeholder="Acme Retail"
                        value={orgName}
                        onChange={(e) => {
                          setOrgName(e.target.value);
                          setError("");
                        }}
                        className="bg-white/5 border-white/10 h-10 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="adminName" className="text-xs font-semibold text-muted-foreground">
                        Admin Full Name
                      </Label>
                      <Input
                        id="adminName"
                        type="text"
                        placeholder="Jane Doe"
                        value={adminName}
                        onChange={(e) => {
                          setAdminName(e.target.value);
                          setError("");
                        }}
                        className="bg-white/5 border-white/10 h-10 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    className="bg-white/5 border-white/10 h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      className="bg-white/5 border-white/10 pr-10 h-10 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {mode === "signup" && isCloud && (
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold text-muted-foreground">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError("");
                        }}
                        className="bg-white/5 border-white/10 pr-10 h-10 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="code" className="text-xs font-semibold text-muted-foreground">
                  Verification Code
                </Label>
                <Input
                  id="code"
                  type="text"
                  maxLength={4}
                  required
                  autoFocus
                  placeholder="_ _ _ _"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  className="bg-white/5 border-white/10 text-center text-2xl font-semibold tracking-widest font-mono h-12"
                />
                <p className="text-[11px] text-muted-foreground text-center mt-1">
                  Enter the 4-digit code generated by the Super Admin in the cloud console.
                </p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2 cursor-pointer"
                  onClick={() => {
                    setRequireCode(false);
                    setCode("");
                    setError("");
                  }}
                >
                  ← Back to sign in
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className={`w-full h-11 text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer mt-2 ${
                mode === "signup" && isCloud
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
              }`}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === "signup" && isCloud ? (
                "Start 7-Day Free Trial"
              ) : requireCode ? (
                "Verify Code"
              ) : (
                "Sign In"
              )}
            </Button>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-200"
              >
                {error}
              </p>
            )}

            {isCloud && !requireCode && !codeUnavailable && (
              <div className="text-center pt-2">
                {mode === "signup" ? (
                  <p className="text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setError("");
                      }}
                      className="text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Sign In
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setError("");
                      }}
                      className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                    >
                      Start 7-Day Free Trial
                    </button>
                  </p>
                )}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
