"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Shield, User, Users } from "lucide-react";

type AgentRole = "admin" | "supervisor" | "agent";
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

const ROLE_LABELS: Record<AgentRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  agent: "Agent",
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  active: "bg-success/15 text-success",
  invited: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  deactivated: "bg-muted text-muted-foreground",
};

export default function AgentsPage() {
  const router = useRouter();
  const { can, isAdmin } = usePermissions();

  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [matrix, setMatrix] = useState<PermissionsMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!can("agents:view")) {
      router.replace("/inbox");
      return;
    }
    Promise.all([api.agents.list(), api.agents.permissionsMatrix()])
      .then(([a, m]) => {
        setAgents(a.data ?? []);
        setMatrix(m.data ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (agentId: string, role: AgentRole) => {
    setSaving(agentId);
    try {
      await api.agents.updateRole(agentId, role);
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, role } : a)));
    } finally {
      setSaving(null);
    }
  };

  const handleStatusToggle = async (agent: AgentRow) => {
    const next = agent.status === "active" ? "deactivated" : "active";
    setSaving(agent.id);
    try {
      await api.agents.updateStatus(agent.id, next);
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, status: next } : a)));
    } finally {
      setSaving(null);
    }
  };

  const handlePermissionToggle = async (agent: AgentRow, key: string, current: boolean) => {
    setSaving(`${agent.id}-${key}`);
    try {
      await api.agents.updatePermission(agent.id, key, !current);
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== agent.id) return a;
          const updated = current
            ? a.permissions.filter((p) => p !== key)
            : [...a.permissions, key];
          return { ...a, permissions: updated };
        })
      );
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading agents…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Agent Management</h1>
          <p className="text-sm text-muted-foreground">{agents.length} team member{agents.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="space-y-2">
        {agents.map((agent) => {
          const isExpanded = expandedId === agent.id;
          const roleIcon = agent.role === "admin" ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />;

          return (
            <div key={agent.id} className="rounded-lg border border-border bg-card">
              {/* Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {agent.firstName[0]}{agent.lastName?.[0] ?? ""}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{agent.firstName} {agent.lastName}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", STATUS_COLORS[agent.status])}>
                      {agent.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{agent.email}</div>
                </div>

                {/* Role selector */}
                {can("agents:edit_permissions") ? (
                  <select
                    value={agent.role}
                    disabled={saving === agent.id}
                    onChange={(e) => handleRoleChange(agent.id, e.target.value as AgentRole)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    {(["admin", "supervisor", "agent"] as AgentRole[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {roleIcon} {ROLE_LABELS[agent.role]}
                  </span>
                )}

                {/* Deactivate toggle */}
                {can("agents:deactivate") && (
                  <button
                    disabled={saving === agent.id}
                    onClick={() => handleStatusToggle(agent)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50",
                      agent.status === "active"
                        ? "border-danger/40 text-danger hover:bg-danger/10"
                        : "border-success/40 text-success hover:bg-success/10"
                    )}
                  >
                    {agent.status === "active" ? "Deactivate" : "Reactivate"}
                  </button>
                )}

                {/* Expand permissions */}
                {can("agents:edit_permissions") && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
              </div>

              {/* Permissions panel */}
              {isExpanded && matrix && (
                <div className="border-t border-border px-4 pb-4 pt-3">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Permission Overrides
                    <span className="ml-2 font-normal normal-case">
                      — grey = role default, coloured = override
                    </span>
                  </p>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {matrix.all.map((key) => {
                      const roleDefault = matrix.defaults[agent.role]?.includes(key) ?? false;
                      const current = agent.permissions.includes(key);
                      const isOverridden = current !== roleDefault;
                      const isSavingThis = saving === `${agent.id}-${key}`;

                      return (
                        <div
                          key={key}
                          className={cn(
                            "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs",
                            isOverridden ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/40"
                          )}
                        >
                          <span className={cn("font-mono", isOverridden ? "text-primary" : "text-foreground/70")}>
                            {key}
                          </span>
                          <button
                            disabled={isSavingThis}
                            onClick={() => handlePermissionToggle(agent, key, current)}
                            className={cn(
                              "ml-3 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50",
                              current ? "bg-primary" : "bg-border"
                            )}
                          >
                            <span
                              className={cn(
                                "block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-white transition-transform",
                                current && "translate-x-[18px]"
                              )}
                            />
                          </button>
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
