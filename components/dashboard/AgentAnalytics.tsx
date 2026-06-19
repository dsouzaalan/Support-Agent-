"use client";

import { useState, Fragment } from "react";
import { agentMetrics } from "@/lib/mock-data";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { Clock, MessageSquare, CheckCheck, Star, AlertTriangle, Sparkles, Send, Timer } from "lucide-react";

const RANGES = ["Today", "Last 7 days", "Last 30 days", "Custom"] as const;

export function AgentAnalytics() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("Last 7 days");
  const { kpis, responseTrend, perDay, heatmap } = agentMetrics;

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your performance</h1>
            <p className="mt-1 text-sm text-muted-foreground">How you're doing across conversations, responses, and customer outcomes.</p>
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                range === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}>{r}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi icon={<Send />} label="Responses sent" value={kpis.sent} delta="+12%" />
          <Kpi icon={<Timer />} label="Avg response" value={kpis.avgResponse} delta="-22s" good />
          <Kpi icon={<Clock />} label="Median response" value={kpis.median} delta="-14s" good />
          <Kpi icon={<CheckCheck />} label="Conversations closed" value={kpis.closed} delta="+8" />
          <Kpi icon={<Star />} label="CSAT" value={kpis.csat + " / 5"} delta="+0.2" good />
          <Kpi icon={<AlertTriangle />} label="Escalation rate" value={kpis.escalation} delta="-1.2%" good />
          <Kpi icon={<Sparkles />} label="MCP queries" value={kpis.mcpQueries} delta="+9" />
          <Kpi icon={<MessageSquare />} label="Login time" value="6h 12m" delta="2 breaks" muted />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card title="Response time trend" subtitle="Average minutes to first reply">
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={responseTrend}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" stroke="currentColor" tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="currentColor" tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="avg" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Conversations handled" subtitle="Per day across the range">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={perDay}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card title="Productivity by hour of day" subtitle="Darker = more responses sent" className="mt-3">
          <Heatmap data={heatmap} />
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, delta, good, muted }: { icon: React.ReactNode; label: string; value: React.ReactNode; delta: string; good?: boolean; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</div>
        <span className={cn("text-[10px] font-semibold", muted ? "text-muted-foreground" : good ? "text-success" : "text-foreground/60")}>{delta}</span>
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Card({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
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

function Heatmap({ data }: { data: { day: number; hour: number; value: number }[] }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 12 }, (_, i) => i + 8);
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[40px_repeat(12,minmax(28px,1fr))] gap-1">
        <div />
        {hours.map((h) => <div key={h} className="text-center text-[10px] text-muted-foreground">{h}</div>)}
        {days.map((dName, d) => (
          <Fragment key={dName}>
            <div className="flex items-center text-[10px] text-muted-foreground">{dName}</div>
            {hours.map((h) => {
              const cell = data.find((c) => c.day === d && c.hour === h);
              const v = cell?.value ?? 0;
              return (
                <div key={`${d}-${h}`} className="aspect-square rounded-sm" style={{
                  background: `color-mix(in oklab, var(--primary) ${Math.max(6, v * 9)}%, transparent)`,
                }} title={`${dName} ${h}:00 — ${v} responses`} />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
