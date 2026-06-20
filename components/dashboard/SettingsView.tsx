"use client";

import { useState } from "react";
import { slackAlerts, slackSettings as initial, auditLog } from "@/lib/mock-data";
import { Bell, Hash, Shield, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function SettingsView({ onOpenConversation }: { onOpenConversation: (id: string) => void }) {
  const [s, setS] = useState(initial);
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <div className="border-b border-border bg-card px-4 py-5 md:px-8">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">Slack alerts and notification rules.</p>
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold">Slack channel</h2>
          <p className="mb-3 text-xs text-muted-foreground">Where Slack alerts get posted.</p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={s.channel} onChange={(e) => setS({ ...s, channel: e.target.value })}
              className="flex-1 bg-transparent text-sm focus:outline-none" />
            <button onClick={() => toast.success("Channel updated")} className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">Save</button>
          </div>
        </section>
        <section className="mt-5 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold">Alert triggers</h2>
          <p className="mb-3 text-xs text-muted-foreground">When an alert fires to Slack.</p>
          <Toggle label="Sentiment turns strongly negative" v={s.thresholds.negativeSentiment} onChange={(v) => setS({ ...s, thresholds: { ...s.thresholds, negativeSentiment: v } })} />
          <Toggle label="Churn risk flips to High" v={s.thresholds.churnHigh} onChange={(v) => setS({ ...s, thresholds: { ...s.thresholds, churnHigh: v } })} />
          <Toggle label="Chargeback / dispute / legal keywords detected" v={s.thresholds.chargebackKeywords} onChange={(v) => setS({ ...s, thresholds: { ...s.thresholds, chargebackKeywords: v } })} />
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
            <span>SLA breach threshold for Platinum / Gold (minutes)</span>
            <input type="number" value={s.thresholds.slaBreachVipMinutes}
              onChange={(e) => setS({ ...s, thresholds: { ...s.thresholds, slaBreachVipMinutes: Number(e.target.value) } })}
              className="w-16 rounded border border-border bg-background px-2 py-1 text-right focus:outline-none" />
          </div>
        </section>
        <section className="mt-5 rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-sm font-semibold">Recent alerts fired</h2>
          </div>
          <div className="space-y-2">
            {slackAlerts.map((a) => (
              <div key={a.id} className="rounded-md border border-border bg-background p-3 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{a.customer}</span>
                    <span className="rounded bg-muted px-1.5 py-0 text-[9px] font-semibold uppercase">{a.tier}</span>
                    <span className="text-muted-foreground">· {a.reason}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{a.when}</span>
                </div>
                <p className="italic text-muted-foreground">&ldquo;{a.snippet}&rdquo;</p>
                <button onClick={() => onOpenConversation(a.conversationId)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                  Open conversation <ExternalLink className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2 text-xs">
      <span>{label}</span>
      <button onClick={() => onChange(!v)}
        className={"relative h-5 w-9 rounded-full transition " + (v ? "bg-primary" : "bg-muted")}>
        <span className={"absolute top-0.5 h-4 w-4 rounded-full bg-background transition " + (v ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export function AuditView() {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <div className="border-b border-border bg-card px-4 py-5 md:px-8">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Audit log</h1>
        </div>
        <p className="text-xs text-muted-foreground">Sensitive actions performed by agents. Admin-only view.</p>
      </div>
      <div className="mx-auto w-full max-w-4xl px-8 py-6">
        <AuditTable />
      </div>
    </div>
  );
}

function AuditTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">When</th>
            <th className="px-4 py-2 text-left font-semibold">Agent</th>
            <th className="px-4 py-2 text-left font-semibold">Action</th>
            <th className="px-4 py-2 text-left font-semibold">Customer</th>
          </tr>
        </thead>
        <tbody>
          {auditLog.map((a) => (
            <tr key={a.id} className="border-t border-border">
              <td className="px-4 py-2 text-muted-foreground">{a.when}</td>
              <td className="px-4 py-2 font-medium">{a.agent}</td>
              <td className="px-4 py-2"><span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{a.action}</span></td>
              <td className="px-4 py-2">{a.customer}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
