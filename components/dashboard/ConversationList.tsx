"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Conversation, TierType } from "@/lib/mock-data";
import { TierBadge } from "./CustomerPanel";
import { Search, Circle, AlertTriangle, Filter, Bookmark, Eye, ChevronDown, Plus, UserCheck, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const TABS = ["All", "Open", "Assigned to Me", "Created by Me", "Pending", "Closed"] as const;
type Tab = (typeof TABS)[number];
type Sort = "priority" | "frustrated" | "waiting" | "sla" | "tier" | "newest";

const SORTS: { id: Sort; label: string }[] = [
  { id: "priority", label: "Priority score" },
  { id: "frustrated", label: "Most frustrated" },
  { id: "waiting", label: "Longest waiting" },
  { id: "sla", label: "SLA risk" },
  { id: "tier", label: "Highest tier" },
  { id: "newest", label: "Newest" },
];

const TIER_ORDER: Record<TierType, number> = { Platinum: 0, Gold: 1, Silver: 2, New: 3 };
const SENTIMENT_ORDER = { negative: 0, neutral: 1, positive: 2 } as const;

interface Props {
  conversations: Conversation[];
  selectedId: string;
  onSelect: (id: string) => void;
  agentName: string;
  agentInitials: string;
  clickupLinks?: Record<string, string>;
}

export function ConversationList({ conversations, selectedId, onSelect, agentName, agentInitials, clickupLinks }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("All");
  const [q, setQ] = useState("");
  const [apiResults, setApiResults] = useState<Conversation[] | null>(null);
  const [apiSearching, setApiSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sort, setSort] = useState<Sort>("priority");
  const [tierFilter, setTierFilter] = useState<TierType | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | "all">("all");
  const [unhealthyOnly, setUnhealthyOnly] = useState(false);
  const [savedView, setSavedView] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Stable refs so the keyboard handler never goes stale
  const filteredRef = useRef<Conversation[]>([]);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const filtered = filteredRef.current;
      const sid = selectedIdRef.current;
      const select = onSelectRef.current;

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventDefault();
          const idx = filtered.findIndex((c) => c.id === sid);
          const next = filtered[idx + 1];
          if (next) select(next.id);
          break;
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault();
          const idx = filtered.findIndex((c) => c.id === sid);
          const prev = filtered[Math.max(0, idx - 1)];
          if (prev && prev.id !== sid) select(prev.id);
          break;
        }
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case "1": setTab("All"); break;
        case "2": setTab("Open"); break;
        case "3": setTab("Assigned to Me"); break;
        case "4": setTab("Created by Me"); break;
        case "5": setTab("Pending"); break;
        case "6": setTab("Closed"); break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced API search for queries 3+ chars — searches beyond the loaded 50
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (q.trim().length < 3) { setApiResults(null); setApiSearching(false); return; }
    setApiSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await api.conversations.search(q.trim());
        setApiResults(res?.data?.conversations ?? []);
      } catch {
        setApiResults(null);
      } finally {
        setApiSearching(false);
      }
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [q]);

  const allTags = useMemo(() => Array.from(new Set(conversations.flatMap((c) => c.customer.tags))).sort(), [conversations]);

  const filtered = useMemo(() => {
    // When we have API search results, use those as the base list instead of local conversations
    const base = apiResults ?? conversations;
    const qLow = q.trim().toLowerCase();
    const isSearching = qLow.length > 0;

    let list = base.filter((c) => {
      if (!isSearching) {
        if (tab === "Closed" && c.status !== "closed") return false;
        if (tab !== "Closed" && c.status === "closed") return false;
        if (tab === "Open" && c.status !== "open") return false;
        if (tab === "Pending" && c.status !== "pending") return false;
        if (tab === "Assigned to Me" && !c.assignedToMe) return false;
        if (tab === "Created by Me" && !c.createdByMe) return false;
      }
      if (tierFilter !== "all" && c.customer.tier !== tierFilter) return false;
      if (tagFilter !== "all" && !c.customer.tags.includes(tagFilter)) return false;
      if (unhealthyOnly && c.customer.mailboxesDisconnected === 0 && c.customer.failedDomains === 0 && !c.customer.paymentExpired) return false;
      // Local filter: match name, subject, preview, email (covers the loaded 50 for short queries)
      if (isSearching && !apiResults) {
        const matches =
          c.customer.name.toLowerCase().includes(qLow) ||
          c.subject.toLowerCase().includes(qLow) ||
          (c.preview ?? "").toLowerCase().includes(qLow) ||
          (c.customer.email ?? "").toLowerCase().includes(qLow);
        if (!matches) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "priority": return b.priorityScore - a.priorityScore;
        case "frustrated": return SENTIMENT_ORDER[a.customer.sentiment] - SENTIMENT_ORDER[b.customer.sentiment];
        case "waiting": return b.waitMinutes - a.waitMinutes;
        case "sla": return (b.waitMinutes / b.slaMinutes) - (a.waitMinutes / a.slaMinutes);
        case "tier": return TIER_ORDER[a.customer.tier] - TIER_ORDER[b.customer.tier];
        case "newest": return a.lastTime.localeCompare(b.lastTime);
      }
    });
    return list;
  }, [conversations, tab, q, sort, tierFilter, tagFilter, unhealthyOnly]);

  // Keep filteredRef in sync so the keyboard handler sees the latest visible list
  filteredRef.current = filtered;

  const applySaved = (name: string) => {
    setSavedView(name);
    if (name === "My VIPs waiting") { setTab("All"); setTagFilter("VIP"); setSort("waiting"); setUnhealthyOnly(false); setTierFilter("all"); }
    if (name === "Frustrated & unassigned") { setTab("All"); setTagFilter("all"); setSort("frustrated"); setUnhealthyOnly(false); setTierFilter("all"); }
    if (name === "Account health alerts") { setTab("All"); setTagFilter("all"); setSort("priority"); setUnhealthyOnly(true); setTierFilter("all"); }
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card">
      <div className="border-b border-border px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight">Inbox</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Online
            </div>
            <button
              onClick={() => router.push("/inbox/new")}
              title="New conversation"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations  [/]"
            className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none" />
          {apiSearching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto">
          {TABS.map((f) => (
            <button key={f} onClick={() => setTab(f)}
              className={cn("whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition",
                tab === f ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>
              {f}
            </button>
          ))}
        </div>
        {/* Filters row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <SelectFilter icon={<Filter className="h-3 w-3" />} value={sort} onChange={(v) => setSort(v as Sort)} options={SORTS.map((s) => ({ value: s.id, label: s.label }))} />
          <SelectFilter value={tierFilter} onChange={(v) => setTierFilter(v as TierType | "all")} options={[
            { value: "all", label: "All tiers" },
            { value: "Platinum", label: "Platinum" }, { value: "Gold", label: "Gold" },
            { value: "Silver", label: "Silver" }, { value: "New", label: "New" },
          ]} />
          <SelectFilter value={tagFilter} onChange={setTagFilter} options={[{ value: "all", label: "All tags" }, ...allTags.map((t) => ({ value: t, label: `#${t}` }))]} />
          <button onClick={() => setUnhealthyOnly(!unhealthyOnly)}
            className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
              unhealthyOnly ? "border-danger/40 bg-danger/10 text-danger" : "border-border text-muted-foreground hover:bg-muted")}>
            Health alerts
          </button>
        </div>
        {/* Saved views */}
        <div className="mt-2 flex items-center gap-1 overflow-x-auto">
          <Bookmark className="h-3 w-3 shrink-0 text-muted-foreground" />
          {["My VIPs waiting", "Frustrated & unassigned", "Account health alerts"].map((v) => (
            <button key={v} onClick={() => applySaved(v)}
              className={cn("whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px]",
                savedView === v ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30")}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((c) => <ConvRow key={c.id} c={c} selected={c.id === selectedId} onSelect={() => onSelect(c.id)} clickupTicket={clickupLinks?.[c.id]} />)}
        {filtered.length === 0 && <div className="px-4 py-12 text-center text-xs text-muted-foreground">No conversations match.</div>}
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-3">
        <div className="relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{agentInitials}</div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{agentName}</div>
          <div className="text-[11px] text-muted-foreground">Online · 6h 12m today</div>
        </div>
      </div>

    </aside>
  );
}

function formatSnoozedUntil(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = ts - now;
  if (diff <= 0) return "Snoozed";
  if (diff < 3600) return `Snoozed · ${Math.ceil(diff / 60)}m`;
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    const m = Math.ceil((diff % 3600) / 60);
    return m > 0 ? `Snoozed · ${h}h ${m}m` : `Snoozed · ${h}h`;
  }
  return `Snoozed · ${new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
}

function ConvRow({ c, selected, onSelect, clickupTicket }: { c: Conversation; selected: boolean; onSelect: () => void; clickupTicket?: string }) {
  const sentDot = c.customer.sentiment === "negative" ? "bg-danger" : c.customer.sentiment === "neutral" ? "bg-warning" : "bg-success";
  const isWaiting = c.waitMinutes >= 0;
  const waitRatio = isWaiting ? c.waitMinutes / c.slaMinutes : 0;
  const waitTone = !isWaiting ? "text-muted-foreground" : waitRatio >= 1 ? "text-danger" : waitRatio >= 0.66 ? "text-warning" : "text-muted-foreground";
  const closed = c.status === "closed";
  const snoozed = c.status === "pending" && !!c.snoozedUntil;
  const visibleTags = c.customer.tags.slice(0, 2);
  const extraTags = Math.max(0, c.customer.tags.length - visibleTags.length);

  return (
    <button onClick={onSelect}
      className={cn("flex w-full gap-2.5 border-b border-border/70 px-3.5 py-3.5 text-left transition hover:bg-muted/60",
        selected && "bg-accent",
        closed && "opacity-70")}>
      <div className="relative">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-xs font-semibold text-primary-foreground">
          {c.customer.initials}
        </div>
        <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card", sentDot)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-sm", c.unread ? "font-semibold text-foreground" : "font-medium text-foreground/85")}>
            {c.customer.name}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{c.lastTime}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          <TierBadge tier={c.customer.tier} />
          {closed && <span className="rounded bg-muted px-1 py-0 text-[9px] font-semibold uppercase text-muted-foreground">closed</span>}
          {snoozed && <span className="rounded bg-amber-100 px-1 py-0 text-[9px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{formatSnoozedUntil(c.snoozedUntil!)}</span>}
          {clickupTicket && <span className="rounded bg-primary/10 px-1 py-0 text-[9px] font-semibold text-primary">{clickupTicket}</span>}
          {c.createdByMe && c.createdByAdmin && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-0.5 rounded bg-indigo-500/10 px-1 py-0 text-[9px] font-semibold text-indigo-500 dark:text-indigo-400">
                    <UserCheck className="h-2.5 w-2.5" />started
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Started by {c.createdByAdmin.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {c.firstResponsePending && <span className="rounded bg-danger/15 px-1 py-0 text-[9px] font-semibold uppercase text-danger">1st reply</span>}
          {c.triggerFlags?.includes("chargeback-risk") && (
            <span className="inline-flex items-center gap-0.5 rounded bg-danger/15 px-1 py-0 text-[9px] font-semibold text-danger">
              <AlertTriangle className="h-2.5 w-2.5" />risk
            </span>
          )}
          {c.viewers && c.viewers.length > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-warning/15 px-1 py-0 text-[9px] text-warning">
              <Eye className="h-2.5 w-2.5" />{c.viewers[0]}
            </span>
          )}
          {isWaiting && <span className={cn("ml-auto text-[10px] tabular-nums", waitTone)}>⏱ {c.waitMinutes}m</span>}
        </div>
        {c.subject && (
          <div className="mt-0.5 truncate text-xs font-medium text-foreground/75">{c.subject}</div>
        )}
        <div className="mt-0.5 flex items-center gap-1">
          <p className="truncate text-xs text-muted-foreground">
            {c.preview || ""}
          </p>
          {c.unread && <Circle className="h-2 w-2 shrink-0 fill-primary text-primary" />}
        </div>
        {visibleTags.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1">
            {visibleTags.map((t) => (
              <span key={t} className="rounded-sm bg-muted/70 px-1 py-0 text-[9px] text-muted-foreground/80">#{t}</span>
            ))}
            {extraTags > 0 && (
              <span className="rounded-sm bg-muted/70 px-1 py-0 text-[9px] text-muted-foreground/80">+{extraTags}</span>
            )}
          </div>
        )}
        {c.tags && c.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {c.tags.map((t) => (
              <span key={t.id} className="rounded-full bg-primary/10 px-1.5 py-0 text-[9px] font-medium text-primary">#{t.name}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function SelectFilter<T extends string>({ value, onChange, options, icon }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; icon?: React.ReactNode }) {
  return (
    <div className="relative inline-flex items-center">
      {icon && <span className="pointer-events-none absolute left-1.5 text-muted-foreground">{icon}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className={cn("appearance-none rounded-md border border-border bg-background py-0.5 pr-5 text-[10px] font-medium focus:outline-none focus:border-primary/50",
          icon ? "pl-5" : "pl-2")}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 h-2.5 w-2.5 text-muted-foreground" />
    </div>
  );
}

