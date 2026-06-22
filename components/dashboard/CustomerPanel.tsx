"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Customer, CustomerNote } from "@/lib/mock-data";
import { getMcpResponse, mcpPrompts, platformIncidents, tagLibrary } from "@/lib/mock-data";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, XCircle,
  Mail, Globe, Zap, CreditCard, ExternalLink, BarChart3, Sparkles,
  ArrowRight, Loader2, Plus, X, ShieldAlert, History, Package,
  Send, Pencil, Trash2,
} from "lucide-react";

const CURRENT_AGENT = { id: "me", name: "Riley Park", isAdmin: false };

export function CustomerPanel({ customer, clickupTicket, conversationTags }: { customer: Customer; clickupTicket?: string; conversationTags?: { id: string; name: string }[] }) {
  const [tags, setTags] = useState<string[]>(customer.tags);
  const [notes, setNotes] = useState<CustomerNote[]>(customer.notes);

  return (
    <aside className="flex w-full flex-col overflow-y-auto border-l border-border bg-card">
      <Identity customer={customer} tags={tags} setTags={setTags} clickupTicket={clickupTicket} conversationTags={conversationTags} />
      <AccountTrend customer={customer} />
      <Snapshot customer={customer} />
      <Products customer={customer} />
      <Destinations customer={customer} />
      <AccountHealth customer={customer} />
      <SentimentRisk customer={customer} />
      <Notes notes={notes} setNotes={setNotes} />
      <PastConvos customer={customer} />
      <McpConsole customer={customer} />
      <QuickLinks customer={customer} />
    </aside>
  );
}

// =========== Sections ===========

function Identity({ customer, tags, setTags, clickupTicket, conversationTags }: { customer: Customer; tags: string[]; setTags: (t: string[]) => void; clickupTicket?: string; conversationTags?: { id: string; name: string }[] }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const suggestions = tagLibrary.filter((t) => !tags.includes(t) && t.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
  const add = (t: string) => { if (t && !tags.includes(t)) setTags([...tags, t]); setVal(""); setAdding(false); };

  return (
    <div className="border-b border-border px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-base font-semibold text-primary-foreground">
          {customer.initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{customer.name}</div>
          <div className="truncate text-xs text-muted-foreground">{customer.company}</div>
        </div>
      </div>
      {clickupTicket && (
        <a href={`https://app.clickup.com/t/${clickupTicket}`} target="_blank" rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10">
          Linked to {clickupTicket} <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <TierBadge tier={customer.tier} />
        <StatusBadge status={customer.status} />
        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {customer.accountAge}
        </span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Renews {customer.nextRenewal}
        </span>
      </div>
      {/* Tags */}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        {tags.map((t) => (
          <span key={t} className="group inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-foreground/80">
            #{t}
            <button onClick={() => setTags(tags.filter((x) => x !== t))} className="opacity-50 hover:opacity-100">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {adding ? (
          <div className="relative">
            <input
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(val); if (e.key === "Escape") { setAdding(false); setVal(""); } }}
              onBlur={() => setTimeout(() => setAdding(false), 150)}
              placeholder="tag…"
              className="w-24 rounded-full border border-primary/40 bg-background px-2 py-0.5 text-[10px] focus:outline-none"
            />
            {val && suggestions.length > 0 && (
              <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-md border border-border bg-popover shadow-lg">
                {suggestions.map((s) => (
                  <button key={s} onMouseDown={() => add(s)} className="block w-full px-2 py-1 text-left text-[10px] hover:bg-muted">#{s}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-primary">
            <Plus className="h-2.5 w-2.5" /> tag
          </button>
        )}
      </div>
      {conversationTags && conversationTags.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">Conversation tags</div>
          <div className="flex flex-wrap gap-1">
            {conversationTags.map((t) => (
              <span key={t.id} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                #{t.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountTrend({ customer }: { customer: Customer }) {
  const tone = customer.trajectory === "Expanding" ? "success" : customer.trajectory === "Contracting" ? "danger" : "muted";
  return (
    <Section title="Account Trend">
      <div className={cn(
        "flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs",
        tone === "success" && "border-success/30 bg-success/5",
        tone === "danger" && "border-danger/30 bg-danger/5",
        tone === "muted" && "border-border bg-muted/30",
      )}>
        {customer.trajectory === "Expanding" ? <TrendingUp className="mt-0.5 h-3.5 w-3.5 text-success" /> :
         customer.trajectory === "Contracting" ? <TrendingDown className="mt-0.5 h-3.5 w-3.5 text-danger" /> :
         <Minus className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />}
        <div className="flex-1">
          <div className="font-semibold">{customer.trajectory}</div>
          <div className="mt-0.5 leading-relaxed text-foreground/75">{customer.trajectoryReason}</div>
        </div>
      </div>
    </Section>
  );
}

function Snapshot({ customer }: { customer: Customer }) {
  return (
    <Section title="Account Snapshot">
      <Grid>
        <Stat label="Workspaces" value={customer.workspaces} />
        <Stat label="Mailboxes" value={customer.mailboxes} />
        <Stat label="Emails sent" value={customer.emailsSent.toLocaleString()} />
        <Stat label="Positive replies" value={customer.positiveReplies.toLocaleString()} highlight />
      </Grid>
    </Section>
  );
}

function Products({ customer }: { customer: Customer }) {
  const upsell = customer.tags.includes("upsell-candidate") || customer.trajectory === "Expanding";
  return (
    <Section title="Top Products">
      <div className="space-y-1.5">
        {customer.products.map((p) => (
          <div key={p.label} className="flex items-center justify-between rounded-md border border-border/70 px-2.5 py-1.5 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Package className="h-3 w-3" />{p.label}</span>
            <span className="font-semibold tabular-nums">{p.count}</span>
          </div>
        ))}
      </div>
      {upsell && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-[11px] text-primary">
          <Sparkles className="h-3 w-3" /> Strong upsell candidate
        </div>
      )}
    </Section>
  );
}

function Destinations({ customer }: { customer: Customer }) {
  return (
    <Section title="Mailbox Destinations">
      {customer.destinations.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-2.5 py-2 text-center text-xs text-muted-foreground">None connected</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {customer.destinations.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium">
              <Send className="h-3 w-3 text-muted-foreground" />{d}
            </span>
          ))}
        </div>
      )}
    </Section>
  );
}

function AccountHealth({ customer }: { customer: Customer }) {
  const incident = platformIncidents.find((i) => customer.mailboxesDisconnected > 0 && /disconnect/i.test(i.kind));
  return (
    <Section title="Account Health">
      {incident && (
        <div className="mb-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2 text-[11px]">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 text-warning" />
          <div className="text-foreground/85">
            <span className="font-semibold">Possible platform incident:</span> {incident.count} other customers reported {incident.kind} in the last hour.
          </div>
        </div>
      )}
      <HealthFlag ok={customer.mailboxesDisconnected === 0} icon={<Mail className="h-3.5 w-3.5" />}
        okText="All mailboxes connected"
        alertText={`${customer.mailboxesDisconnected} mailboxes disconnected (${customer.disconnectedProviders.join(", ")})`} />
      <HealthFlag ok={customer.failedDomains === 0} icon={<Globe className="h-3.5 w-3.5" />}
        okText="All domains verified"
        alertText={`${customer.failedDomains} domain${customer.failedDomains === 1 ? "" : "s"} failing: ${customer.failedDomainList.join(", ")}`} />
      <HealthFlag ok={customer.apiErrors === 0} icon={<Zap className="h-3.5 w-3.5" />}
        okText="API healthy"
        alertText={`${customer.apiErrors} API errors in last 24h`} warning />
      <HealthFlag ok={!customer.paymentExpired && customer.failedPayments === 0} icon={<CreditCard className="h-3.5 w-3.5" />}
        okText="Payment method valid"
        alertText={customer.paymentExpired ? "Card expired" : `${customer.failedPayments} failed payment(s)`} />
      <div className="mt-2 text-[10px] text-muted-foreground">Last check: {customer.lastStatusCheck}</div>
    </Section>
  );
}

function SentimentRisk({ customer }: { customer: Customer }) {
  return (
    <Section title="Sentiment & Risk">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">AI sentiment</span>
        <SentimentBadge s={customer.sentiment} />
      </div>
      <p className="mt-2 rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-relaxed text-foreground/80">
        <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
        {customer.sentimentReason}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Churn risk</span>
        <ChurnBadge risk={customer.churn} />
      </div>
      <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2 text-[11px] leading-relaxed">
        <span className="font-semibold text-primary">Suggested next action: </span>
        <span className="text-foreground/85">{customer.suggestedAction}</span>
      </div>
    </Section>
  );
}

function Notes({ notes, setNotes }: { notes: CustomerNote[]; setNotes: (n: CustomerNote[]) => void }) {
  const [val, setVal] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const add = () => {
    if (!val.trim()) return;
    setNotes([{ id: String(Date.now()), author: CURRENT_AGENT.name, authorId: CURRENT_AGENT.id, when: "just now", text: val.trim() }, ...notes]);
    setVal("");
  };
  const canEdit = (n: CustomerNote) => n.authorId === CURRENT_AGENT.id || CURRENT_AGENT.isAdmin;

  return (
    <Section title="Notes">
      <div className="rounded-md border border-border bg-background">
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Add a private note about this customer…"
          rows={2}
          className="w-full resize-none bg-transparent px-2.5 py-2 text-xs placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex justify-end border-t border-border px-1.5 py-1">
          <button onClick={add} disabled={!val.trim()} className="rounded bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground disabled:opacity-40">Add note</button>
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        {notes.length === 0 && <div className="text-[11px] text-muted-foreground">No notes yet.</div>}
        {notes.map((n) => (
          <div key={n.id} className="rounded-md border border-border bg-background px-2.5 py-2 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-foreground/80">{n.author} <span className="font-normal text-muted-foreground">· {n.when}</span></span>
              {canEdit(n) && (
                <div className="flex items-center gap-0.5">
                  <button onClick={() => { setEditingId(n.id); setEditVal(n.text); }} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => setNotes(notes.filter((x) => x.id !== n.id))} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-danger"><Trash2 className="h-3 w-3" /></button>
                </div>
              )}
            </div>
            {editingId === n.id ? (
              <div>
                <textarea value={editVal} onChange={(e) => setEditVal(e.target.value)} rows={2} className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none" />
                <div className="mt-1 flex justify-end gap-1">
                  <button onClick={() => setEditingId(null)} className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">Cancel</button>
                  <button onClick={() => { setNotes(notes.map((x) => x.id === n.id ? { ...x, text: editVal } : x)); setEditingId(null); }} className="rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Save</button>
                </div>
              </div>
            ) : (
              <p className="leading-relaxed text-foreground/80">{n.text}</p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function PastConvos({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Past Conversations">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:border-primary/40">
        <span className="flex items-center gap-1.5 text-muted-foreground"><History className="h-3 w-3" />{customer.pastConversations.length} prior conversation{customer.pastConversations.length === 1 ? "" : "s"}</span>
        <ArrowRight className={cn("h-3 w-3 transition", open && "rotate-90")} />
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {customer.pastConversations.length === 0 && <div className="text-[11px] text-muted-foreground">No history.</div>}
          {customer.pastConversations.map((p) => (
            <div key={p.id} className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground/85">{p.subject}</span>
                <span className="text-muted-foreground">{p.date}</span>
              </div>
              <div className="text-muted-foreground">{p.outcome}</div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function McpConsole({ customer }: { customer: Customer }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string[] | null>(null);
  const ask = (text?: string) => {
    const query = (text ?? q).trim(); if (!query) return;
    setQ(query); setLoading(true); setResult(null);
    setTimeout(() => { setResult(getMcpResponse(query, customer)); setLoading(false); }, 900);
  };
  return (
    <Section title="MCP Diagnostic">
      <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-2.5">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask MCP about this customer…"
            className="w-full bg-transparent text-xs placeholder:text-muted-foreground focus:outline-none" />
          <button onClick={() => ask()} className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90"><ArrowRight className="h-3 w-3" /></button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {mcpPrompts.slice(0, 3).map((p) => (
            <button key={p} onClick={() => ask(p)} className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground">{p}</button>
          ))}
        </div>
        {(loading || result) && (
          <div className="mt-2 rounded-md border border-border bg-background p-2.5 text-xs">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />MCP investigating…</div>
            ) : (
              <ul className="space-y-1.5">{result!.map((line, i) => (
                <li key={i} className="flex gap-1.5 leading-relaxed text-foreground/85"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" /><span>{line}</span></li>
              ))}</ul>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

function QuickLinks({ customer }: { customer: Customer }) {
  const onLogin = () => toast.success(`Issued one-click login token for ${customer.name} (15-min validity). Logged.`);
  const onStripe = () => toast.success(`Opening Stripe customer page in new tab. Logged.`);
  return (
    <Section title="Quick Links" last>
      <button onClick={onLogin} className="group flex w-full items-center justify-between rounded-md border border-border bg-background px-2.5 py-2 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5">
        <span className="flex items-center gap-2 text-foreground/85"><ExternalLink className="h-3.5 w-3.5 text-primary" />One-Click Login</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary" />
      </button>
      {customer.loginAudit && (
        <div className="mt-1 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          <ShieldAlert className="h-2.5 w-2.5" /> Last accessed by {customer.loginAudit.agent} · {customer.loginAudit.when}
        </div>
      )}
      <button onClick={onStripe} className="group mt-1.5 flex w-full items-center justify-between rounded-md border border-border bg-background px-2.5 py-2 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5">
        <span className="flex items-center gap-2 text-foreground/85"><CreditCard className="h-3.5 w-3.5 text-primary" />One-Click Stripe</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary" />
      </button>
      <button className="group mt-1.5 flex w-full items-center justify-between rounded-md border border-border bg-background px-2.5 py-2 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5">
        <span className="flex items-center gap-2 text-foreground/85"><BarChart3 className="h-3.5 w-3.5 text-primary" />Usage History</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary" />
      </button>
    </Section>
  );
}

// =========== Primitives ===========
function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("px-5 py-4", !last && "border-b border-border")}>
      <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 grid grid-cols-2 gap-1.5">{children}</div>;
}
function Stat({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("rounded-md border px-2.5 py-2", highlight ? "border-success/30 bg-success/5" : "border-border bg-background")}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", highlight && "text-success")}>{value}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
export function TierBadge({ tier }: { tier: Customer["tier"] }) {
  const map: Record<Customer["tier"], string> = {
    Platinum: "bg-foreground text-background",
    Gold: "bg-warning/20 text-warning",
    Silver: "bg-muted text-foreground/70",
    New: "bg-success/15 text-success",
  };
  return <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", map[tier])}>{tier}</span>;
}
function StatusBadge({ status }: { status: Customer["status"] }) {
  const map: Record<Customer["status"], string> = {
    Healthy: "bg-success/15 text-success",
    "At Risk": "bg-danger/15 text-danger",
    Trial: "bg-primary/15 text-primary",
    New: "bg-success/15 text-success",
  };
  return <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", map[status])}>{status}</span>;
}
function SentimentBadge({ s }: { s: Customer["sentiment"] }) {
  const map = { positive: "bg-success/15 text-success", neutral: "bg-muted text-foreground/70", negative: "bg-danger/15 text-danger" } as const;
  return <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize", map[s])}>{s}</span>;
}
function ChurnBadge({ risk }: { risk: Customer["churn"] }) {
  const map = { low: "bg-success/15 text-success", medium: "bg-warning/20 text-warning", high: "bg-danger/15 text-danger" } as const;
  return <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize", map[risk])}>{risk}</span>;
}
function TrendIcon({ t }: { t: Customer["trend"] }) {
  if (t === "growing") return <TrendingUp className="h-3.5 w-3.5 text-success" />;
  if (t === "declining") return <TrendingDown className="h-3.5 w-3.5 text-danger" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}
function HealthFlag({ ok, icon, okText, alertText, warning }: { ok: boolean; icon: React.ReactNode; okText: string; alertText: string; warning?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1.5 text-xs">
      <span className={cn("mt-0.5", ok ? "text-success" : warning ? "text-warning" : "text-danger")}>
        {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : warning ? <AlertTriangle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      </span>
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className={cn("flex-1 leading-relaxed", !ok && !warning && "text-danger", !ok && warning && "text-warning")}>
        {ok ? okText : alertText}
      </span>
    </div>
  );
}

