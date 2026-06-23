"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import {
  Bell, Users, FileText, Hash, BookOpen,
  Plus, Trash2, Pencil, X, ChevronDown, ChevronUp,
  Shield, Loader2, ExternalLink, UserCheck, UserX,
  MessageSquare, StickyNote, Tag, UserCog, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { slackAlerts, slackSettings as initialSlack } from "@/lib/mock-data";
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
    label: "Tags & Articles & Macros",
    icon: <Tag className="h-3.5 w-3.5" />,
    keys: ["tags:apply", "tags:manage", "articles:view", "articles:manage", "macros:apply", "macros:manage"],
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
  "tags:apply":                "Apply tags",
  "tags:manage":               "Create & delete tags",
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
    { key: "tags",     label: "Tags",      icon: <Hash className="h-3.5 w-3.5" />,     show: can("tags:manage") },
    { key: "articles", label: "Articles",  icon: <BookOpen className="h-3.5 w-3.5" />, show: can("articles:manage") },
  ].filter((t) => t.show);

  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "alerts");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-base font-semibold">Settings</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border bg-card px-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition",
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
        {activeTab === "tags"     && <TagsTab />}
        {activeTab === "articles" && <ArticlesTab />}
      </div>
    </div>
  );
}

// ─── Alerts tab (existing content) ───────────────────────────────────────────

function AlertsTab({ onOpenConversation }: { onOpenConversation: (id: string) => void }) {
  const [s, setS] = useState(initialSlack);
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
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

  useEffect(() => {
    Promise.all([api.agents.list(), api.agents.permissionsMatrix()])
      .then(([a, m]) => { setAgents(a.data ?? []); setMatrix(m.data ?? null); })
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return <TabLoader />;

  const counts = {
    total: agents.length,
    active: agents.filter((a) => a.status === "active").length,
    invited: agents.filter((a) => a.status === "invited").length,
    deactivated: agents.filter((a) => a.status === "deactivated").length,
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      {/* Stats row */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-foreground" },
          { label: "Active", value: counts.active, color: "text-success" },
          { label: "Invited", value: counts.invited, color: "text-amber-600 dark:text-amber-400" },
          { label: "Deactivated", value: counts.deactivated, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Agent list */}
      <div className="space-y-3">
        {agents.map((agent) => {
          const isExpanded = expandedId === agent.id;
          const roleStyle = ROLE_STYLES[agent.role];
          const initials = `${agent.firstName[0]}${agent.lastName?.[0] ?? ""}`.toUpperCase();
          const overrideCount = matrix
            ? matrix.all.filter((k) => {
                const def = matrix.defaults[agent.role]?.includes(k) ?? false;
                return agent.permissions.includes(k) !== def;
              }).length
            : 0;

          return (
            <div key={agent.id} className={cn("rounded-xl border bg-card transition-shadow", isExpanded ? "border-primary/30 shadow-md" : "border-border hover:border-border/80 hover:shadow-sm")}>
              {/* Agent row */}
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Avatar */}
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold", roleStyle.avatar)}>
                  {initials}
                </div>

                {/* Name + email */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{agent.firstName} {agent.lastName}</span>
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

                {/* Role pills */}
                {can("agents:edit_permissions") ? (
                  <div className="flex items-center gap-1">
                    {(["admin", "supervisor", "agent"] as AgentRole[]).map((r) => (
                      <button
                        key={r}
                        disabled={saving === agent.id}
                        onClick={() => agent.role !== r && handleRoleChange(agent.id, r)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50",
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

                {/* Deactivate / Reactivate */}
                {can("agents:deactivate") && (
                  <button
                    disabled={saving === agent.id}
                    onClick={() => handleStatusToggle(agent)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50",
                      agent.status === "active"
                        ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                        : "border-success/40 text-success hover:bg-success/10"
                    )}
                  >
                    {agent.status === "active"
                      ? <><UserX className="h-3.5 w-3.5" /> Deactivate</>
                      : <><UserCheck className="h-3.5 w-3.5" /> Reactivate</>}
                  </button>
                )}

                {/* Expand permissions */}
                {can("agents:edit_permissions") && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                      isExpanded
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-border/60 hover:text-foreground"
                    )}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Permissions
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
              </div>

              {/* Permissions panel */}
              {isExpanded && matrix && (
                <div className="border-t border-border bg-muted/30 px-5 pb-5 pt-4">
                  <div className="mb-4 flex items-center justify-between">
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
                                  <div className="min-w-0">
                                    <span className={cn("text-xs font-medium", isOverridden ? "text-primary" : "text-foreground")}>
                                      {PERMISSION_LABELS[key] ?? key}
                                    </span>
                                    {isOverridden && (
                                      <span className="ml-2 text-[10px] text-primary/70">
                                        {current ? "(granted above role default)" : "(revoked from role default)"}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    disabled={isSaving}
                                    onClick={() => handlePermissionToggle(agent, key, current)}
                                    className={cn(
                                      "relative ml-4 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50",
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
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="flex items-start justify-between">
        <SectionHeader icon={<FileText className="h-4 w-4" />} title="Macros" subtitle="Saved reply templates and action sequences" />
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
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

// ─── Tags tab ─────────────────────────────────────────────────────────────────

function TagsTab() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.tags.list()
      .then((res) => setTags(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await api.tags.create(newName.trim());
      setTags((prev) => [...prev, res.data]);
      setNewName("");
      toast.success("Tag created");
      inputRef.current?.focus();
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.tags.delete(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
      toast.success("Tag deleted");
    } catch (e: any) { toast.error(e.message); }
    finally { setDeletingId(null); }
  };

  if (loading) return <TabLoader />;

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <SectionHeader icon={<Hash className="h-4 w-4" />} title="Tags" subtitle="Manage conversation labels" />
      <div className="mt-4 flex gap-2">
        <input
          ref={inputRef}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          placeholder="New tag name…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
        />
        <button onClick={handleCreate} disabled={!newName.trim() || creating}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.length === 0 && <EmptyState label="No tags yet" />}
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
            <Hash className="h-3 w-3 text-muted-foreground" />
            {tag.name}
            <button onClick={() => handleDelete(tag.id)} disabled={deletingId === tag.id}
              className="ml-0.5 text-muted-foreground hover:text-danger disabled:opacity-50">
              {deletingId === tag.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            </button>
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
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="flex items-start justify-between">
        <SectionHeader icon={<BookOpen className="h-4 w-4" />} title="Knowledge Base Articles" subtitle="Published articles for agent use" />
        <button onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
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
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{a.title}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                  a.state === "published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                  {a.state}
                </span>
              </div>
              {a.description && <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.description}</div>}
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
      <span>{label}</span>
      <button onClick={() => onChange(!v)} className={"relative h-5 w-9 rounded-full transition " + (v ? "bg-primary" : "bg-muted")}>
        <span className={"absolute top-0.5 h-4 w-4 rounded-full bg-background transition " + (v ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}
