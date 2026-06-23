"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { Users, Loader2, Search, ShieldCheck, UserCog, User } from "lucide-react";

type AgentRole   = "admin" | "supervisor" | "agent";
type AgentStatus = "active" | "invited" | "deactivated";

interface Agent {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  role: AgentRole;
  status: AgentStatus;
}

const ROLE_META: Record<AgentRole, {
  label: string;
  icon: React.ReactNode;
  avatar: string;
  badge: string;
  border: string;
  heading: string;
}> = {
  admin: {
    label: "Admin",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    avatar: "bg-violet-500 text-white",
    badge:  "bg-violet-50 text-violet-700 border-violet-200",
    border: "border-l-violet-400",
    heading:"text-violet-700",
  },
  supervisor: {
    label: "Supervisor",
    icon: <UserCog className="h-3.5 w-3.5" />,
    avatar: "bg-blue-500 text-white",
    badge:  "bg-blue-50 text-blue-700 border-blue-200",
    border: "border-l-blue-400",
    heading:"text-blue-700",
  },
  agent: {
    label: "Agent",
    icon: <User className="h-3.5 w-3.5" />,
    avatar: "bg-slate-400 text-white",
    badge:  "bg-slate-100 text-slate-600 border-slate-200",
    border: "border-l-slate-300",
    heading:"text-slate-600",
  },
};

const STATUS_DOT: Record<AgentStatus, string> = {
  active:      "bg-emerald-400",
  invited:     "bg-amber-400",
  deactivated: "bg-red-400",
};

const STATUS_TEXT: Record<AgentStatus, string> = {
  active:      "text-emerald-600",
  invited:     "text-amber-600",
  deactivated: "text-red-500",
};

function initials(first: string, last: string | null) {
  return ((first[0] ?? "") + (last?.[0] ?? "")).toUpperCase();
}

export default function TeamPage() {
  const { can } = usePermissions();
  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [query, setQuery]     = useState("");

  useEffect(() => {
    if (!can("agents:view")) return;
    api.agents.list()
      .then((res) => setAgents(res?.data ?? []))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        `${a.firstName} ${a.lastName ?? ""}`.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.role.includes(q)
    );
  }, [agents, query]);

  const byRole: Record<AgentRole, Agent[]> = { admin: [], supervisor: [], agent: [] };
  for (const a of filtered) byRole[a.role]?.push(a);

  const activeCount      = agents.filter((a) => a.status === "active").length;
  const invitedCount     = agents.filter((a) => a.status === "invited").length;
  const deactivatedCount = agents.filter((a) => a.status === "deactivated").length;

  if (!can("agents:view")) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Users className="h-10 w-10 opacity-20" />
        <p className="text-sm font-medium">You don't have permission to view the team.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Team</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Everyone in your workspace</p>
            </div>

            {/* Stats pills */}
            {!loading && !error && (
              <div className="flex shrink-0 items-center gap-2">
                <Pill dot="bg-emerald-400" value={activeCount}      label="Active"      />
                <Pill dot="bg-amber-400"   value={invitedCount}     label="Invited"     hide={!invitedCount} />
                <Pill dot="bg-red-400"     value={deactivatedCount} label="Deactivated" hide={!deactivatedCount} />
              </div>
            )}
          </div>

          {/* Search */}
          {!loading && !error && agents.length > 0 && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, email or role…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-4xl">

          {loading && (
            <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Failed to load team: {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
              <Users className="h-8 w-8 opacity-20" />
              <p className="text-sm">{query ? "No members match your search." : "No team members yet."}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="flex flex-col gap-8">
              {(["admin", "supervisor", "agent"] as AgentRole[]).map((role) => {
                const members = byRole[role];
                if (!members.length) return null;
                const meta = ROLE_META[role];

                return (
                  <section key={role}>
                    {/* Section heading */}
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest", meta.heading)}>
                        {meta.icon}
                        {meta.label}s
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {members.length}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    {/* Member grid */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {members.map((agent) => (
                        <MemberCard key={agent.id} agent={agent} meta={meta} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function MemberCard({ agent, meta }: {
  agent: Agent;
  meta: (typeof ROLE_META)[AgentRole];
}) {
  return (
    <div className={cn(
      "flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm",
      "border-l-4 transition-shadow hover:shadow-md",
      meta.border
    )}>
      {/* Avatar */}
      <div className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
        meta.avatar
      )}>
        {initials(agent.firstName, agent.lastName)}
        {/* Status dot */}
        <span className={cn(
          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
          STATUS_DOT[agent.status]
        )} />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground leading-tight">
          {agent.firstName} {agent.lastName ?? ""}
        </p>
        <p className="truncate text-xs text-muted-foreground mt-0.5">{agent.email}</p>
      </div>

      {/* Role + status */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize", meta.badge)}>
          {meta.label}
        </span>
        <span className={cn("flex items-center gap-1 text-[10px] font-medium capitalize", STATUS_TEXT[agent.status])}>
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[agent.status])} />
          {agent.status}
        </span>
      </div>
    </div>
  );
}

function Pill({ dot, value, label, hide }: {
  dot: string;
  value: number;
  label: string;
  hide?: boolean;
}) {
  if (hide) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      <span className="font-semibold text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  );
}
