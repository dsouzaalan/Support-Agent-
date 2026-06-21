"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Conversation, ConvStatus, Message } from "@/lib/mock-data";
import { cannedResponses, helpArticles, suggestedMcp, getMcpResponse } from "@/lib/mock-data";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sparkles, SendHorizonal, Wand2, ExternalLink,
  AlertTriangle, CheckCheck, MoreHorizontal, UserPlus, Languages,
  BookOpen, FileText, Clock, Stethoscope, StickyNote, AtSign, CreditCard,
  ClipboardList, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const DRAFTS: Record<string, string> = {
  c1: "Hi Marcus — I've reviewed your account. The three disconnects were caused by Google rotating OAuth tokens overnight. I've queued a one-click reconnect link for all three mailboxes (Gmail x2, Outlook x1). On the duplicate charge: one $899 transaction was auto-refunded on Oct 18. Want me to forward proof to your finance team?",
  c2: "Hi Priya — DNS looks clean on our side. The verifier was using a stale cache; I've forced a re-check and your send.acme.co domain should flip to verified in the next 5 minutes.",
  c3: "Hallo Tomás — ja, Settings → Imports → CSV. Felder 'email' + 'first_name' zuordnen und fertig. Gerne 10-min Call vor Trial-Ende.",
  c4: "Hi Aisha — confirmed: the Dec 11 charge failed because the card on file expired. I've sent you a secure link to update it. Your account stays Active during the 5-day grace period.",
  c5: "Glad you're loving it! Logged your request for sequence-step filtering.",
  c6: "Hi Lin — Scale's API ceiling is 240 req/min. You peaked at 312. Two options: client-side backoff or Enterprise burst pool (1,000 req/min).",
};

const LANG_LABELS: Record<string, string> = { en: "English", de: "Deutsch", fr: "Français", es: "Español" };
const AGENT_LANG = "en";

interface ThreadProps {
  conversation: Conversation;
  clickupTicket?: string;
  onLinkClickup?: (ticket: string) => void;
  onStatusChange?: (status: ConvStatus) => void;
}

export function ConversationThread({ conversation, clickupTicket, onLinkClickup, onStatusChange }: ThreadProps) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [toneCheck, setToneCheck] = useState<null | { tone: string; suggestion: string }>(null);
  const [translatePreview, setTranslatePreview] = useState<null | { lang: string; text: string }>(null);
  const [showTranslated, setShowTranslated] = useState<Record<string, boolean>>({});
  const [showCanned, setShowCanned] = useState(false);
  const [showArticles, setShowArticles] = useState(false);
  const [mcpResult, setMcpResult] = useState<string[] | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [noteVal, setNoteVal] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>(conversation.messages);
  const [clickupOpen, setClickupOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(""); setToneCheck(null); setTranslatePreview(null);
    setShowTranslated({}); setMcpResult(null); setLocalMessages(conversation.messages);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conversation.id, conversation.messages]);

  const suggested = useMemo(() => suggestedMcp(conversation.messages), [conversation.messages]);
  const isWaiting = conversation.waitMinutes >= 0;
  const slaLeft = isWaiting ? Math.max(0, conversation.slaMinutes - conversation.waitMinutes) : null;
  const slaTone = slaLeft === null ? "text-muted-foreground" : slaLeft === 0 ? "text-danger" : slaLeft < 5 ? "text-danger" : slaLeft < 15 ? "text-warning" : "text-muted-foreground";

  const autoFill = () => {
    setAiThinking(true); setToneCheck(null);
    setTimeout(() => { setDraft(DRAFTS[conversation.id] || "Thanks for reaching out — looking into this now."); setAiThinking(false); }, 800);
  };
  const runToneCheck = () => {
    if (!draft.trim()) return toast.error("Write a reply first");
    setToneCheck({ tone: "Professional · Empathetic", suggestion: "Consider opening with the customer's name to warm the tone." });
  };
  const translateReply = () => {
    if (!draft.trim()) return toast.error("Write a reply first");
    const lang = conversation.customer.language;
    if (lang === AGENT_LANG) return toast(`Customer language matches yours (${LANG_LABELS[lang]}).`);
    setTranslatePreview({ lang, text: `[${LANG_LABELS[lang]} translation] ${draft}` });
  };
  const send = async () => {
    if (!draft.trim() || sending) return;
    const body = translatePreview ? translatePreview.text : draft.trim();
    setSending(true);
    // Optimistic update
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      from: "agent",
      text: body,
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      read: true,
      author: user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Agent",
    };
    setLocalMessages((prev) => [...prev, optimistic]);
    setDraft(""); setToneCheck(null); setTranslatePreview(null);
    try {
      await api.conversations.reply(conversation.id, body, "comment");
      toast.success(translatePreview ? `Reply sent in ${LANG_LABELS[translatePreview.lang]}.` : `Reply sent to ${conversation.customer.name}.`);
    } catch (err: any) {
      toast.error(`Failed to send reply: ${err.message}`);
      // Rollback optimistic message
      setLocalMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
    } finally {
      setSending(false);
    }
  };
  const runMcp = () => {
    if (!suggested) return;
    setMcpResult(getMcpResponse(suggested, conversation.customer));
  };
  const insertMcpIntoReply = () => {
    if (!mcpResult) return;
    const friendly = `Quick diagnostic from our end:\n${mcpResult.map((l) => "• " + l).join("\n")}\n\n`;
    setDraft((d) => friendly + d);
    toast.success("MCP results inserted in customer-friendly format");
  };
  const addNote = async () => {
    if (!noteVal.trim() || sending) return;
    const body = noteVal.trim();
    const authorName = user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Agent";
    setSending(true);
    const optimistic: Message = {
      id: `note-opt-${Date.now()}`,
      from: "note",
      text: body,
      time: "now",
      author: authorName,
    };
    setLocalMessages((prev) => [...prev, optimistic]);
    setNoteVal(""); setShowNote(false);
    try {
      await api.conversations.reply(conversation.id, body, "note");
    } catch (err: any) {
      toast.error(`Failed to save note: ${err.message}`);
      setLocalMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{conversation.subject}</h2>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              conversation.status === "open" && "bg-success/15 text-success",
              conversation.status === "pending" && "bg-warning/20 text-warning",
              conversation.status === "closed" && "bg-muted text-muted-foreground")}>{conversation.status}</span>
            {clickupTicket && (
              <a href={`https://app.clickup.com/t/${clickupTicket}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10">
                <ClipboardList className="h-2.5 w-2.5" />{clickupTicket}
              </a>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {(() => {
              const n = conversation.customer.name;
              const c = conversation.customer.company;
              // Don't show company if it's just the email domain already visible in the name
              const showCompany = c && c !== "Unknown" && !(n.includes("@") && n.endsWith(`@${c}`));
              return <span>with {n}{showCompany ? ` · ${c}` : ""}</span>;
            })()}
            {conversation.customer.localTime && (
              <>
                <span className="text-foreground/40">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {conversation.customer.localTime}
                  {conversation.customer.timezone && <span className="opacity-70">&nbsp;{conversation.customer.timezone}</span>}
                </span>
              </>
            )}
            <span className="text-foreground/40">·</span>
            <span className={cn("inline-flex items-center gap-1 font-medium", slaTone)}>
              {slaLeft === null ? "SLA Met" : slaLeft === 0 ? "SLA BREACHED" : `SLA ${slaLeft}m left`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="Reassign"><UserPlus className="h-4 w-4" /></IconBtn>
          {conversation.status === "closed" ? (
            <IconBtn label="Reopen" onClick={() => { onStatusChange?.("open"); toast.success("Conversation reopened"); }}>
              <RotateCcw className="h-4 w-4" />
            </IconBtn>
          ) : (
            <IconBtn label="Mark resolved" onClick={() => { onStatusChange?.("closed"); toast.success("Marked resolved"); }}>
              <CheckCheck className="h-4 w-4" />
            </IconBtn>
          )}
          <IconBtn label="More"><MoreHorizontal className="h-4 w-4" /></IconBtn>
        </div>
      </div>

      {/* Suggested diagnostic */}
      {suggested && (
        <div className="border-b border-border bg-primary/5 px-4 py-2 md:px-6">
          <div className="flex items-center gap-2 text-xs">
            <Stethoscope className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0 truncate text-foreground/80">Suggested diagnostic: <span className="font-medium">{suggested}</span></span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <button
                onClick={mcpResult ? () => setMcpResult(null) : runMcp}
                className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {mcpResult ? "Close" : "Run"}
              </button>
            </div>
          </div>
          {mcpResult && (
            <div className="mt-2 rounded-md border border-border bg-background p-2.5 text-xs">
              <ul className="space-y-1">
                {mcpResult.map((l, i) => (
                  <li key={i} className="flex gap-1.5 leading-relaxed text-foreground/85">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={insertMcpIntoReply} className="rounded-md border border-primary/40 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/5">
                  Insert into reply →
                </button>
                <button onClick={() => setMcpResult(null)} className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted">
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {localMessages.map((m) => {
            if (m.from === "note") return (
              <div key={m.id} className="mx-auto w-full max-w-[88%] rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                  <StickyNote className="h-3 w-3" /> Internal note · {m.author} · {m.time}
                </div>
                {m.html ? (
                  <div
                    className="mt-1 im-body im-body--customer"
                    dangerouslySetInnerHTML={{ __html: m.html }}
                  />
                ) : (
                  <p className="mt-1 leading-relaxed text-foreground/85">
                    {m.text.split(/(\s)/).map((part, i) => part.startsWith("@") ?
                      <span key={i} className="font-semibold text-primary">{part}</span> : part)}
                  </p>
                )}
                <MessageAttachments attachments={m.attachments} isAgent={false} />
              </div>
            );
            const translated = showTranslated[m.id];
            const langDifferent = m.from === "customer" && m.language && m.language !== AGENT_LANG;
            const isAgent = m.from === "agent";
            return (
              <div key={m.id} className={cn("flex gap-2.5", isAgent && "flex-row-reverse")}>
                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  !isAgent ? "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground" : "bg-foreground text-background")}>
                  {!isAgent ? conversation.customer.initials : "You"}
                </div>
                <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  !isAgent ? "rounded-tl-sm bg-card text-foreground shadow-sm ring-1 ring-border" : "rounded-tr-sm bg-primary text-primary-foreground")}>
                  {langDifferent && (
                    <div className="mb-1 flex items-center gap-1">
                      <span className="rounded bg-muted px-1.5 py-0 text-[9px] font-semibold uppercase text-muted-foreground">{m.language}</span>
                      <button onClick={() => setShowTranslated({ ...showTranslated, [m.id]: !translated })}
                        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0 text-[10px] font-medium text-primary hover:bg-primary/10">
                        <Languages className="h-2.5 w-2.5" /> {translated ? "Show original" : "Translate"}
                      </button>
                    </div>
                  )}
                  {m.html ? (
                    <div
                      className={cn("im-body", isAgent ? "im-body--agent" : "im-body--customer")}
                      dangerouslySetInnerHTML={{ __html: m.html }}
                    />
                  ) : (translated && m.translation ? m.translation : m.text) ? (
                    <LinkifiedText text={translated && m.translation ? m.translation : m.text} isAgent={isAgent} />
                  ) : null}
                  {translated && m.translation && (
                    <div className="mt-1 text-[10px] italic text-muted-foreground">Translated from {LANG_LABELS[m.language!] || m.language}</div>
                  )}
                  <MessageAttachments attachments={m.attachments} isAgent={isAgent} />
                  <div className={cn("mt-1 flex items-center gap-1 text-[10px]", !isAgent ? "text-muted-foreground" : "text-primary-foreground/70")}>
                    <span>{m.time}</span>
                    {isAgent && m.read && <CheckCheck className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card px-3 py-3 md:px-6">
        {showNote && (
          <div className="mb-2 rounded-md border border-warning/40 bg-warning/5 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase text-warning">Add internal note (not sent to customer)</div>
            <textarea value={noteVal} onChange={(e) => setNoteVal(e.target.value)}
              placeholder="Use @name to mention a teammate…" rows={2}
              className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none" />
            <div className="mt-1 flex justify-end gap-1">
              <button onClick={() => setShowNote(false)} className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={addNote} className="rounded bg-warning px-2 py-0.5 text-[10px] font-semibold text-background">Post note</button>
            </div>
          </div>
        )}
        {showCanned && (
          <div className="mb-2 rounded-md border border-border bg-background p-1.5">
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase text-muted-foreground">Canned responses</div>
            <div className="max-h-40 overflow-y-auto">
              {cannedResponses.map((r) => (
                <button key={r.id} onClick={() => { setDraft(r.body.replace("{name}", conversation.customer.name.split(" ")[0])); setShowCanned(false); }}
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted">
                  <div className="font-medium">{r.title}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{r.body}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {showArticles && (
          <div className="mb-2 rounded-md border border-border bg-background p-1.5">
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase text-muted-foreground">Suggested articles</div>
            {helpArticles.map((a) => (
              <button key={a.id} onClick={() => { setDraft((d) => d + `\n\nHelpful article: ${a.title} — ${a.url}`); setShowArticles(false); }}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-muted">
                <span className="flex items-center gap-1.5"><BookOpen className="h-3 w-3 text-primary" />{a.title}</span>
                <span className="text-[10px] text-muted-foreground">Insert</span>
              </button>
            ))}
          </div>
        )}
        {toneCheck && (
          <div className="mb-2 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary" />
            <div>
              <div className="font-medium">Tone: <span className="text-primary">{toneCheck.tone}</span></div>
              <div className="text-muted-foreground">{toneCheck.suggestion}</div>
            </div>
          </div>
        )}
        {translatePreview && (
          <div className="mb-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            <div className="mb-1 flex items-center gap-1 font-medium text-primary"><Languages className="h-3 w-3" /> Translation preview · {LANG_LABELS[translatePreview.lang]}</div>
            <p className="leading-relaxed text-foreground/85">{translatePreview.text}</p>
            <button onClick={() => setTranslatePreview(null)} className="mt-1 text-[10px] text-muted-foreground hover:text-foreground">Use original instead</button>
          </div>
        )}
        <div className="rounded-lg border border-border bg-background focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a reply… or click Auto-Fill" rows={3}
            className="w-full resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none" />
          <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-0.5">
              <ComposerBtn onClick={autoFill} disabled={aiThinking}>
                {aiThinking ? <><Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" /> Drafting…</> : <><Sparkles className="h-3.5 w-3.5 text-primary" /> Auto-Fill</>}
              </ComposerBtn>
              <ComposerBtn onClick={runToneCheck}><Wand2 className="h-3.5 w-3.5" /> Tone</ComposerBtn>
              <ComposerBtn onClick={translateReply}><Languages className="h-3.5 w-3.5" /> Translate</ComposerBtn>
              <ComposerBtn onClick={() => { setShowCanned(!showCanned); setShowArticles(false); }}><FileText className="h-3.5 w-3.5" /> Macros</ComposerBtn>
              <ComposerBtn onClick={() => { setShowArticles(!showArticles); setShowCanned(false); }}><BookOpen className="h-3.5 w-3.5" /> Articles</ComposerBtn>
              <ComposerBtn onClick={() => setShowNote(true)}><StickyNote className="h-3.5 w-3.5 text-warning" /> Note</ComposerBtn>
              <ComposerBtn onClick={() => toast("Mention @teammate inside a note")}><AtSign className="h-3.5 w-3.5" /></ComposerBtn>
            </div>
            <button onClick={send} disabled={!draft.trim() || sending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40">
              Send <SendHorizonal className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <QuickAction icon={<ExternalLink className="h-3 w-3" />} onClick={() => toast.success("One-click login token issued (15-min). Logged.")}>One-Click Login</QuickAction>
          <QuickAction icon={<CreditCard className="h-3 w-3" />} onClick={() => toast.success("Opening Stripe customer page. Logged.")}>One-Click Stripe</QuickAction>
          <QuickAction icon={<ClipboardList className="h-3 w-3" />} onClick={() => setClickupOpen(true)}>
            {clickupTicket ? `View ${clickupTicket}` : "Add to ClickUp"}
          </QuickAction>
          <QuickAction icon={<AlertTriangle className="h-3 w-3" />} variant="warning" onClick={() => toast.success("Escalated to billing")}>Escalate</QuickAction>
        </div>
      </div>

      <ClickUpModal
        open={clickupOpen}
        onOpenChange={setClickupOpen}
        conversation={conversation}
        existingTicket={clickupTicket}
        onCreated={(ticket) => { onLinkClickup?.(ticket); setClickupOpen(false); toast.success(`Created ${ticket} in ClickUp`); }}
      />
    </section>
  );
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return <button onClick={onClick} title={label} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground">{children}</button>;
}
function ComposerBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground/80 transition hover:bg-muted hover:text-foreground disabled:opacity-50">{children}</button>;
}
function QuickAction({ children, icon, variant, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ReactNode; variant?: "warning" | "danger" }) {
  return <button {...p} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition",
    !variant && "border-border bg-background text-foreground/80 hover:border-foreground/30 hover:text-foreground",
    variant === "warning" && "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15",
    variant === "danger" && "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15")}>{icon}{children}</button>;
}

type ClickUpCategory = "Bug" | "Feature" | "Enhancement";
type ClickUpPriority = "Low" | "Normal" | "High" | "Urgent";

function aiDraftFromConversation(conv: Conversation): { title: string; description: string; category: ClickUpCategory; priority: ClickUpPriority } {
  const firstCustomerMsg = conv.messages.find((m) => m.from === "customer")?.text ?? "";
  const subject = conv.subject;
  const flags: string[] = [];
  if (conv.customer.mailboxesDisconnected > 0) flags.push(`${conv.customer.mailboxesDisconnected} mailboxes disconnected (${conv.customer.disconnectedProviders.join(", ")})`);
  if (conv.customer.failedDomains > 0) flags.push(`${conv.customer.failedDomains} domain(s) failing: ${conv.customer.failedDomainList.join(", ")}`);
  if (conv.customer.apiErrors > 0) flags.push(`${conv.customer.apiErrors} API errors in last 24h`);
  if (conv.customer.paymentExpired) flags.push("Payment method expired");
  if (conv.customer.failedPayments > 0) flags.push(`${conv.customer.failedPayments} failed payments`);

  const lower = (subject + " " + firstCustomerMsg).toLowerCase();
  let category: ClickUpCategory = "Bug";
  if (/feature|request|wish|would love|could you add/.test(lower)) category = "Feature";
  else if (/improve|better|enhanc|easier|smoother/.test(lower)) category = "Enhancement";
  else if (/disconnect|error|fail|broken|bug|crash|charge|refund/.test(lower)) category = "Bug";

  const priority: ClickUpPriority =
    conv.triggerFlags?.includes("chargeback-risk") ? "Urgent" :
    conv.customer.sentiment === "negative" ? "High" :
    conv.priorityScore >= 80 ? "High" : "Normal";

  const title = subject.length > 70 ? subject.slice(0, 67) + "…" : subject;

  const description =
`Reported by ${conv.customer.name} (${conv.customer.company}) — tier ${conv.customer.tier}.

Summary: ${firstCustomerMsg.slice(0, 240)}${firstCustomerMsg.length > 240 ? "…" : ""}

Account context:
${flags.length ? flags.map((f) => "• " + f).join("\n") : "• No active health flags."}

Conversation link: https://support.zapmail.internal/conversations/${conv.id}`;

  return { title, description, category, priority };
}

// ─── Inline attachment rendering ─────────────────────────────────────────────

import type { MessageAttachment } from "@/lib/mock-data";

function MessageAttachments({ attachments, isAgent }: { attachments?: MessageAttachment[]; isAgent: boolean }) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((a, i) => {
        const ct = a.contentType || "";
        if (ct.startsWith("image/")) {
          return (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.name}
                className="max-h-64 max-w-full rounded-lg object-contain"
                style={{ maxWidth: "min(320px, 100%)" }}
              />
            </a>
          );
        }
        if (ct.startsWith("video/")) {
          return (
            <video key={i} controls className="max-h-48 max-w-full rounded-lg" style={{ maxWidth: "min(320px, 100%)" }}>
              <source src={a.url} type={ct} />
              <a href={a.url} target="_blank" rel="noreferrer" className="underline text-xs">
                {a.name}
              </a>
            </video>
          );
        }
        // generic file / PDF / etc.
        return (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
              isAgent
                ? "border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                : "border-border text-foreground hover:bg-muted"
            )}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            {a.name}
          </a>
        );
      })}
    </div>
  );
}

const URL_RE = /(https?:\/\/[^\s()"<>]+)/g;

function LinkifiedText({ text, isAgent }: { text: string; isAgent: boolean }) {
  if (!text) return null;
  const parts = text.split(/(https?:\/\/[^\s()"<>]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            className={cn("underline underline-offset-2 break-all", isAgent ? "text-primary-foreground/90" : "text-primary")}
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </p>
  );
}

function ClickUpModal({ open, onOpenChange, conversation, existingTicket, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversation: Conversation;
  existingTicket?: string;
  onCreated: (ticket: string) => void;
}) {
  const draft = useMemo(() => aiDraftFromConversation(conversation), [conversation]);
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [category, setCategory] = useState<ClickUpCategory>(draft.category);
  const [priority, setPriority] = useState<ClickUpPriority>(draft.priority);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(draft.title); setDescription(draft.description);
      setCategory(draft.category); setPriority(draft.priority);
    }
  }, [open, draft]);

  const submit = () => {
    if (!title.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      const ticket = `CU-${Math.floor(1000 + Math.random() * 9000)}`;
      setSubmitting(false);
      onCreated(ticket);
    }, 700);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            {existingTicket ? `ClickUp · ${existingTicket}` : "Add to ClickUp"}
          </DialogTitle>
        </DialogHeader>
        {existingTicket ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">This conversation is already linked to a ClickUp task.</p>
            <a href={`https://app.clickup.com/t/${existingTicket}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
              Open {existingTicket} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[11px] text-primary">
              <Sparkles className="mr-1 inline h-3 w-3" /> AI pre-filled from this conversation. Review and edit before sending.
            </div>
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary/50 focus:outline-none" />
            </Field>
            <Field label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8}
                className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs leading-relaxed focus:border-primary/50 focus:outline-none" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <div className="flex gap-1">
                  {(["Bug", "Feature", "Enhancement"] as ClickUpCategory[]).map((c) => (
                    <button key={c} onClick={() => setCategory(c)}
                      className={cn("flex-1 rounded-md border px-2 py-1 text-xs font-medium transition",
                        category === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>{c}</button>
                  ))}
                </div>
              </Field>
              <Field label="Priority">
                <select value={priority} onChange={(e) => setPriority(e.target.value as ClickUpPriority)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary/50 focus:outline-none">
                  {(["Low", "Normal", "High", "Urgent"] as ClickUpPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Routes to ClickUp list: <span className="font-mono text-foreground/70">{category === "Bug" ? "ZM · Bugs" : category === "Feature" ? "ZM · Feature Requests" : "ZM · Enhancements"}</span>
            </div>
          </div>
        )}
        {!existingTicket && (
          <DialogFooter>
            <button onClick={() => onOpenChange(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
            <button onClick={submit} disabled={submitting || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {submitting ? "Creating…" : "Create ClickUp task"}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
