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
  const [name, setName] = React.useState("");
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
        await signupWithApi(name.trim(), email.trim(), password);
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
    <div className="min-h-screen grid place-items-center px-4 relative overflow-hidden">
      {/* Background glowing gradients */}
      <div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md glass-strong rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <img
            src="/logo.png"
            className="h-11 rounded-xl shadow-md object-contain"
            alt="FAM Logo"
          />
          <div>
            <div className="text-lg font-semibold tracking-tight">Feedback Action Management</div>
            <div className="text-xs text-muted-foreground">Action Management Platform</div>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signup" && isCloud ? "Create Cloud Account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup" && isCloud
              ? "Sign up now and get full access with a 7-day free trial."
              : "Sign in to manage your reviews."}
          </p>
        </div>

        {/* Mode Switcher Tabs (Cloud Only) */}
        {isCloud && !requireCode && !codeUnavailable && (
          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                mode === "login"
                  ? "bg-primary text-primary-foreground shadow-md"
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
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mode === "signup"
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3.5" />
              <span>Sign Up</span>
              <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded-full font-bold">
                7d Free
              </span>
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
            {!requireCode ? (
              <>
                {mode === "signup" && isCloud && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name / Organization</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setError("");
                      }}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
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
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      className="bg-white/5 border-white/10 pr-10"
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
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError("");
                        }}
                        className="bg-white/5 border-white/10 pr-10"
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
                <Label htmlFor="code">Verification Code</Label>
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
              className={`w-full mt-2 group ${
                mode === "signup" && isCloud
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : ""
              }`}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {requireCode
                    ? "Verify Code"
                    : mode === "signup" && isCloud
                    ? "Create Account & Start 7-Day Trial"
                    : "Sign in"}{" "}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
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
          </form>
        )}
      </div>
    </div>
  );
}
