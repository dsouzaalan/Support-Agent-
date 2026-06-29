"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { useSSE } from "@/hooks/useSSE";
import { cn } from "@/lib/utils";
import {
  Bell, Users, FileText, Hash, BookOpen,
  Plus, Trash2, Pencil, X, ChevronDown, ChevronUp,
  Shield, Loader2, ExternalLink, UserCheck, UserX,
  MessageSquare, StickyNote, Tag, UserCog, ClipboardList,
  Clock, Globe, Webhook, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentRole } from "@/contexts/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

type AgentStatus = "active" | "invited" | "deactivated";
interface AgentRow {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  role: AgentRole;
  status: AgentStatus;
  intercomAdminId: string | null;
  permissions: string[];
  overrides: { key: string; granted: boolean }[];
}
interface PermissionsMatrix {
  all: string[];
  defaults: Record<AgentRole, string[]>;
}
interface MacroAction {
  type: "reply" | "status" | "tag";
  body?: string;
  value?: string;
  tagId?: string;
}
interface Macro {
  id: string;
  name: string;
  description: string;
  actions: MacroAction[];
}
interface Tag { id: string; name: string }
interface Article { id: string; title: string; state: string; url: string; description: string }

const ROLE_LABELS: Record<AgentRole, string> = { admin: "Admin", supervisor: "Supervisor", agent: "Agent" };

const ROLE_STYLES: Record<AgentRole, { badge: string; avatar: string; pill: string }> = {
  admin:      { badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", avatar: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", pill: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-300" },
  supervisor: { badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",         avatar: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",         pill: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300" },
  agent:      { badge: "bg-muted text-muted-foreground",                                            avatar: "bg-muted text-muted-foreground",                                            pill: "border-border bg-muted/50 text-muted-foreground" },
};

const STATUS_STYLES: Record<AgentStatus, string> = {
  active:      "bg-success/15 text-success",
  invited:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  deactivated: "bg-muted text-muted-foreground line-through",
};

const PERMISSION_GROUPS: { label: string; icon: React.ReactNode; keys: string[] }[] = [
  {
    label: "Conversations",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    keys: ["conversations:view_all", "conversations:reply", "conversations:assign", "conversations:status"],
  },
  {
    label: "Notes",
    icon: <StickyNote className="h-3.5 w-3.5" />,
    keys: ["notes:create", "notes:view"],
  },
  {
    label: "Articles & Macros",
    icon: <Tag className="h-3.5 w-3.5" />,
    keys: ["articles:view", "articles:manage", "macros:apply", "macros:manage"],
  },
  {
    label: "Team",
    icon: <UserCog className="h-3.5 w-3.5" />,
    keys: ["agents:view", "agents:invite", "agents:deactivate", "agents:edit_permissions"],
  },
  {
    label: "Integrations",
    icon: <ClipboardList className="h-3.5 w-3.5" />,
    keys: ["clickup:link"],
  },
  {
    label: "Audit",
    icon: <ClipboardList className="h-3.5 w-3.5" />,
    keys: ["audit_logs:view"],
  },
];

const PERMISSION_LABELS: Record<string, string> = {
  "conversations:view_all":    "View all conversations",
  "conversations:reply":       "Reply to conversations",
  "conversations:assign":      "Assign conversations",
  "conversations:status":      "Change conversation status",
  "notes:create":              "Create internal notes",
  "notes:view":                "View internal notes",
  "articles:view":             "View articles",
  "articles:manage":           "Create & delete articles",
  "macros:apply":              "Apply macros",
  "macros:manage":             "Create, edit & delete macros",
  "agents:view":               "View team members",
  "agents:invite":             "Invite new agents",
  "agents:deactivate":         "Deactivate agents",
  "agents:edit_permissions":   "Edit agent permissions & roles",
  "audit_logs:view":           "View audit logs",
  "clickup:link":              "Link & create ClickUp tasks",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminSettingsView({ onOpenConversation }: { onOpenConversation: (id: string) => void }) {
  const { can, role } = usePermissions();
  const isAdmin = role === "admin";

  const tabs = [
    { key: "alerts",   label: "Alerts",    icon: <Bell className="h-3.5 w-3.5" />,     show: true },
    { key: "agents",   label: "Agents",    icon: <Users className="h-3.5 w-3.5" />,    show: isAdmin },
    { key: "macros",   label: "Macros",    icon: <FileText className="h-3.5 w-3.5" />, show: can("macros:manage") },
    { key: "articles", label: "Articles",  icon: <BookOpen className="h-3.5 w-3.5" />, show: can("articles:manage") },
  ].filter((t) => t.show);

  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "alerts");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
        <h1 className="text-base font-semibold">Settings</h1>
      </div>

      {/* Tab bar — scrollable on mobile */}
      <div className="flex overflow-x-auto border-b border-border bg-card px-4 sm:px-6 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition",
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "alerts"   && <AlertsTab onOpenConversation={onOpenConversation} />}
        {activeTab === "agents"   && <AgentsTab />}
        {activeTab === "macros"   && <MacrosTab />}
        {activeTab === "articles" && <ArticlesTab />}
      </div>
    </div>
  );
}

// ─── Alerts tab ───────────────────────────────────────────────────────────────

const TIMEZONES = [
  "UTC",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "America/Honolulu", "America/Sao_Paulo", "America/Toronto",
  "America/Vancouver", "America/Mexico_City", "America/Bogota", "America/Santiago",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Amsterdam",
  "Europe/Madrid", "Europe/Rome", "Europe/Stockholm", "Europe/Moscow",
  "Europe/Istanbul", "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos",
  "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Colombo",
  "Asia/Dhaka", "Asia/Bangkok", "Asia/Singapore", "Asia/Hong_Kong",
  "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney",
  "Australia/Melbourne", "Australia/Perth", "Pacific/Auckland",
];

const DAYS = [
  { label: "Mon", value: 1 }, { label: "Tue", value: 2 }, { label: "Wed", value: 3 },
  { label: "Thu", value: 4 }, { label: "Fri", value: 5 }, { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

const ALERT_TYPE_LABELS: Record<string, string> = {
  sla_breach_ftr:      "SLA Breach (FTR)",
  sla_breach_ntr:      "SLA Breach (NTR)",
  sentiment_negative:  "Negative Sentiment",
  churn_high:          "High Churn Risk",
  chargeback_keyword:  "Chargeback Keyword",
};

const TIER_EMOJI: Record<string, string> = {
  Platinum: "💎", Gold: "🥇", Silver: "🥈", New: "🆕",
};

function relativeTime(date: string | Date): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function AlertsTab({ onOpenConversation }: { onOpenConversation: (id: string) => void }) {
  const [loading, setLoading] = useState(true);

  // Slack channel names (webhook URLs live in env vars)
  const [channelDefault,    setChannelDefault]    = useState("");
  const [channelSla,        setChannelSla]        = useState("");
  const [channelSentiment,  setChannelSentiment]  = useState("");
  const [channelChargeback, setChannelChargeback] = useState("");
  const [savingSlack,       setSavingSlack]       = useState(false);

  // Alert toggles
  const [alertSla,         setAlertSla]         = useState(true);
  const [alertSentiment,   setAlertSentiment]   = useState(false);
  const [alertChurn,       setAlertChurn]       = useState(false);
  const [alertChargeback,  setAlertChargeback]  = useState(false);
  const [savingToggles,    setSavingToggles]    = useState(false);

  // FTR thresholds
  const [ftrPlatinum, setFtrPlatinum] = useState(15);
  const [ftrGold,     setFtrGold]     = useState(15);
  const [ftrSilver,   setFtrSilver]   = useState(30);
  const [ftrNew,      setFtrNew]      = useState(60);
  // NTR thresholds
  const [ntrPlatinum, setNtrPlatinum] = useState(30);
  const [ntrGold,     setNtrGold]     = useState(60);
  const [ntrSilver,   setNtrSilver]   = useState(120);
  const [ntrNew,      setNtrNew]      = useState(240);
  const [savingThresholds, setSavingThresholds] = useState(false);

  // Working hours
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd,   setWorkEnd]   = useState("18:00");
  const [workTz,    setWorkTz]    = useState("America/Los_Angeles");
  const [workDays,  setWorkDays]  = useState<number[]>([1, 2, 3, 4, 5]);
  const [savingHours, setSavingHours] = useState(false);

  // Real alerts
  const [recentAlerts,   setRecentAlerts]   = useState<any[]>([]);
  const [alertsLoading,  setAlertsLoading]  = useState(true);

  useEffect(() => {
    api.settings.get()
      .then((res) => {
        const d = res.data ?? res;
        setChannelDefault(d.slackChannel ?? "");
        setChannelSla(d.slackChannelSla ?? "");
        setChannelSentiment(d.slackChannelSentiment ?? "");
        setChannelChargeback(d.slackChannelChargeback ?? "");
        setAlertSla(d.alertSlaEnabled ?? true);
        setAlertSentiment(d.alertSentimentEnabled ?? false);
        setAlertChurn(d.alertChurnEnabled ?? false);
        setAlertChargeback(d.alertChargebackEnabled ?? false);
        setFtrPlatinum(d.slaThresholdPlatinum ?? 15);
        setFtrGold(d.slaThresholdGold ?? 15);
        setFtrSilver(d.slaThresholdSilver ?? 30);
        setFtrNew(d.slaThresholdNew ?? 60);
        setNtrPlatinum(d.slaNtrThresholdPlatinum ?? 30);
        setNtrGold(d.slaNtrThresholdGold ?? 60);
        setNtrSilver(d.slaNtrThresholdSilver ?? 120);
        setNtrNew(d.slaNtrThresholdNew ?? 240);
        setWorkStart(d.workingHoursStart ?? "09:00");
        setWorkEnd(d.workingHoursEnd ?? "18:00");
        setWorkTz(d.workingHoursTimezone ?? "America/Los_Angeles");
        setWorkDays(d.workingHoursDays ?? [1, 2, 3, 4, 5]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    api.alerts.list()
      .then((res) => setRecentAlerts(res.data ?? []))
      .catch(() => {})
      .finally(() => setAlertsLoading(false));
  }, []);

  const saveSlack = async () => {
    setSavingSlack(true);
    try {
      await api.settings.update({
        slackChannel:            channelDefault    || null,
        slackChannelSla:         channelSla        || null,
        slackChannelSentiment:   channelSentiment  || null,
        slackChannelChargeback:  channelChargeback || null,
      });
      toast.success("Slack settings saved");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingSlack(false); }
  };

  const saveToggles = async (patch: Record<string, boolean>) => {
    setSavingToggles(true);
    try {
      await api.settings.update(patch);
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingToggles(false); }
  };

  const saveThresholds = async () => {
    setSavingThresholds(true);
    try {
      await api.settings.update({
        slaThresholdPlatinum:    ftrPlatinum,
        slaThresholdGold:        ftrGold,
        slaThresholdSilver:      ftrSilver,
        slaThresholdNew:         ftrNew,
        slaNtrThresholdPlatinum: ntrPlatinum,
        slaNtrThresholdGold:     ntrGold,
        slaNtrThresholdSilver:   ntrSilver,
        slaNtrThresholdNew:      ntrNew,
      });
      toast.success("SLA thresholds saved");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingThresholds(false); }
  };

  const saveHours = async () => {
    setSavingHours(true);
    try {
      await api.settings.update({
        workingHoursStart:    workStart,
        workingHoursEnd:      workEnd,
        workingHoursTimezone: workTz,
        workingHoursDays:     workDays,
      });
      toast.success("Working hours saved");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingHours(false); }
  };

  const toggleDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  if (loading) return <TabLoader />;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-6 space-y-4">

      {/* Slack */}
      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <Webhook className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-semibold">Slack integration</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Enter the Slack channel name for each alert type. Webhook URLs are configured via environment variables.
        </p>
        <div className="space-y-3">
          {[
            { label: "Default channel",       placeholder: "#support-alerts",  value: channelDefault,    set: setChannelDefault, },
            // { label: "SLA breaches",           placeholder: "#sla-alerts",      value: channelSla,        set: setChannelSla,        hint: "Uses ZAPMAIL_SLACK_WEBHOOK_SLA" },
            { label: "Sentiment & churn",      placeholder: "#customer-health", value: channelSentiment,  set: setChannelSentiment, },
            // { label: "Chargeback / dispute",   placeholder: "#risk-alerts",     value: channelChargeback, set: setChannelChargeback, hint: "Uses ZAPMAIL_SLACK_WEBHOOK_CHARGEBACK" },
          ].map(({ label, placeholder, value, set}) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                {/* <span className="text-[10px] text-muted-foreground">{hint}</span> */}
              </div>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:border-primary/50 focus:outline-none"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={saveSlack}
            disabled={savingSlack}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingSlack && <Loader2 className="h-3 w-3 animate-spin" />}
            Save
          </button>
        </div>
      </section>

      {/* Alert toggles */}
      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-semibold">Alert triggers</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">Choose which events fire a Slack alert.</p>
        {savingToggles && <span className="mb-2 block text-[10px] text-muted-foreground">Saving…</span>}
        <Toggle
          label="SLA breach"
          v={alertSla}
          onChange={(v) => { setAlertSla(v); saveToggles({ alertSlaEnabled: v }); }}
        />
        <Toggle
          label="Sentiment turns strongly negative"
          v={alertSentiment}
          onChange={(v) => { setAlertSentiment(v); saveToggles({ alertSentimentEnabled: v }); }}
        />
        <Toggle
          label="Churn risk flips to High"
          v={alertChurn}
          onChange={(v) => { setAlertChurn(v); saveToggles({ alertChurnEnabled: v }); }}
        />
        <Toggle
          label="Chargeback / dispute / legal keywords detected"
          v={alertChargeback}
          onChange={(v) => { setAlertChargeback(v); saveToggles({ alertChargebackEnabled: v }); }}
        />
      </section>

      {/* SLA thresholds */}
      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-semibold">SLA thresholds</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Working-hours minutes before an SLA breach alert fires, per customer tier.
        </p>

        {/* FTR row */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">FTR</span>
            <span className="text-[10px] text-muted-foreground">First Time Response — no agent has replied yet</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Platinum 💎", value: ftrPlatinum, set: setFtrPlatinum },
              { label: "Gold 🥇",     value: ftrGold,     set: setFtrGold },
              { label: "Silver 🥈",   value: ftrSilver,   set: setFtrSilver },
              { label: "New 🆕",      value: ftrNew,      set: setFtrNew },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</label>
                <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5">
                  <input
                    type="number"
                    min={1}
                    value={value}
                    onChange={(e) => set(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-transparent text-sm tabular-nums focus:outline-none"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">min</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NTR row */}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">NTR</span>
            <span className="text-[10px] text-muted-foreground">Next Time Response — customer replied after agent</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Platinum 💎", value: ntrPlatinum, set: setNtrPlatinum },
              { label: "Gold 🥇",     value: ntrGold,     set: setNtrGold },
              { label: "Silver 🥈",   value: ntrSilver,   set: setNtrSilver },
              { label: "New 🆕",      value: ntrNew,      set: setNtrNew },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</label>
                <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5">
                  <input
                    type="number"
                    min={1}
                    value={value}
                    onChange={(e) => set(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-transparent text-sm tabular-nums focus:outline-none"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">min</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={saveThresholds}
            disabled={savingThresholds}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingThresholds && <Loader2 className="h-3 w-3 animate-spin" />}
            Save
          </button>
        </div>
      </section>

      {/* Working hours */}
      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-semibold">Working hours</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          SLA timers only count minutes that fall within these hours.
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Start time</label>
              <input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">End time</label>
              <input
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Globe className="h-3 w-3" /> Timezone
            </label>
            <select
              value={workTz}
              onChange={(e) => setWorkTz(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Working days</label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => toggleDay(value)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition",
                    workDays.includes(value)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={saveHours}
            disabled={savingHours}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingHours && <Loader2 className="h-3 w-3 animate-spin" />}
            Save
          </button>
        </div>
      </section>

      {/* Recent alerts */}
      <RecentAlertsPanel
        alerts={recentAlerts}
        loading={alertsLoading}
        onOpenConversation={onOpenConversation}
      />

    </div>
  );
}

// ─── Agents tab ───────────────────────────────────────────────────────────────

function AgentsTab() {
  const { can } = usePermissions();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [matrix, setMatrix] = useState<PermissionsMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "agent" as AgentRole });
  const [inviteSending, setInviteSending] = useState(false);

  useEffect(() => {
    Promise.all([api.agents.list(), api.agents.permissionsMatrix()])
      .then(([a, m]) => { setAgents(a.data ?? []); setMatrix(m.data ?? null); })
      .finally(() => setLoading(false));
  }, []);

  useSSE({
    onAgentUpdated: useCallback((updated:any) => {
      setAgents((prev) =>
        prev.map((a) => a.id === updated.id ? { ...a, ...updated } : a)
      );
    }, []),
  });

  const handleRoleChange = async (agentId: string, role: AgentRole) => {
    setSaving(agentId);
    try {
      await api.agents.updateRole(agentId, role);
      setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, role } : a));
      toast.success("Role updated");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  };

  const handleStatusToggle = async (agent: AgentRow) => {
    const next: AgentStatus = agent.status === "active" ? "deactivated" : "active";
    setSaving(agent.id);
    try {
      await api.agents.updateStatus(agent.id, next);
      setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, status: next } : a));
      toast.success(`Agent ${next}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  };

  const handlePermissionToggle = async (agent: AgentRow, key: string, current: boolean) => {
    setSaving(`${agent.id}-${key}`);
    try {
      await api.agents.updatePermission(agent.id, key, !current);
      setAgents((prev) => prev.map((a) => {
        if (a.id !== agent.id) return a;
        return { ...a, permissions: current ? a.permissions.filter((p) => p !== key) : [...a.permissions, key] };
      }));
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  };

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) { toast.error("Email is required"); return; }
    setInviteSending(true);
    try {
      const res = await api.agents.invite(inviteForm.email.trim(), inviteForm.role);
      const inviteLink: string | undefined = res?.data?.inviteLink;
      if (inviteLink) {
        try { await navigator.clipboard.writeText(inviteLink); } catch {}
        toast.success("Agent created — email failed. Invite link copied to clipboard.", { duration: 8000 });
      } else {
        toast.success(`Invitation sent to ${inviteForm.email}`);
      }
      setInviteOpen(false);
      setInviteForm({ email: "", role: "agent" });
      const [a, m] = await Promise.all([api.agents.list(), api.agents.permissionsMatrix()]);
      setAgents(a.data ?? []);
      setMatrix(m.data ?? null);
    } catch (e: any) { toast.error(e.message); }
    finally { setInviteSending(false); }
  };

  if (loading) return <TabLoader />;

  const counts = {
    total: agents.length,
    active: agents.filter((a) => a.status === "active").length,
    invited: agents.filter((a) => a.status === "invited").length,
    deactivated: agents.filter((a) => a.status === "deactivated").length,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between sm:mb-6">
        <div>
          <h2 className="text-sm font-semibold">Team Members</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage agents, roles, and permissions</p>
        </div>
        {can("agents:invite") && (
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Invite Agent</span>
            <span className="sm:hidden">Invite</span>
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-4 sm:gap-3">
        {[
          { label: "Total",       value: counts.total,       color: "text-foreground" },
          { label: "Active",      value: counts.active,      color: "text-success" },
          { label: "Invited",     value: counts.invited,     color: "text-amber-600 dark:text-amber-400" },
          { label: "Deactivated", value: counts.deactivated, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3">
            <div className={cn("text-xl font-bold tabular-nums sm:text-2xl", s.color)}>{s.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center" onClick={() => setInviteOpen(false)}>
          <div className="w-full max-w-sm rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Invite Agent</h3>
              <button onClick={() => setInviteOpen(false)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Email address</label>
                <input
                  type="email"
                  placeholder="agent@company.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as AgentRole }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                >
                  <option value="agent">Agent</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setInviteOpen(false)} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviteSending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {inviteSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Send invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent list */}
      <div className="space-y-2 sm:space-y-3">
        {agents.map((agent) => {
          const isExpanded = expandedId === agent.id;
          const roleStyle = ROLE_STYLES[agent.role];
          const initials = agent.firstName
            ? `${agent.firstName[0]}${agent.lastName?.[0] ?? ""}`.toUpperCase()
            : agent.email[0].toUpperCase();
          const overrideCount = matrix
            ? matrix.all.filter((k) => {
                const def = matrix.defaults[agent.role]?.includes(k) ?? false;
                return agent.permissions.includes(k) !== def;
              }).length
            : 0;

          return (
            <div key={agent.id} className={cn("rounded-xl border bg-card transition-shadow", isExpanded ? "border-primary/30 shadow-md" : "border-border hover:border-border/80 hover:shadow-sm")}>
              {/* Agent row */}
              <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">

                {/* Top section: avatar + name/email */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:h-10 sm:w-10", roleStyle.avatar)}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-sm font-semibold">
                        {agent.firstName ? `${agent.firstName}${agent.lastName ? ` ${agent.lastName}` : ""}` : agent.email}
                      </span>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", STATUS_STYLES[agent.status])}>
                        {agent.status}
                      </span>
                      {overrideCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {overrideCount} override{overrideCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{agent.email}</div>
                  </div>
                </div>

                {/* Controls — wrap on mobile, inline on sm+ */}
                <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">

                  {/* Role pills */}
                  {can("agents:edit_permissions") ? (
                    <div className="flex items-center gap-1">
                      {(["admin", "supervisor", "agent"] as AgentRole[]).map((r) => (
                        <button
                          key={r}
                          disabled={saving === agent.id}
                          onClick={() => agent.role !== r && handleRoleChange(agent.id, r)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-medium transition disabled:opacity-50 sm:px-2.5 sm:py-1",
                            agent.role === r
                              ? ROLE_STYLES[r].pill + " ring-1 ring-offset-1 ring-current"
                              : "border-border text-muted-foreground hover:border-border/60 hover:text-foreground"
                          )}
                        >
                          {saving === agent.id && agent.role === r
                            ? <Loader2 className="inline h-3 w-3 animate-spin" />
                            : ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", roleStyle.pill)}>
                      {ROLE_LABELS[agent.role]}
                    </span>
                  )}

                  {/* Deactivate / Reactivate — not shown for invited agents */}
                  {can("agents:deactivate") && agent.status !== "invited" && (
                    <button
                      disabled={saving === agent.id}
                      onClick={() => handleStatusToggle(agent)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 sm:gap-1.5 sm:px-3",
                        agent.status === "active"
                          ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                          : "border-success/40 text-success hover:bg-success/10"
                      )}
                    >
                      {agent.status === "active"
                        ? <><UserX className="h-3.5 w-3.5" /><span className="hidden sm:inline">Deactivate</span></>
                        : <><UserCheck className="h-3.5 w-3.5" /><span className="hidden sm:inline">Reactivate</span></>}
                    </button>
                  )}

                  {/* Expand permissions */}
                  {can("agents:edit_permissions") && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition sm:gap-1 sm:px-3",
                        isExpanded
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-border/60 hover:text-foreground"
                      )}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Permissions</span>
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Permissions panel */}
              {isExpanded && matrix && (
                <div className="border-t border-border bg-muted/30 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Permissions</p>
                      <p className="text-xs text-muted-foreground">
                        Defaults from <span className={cn("font-medium", roleStyle.badge.split(" ")[1])}>{ROLE_LABELS[agent.role]}</span> role.{" "}
                        Highlighted rows are custom overrides.
                      </p>
                    </div>
                    {overrideCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {overrideCount} custom override{overrideCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    {PERMISSION_GROUPS.map((group) => {
                      const groupKeys = group.keys.filter((k) => matrix.all.includes(k));
                      if (!groupKeys.length) return null;
                      return (
                        <div key={group.label}>
                          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.icon}
                            {group.label}
                          </div>
                          <div className="space-y-1">
                            {groupKeys.map((key) => {
                              const roleDefault = matrix.defaults[agent.role]?.includes(key) ?? false;
                              const current = agent.permissions.includes(key);
                              const isOverridden = current !== roleDefault;
                              const isSaving = saving === `${agent.id}-${key}`;
                              return (
                                <div
                                  key={key}
                                  className={cn(
                                    "flex items-center justify-between rounded-lg px-3 py-2",
                                    isOverridden
                                      ? "bg-primary/8 ring-1 ring-primary/20"
                                      : "bg-background/60"
                                  )}
                                >
                                  <div className="min-w-0 pr-3">
                                    <span className={cn("text-xs font-medium", isOverridden ? "text-primary" : "text-foreground")}>
                                      {PERMISSION_LABELS[key] ?? key}
                                    </span>
                                    {isOverridden && (
                                      <span className="ml-1.5 hidden text-[10px] text-primary/70 sm:inline">
                                        {current ? "(granted above role default)" : "(revoked from role default)"}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    disabled={isSaving}
                                    onClick={() => handlePermissionToggle(agent, key, current)}
                                    className={cn(
                                      "relative ml-2 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50",
                                      current ? "bg-primary" : "bg-border"
                                    )}
                                  >
                                    {isSaving
                                      ? <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white" />
                                      : <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all", current ? "left-[18px]" : "left-0.5")} />}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Macros tab ───────────────────────────────────────────────────────────────

function MacrosTab() {
  const [macros, setMacros] = useState<Macro[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", actions: [] as MacroAction[] });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.macros.list(), api.tags.list()])
      .then(([m, t]) => { setMacros(m.data ?? []); setTags(t.data ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => { setForm({ name: "", description: "", actions: [] }); setEditingId(null); setShowForm(false); };

  const addAction = () => setForm((f) => ({ ...f, actions: [...f.actions, { type: "reply", body: "" }] }));

  const updateAction = (i: number, patch: Partial<MacroAction>) =>
    setForm((f) => { const actions = [...f.actions]; actions[i] = { ...actions[i], ...patch } as MacroAction; return { ...f, actions }; });

  const removeAction = (i: number) =>
    setForm((f) => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }));

  const startEdit = (m: Macro) => { setForm({ name: m.name, description: m.description, actions: m.actions }); setEditingId(m.id); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.actions.length) { toast.error("Name and at least one action are required"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const res = await api.macros.update(editingId, form);
        setMacros((prev) => prev.map((m) => m.id === editingId ? res.data : m));
        toast.success("Macro updated");
      } else {
        const res = await api.macros.create(form);
        setMacros((prev) => [...prev, res.data]);
        toast.success("Macro created");
      }
      resetForm();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.macros.delete(id);
      setMacros((prev) => prev.filter((m) => m.id !== id));
      toast.success("Macro deleted");
    } catch (e: any) { toast.error(e.message); }
    finally { setDeletingId(null); }
  };

  if (loading) return <TabLoader />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader icon={<FileText className="h-4 w-4" />} title="Macros" subtitle="Saved reply templates and action sequences" />
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> New macro
        </button>
      </div>

      {/* Create / edit form */}
      {showForm && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h3 className="mb-3 text-sm font-semibold">{editingId ? "Edit macro" : "New macro"}</h3>
          <div className="space-y-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Macro name…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none" />
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional)…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none" />
          </div>

          {/* Actions */}
          <div className="mt-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Actions</div>
            {form.actions.map((action, i) => (
              <div key={i} className="flex items-start gap-2">
                <select value={action.type}
                  onChange={(e) => updateAction(i, { type: e.target.value as MacroAction["type"], body: "", value: "", tagId: "" })}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none">
                  <option value="reply">Send reply</option>
                  <option value="status">Set status</option>
                  <option value="tag">Add tag</option>
                </select>
                {action.type === "reply" && (
                  <textarea value={action.body ?? ""} onChange={(e) => updateAction(i, { body: e.target.value })}
                    placeholder="Reply text…" rows={2}
                    className="flex-1 resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none" />
                )}
                {action.type === "status" && (
                  <select value={action.value ?? "closed"} onChange={(e) => updateAction(i, { value: e.target.value })}
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none">
                    <option value="open">Open</option>
                    <option value="closed">Resolved</option>
                    <option value="pending">Pending</option>
                  </select>
                )}
                {action.type === "tag" && (
                  <select value={action.tagId ?? ""} onChange={(e) => updateAction(i, { tagId: e.target.value })}
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none">
                    <option value="">Select tag…</option>
                    {tags.map((t) => <option key={t.id} value={t.id}>#{t.name}</option>)}
                  </select>
                )}
                <button onClick={() => removeAction(i)} className="mt-1 text-muted-foreground hover:text-danger">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button onClick={addAction}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary">
              <Plus className="h-3 w-3" /> Add action
            </button>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
              {saving && <Loader2 className="h-3 w-3 animate-spin" />} {editingId ? "Save changes" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="mt-4 space-y-2">
        {macros.length === 0 && <EmptyState label="No macros yet" />}
        {macros.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{m.name}</div>
              {m.description && <div className="mt-0.5 text-xs text-muted-foreground">{m.description}</div>}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.actions.map((a, i) => (
                  <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {a.type === "reply" ? "Reply" : a.type === "status" ? `Set ${a.value}` : `Tag`}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => startEdit(m)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(m.id)} disabled={deletingId === m.id}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger disabled:opacity-50">
                {deletingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Articles tab ─────────────────────────────────────────────────────────────

function ArticlesTab() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", state: "published" as "published" | "draft" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.articles.list({ perPage: 50 })
      .then((res) => setArticles(res.data?.articles ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error("Title and body are required"); return; }
    setSaving(true);
    try {
      const res = await api.articles.create(form);
      setArticles((prev) => [res.data, ...prev]);
      setForm({ title: "", body: "", state: "published" });
      setShowForm(false);
      toast.success("Article created");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.articles.delete(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
      toast.success("Article deleted");
    } catch (e: any) { toast.error(e.message); }
    finally { setDeletingId(null); }
  };

  if (loading) return <TabLoader />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader icon={<BookOpen className="h-4 w-4" />} title="Knowledge Base Articles" subtitle="Published articles for agent use" />
        <button onClick={() => setShowForm((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> New article
        </button>
      </div>

      {showForm && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h3 className="mb-3 text-sm font-semibold">New article</h3>
          <div className="space-y-2">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none" />
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Article body (plain text or HTML)…" rows={6}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none" />
            <div className="flex items-center gap-2">
              {(["published", "draft"] as const).map((s) => (
                <button key={s} onClick={() => setForm({ ...form, state: s })}
                  className={cn("rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition",
                    form.state === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
            <button onClick={handleCreate} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
              {saving && <Loader2 className="h-3 w-3 animate-spin" />} Publish
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {articles.length === 0 && <EmptyState label="No articles yet" />}
        {articles.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{a.title}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                  a.state === "published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                  {a.state}
                </span>
              </div>
              {a.description && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:line-clamp-1">{a.description}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {a.url && (
                <a href={a.url} target="_blank" rel="noreferrer"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button onClick={() => handleDelete(a.id)} disabled={deletingId === a.id}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger disabled:opacity-50">
                {deletingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent alerts panel ──────────────────────────────────────────────────────

const ALERT_FILTER_GROUPS = [
  { key: "all",         label: "All" },
  { key: "sla",         label: "SLA" },
  { key: "sentiment",   label: "Sentiment" },
  { key: "churn",       label: "Churn" },
  { key: "chargeback",  label: "Chargeback" },
] as const;

type AlertFilterKey = typeof ALERT_FILTER_GROUPS[number]["key"];

function matchesFilter(alertType: string, filter: AlertFilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "sla") return alertType.startsWith("sla_breach");
  if (filter === "sentiment") return alertType === "sentiment_negative";
  if (filter === "churn") return alertType === "churn_high";
  if (filter === "chargeback") return alertType === "chargeback_keyword";
  return false;
}

const ALERT_STYLE: Record<string, { dot: string; border: string; badge: string; label: string }> = {
  sla_breach_ftr:     { dot: "bg-red-500",    border: "border-l-red-400",    badge: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",    label: "SLA · FTR" },
  sla_breach_ntr:     { dot: "bg-orange-500", border: "border-l-orange-400", badge: "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400", label: "SLA · NTR" },
  sla_breach:         { dot: "bg-red-500",    border: "border-l-red-400",    badge: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",    label: "SLA Breach" },
  sentiment_negative: { dot: "bg-amber-500",  border: "border-l-amber-400",  badge: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", label: "Sentiment" },
  churn_high:         { dot: "bg-amber-500",  border: "border-l-amber-400",  badge: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", label: "Churn Risk" },
  chargeback_keyword: { dot: "bg-rose-600",   border: "border-l-rose-500",   badge: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",  label: "Chargeback" },
};

const DEFAULT_ALERT_STYLE = { dot: "bg-muted-foreground", border: "border-l-border", badge: "bg-muted text-muted-foreground", label: "Alert" };
const PREVIEW_COUNT = 5;

function RecentAlertsPanel({
  alerts,
  loading,
  onOpenConversation,
}: {
  alerts: any[];
  loading: boolean;
  onOpenConversation: (id: string) => void;
}) {
  const [filter, setFilter] = useState<AlertFilterKey>("all");
  const [showAll, setShowAll] = useState(false);

  const filtered = alerts.filter((a) => matchesFilter(a.alertType, filter));
  const visible  = showAll ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hidden   = filtered.length - PREVIEW_COUNT;

  // reset showAll when filter changes
  const handleFilter = (key: AlertFilterKey) => { setFilter(key); setShowAll(false); };

  // count per group for badges
  const counts: Record<AlertFilterKey, number> = {
    all:        alerts.length,
    sla:        alerts.filter((a) => matchesFilter(a.alertType, "sla")).length,
    sentiment:  alerts.filter((a) => matchesFilter(a.alertType, "sentiment")).length,
    churn:      alerts.filter((a) => matchesFilter(a.alertType, "churn")).length,
    chargeback: alerts.filter((a) => matchesFilter(a.alertType, "chargeback")).length,
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-semibold">Recent alerts</h2>
          {!loading && alerts.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {alerts.length}
            </span>
          )}
        </div>
      </div>

      {/* Filter pills — only show if there are alerts */}
      {!loading && alerts.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ALERT_FILTER_GROUPS.filter((g) => g.key === "all" || counts[g.key] > 0).map((g) => (
            <button
              key={g.key}
              onClick={() => handleFilter(g.key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                filter === g.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              {g.label}
              <span className={cn(
                "rounded-full px-1 text-[9px] font-semibold tabular-nums",
                filter === g.key ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {counts[g.key]}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-1.5 py-6 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {alerts.length === 0 ? "No alerts fired yet." : "No alerts in this category."}
        </p>
      ) : (
        <>
          <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {visible.map((a: any) => {
              const style = ALERT_STYLE[a.alertType] ?? DEFAULT_ALERT_STYLE;
              return (
                <div
                  key={a.id}
                  className={cn("flex items-start gap-3 border-l-[3px] bg-background px-3 py-2.5 text-xs", style.border)}
                >
                  {/* Color dot */}
                  <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />

                  {/* Main content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-foreground">{a.customerName}</span>
                      <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                        {TIER_EMOJI[a.customerTier] ?? ""} {a.customerTier}
                      </span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", style.badge)}>
                        {style.label}
                      </span>
                    </div>
                    {a.messageSnippet && (
                      <p className="mt-0.5 line-clamp-1 text-muted-foreground italic">
                        &ldquo;{a.messageSnippet}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Right side: time + link */}
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] text-muted-foreground">{relativeTime(a.firedAt)}</span>
                    <button
                      onClick={() => onOpenConversation(a.conversationId)}
                      className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
                    >
                      Open <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show more / less */}
          {filtered.length > PREVIEW_COUNT && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 w-full rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            >
              {showAll ? "Show less" : `Show ${hidden} more`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="text-primary">{icon}</div>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function TabLoader() {
  return (
    <div className="flex h-48 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{label}</p>;
}

function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2 text-xs">
      <span className="mr-4">{label}</span>
      <button onClick={() => onChange(!v)} className={"relative h-5 w-9 shrink-0 rounded-full transition " + (v ? "bg-primary" : "bg-muted")}>
        <span className={"absolute top-0.5 h-4 w-4 rounded-full bg-background transition " + (v ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}
