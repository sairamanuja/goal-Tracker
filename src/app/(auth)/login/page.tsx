"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { loginSchema } from "@/lib/validation";
import { Target, TrendingUp, BarChart3 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Validation failed");
      return;
    }

    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        toast.error("Invalid email or password");
      } else {
        router.push("/");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMicrosoft() {
    setMsLoading(true);
    await signIn("azure-ad", { callbackUrl: "/" });
  }

  return (
    <div className="min-h-screen flex">
      {/* Brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden bg-[oklch(0.232_0.065_277)]">
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[oklch(0.315_0.085_277)] opacity-60" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[oklch(0.315_0.085_277)] opacity-40" />
        <div className="absolute top-1/2 right-0 w-48 h-48 rounded-full bg-[oklch(0.511_0.222_277)] opacity-20 translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 max-w-sm w-full">
          {/* Logo */}
          <div className="w-14 h-14 rounded-2xl bg-[oklch(0.511_0.222_277)] flex items-center justify-center mb-8 shadow-lg">
            <span className="text-white font-bold text-2xl">G</span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
            GoalTrack<br />Portal
          </h1>
          <p className="text-[oklch(0.906_0.025_277)] text-base mb-10 leading-relaxed">
            Performance management made simple. Set goals, track progress, and achieve results — all in one place.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-[oklch(0.511_0.222_277)]/30 shrink-0 mt-0.5">
                <Target className="w-4 h-4 text-[oklch(0.906_0.025_277)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Structured Goal Setting</p>
                <p className="text-xs text-[oklch(0.906_0.025_277)]/80 mt-0.5">Quarterly KPIs with manager approval workflow</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-[oklch(0.511_0.222_277)]/30 shrink-0 mt-0.5">
                <TrendingUp className="w-4 h-4 text-[oklch(0.906_0.025_277)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Real-time Progress Tracking</p>
                <p className="text-xs text-[oklch(0.906_0.025_277)]/80 mt-0.5">Quarterly check-ins and automated scoring</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-[oklch(0.511_0.222_277)]/30 shrink-0 mt-0.5">
                <BarChart3 className="w-4 h-4 text-[oklch(0.906_0.025_277)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Analytics & Reports</p>
                <p className="text-xs text-[oklch(0.906_0.025_277)]/80 mt-0.5">Department-level insights and export tools</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo — only shown on small screens */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
              G
            </div>
            <span className="font-semibold text-xl">GoalTrack Portal</span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-sm mt-1">Sign in to your account to continue</p>
          </div>

          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full gap-2 h-10"
              onClick={handleMicrosoft}
              disabled={msLoading}
            >
              <svg viewBox="0 0 21 21" className="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              {msLoading ? "Redirecting…" : "Continue with Microsoft"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or sign in with email</span>
              </div>
            </div>

            <form onSubmit={handleCredentials} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@atomberg.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-10"
                />
              </div>
              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
