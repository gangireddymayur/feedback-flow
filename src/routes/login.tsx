import * as React from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const router = useRouter();
  const [role, setRole] = React.useState<"sub" | "super">("sub");
  const [email, setEmail] = React.useState(role === "super" ? "alex@reviewos.app" : "aisha@brand.co");

  React.useEffect(() => {
    setEmail(role === "super" ? "alex@reviewos.app" : "aisha@brand.co");
  }, [role]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setAuth({
      role,
      name: role === "super" ? "Alex Morgan" : "Aisha Khan",
      email,
    });
    router.navigate({ to: "/" });
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

        <div className="flex p-1 mb-6 rounded-xl bg-white/5 border border-white/10 text-sm">
          {(["sub", "super"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-2 rounded-lg transition-colors ${
                role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "super" ? "Super Admin" : "Sub Admin"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" defaultValue="demo1234" className="bg-white/5 border-white/10" />
          </div>
          <Button type="submit" className="w-full mt-2 group">
            Sign in <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">Demo mode — any credentials work.</p>
        </form>
      </div>
    </div>
  );
}
