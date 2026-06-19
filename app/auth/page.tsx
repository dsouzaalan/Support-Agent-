"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Tab = "signin" | "signup";

const FEATURES = [
  "Unified inbox across all channels",
  "AI-powered customer intelligence",
  "Real-time sentiment & churn detection",
  "Analytics, alerts, and audit logs",
];

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [signUpForm, setSignUpForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });

  function handleTabChange(next: Tab) {
    setTab(next);
    setError("");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!signInForm.email || !signInForm.password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    document.cookie = "auth-session=true; path=/; SameSite=Strict";
    router.push("/");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!signUpForm.name || !signUpForm.email || !signUpForm.password || !signUpForm.confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (signUpForm.password !== signUpForm.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (signUpForm.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    document.cookie = "auth-session=true; path=/; SameSite=Strict";
    router.push("/");
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between bg-sidebar-bg text-sidebar-bg-foreground p-10 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">ZapMail</span>
        </div>

        {/* Main copy */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight text-white">
              Support smarter,<br />not harder.
            </h1>
            <p className="text-base text-white/60 leading-relaxed max-w-xs">
              Your AI-powered hub for managing customer conversations, detecting risk, and staying ahead of every issue.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-white/75">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer quote */}
        <p className="text-xs text-white/30">
          &copy; {new Date().getFullYear()} ZapMail, Inc. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-[400px] space-y-7">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-base font-semibold">ZapMail</span>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">
              {tab === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tab === "signin"
                ? "Sign in to your agent workspace."
                : "Get started with ZapMail for free."}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-lg border border-border bg-muted p-1 gap-1">
            <button
              onClick={() => handleTabChange("signin")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm font-medium transition-all duration-150",
                tab === "signin"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => handleTabChange("signup")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm font-medium transition-all duration-150",
                tab === "signup"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Create Account
            </button>
          </div>

          {/* Sign In form */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="si-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="si-email"
                    type="email"
                    placeholder="you@company.com"
                    className="pl-9"
                    value={signInForm.email}
                    onChange={(e) => setSignInForm((f) => ({ ...f, email: e.target.value }))}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="si-password">Password</Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    tabIndex={-1}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="si-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="pl-9 pr-10"
                    value={signInForm.password}
                    onChange={(e) => setSignInForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign In <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleTabChange("signup")}
                  className="text-primary hover:underline font-medium"
                >
                  Create one
                </button>
              </p>
            </form>
          )}

          {/* Create Account form */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="su-name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="su-name"
                    type="text"
                    placeholder="Riley Park"
                    className="pl-9"
                    value={signUpForm.name}
                    onChange={(e) => setSignUpForm((f) => ({ ...f, name: e.target.value }))}
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="su-email">Work Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="su-email"
                    type="email"
                    placeholder="you@company.com"
                    className="pl-9"
                    value={signUpForm.email}
                    onChange={(e) => setSignUpForm((f) => ({ ...f, email: e.target.value }))}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="su-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="su-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    className="pl-9 pr-10"
                    value={signUpForm.password}
                    onChange={(e) => setSignUpForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="su-confirm">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="su-confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your password"
                    className="pl-9 pr-10"
                    value={signUpForm.confirm}
                    onChange={(e) => setSignUpForm((f) => ({ ...f, confirm: e.target.value }))}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Create Account <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleTabChange("signin")}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </p>

              <p className="text-center text-xs text-muted-foreground">
                By creating an account you agree to our{" "}
                <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>{" "}
                and{" "}
                <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
