import * as React from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginWithApi } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("admin@reviewos.app");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password to sign in.");
      return;
    }
    setLoading(true);
    try {
      await loginWithApi(email, password);
      router.navigate({ to: "/" });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error("Sign-in failed", { description: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md glass-strong rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="size-11 rounded-2xl bg-gradient-to-br from-[oklch(0.82_0.16_200)] to-[oklch(0.78_0.18_300)] grid place-items-center">
            <Sparkles className="size-5 text-background" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">ReviewOS</div>
            <div className="text-xs text-muted-foreground">Review Management Platform</div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">Sign in to manage your reviews.</p>

        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
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
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              className="bg-white/5 border-white/10"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full mt-2 group">
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Sign in{" "}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-200"
            >
              Sign-in failed: {error}
            </p>
          )}
          <p className="text-[11px] text-center text-muted-foreground">
            Super admin: <b>admin@reviewos.app</b> / <b>1m2a3y4u5r</b>
            <br />
            Sub admin: <b>aisha@brand.co</b> / <b>ChangeMe!2026</b>
          </p>
        </form>
      </div>
    </div>
  );
}
