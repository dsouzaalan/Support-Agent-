"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Zap, Lock, User, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const code = searchParams.get("code") ?? "";

  const [form, setForm] = useState({ firstName: "", lastName: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!code) setError("Invalid or missing invitation link.");
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.firstName.trim()) { setError("First name is required."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await api.auth.acceptInvite(code, form.firstName.trim(), form.lastName.trim(), form.password);
      const authToken: string = res?.data?.authToken;
      if (!authToken) throw new Error("No auth token received.");
      setSession(authToken);
      document.cookie = "auth-session=true; path=/; SameSite=Strict";
      setDone(true);
      setTimeout(() => router.push("/"), 1500);
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-[400px] space-y-7">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ZapMail</span>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Accept your invitation</h2>
          <p className="text-sm text-muted-foreground">Set up your account to join the support team.</p>
        </div>

        {done ? (
          <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/8 px-4 py-4">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success">Account created!</p>
              <p className="text-xs text-success/80 mt-0.5">Redirecting you to the dashboard…</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ai-fname">First Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input id="ai-fname" type="text" placeholder="Riley" className="pl-9"
                    value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-lname">Last Name</Label>
                <Input id="ai-lname" type="text" placeholder="Park"
                  value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input id="ai-password" type={showPassword ? "text" : "password"} placeholder="Min. 8 characters"
                  className="pl-9 pr-10" value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-confirm">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input id="ai-confirm" type={showPassword ? "text" : "password"} placeholder="Repeat your password"
                  className="pl-9" value={form.confirm}
                  onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading || !code}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Set up account <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
