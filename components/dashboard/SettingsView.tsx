"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Hash, Shield, ExternalLink, Loader2, ChevronLeft, ChevronRight, Filter, X, MessageSquare, StickyNote, Wand2, Clock, AlertTriangle, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSSE } from "@/hooks/useSSE";
import { useAuth } from "@/contexts/AuthContext";

// ─── IANA timezone list (common subset) ───────────────────────────────────────
const TIMEZONES = Intl.supportedValuesOf
  ? Intl.supportedValuesOf("timeZone")
  : [
      "UTC", "America/New_York", "America/Chicago", "America/Denver",
      "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
      "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
      "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
      "Australia/Sydney", "Pacific/Auckland",
    ];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface WorkspaceSettings {
  slaThresholdPlatinum: number;
  slaThresholdGold: number;
  slaThresholdSilver: number;
  slaThresholdNew: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingHoursTimezone: string;
  workingHoursDays: number[];
  slackWebhookUrl: string | null;
  slackChannel: string | null;
  alertSlaEnabled: boolean;
  alertSentimentEnabled: boolean;
  alertChurnEnabled: boolean;
  alertChargebackEnabled: boolean;
}

interface AlertRow {
  id: string;
  conversationId: string;
  customerName: string | null;
  customerTier: string | null;
  alertType: string;
  messageSnippet: string | null;
  firedAt: string;
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  slaThresholdPlatinum: 15,
  slaThresholdGold: 15,
  slaThresholdSilver: 30,
  slaThresholdNew: 60,
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  workingHoursTimezone: "America/Los_Angeles",
  workingHoursDays: [1, 2, 3, 4, 5],
  slackWebhookUrl: null,
  slackChannel: null,
  alertSlaEnabled: true,
  alertSentimentEnabled: false,
  alertChurnEnabled: false,
  alertChargebackEnabled: false,
};

function alertTypeLabel(t: string) {
  switch (t) {
    case "sla_breach": return "SLA Breach";
    case "sentiment_negative": return "Negative Sentiment";
    case "churn_high": return "High Churn Risk";
    case "chargeback_keyword": return "Chargeback Keyword";
    default: return t.replace(/_/g, " ");
  }
}

function alertTypeColor(t: string) {
  switch (t) {
    case "sla_breach": return "bg-danger/15 text-danger";
    case "sentiment_negative": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "churn_high": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "chargeback_keyword": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function relativeAlertTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SettingsView({ onOpenConversation }: { onOpenConversation: (id: string) => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  useEffect(() => {
    api.settings.get()
      .then((res: any) => {
        const s = res.data ?? res;
        setSettings(s);
        setDraft(s);
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));

    api.alerts.list()
      .then((res: any) => setAlerts(res.data ?? res ?? []))
      .catch(() => {})
      .finally(() => setAlertsLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await api.settings.update(draft);
      const s = res.data ?? res;
      setSettings(s);
      setDraft(s);
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(day: number) {
    setDraft((d) => ({
      ...d,
      workingHoursDays: d.workingHoursDays.includes(day)
        ? d.workingHoursDays.filter((x) => x !== day)
        : [...d.workingHoursDays, day].sort(),
    }));
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <div className="border-b border-border bg-card px-4 py-5 md:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Configure SLA thresholds, working hours, and Slack alerts." : "Settings are view-only. Contact an admin to make changes."}
            </p>
          </div>
          {isAdmin && dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save changes
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 space-y-5">

        {/* SLA Thresholds */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <h2 className="text-sm font-semibold">SLA breach thresholds</h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Alert fires when a customer has been waiting longer than these limits (minutes). Uses Intercom's native SLA if configured, otherwise falls back to working-hours calculation.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["Platinum", "Gold", "Silver", "New"] as const).map((tier) => {
              const key = `slaThreshold${tier}` as keyof WorkspaceSettings;
              return (
                <div key={tier}>
                  <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{tier}</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      disabled={!isAdmin}
                      value={draft[key] as number}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-right focus:outline-none disabled:opacity-50"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">min</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Working Hours */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-sm font-semibold">Working hours</h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Used to calculate wait time only during business hours. Conversations outside these hours don't accumulate SLA wait time.
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium">Timezone</label>
              <select
                disabled={!isAdmin}
                value={draft.workingHoursTimezone}
                onChange={(e) => setDraft((d) => ({ ...d, workingHoursTimezone: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none disabled:opacity-50"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium">Start time</label>
                <input
                  type="time"
                  disabled={!isAdmin}
                  value={draft.workingHoursStart}
                  onChange={(e) => setDraft((d) => ({ ...d, workingHoursStart: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none disabled:opacity-50"
                />
              </div>
              <span className="mt-5 text-sm text-muted-foreground">to</span>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium">End time</label>
                <input
                  type="time"
                  disabled={!isAdmin}
                  value={draft.workingHoursEnd}
                  onChange={(e) => setDraft((d) => ({ ...d, workingHoursEnd: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium">Working days</label>
              <div className="flex gap-1.5">
                {DAY_NAMES.map((name, idx) => (
                  <button
                    key={idx}
                    disabled={!isAdmin}
                    onClick={() => toggleDay(idx)}
                    className={cn(
                      "h-8 w-10 rounded-md border text-xs font-medium transition disabled:opacity-50",
                      draft.workingHoursDays.includes(idx)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Slack Integration */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <Hash className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-sm font-semibold">Slack integration</h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">Alerts are posted via an incoming webhook. Set up a webhook in your Slack app settings.</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium">Webhook URL</label>
              <input
                type="url"
                disabled={!isAdmin}
                placeholder="https://hooks.slack.com/services/..."
                value={draft.slackWebhookUrl ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, slackWebhookUrl: e.target.value || null }))}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">Channel (optional)</label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
                <Hash className="h-3 w-3 shrink-0 text-muted-foreground" />
                <input
                  disabled={!isAdmin}
                  placeholder="support-alerts"
                  value={draft.slackChannel ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, slackChannel: e.target.value || null }))}
                  className="flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Alert Toggles */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-sm font-semibold">Alert triggers</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Choose which events fire a Slack alert. Alerts have a 30-minute cooldown per conversation.</p>
          <Toggle
            label="SLA breach (customer waiting too long)"
            v={draft.alertSlaEnabled}
            disabled={!isAdmin}
            onChange={(v) => setDraft((d) => ({ ...d, alertSlaEnabled: v }))}
          />
          <Toggle
            label="Sentiment turns strongly negative"
            v={draft.alertSentimentEnabled}
            disabled={!isAdmin}
            onChange={(v) => setDraft((d) => ({ ...d, alertSentimentEnabled: v }))}
          />
          <Toggle
            label="Churn risk flips to High"
            v={draft.alertChurnEnabled}
            disabled={!isAdmin}
            onChange={(v) => setDraft((d) => ({ ...d, alertChurnEnabled: v }))}
          />
          <Toggle
            label="Chargeback / dispute / legal keywords detected"
            v={draft.alertChargebackEnabled}
            disabled={!isAdmin}
            onChange={(v) => setDraft((d) => ({ ...d, alertChargebackEnabled: v }))}
          />
        </section>

        {/* Recent Alerts */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-sm font-semibold">Recent alerts fired</h2>
          </div>
          {alertsLoading ? (
            <div className="flex h-16 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No alerts fired yet. Configure a Slack webhook and enable an alert trigger above.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="rounded-md border border-border bg-background p-3 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", alertTypeColor(a.alertType))}>
                        {alertTypeLabel(a.alertType)}
                      </span>
                      {a.customerName && <span className="font-semibold">{a.customerName}</span>}
                      {a.customerTier && (
                        <span className="rounded bg-muted px-1.5 py-0 text-[9px] font-semibold uppercase">{a.customerTier}</span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{relativeAlertTime(a.firedAt)}</span>
                  </div>
                  {a.messageSnippet && (
                    <p className="italic text-muted-foreground line-clamp-2">&ldquo;{a.messageSnippet}&rdquo;</p>
                  )}
                  <button
                    onClick={() => onOpenConversation(a.conversationId)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    Open conversation <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function Toggle({ label, v, disabled, onChange }: { label: string; v: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex items-center justify-between py-2 text-xs", disabled ? "opacity-60" : "cursor-pointer")}>
      <span>{label}</span>
      <button
        disabled={disabled}
        onClick={() => onChange(!v)}
        className={"relative h-5 w-9 shrink-0 rounded-full transition " + (v ? "bg-primary" : "bg-muted")}
      >
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

// STATUS_CHANGED is split into individual status filter options; exclude it from the flat list
const ALL_ACTIONS = Object.keys(ACTION_STYLES).filter(a => a !== "STATUS_CHANGED");

// Virtual filter keys for per-status filtering (mapped to action=STATUS_CHANGED + metadataStatus=X at the API layer)
const STATUS_FILTER_OPTIONS = [
  { value: "__STATUS_closed",  label: "Status: closed" },
  { value: "__STATUS_open",    label: "Status: open" },
  { value: "__STATUS_pending", label: "Status: pending" },
];

function isStatusFilter(action: string) { return action.startsWith("__STATUS_"); }
function statusFilterValue(action: string) { return action.replace("__STATUS_", ""); }

function actionLabel(action: string): string {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

function MetaDetails({ log }: { log: AuditLogRow }) {
  const m = log.metadata;
  const isConvAction = log.targetType === "CONVERSATION" && !!log.targetId;

  // Plain-text summary line
  let summary = "";
  let icon: React.ReactNode = null;

  if (log.action === "AGENT_ROLE_CHANGED")        { summary = `${m?.from} → ${m?.to}`; }
  else if (log.action === "AGENT_STATUS_CHANGED") { summary = `${m?.from} → ${m?.to}`; }
  else if (log.action === "AGENT_PERMISSION_CHANGED") { summary = `${m?.key}: ${m?.granted ? "granted" : "revoked"}`; }
  else if (log.action === "STATUS_CHANGED")       { summary = ""; }
  else if (log.action === "CLICKUP_TASK_CREATED") { summary = m?.taskUrl ? "Task created" : ""; }
  else if (log.action === "MACRO_APPLIED") {
    icon = <Wand2 className="h-3 w-3 shrink-0 text-muted-foreground" />;
    summary = m?.macroName ? `Macro: ${m.macroName}` : "Macro applied";
  } else if (log.action === "CONVERSATION_REPLY") {
    icon = <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />;
    summary = m?.snippet ? `"${m.snippet.slice(0, 120)}${m.snippet.length >= 120 ? "…" : ""}"` : "";
  } else if (log.action === "NOTE_ADDED") {
    icon = <StickyNote className="h-3 w-3 shrink-0 text-muted-foreground" />;
    summary = m?.snippet ? `"${m.snippet.slice(0, 120)}${m.snippet.length >= 120 ? "…" : ""}"` : "";
  }

  if (!summary && !isConvAction) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="space-y-1">
      {summary && (
        <div className="flex items-start gap-1">
          {icon}
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{summary}</p>
        </div>
      )}
      {isConvAction && (
        <a
          href={`/inbox/${encodeURIComponent(log.targetId ?? '')}${
            m?.partId ? `?msg=${encodeURIComponent(m.partId)}` :
            m?.partIds?.[0] ? `?msg=${encodeURIComponent(m.partIds[0])}` : ''
          }`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          View conversation <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </div>
  );
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
    // Translate virtual __STATUS_X keys to action=STATUS_CHANGED + metadataStatus=X
    const apiAction = action
      ? isStatusFilter(action) ? "STATUS_CHANGED" : action
      : undefined;
    const apiMetadataStatus = action && isStatusFilter(action)
      ? statusFilterValue(action)
      : undefined;

    api.auditLogs
      .list({
        agentId: agentId || undefined,
        action: apiAction,
        metadataStatus: apiMetadataStatus,
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
      if (f.page !== 1) return;
      if (f.agentId && log.agentId !== f.agentId) return;
      if (f.action) {
        if (isStatusFilter(f.action)) {
          // Virtual status filter: check action=STATUS_CHANGED and metadata.status matches
          if (log.action !== "STATUS_CHANGED") return;
          if (log.metadata?.status !== statusFilterValue(f.action)) return;
        } else {
          if (log.action !== f.action) return;
        }
      }
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
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
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
                <th className="w-32 px-4 py-2.5 text-left font-semibold">Sentiment</th>
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
                      {log.action === "STATUS_CHANGED" && log.metadata?.status
                        ? log.metadata.status
                        : actionLabel(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    {log.targetName ? (
                      <div className="font-medium truncate" title={log.targetName}>
                        {log.targetName}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 max-w-[280px]">
                    <MetaDetails log={log} />
                  </td>
                  <td className="px-4 py-2.5">
                    {log.action === "STATUS_CHANGED" && log.metadata?.status === "closed" && log.metadata?.sentiment ? (
                      <div>
                        <span className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                          log.metadata.sentiment === "positive" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                          log.metadata.sentiment === "neutral"  && "bg-muted text-muted-foreground",
                          log.metadata.sentiment === "negative" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                        )}>
                          {log.metadata.sentiment}
                        </span>
                        {log.metadata.sentimentReason && (
                          <p className="mt-1 text-[10px] text-muted-foreground leading-snug line-clamp-2" title={log.metadata.sentimentReason}>
                            {log.metadata.sentimentReason}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
