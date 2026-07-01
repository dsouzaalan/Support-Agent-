"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  Clock, CheckCheck, Send, Timer, Loader2,
  ChevronUp, ChevronDown, Users, ArrowLeft,
  FileText, Zap, LogIn, MessageSquare, Trophy,
  ArrowRightLeft, Bot, RotateCcw, TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Kpis {
  repliesSent: number;              repliesSentDelta: number;
  closed: number;                   closedDelta: number;
  notes: number;                    notesDelta: number;
  macros: number;                   macrosDelta: number;
  clickupTasks: number;
  loginEvents: number;
  uniqueConversations: number;
  activeDays: number;
  avgResponseMinutes: number | null;
  medianResponseMinutes: number | null;
  conversationsAssigned: number;
  avgTimeToCloseMinutes: number | null;
  avgFirstReplyMinutes: number | null;
  handoffCount: number;
  botHandoffCount: number;
  reopenedCount: number;
  customerSatisfactionScore: number | null;
}

interface LeaderboardRow {
  agentId: string;
  agentName: string;
  agentEmail: string;
  role: string;
  repliesSent: number;
  closed: number;
  notes: number;
  macros: number;
  clickupTasks: number;
  loginEvents: number;
  uniqueConversations: number;
  activeDays: number;
  avgResponseMinutes: number | null;
  conversationsAssigned: number;
  avgTimeToCloseMinutes: number | null;
  avgFirstReplyMinutes: number | null;
  handoffCount: number;
  botHandoffCount: number;
  reopenedCount: number;
}

interface Summary {
  topPerformer: { agentId: string; agentName: string; metric: string; value: number };
  fastestResponder: { agentId: string; agentName: string; avgFirstReplyMinutes: number } | null;
  mostConversationsClosed: { agentId: string; agentName: string; count: number };
  teamAvgFirstReplyMinutes: number | null;
  teamAvgCloseMinutes: number | null;
  totalConversationsHandled: number;
  botHandoffRate: number;
}

interface AgentComparison {
  agentName: string;
  repliesSent: number;
  closed: number;
  avgFirstReplyMinutes: number | null;
}

interface PerformanceData {
  kpis: Kpis;
  responseTrend: { day: string; avg: number | null; close: number | null }[];
  perDay:        { day: string; count: number }[];
  heatmap:       { day: number; hour: number; value: number }[];
  leaderboard?:  LeaderboardRow[];
  summary?:      Summary;
  agentComparison?: AgentComparison[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RANGES = ["Today", "Last 7 days", "Last 30 days"] as const;
type Range = (typeof RANGES)[number];

function rangeToParams(range: Range): { from: string; to: string } {
  const now = new Date();
  const to  = now.toISOString();
  switch (range) {
    case "Today":
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), to };
    case "Last 30 days":
      return { from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), to };
    default:
      return { from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), to };
  }
}

function fmtMins(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return "—";
  const totalSecs = Math.round(mins * 60);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  if (m === 0) return `${s}s`;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  }
  return `${m}m ${s}s`;
}

function fmtDelta(delta: number | undefined): { text: string; positive: boolean } {
  if (delta === undefined || delta === 0) return { text: "—", positive: true };
  const arrow = delta > 0 ? "↑" : "↓";
  return { text: `${arrow} ${Math.abs(delta)}%`, positive: delta >= 0 };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentAnalytics() {
  const { isAdmin, isSupervisor } = usePermissions();
  const { user }     = useAuth();
  const isPrivileged = isAdmin || isSupervisor;

  const [range, setRange]           = useState<Range>("Last 7 days");
  const [data, setData]             = useState<PerformanceData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [selectedAgentId, setSelected] = useState<string | null>(null);
  const [leaderboard, setLeaderboard]  = useState<LeaderboardRow[]>([]);
  const [sortKey, setSortKey]       = useState<keyof LeaderboardRow>("repliesSent");
  const [sortAsc, setSortAsc]       = useState(false);

  const isDrilledIn = isPrivileged && selectedAgentId !== null;

  const fetchData = useCallback(() => {
    setLoading(true);
    const { from, to } = rangeToParams(range);
    api.analytics
      .performance({ from, to, agentId: selectedAgentId ?? undefined })
      .then((res) => {
        const d: PerformanceData = res.data ?? null;
        setData(d);
        if (d?.leaderboard) setLeaderboard(d.leaderboard);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [range, selectedAgentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpis = data?.kpis;

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === "string" && typeof bv === "string")
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const viewingName = selectedAgentId
    ? leaderboard.find((r) => r.agentId === selectedAgentId)?.agentName ?? "Agent"
    : user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "You";

  const handleSort = (key: keyof LeaderboardRow) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            {isDrilledIn && (
              <button
                onClick={() => setSelected(null)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Team
              </button>
            )}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {isPrivileged && !selectedAgentId ? "Team performance" : `${viewingName}'s performance`}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isPrivileged && !selectedAgentId
                  ? "Overview across all agents. Click a row to drill in."
                  : "Conversations, responses, and activity over time."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPrivileged && (
              <select
                value={selectedAgentId ?? ""}
                onChange={(e) => setSelected(e.target.value || null)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium focus:outline-none"
              >
                <option value="">All agents</option>
                {leaderboard.map((r) => (
                  <option key={r.agentId} value={r.agentId}>{r.agentName}</option>
                ))}
              </select>
            )}
            <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition",
                    range === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Team Summary (admin/supervisor, team view only) ──────────── */}
            {isPrivileged && !selectedAgentId && data?.summary && (
              <TeamSummaryCard summary={data.summary} onDrillIn={setSelected} />
            )}

            {/* ── Leaderboard (admin/supervisor, team view only) ───────────── */}
            {isPrivileged && !selectedAgentId && (
              <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-semibold">Agent Leaderboard</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {leaderboard.length} agent{leaderboard.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        {(
                          [
                            ["agentName",             "Agent"],
                            ["repliesSent",           "Replies"],
                            ["closed",                "Closed"],
                            ["conversationsAssigned", "Assigned"],
                            ["avgFirstReplyMinutes",  "Avg 1st Reply"],
                            ["avgTimeToCloseMinutes", "Avg Close"],
                            ["avgResponseMinutes",    "Avg Response"],
                            ["handoffCount",          "Handed Off"],
                            ["botHandoffCount",       "Bot Handoffs"],
                            ["reopenedCount",         "Reopened"],
                            ["activeDays",            "Active Days"],
                          ] as [keyof LeaderboardRow, string][]
                        ).map(([key, label]) => (
                          <th
                            key={key}
                            onClick={() => handleSort(key)}
                            className="cursor-pointer select-none whitespace-nowrap px-4 py-2.5 text-left font-semibold hover:text-foreground"
                          >
                            <span className="inline-flex items-center gap-1">
                              {label}
                              {sortKey === key
                                ? sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                : <ChevronDown className="h-3 w-3 opacity-30" />}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLeaderboard.length === 0 && (
                        <tr>
                          <td colSpan={11} className="px-4 py-6 text-center text-muted-foreground">
                            No activity in this period
                          </td>
                        </tr>
                      )}
                      {sortedLeaderboard.map((row, i) => (
                        <tr
                          key={row.agentId}
                          onClick={() => setSelected(row.agentId)}
                          className="cursor-pointer border-t border-border transition-colors hover:bg-muted/40"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                {i + 1}
                              </div>
                              <div>
                                <div className="font-medium">{row.agentName}</div>
                                <div className="text-[10px] text-muted-foreground">{row.agentEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums font-medium">{row.repliesSent}</td>
                          <td className="px-4 py-2.5 tabular-nums">{row.closed}</td>
                          <td className="px-4 py-2.5 tabular-nums">{row.conversationsAssigned}</td>
                          <td className="px-4 py-2.5 tabular-nums">{fmtMins(row.avgFirstReplyMinutes)}</td>
                          <td className="px-4 py-2.5 tabular-nums">{fmtMins(row.avgTimeToCloseMinutes)}</td>
                          <td className="px-4 py-2.5 tabular-nums">{fmtMins(row.avgResponseMinutes)}</td>
                          <td className="px-4 py-2.5 tabular-nums">{row.handoffCount}</td>
                          <td className="px-4 py-2.5 tabular-nums">{row.botHandoffCount}</td>
                          <td className="px-4 py-2.5 tabular-nums">{row.reopenedCount}</td>
                          <td className="px-4 py-2.5 tabular-nums">{row.activeDays}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── KPI cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard icon={<Send />}         label="Responses sent"        value={kpis?.repliesSent ?? 0}                        delta={fmtDelta(kpis?.repliesSentDelta)} />
              <KpiCard icon={<CheckCheck />}   label="Conversations closed"  value={kpis?.closed ?? 0}                             delta={fmtDelta(kpis?.closedDelta)} />
              <KpiCard icon={<MessageSquare />} label="Assigned"              value={kpis?.conversationsAssigned ?? 0}              delta={{ text: "—", positive: true }} muted />
              <KpiCard icon={<Timer />}        label="Avg first reply"        value={fmtMins(kpis?.avgFirstReplyMinutes ?? null)}   delta={{ text: "after assignment", positive: true }} muted />
              <KpiCard icon={<Clock />}        label="Avg time to close"      value={fmtMins(kpis?.avgTimeToCloseMinutes ?? null)}  delta={{ text: "assign → close", positive: true }} muted />
              <KpiCard icon={<Clock />}        label="Avg response"           value={fmtMins(kpis?.avgResponseMinutes ?? null)}     delta={{ text: "first reply", positive: true }} muted />
              <KpiCard icon={<FileText />}     label="Notes added"            value={kpis?.notes ?? 0}                              delta={fmtDelta(kpis?.notesDelta)} />
              <KpiCard icon={<Zap />}          label="Macros applied"         value={kpis?.macros ?? 0}                             delta={fmtDelta(kpis?.macrosDelta)} />
              <KpiCard icon={<ArrowRightLeft />} label="Handed off"           value={kpis?.handoffCount ?? 0}                       delta={{ text: "—", positive: true }} muted />
              <KpiCard icon={<Bot />}          label="Bot handoffs"           value={kpis?.botHandoffCount ?? 0}                    delta={{ text: "routed from bot", positive: true }} muted />
              <KpiCard icon={<RotateCcw />}    label="Reopened"               value={kpis?.reopenedCount ?? 0}                      delta={{ text: "—", positive: true }} muted />
              <KpiCard icon={<LogIn />}        label="Login sessions"         value={kpis?.loginEvents ?? 0}                        delta={{ text: "—", positive: true }} muted />
            </div>

            {/* ── Charts ──────────────────────────────────────────────────── */}
            <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <ChartCard title="Performance trend" subtitle="Avg response time vs avg time to close (minutes)">
                {(data?.responseTrend?.length ?? 0) === 0 ? (
                  <EmptyChart label="No trend data yet" />
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer>
                      <LineChart data={data!.responseTrend}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} unit="m" />
                        <Tooltip
                          formatter={(v: number, name: string) => [`${v != null ? v.toFixed(1) : "—"}m`, name === "avg" ? "Avg response" : "Avg close"]}
                          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        />
                        <Legend formatter={(v) => v === "avg" ? "Avg response" : "Avg close"} wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="avg"   stroke="var(--primary)"   strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary)" }}   connectNulls />
                        <Line type="monotone" dataKey="close" stroke="hsl(142,71%,45%)" strokeWidth={2}   dot={{ r: 3, fill: "hsl(142,71%,45%)" }} connectNulls strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>

              <ChartCard title="Conversations closed" subtitle="Per day across the range">
                {(data?.perDay?.length ?? 0) === 0 ? (
                  <EmptyChart label="No closed conversations in this period" />
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer>
                      <BarChart data={data!.perDay}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          formatter={(v: number) => [v, "Closed"]}
                          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        />
                        <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            </div>

            {/* ── Agent Comparison (team view only) ───────────────────────── */}
            {isPrivileged && !selectedAgentId && (data?.agentComparison?.length ?? 0) > 0 && (
              <ChartCard title="Agent comparison" subtitle="Replies sent vs conversations closed" className="mt-3">
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={data!.agentComparison} barCategoryGap="25%">
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="agentName" tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="repliesSent" name="Replies"        fill="var(--primary)"   radius={[4, 4, 0, 0]} />
                      <Bar dataKey="closed"      name="Closed"         fill="hsl(142,71%,45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            )}

            <ChartCard title="Activity heatmap" subtitle="Darker = more replies sent" className="mt-3">
              <Heatmap data={data?.heatmap ?? []} />
            </ChartCard>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Team Summary card ────────────────────────────────────────────────────────

function TeamSummaryCard({ summary, onDrillIn }: { summary: Summary; onDrillIn: (id: string) => void }) {
  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-primary" />
        <span className="text-sm font-semibold">Team Summary</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <SummaryTile
          icon={<Trophy className="h-4 w-4 text-yellow-500" />}
          label="Top performer"
          value={summary.topPerformer.agentName}
          sub={`${summary.topPerformer.value} replies`}
          onClick={() => onDrillIn(summary.topPerformer.agentId)}
        />
        {summary.fastestResponder && (
          <SummaryTile
            icon={<Timer className="h-4 w-4 text-blue-500" />}
            label="Fastest first reply"
            value={summary.fastestResponder.agentName}
            sub={fmtMins(summary.fastestResponder.avgFirstReplyMinutes)}
            onClick={() => onDrillIn(summary.fastestResponder!.agentId)}
          />
        )}
        <SummaryTile
          icon={<CheckCheck className="h-4 w-4 text-green-500" />}
          label="Most closed"
          value={summary.mostConversationsClosed.agentName}
          sub={`${summary.mostConversationsClosed.count} conversations`}
          onClick={() => onDrillIn(summary.mostConversationsClosed.agentId)}
        />
        <SummaryTile
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          label="Team avg first reply"
          value={fmtMins(summary.teamAvgFirstReplyMinutes)}
          sub="after assignment"
        />
        <SummaryTile
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          label="Team avg close time"
          value={fmtMins(summary.teamAvgCloseMinutes)}
          sub="assign → resolved"
        />
        <SummaryTile
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
          label="Total handled"
          value={String(summary.totalConversationsHandled)}
          sub="conversations assigned"
        />
        <SummaryTile
          icon={<Bot className="h-4 w-4 text-muted-foreground" />}
          label="Bot handoff rate"
          value={`${summary.botHandoffRate}%`}
          sub="of assigned via bot"
        />
      </div>
    </div>
  );
}

function SummaryTile({
  icon, label, value, sub, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-border p-3 text-left transition",
        onClick ? "hover:bg-muted/50 cursor-pointer" : "cursor-default",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-base font-semibold leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </button>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, delta, muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  delta: { text: string; positive: boolean };
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </div>
        <span className={cn(
          "text-[10px] font-semibold",
          muted
            ? "text-muted-foreground"
            : delta.text === "—"
              ? "text-muted-foreground"
              : delta.positive
                ? "text-green-500"
                : "text-red-500",
        )}>
          {delta.text}
        </span>
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// ─── Chart card ───────────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, className }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function Heatmap({ data }: { data: { day: number; hour: number; value: number }[] }) {
  const days  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 12 }, (_, i) => i + 8);
  const maxVal = Math.max(1, ...data.map((c) => c.value));

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[40px_repeat(12,minmax(28px,1fr))] gap-1">
        <div />
        {hours.map((h) => (
          <div key={h} className="text-center text-[10px] text-muted-foreground">{h}</div>
        ))}
        {days.map((dName, d) => (
          <Fragment key={dName}>
            <div className="flex items-center text-[10px] text-muted-foreground">{dName}</div>
            {hours.map((h) => {
              const cell = data.find((c) => c.day === d && c.hour === h);
              const v    = cell?.value ?? 0;
              const pct  = Math.round((v / maxVal) * 100);
              return (
                <div
                  key={`${d}-${h}`}
                  className="aspect-square rounded-sm"
                  style={{ background: `color-mix(in oklab, var(--primary) ${Math.max(6, pct)}%, transparent)` }}
                  title={`${dName} ${h}:00 — ${v} replies`}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}
