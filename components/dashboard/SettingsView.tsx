"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { slackAlerts, slackSettings as initial } from "@/lib/mock-data";
import { Bell, Hash, Shield, ExternalLink, Loader2, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSSE } from "@/hooks/useSSE";

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLogRow {
  id: string;
  agentId: string;
  agentName: string;
  agentEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  metadata: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: string;
}

// ─── Action badge styling ─────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, string> = {
  LOGIN:                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  SIGNUP:                   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CONVERSATION_REPLY:       "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  NOTE_ADDED:               "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  STATUS_CHANGED:           "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  CONVERSATION_SNOOZED:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  CONVERSATION_CREATED:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CONVERSATION_ASSIGNED:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  TAG_ADDED:                "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  TAG_REMOVED:              "bg-muted text-muted-foreground",
  TAG_CREATED:              "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  TAG_DELETED:              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MACRO_APPLIED:            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  MACRO_CREATED:            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  MACRO_UPDATED:            "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  MACRO_DELETED:            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  AGENT_ROLE_CHANGED:       "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  AGENT_STATUS_CHANGED:     "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  AGENT_PERMISSION_CHANGED: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  CLICKUP_TASK_CREATED:     "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  ARTICLE_CREATED:          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  ARTICLE_DELETED:          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const ALL_ACTIONS = Object.keys(ACTION_STYLES);

function actionLabel(action: string): string {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

function metaSummary(log: AuditLogRow): string {
  const m = log.metadata;
  if (!m) return "";
  if (log.action === "AGENT_ROLE_CHANGED") return `${m.from} → ${m.to}`;
  if (log.action === "AGENT_STATUS_CHANGED") return `${m.from} → ${m.to}`;
  if (log.action === "AGENT_PERMISSION_CHANGED") return `${m.key}: ${m.granted ? "granted" : "revoked"}`;
  if (log.action === "STATUS_CHANGED") return m.status ?? "";
  if (log.action === "CLICKUP_TASK_CREATED") return m.taskUrl ? "Task created" : "";
  if (log.action === "MACRO_APPLIED") return m.macroId ? `macro ${m.macroId.slice(0, 8)}` : "";
  return "";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function absTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

const PER_PAGE = 50;

export function AuditView() {
  const [logs, setLogs]           = useState<AuditLogRow[]>([]);
  const [totalCount, setTotal]    = useState(0);
  const [loading, setLoading]     = useState(true);
  const [agents, setAgents]       = useState<{ id: string; name: string }[]>([]);
  const [agentId, setAgentId]     = useState("");
  const [action, setAction]       = useState("");
  const [from, setFrom]           = useState("");
  const [to, setTo]               = useState("");
  const [page, setPage]           = useState(1);

  useEffect(() => {
    api.agents.list().then((res) => {
      setAgents(
        (res.data ?? []).map((a: any) => ({
          id: a.id,
          name: `${a.firstName} ${a.lastName ?? ""}`.trim(),
        }))
      );
    }).catch(() => {});
  }, []);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    api.auditLogs
      .list({
        agentId: agentId || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to ? `${to}T23:59:59` : undefined,
        page,
        perPage: PER_PAGE,
      })
      .then((res) => {
        setLogs(res.data?.logs ?? []);
        setTotal(res.data?.totalCount ?? 0);
      })
      .catch((e: any) => toast.error(e.message ?? "Failed to load audit logs"))
      .finally(() => setLoading(false));
  }, [agentId, action, from, to, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Keep a stable ref to current filters so the SSE handler can check them
  const filtersRef = useRef({ agentId, action, from, to, page });
  filtersRef.current = { agentId, action, from, to, page };

  useSSE({
    onAuditLogNew: useCallback((log: AuditLogRow) => {
      const f = filtersRef.current;
      // Only prepend if we're on page 1 and the new log matches active filters
      if (f.page !== 1) return;
      if (f.agentId && log.agentId !== f.agentId) return;
      if (f.action  && log.action  !== f.action)  return;
      if (f.from && new Date(log.createdAt) < new Date(f.from)) return;
      if (f.to   && new Date(log.createdAt) > new Date(`${f.to}T23:59:59`)) return;

      setLogs((prev) => [log, ...prev].slice(0, PER_PAGE));
      setTotal((n) => n + 1);
    }, []),
  });

  const clearFilters = () => {
    setAgentId(""); setAction(""); setFrom(""); setTo(""); setPage(1);
  };

  const hasFilters = !!(agentId || action || from || to);
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h1 className="text-base font-semibold">Audit log</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Every agent action recorded — {totalCount.toLocaleString()} total entries.
        </p>
      </div>

      {/* Filters */}
      <div className="border-b border-border bg-card/50 px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

          {/* Agent filter */}
          <select
            value={agentId}
            onChange={(e) => { setAgentId(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Action filter */}
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">All actions</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{actionLabel(a)}</option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none"
          />

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2">
            <Shield className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No audit log entries found</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur-sm text-muted-foreground">
              <tr>
                <th className="w-36 px-4 py-2.5 text-left font-semibold">When</th>
                <th className="px-4 py-2.5 text-left font-semibold">Agent</th>
                <th className="px-4 py-2.5 text-left font-semibold">Action</th>
                <th className="px-4 py-2.5 text-left font-semibold">Target</th>
                <th className="px-4 py-2.5 text-left font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground" title={absTime(log.createdAt)}>
                    {relativeTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{log.agentName}</div>
                    <div className="text-[10px] text-muted-foreground">{log.agentEmail}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", ACTION_STYLES[log.action] ?? "bg-muted text-muted-foreground")}>
                      {actionLabel(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {log.targetName || log.targetId ? (
                      <>
                        <div className="font-medium">{log.targetName ?? log.targetId}</div>
                        {log.targetType && (
                          <div className="text-[10px] text-muted-foreground uppercase">{log.targetType}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {metaSummary(log) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border bg-card/50 px-6 py-3">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {totalCount.toLocaleString()} entries
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
