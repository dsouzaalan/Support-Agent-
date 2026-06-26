"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Conversation, ConvStatus, Message, MessageAttachment } from "@/lib/mock-data";
import { suggestedMcp, getMcpResponse } from "@/lib/mock-data";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sparkles, SendHorizonal, Wand2, ExternalLink,
  AlertTriangle, CheckCheck, MoreHorizontal, UserPlus, Languages,
  BookOpen, FileText, Clock, Stethoscope, StickyNote, AtSign, CreditCard,
  ClipboardList, RotateCcw, Keyboard, Paperclip, Tag, X, Plus, Loader2, BellOff,
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
  clickupTaskUrl?: string;
  onLinkClickup?: (ticket: string, taskUrl: string) => void;
  onStatusChange?: (status: ConvStatus) => void;
  onTagsChange?: (tags: { id: string; name: string }[]) => void;
  onSnooze?: (snoozedUntil: number) => void;
  highlightMessageId?: string;
  searchQuery?: string;
}

function nameInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const TAG_PALETTE = [
  { bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  { bg: "bg-blue-100 dark:bg-blue-900/40",     text: "text-blue-700 dark:text-blue-300",     dot: "bg-blue-500" },
  { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { bg: "bg-amber-100 dark:bg-amber-900/40",   text: "text-amber-700 dark:text-amber-300",   dot: "bg-amber-500" },
  { bg: "bg-pink-100 dark:bg-pink-900/40",     text: "text-pink-700 dark:text-pink-300",     dot: "bg-pink-500" },
  { bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  { bg: "bg-teal-100 dark:bg-teal-900/40",     text: "text-teal-700 dark:text-teal-300",     dot: "bg-teal-500" },
  { bg: "bg-red-100 dark:bg-red-900/40",       text: "text-red-700 dark:text-red-300",       dot: "bg-red-500" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/40",     text: "text-cyan-700 dark:text-cyan-300",     dot: "bg-cyan-500" },
];

function getTagColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}

const SNOOZE_OPTIONS = [
  { label: "1 hour",      getTime: () => Math.floor(Date.now() / 1000) + 3600 },
  { label: "4 hours",     getTime: () => Math.floor(Date.now() / 1000) + 14400 },
  { label: "Tomorrow 9am",getTime: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return Math.floor(d.getTime() / 1000); } },
  { label: "Next week",   getTime: () => Math.floor(Date.now() / 1000) + 7 * 24 * 3600 },
];

export function ConversationThread({ conversation, clickupTicket, clickupTaskUrl, onLinkClickup, onStatusChange, onTagsChange, onSnooze, highlightMessageId, searchQuery }: ThreadProps) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const currentUserName = user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Agent";
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
  const [showShortcutsPopover, setShowShortcutsPopover] = useState(false);
  const [shortcutsPos, setShortcutsPos] = useState({ bottom: 0, right: 0 });
  const shortcutsBtnRef = useRef<HTMLButtonElement>(null);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  // Assignment
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [agentList, setAgentList] = useState<{ id: string; name: string }[]>([]);
  const [agentListLoading, setAgentListLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [localAssignedAgent, setLocalAssignedAgent] = useState(conversation.assignedAgent ?? null);

  // Tags
  const [convTags, setConvTags] = useState<{ id: string; name: string }[]>(conversation.tags ?? []);
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Macros (real API)
  const [macros, setMacros] = useState<{ id: string; name: string; description: string; actions: any[] }[]>([]);
  const [macrosLoading, setMacrosLoading] = useState(false);
  const [applyingMacro, setApplyingMacro] = useState<string | null>(null);

  // Articles (real API)
  const [articles, setArticles] = useState<{ id: string; title: string; url: string }[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [newArticleTitle, setNewArticleTitle] = useState("");
  const [newArticleBody, setNewArticleBody] = useState("");
  const [newArticleState, setNewArticleState] = useState<"published" | "draft">("published");
  const [creatingArticle, setCreatingArticle] = useState(false);

  // File attachments — stored as File objects, converted to base64 only on send
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  // Stable refs for keyboard handler — avoids stale closures without re-registering listener
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const canRef = useRef(can);
  canRef.current = can;

  // Resolve which message to highlight:
  // - explicit partId from audit log link (?msg=...)
  // - OR first message whose text contains the search query (?q=...)
  const resolvedHighlightId = useMemo(() => {
    if (highlightMessageId) return highlightMessageId;
    if (!searchQuery?.trim()) return undefined;
    const qLow = searchQuery.trim().toLowerCase();
    return localMessages.find((m) => m.text?.toLowerCase().includes(qLow))?.id;
  }, [highlightMessageId, searchQuery, localMessages]);

  // Track which target we've already scrolled to so SSE message updates don't re-trigger it.
  const scrolledForRef = useRef<string | undefined>(undefined);
  // Detect conversation switches vs same-conversation SSE updates.
  const prevConvIdRef = useRef(conversation.id);

  useEffect(() => {
    const isSwitch = prevConvIdRef.current !== conversation.id;
    prevConvIdRef.current = conversation.id;

    if (isSwitch) {
      // Switching to a new conversation — full reset.
      setDraft(""); setToneCheck(null); setTranslatePreview(null);
      setShowTranslated({}); setMcpResult(null);
      setConvTags(conversation.tags ?? []);
      setAttachedFiles([]);
      setLocalAssignedAgent(conversation.assignedAgent ?? null);
      scrolledForRef.current = undefined;
      setLocalMessages(conversation.messages);
      if (!highlightMessageId && !searchQuery?.trim()) {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }
    } else {
      // SSE update on the same conversation — merge server state into local state.
      setLocalMessages((prev) => {
        const prevById = new Map(prev.map((m) => [m.id, m]));
        let changed = false;
        let updated = prev.map((m) => {
          const serverVersion = conversation.messages.find((s) => s.id === m.id);
          if (!serverVersion || m.id.startsWith("opt-")) return m;
          // Merge server data into existing message (keeps read state, text, attachments fresh)
          const merged = { ...serverVersion, attachments: serverVersion.attachments?.map((a, i) => ({ ...a, name: m.attachments?.[i]?.name ?? a.name })) };
          if (JSON.stringify(merged) !== JSON.stringify(m)) { changed = true; return merged; }
          return m;
        });

        const toAppend: Message[] = [];
        for (const serverMsg of conversation.messages) {
          if (prevById.has(serverMsg.id)) continue;
          // New agent message — replace earliest optimistic placeholder to avoid duplication.
          if (serverMsg.from === "agent") {
            const optIdx = updated.findIndex((m) => m.id.startsWith("opt-"));
            if (optIdx !== -1) {
              const opt = updated[optIdx];
              updated[optIdx] = {
                ...serverMsg,
                attachments: serverMsg.attachments?.map((a, i) => ({ ...a, name: opt.attachments?.[i]?.name ?? a.name })),
              };
              changed = true;
              continue;
            }
          }
          toAppend.push(serverMsg);
        }

        if (!changed && toAppend.length === 0) return prev;
        return toAppend.length > 0 ? [...updated, ...toAppend] : updated;
      });
      // Sync assignment from SSE
      setLocalAssignedAgent(conversation.assignedAgent ?? null);
    }
  }, [conversation.id, conversation.messages, conversation.assignedAgent]);

  // Scroll to and ring-highlight the target message once per navigation.
  // Also depends on localMessages so it retries after the full conversation loads
  // (the element may not exist yet when the effect first fires from the URL param).
  useEffect(() => {
    if (!resolvedHighlightId) return;
    if (scrolledForRef.current === resolvedHighlightId) return;

    const t = setTimeout(() => {
      const el = document.getElementById(`msg-${resolvedHighlightId}`);
      if (!el) return; // messages not rendered yet — will retry when localMessages updates
      scrolledForRef.current = resolvedHighlightId;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "ring-offset-2", "rounded-xl");
      // Clean ?msg= / ?q= from the URL once we've landed — no need for it to persist.
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "rounded-xl");
      }, 2500);
    }, 200);
    return () => clearTimeout(t);
  }, [resolvedHighlightId, localMessages]);

  // Load tags, macros, articles once on mount
  useEffect(() => {
    api.tags.list().then((res) => setAllTags(res.data ?? [])).catch(() => {});
    setMacrosLoading(true);
    api.macros.list().then((res) => setMacros(res.data ?? [])).catch(() => {}).finally(() => setMacrosLoading(false));
    setArticlesLoading(true);
    api.articles.list({ perPage: 20 }).then((res) => setArticles(res.data?.articles ?? [])).catch(() => {}).finally(() => setArticlesLoading(false));
  }, []);

  // Thread keyboard shortcuts — only fire when not typing in an input/textarea
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "r":
          e.preventDefault();
          replyRef.current?.focus();
          break;
        case "e": {
          e.preventDefault();
          const conv = conversationRef.current;
          const newStatus = conv.status === "closed" ? "open" : "closed";
          onStatusChangeRef.current?.(newStatus);
          toast.success(newStatus === "closed" ? "Marked resolved" : "Conversation reopened");
          break;
        }
        case "a":
          e.preventDefault();
          setAiThinking(true); setToneCheck(null);
          setTimeout(() => {
            setDraft(DRAFTS[conversationRef.current.id] || "Thanks for reaching out — looking into this now.");
            setAiThinking(false);
          }, 800);
          break;
        case "t":
          e.preventDefault();
          if (!draftRef.current.trim()) { toast.error("Write a reply first"); return; }
          setToneCheck({ tone: "Professional · Empathetic", suggestion: "Consider opening with the customer's name to warm the tone." });
          break;
        case "l":
          e.preventDefault();
          if (!draftRef.current.trim()) { toast.error("Write a reply first"); return; }
          (() => {
            const lang = conversationRef.current.customer.language;
            if (lang === AGENT_LANG) { toast(`Customer language matches yours.`); return; }
            setTranslatePreview({ lang, text: `[${LANG_LABELS[lang]} translation] ${draftRef.current}` });
          })();
          break;
        case "n":
          e.preventDefault();
          if (canRef.current('notes:create')) setShowNote(true);
          break;
        case "m":
          e.preventDefault();
          if (canRef.current('macros:apply')) { setShowCanned((v) => !v); setShowArticles(false); }
          break;
        case "c":
          e.preventDefault();
          if (canRef.current('clickup:link')) setClickupOpen(true);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
    if ((!draft.trim() && !attachedFiles.length) || sending) return;
    const body = translatePreview ? translatePreview.text : draft.trim();
    setSending(true);
    const filesToSend = [...attachedFiles];

    // Build optimistic attachment previews synchronously using object URLs
    const blobUrls: string[] = [];
    const optimisticAttachments: MessageAttachment[] = filesToSend.map((file) => {
      const url = URL.createObjectURL(file);
      blobUrls.push(url);
      return { name: file.name, url, contentType: file.type || "application/octet-stream" };
    });

    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      from: "agent",
      text: body,
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      read: true,
      author: user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Agent",
      ...(optimisticAttachments.length > 0 && { attachments: optimisticAttachments }),
    };
    setLocalMessages((prev) => [...prev, optimistic]);
    setAttachedFiles([]);
    setDraft(""); setToneCheck(null); setTranslatePreview(null);
    try {
      const attachments = filesToSend.length
        ? await Promise.all(filesToSend.map((file) => new Promise<{ filename: string; mimeType: string; base64: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ filename: file.name, mimeType: file.type, base64: (reader.result as string).split(",")[1] });
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })))
        : undefined;
      await api.conversations.reply(conversation.id, body, "comment", attachments);
      // Revoke blob URLs now that the server has the real Cloudinary URLs via SSE
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
      toast.success(translatePreview ? `Reply sent in ${LANG_LABELS[translatePreview.lang]}.` : `Reply sent to ${conversation.customer.name}.`);
    } catch (err: any) {
      toast.error(`Failed to send reply: ${err.message}`);
      setLocalMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
      setDraft(body);
      setAttachedFiles(filesToSend);
    } finally {
      setSending(false);
    }
  };
  // Tag handlers
  const handleAddTag = async (tag: { id: string; name: string }) => {
    if (convTags.some((t) => t.id === tag.id)) return;
    const next = [...convTags, tag];
    setConvTags(next);
    onTagsChange?.(next);
    setShowTagPicker(false);
    try {
      await api.tags.add(conversation.id, tag.id);
      toast.success(`Tagged as #${tag.name}`);
    } catch (err: any) {
      const rolled = convTags.filter((t) => t.id !== tag.id);
      setConvTags(rolled);
      onTagsChange?.(rolled);
      toast.error(`Failed to add tag: ${err.message}`);
    }
  };
  const handleRemoveTag = async (tagId: string) => {
    const tag = convTags.find((t) => t.id === tagId);
    const next = convTags.filter((t) => t.id !== tagId);
    setConvTags(next);
    onTagsChange?.(next);
    try {
      await api.tags.remove(conversation.id, tagId);
    } catch (err: any) {
      if (tag) {
        const rolled = [...next, tag];
        setConvTags(rolled);
        onTagsChange?.(rolled);
      }
      toast.error(`Failed to remove tag: ${err.message}`);
    }
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name || creatingTag) return;
    setCreatingTag(true);
    try {
      const res = await api.tags.create(name);
      const tag: { id: string; name: string } = res.data;
      setAllTags((prev) => [...prev, tag]);
      setNewTagName("");
      await handleAddTag(tag);
    } catch (err: any) {
      toast.error(`Failed to create tag: ${err.message}`);
    } finally {
      setCreatingTag(false);
    }
  };

  const handleCreateArticle = async () => {
    if (!newArticleTitle.trim() || !newArticleBody.trim() || creatingArticle) return;
    setCreatingArticle(true);
    try {
      const res = await api.articles.create({
        title: newArticleTitle.trim(),
        body: newArticleBody.trim(),
        state: newArticleState,
      });
      const article = res.data;
      setArticles((prev) => [article, ...prev]);
      setNewArticleTitle(""); setNewArticleBody(""); setNewArticleState("published");
      setShowNewArticle(false);
      toast.success(`Article "${article.title}" created`);
    } catch (err: any) {
      toast.error(`Failed to create article: ${err.message}`);
    } finally {
      setCreatingArticle(false);
    }
  };

  // Macro apply handler
  const handleApplyMacro = async (macroId: string, macroName: string) => {
    setApplyingMacro(macroId);
    setShowCanned(false);

    const macro = macros.find((m) => m.id === macroId);
    const replyActions = macro?.actions.filter((a: any) => a.type === "reply") ?? [];
    const authorName = user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Agent";
    const now = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const optimisticIds = replyActions.map((_: any, i: number) => `macro-opt-${macroId}-${i}-${Date.now()}`);

    if (replyActions.length > 0) {
      const optimisticMsgs: Message[] = replyActions.map((a: any, i: number) => ({
        id: optimisticIds[i],
        from: "agent" as const,
        text: a.body,
        time: now,
        read: true,
        author: authorName,
      }));
      setLocalMessages((prev) => [...prev, ...optimisticMsgs]);
    }

    try {
      await api.macros.apply(macroId, conversation.id);
      toast.success(`Macro "${macroName}" applied`);
    } catch (err: any) {
      if (optimisticIds.length > 0) {
        setLocalMessages((prev) => prev.filter((m) => !optimisticIds.includes(m.id)));
      }
      toast.error(`Failed to apply macro: ${err.message}`);
    } finally {
      setApplyingMacro(null);
    }
  };

  // Article insert handler
  const handleInsertArticle = (article: { title: string; url: string }) => {
    setDraft((d) => d + `\n\nHelpful article: ${article.title} — ${article.url}`);
    setShowArticles(false);
    toast.success("Article inserted into reply");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10 MB"); return; }
    setAttachedFiles((prev) => [...prev, file]);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    if (!noteVal.trim() || sending || !can('notes:create')) return;
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
            {conversation.sla?.firstReplyBreached && (
              <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">
                <AlertTriangle className="h-3 w-3" />SLA Breached
              </span>
            )}
            {!conversation.sla?.firstReplyBreached && conversation.sla?.remainingSeconds != null && conversation.sla.remainingSeconds > 0 && (
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                conversation.sla.remainingSeconds < 300 ? "bg-danger/10 text-danger" : "bg-warning/15 text-warning"
              )}>
                <Clock className="h-3 w-3" />
                {conversation.sla.remainingSeconds < 60
                  ? `${conversation.sla.remainingSeconds}s`
                  : `${Math.round(conversation.sla.remainingSeconds / 60)}m`} left
              </span>
            )}
            {clickupTicket && (
              <a href={clickupTaskUrl || `https://app.clickup.com/t/${clickupTicket}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10">
                <ClipboardList className="h-2.5 w-2.5" />{clickupTicket}
              </a>
            )}
            {(() => {
              const name = localAssignedAgent?.name || conversation.intercomAssignee?.name || null;
              if (!name) return null;
              return (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                  <UserPlus className="h-2.5 w-2.5" />
                  {name}
                </span>
              );
            })()}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {(() => {
              const n = conversation.customer.name;
              const c = conversation.customer.company;
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
          {/* Tags row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {convTags.map((tag) => {
              const color = getTagColor(tag.id);
              return (
                <span key={tag.id} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", color.bg, color.text)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", color.dot)} />
                  {tag.name}
                  <button onClick={() => handleRemoveTag(tag.id)} className="ml-0.5 opacity-60 hover:opacity-100 focus:outline-none" aria-label={`Remove ${tag.name}`}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
            <div className="relative">
              <button
                onClick={() => setShowTagPicker((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                title="Add tag"
              >
                <Plus className="h-3 w-3" /> Tag
              </button>
              {showTagPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setShowTagPicker(false); setNewTagName(""); }} />
                  <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-card shadow-xl">
                    {/* Search input */}
                    <div className="px-2 pt-2 pb-1">
                      <input
                        ref={tagInputRef}
                        autoFocus
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const exact = allTags.find((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase());
                            if (exact) handleAddTag(exact);
                            else if (newTagName.trim()) handleCreateTag();
                          }
                          e.stopPropagation();
                        }}
                        placeholder="Search tags…"
                        className="w-full rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs focus:border-primary/50 focus:outline-none"
                      />
                    </div>
                    {/* Tag list */}
                    <div className="max-h-48 overflow-y-auto py-1">
                      {allTags
                        .filter((t) => t.name.toLowerCase().includes(newTagName.trim().toLowerCase()))
                        .map((tag) => {
                          const applied = convTags.some((ct) => ct.id === tag.id);
                          const color = getTagColor(tag.id);
                          return (
                            <button
                              key={tag.id}
                              onClick={() => applied ? handleRemoveTag(tag.id) : handleAddTag(tag)}
                              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors"
                            >
                              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors", applied ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                                {applied && <span className="text-[9px] font-bold leading-none">✓</span>}
                              </span>
                              <span className={cn("flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold", color.bg, color.text)}>
                                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", color.dot)} />
                                {tag.name}
                              </span>
                            </button>
                          );
                        })}
                      {allTags.filter((t) => t.name.toLowerCase().includes(newTagName.trim().toLowerCase())).length === 0 && !newTagName.trim() && (
                        <div className="px-3 py-2 text-[11px] text-muted-foreground">No tags yet</div>
                      )}
                    </div>
                    {/* Create row — only shown when typed text doesn't match any existing tag */}
                    {newTagName.trim() && !allTags.some((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase()) && (
                      <div className="border-t border-border px-2 py-1.5">
                        <button
                          onClick={handleCreateTag}
                          disabled={creatingTag}
                          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/8 disabled:opacity-50 transition-colors"
                        >
                          {creatingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                          Create &ldquo;{newTagName.trim()}&rdquo;
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {can('conversations:assign') && (
            user?.role === 'agent' ? (
              /* Agent: simple self-assign / unassign — no dropdown */
              (() => {
                const assignedToMe = localAssignedAgent?.id === user?.id;
                const assignedToOther = !!localAssignedAgent && !assignedToMe;
                return (
                  <div className="flex items-center gap-1">
                    {assignedToOther ? (
                      /* Another agent owns it — read-only indicator */
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                        <UserPlus className="h-3 w-3" />{localAssignedAgent!.name}
                      </span>
                    ) : assignedToMe ? (
                      /* Assigned to me — offer unassign */
                      <button
                        disabled={assigning}
                        onClick={async () => {
                          setAssigning(true);
                          try {
                            await api.conversations.assign(conversation.id, null);
                            setLocalAssignedAgent(null);
                            toast.success('Unassigned');
                          } catch { toast.error('Failed to unassign'); }
                          finally { setAssigning(false); }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary hover:bg-danger/10 hover:text-danger transition-colors disabled:opacity-50"
                        title="Click to unassign"
                      >
                        {assigning ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                        Assigned to me
                      </button>
                    ) : (
                      /* Unassigned — offer self-assign */
                      <button
                        disabled={assigning}
                        onClick={async () => {
                          if (!user?.id) return;
                          setAssigning(true);
                          try {
                            await api.conversations.assign(conversation.id, user.id);
                            setLocalAssignedAgent({ id: user.id, name: currentUserName, assignedById: user.id, assignedByName: currentUserName, assignedAt: new Date().toISOString() });
                            toast.success('Assigned to you');
                          } catch { toast.error('Failed to assign'); }
                          finally { setAssigning(false); }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {assigning ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                        Assign to me
                      </button>
                    )}
                  </div>
                );
              })()
            ) : (
              /* Admin / Supervisor: full agent dropdown */
              <div className="relative">
                {showAssignMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAssignMenu(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-card shadow-lg">
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Assign to</div>
                      {agentListLoading ? (
                        <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</div>
                      ) : (
                        <>
                          {localAssignedAgent && (
                            <button
                              disabled={assigning}
                              onClick={async () => {
                                setAssigning(true);
                                try {
                                  await api.conversations.assign(conversation.id, null);
                                  setLocalAssignedAgent(null);
                                  toast.success('Unassigned');
                                } catch { toast.error('Failed to unassign'); }
                                finally { setAssigning(false); setShowAssignMenu(false); }
                              }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                            >
                              {assigning ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
                              Unassign
                            </button>
                          )}
                          {agentList.map((a) => (
                            <button
                              key={a.id}
                              disabled={assigning}
                              onClick={async () => {
                                setAssigning(true);
                                try {
                                  await api.conversations.assign(conversation.id, a.id);
                                  setLocalAssignedAgent({ id: a.id, name: a.name, assignedById: user?.id ?? '', assignedByName: currentUserName, assignedAt: new Date().toISOString() });
                                  toast.success(`Assigned to ${a.name}`);
                                } catch { toast.error('Failed to assign'); }
                                finally { setAssigning(false); setShowAssignMenu(false); }
                              }}
                              className={cn(
                                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted",
                                localAssignedAgent?.id === a.id && "font-medium text-primary"
                              )}
                            >
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                                {a.name.charAt(0).toUpperCase()}
                              </span>
                              {a.name}
                              {localAssignedAgent?.id === a.id && <span className="ml-auto text-[10px] text-primary">✓</span>}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </>
                )}
                <div className="relative flex items-center gap-1">
                  <IconBtn
                    label={localAssignedAgent ? `Assigned to ${localAssignedAgent.name}` : 'Assign'}
                    onClick={async () => {
                      if (!showAssignMenu && agentList.length === 0) {
                        setAgentListLoading(true);
                        try {
                          const res = await api.agents.list();
                          const agents: any[] = res.data ?? [];
                          setAgentList(agents.filter((a) => a.status === 'active').map((a: any) => ({
                            id: a.id,
                            name: [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || a.email,
                          })));
                        } catch { toast.error('Could not load agents'); }
                        finally { setAgentListLoading(false); }
                      }
                      setShowAssignMenu((v) => !v);
                    }}
                  >
                    {assigning
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <UserPlus className={cn("h-4 w-4", localAssignedAgent && "text-primary")} />}
                  </IconBtn>
                  {localAssignedAgent && (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary" title={`Assigned to ${localAssignedAgent.name}`}>
                      {localAssignedAgent.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            )
          )}
          {/* Snooze */}
          {can('conversations:status') && (
            <div className="relative">
              {showSnoozeMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSnoozeMenu(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-card shadow-lg">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Snooze until</div>
                    {SNOOZE_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => { setShowSnoozeMenu(false); onSnooze?.(opt.getTime()); }}
                        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <IconBtn label="Snooze" onClick={() => setShowSnoozeMenu((v) => !v)}>
                <BellOff className="h-4 w-4" />
              </IconBtn>
            </div>
          )}
          {can('conversations:status') && (conversation.status === "closed" ? (
            <IconBtn label="Reopen" onClick={() => { onStatusChange?.("open"); toast.success("Conversation reopened"); }}>
              <RotateCcw className="h-4 w-4" />
            </IconBtn>
          ) : (
            <IconBtn label="Mark resolved" onClick={() => { onStatusChange?.("closed"); toast.success("Marked resolved"); }}>
              <CheckCheck className="h-4 w-4" />
            </IconBtn>
          ))}
          <IconBtn label="More"><MoreHorizontal className="h-4 w-4" /></IconBtn>
        </div>
      </div>

      {/* Snoozed banner */}
      {conversation.status === "pending" && conversation.snoozedUntil && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300 md:px-6">
          <BellOff className="h-3.5 w-3.5 shrink-0" />
          <span>
            Snoozed until{" "}
            <strong>
              {new Date(conversation.snoozedUntil * 1000).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })}
            </strong>
          </span>
        </div>
      )}

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
            if (m.from === "note") return can('notes:view') ? (
              <div key={m.id} id={`msg-${m.id}`} className="mx-auto w-full max-w-[88%] rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
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
            ) : null;
            const translated = showTranslated[m.id];
            const langDifferent = m.from === "customer" && m.language && m.language !== AGENT_LANG;
            const isAgent = m.from === "agent";
            return (
              <div key={m.id} id={`msg-${m.id}`} className={cn("flex gap-2.5", isAgent && "flex-row-reverse")}>
                <div
                  title={isAgent ? (m.author === currentUserName ? `You · ${m.author}` : (m.author || "Agent")) : conversation.customer.name}
                  className={cn("flex h-7 w-7 shrink-0 cursor-default items-center justify-center rounded-full text-[10px] font-semibold",
                    !isAgent ? "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground" : "bg-foreground text-background")}>
                  {!isAgent ? conversation.customer.initials : nameInitials(m.author || "Agent")}
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
            <textarea
              value={noteVal}
              onChange={(e) => setNoteVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); }
                if (e.key === "Escape") { setShowNote(false); }
              }}
              placeholder="Use @name to mention a teammate… (Enter to post, Shift+Enter for newline)"
              rows={2}
              className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none" />
            <div className="mt-1 flex justify-end gap-1">
              <button onClick={() => setShowNote(false)} className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={addNote} className="rounded bg-warning px-2 py-0.5 text-[10px] font-semibold text-background">Post note</button>
            </div>
          </div>
        )}
        {showCanned && can('macros:apply') && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowCanned(false)} />
            <div className="relative z-50 mb-2 rounded-md border border-border bg-background p-1.5">
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase text-muted-foreground">Macros</div>
              {macrosLoading ? (
                <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading macros…
                </div>
              ) : macros.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-muted-foreground">No macros available</div>
              ) : (
                <div className="max-h-52 overflow-y-auto">
                  {macros.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleApplyMacro(m.id, m.name)}
                      disabled={applyingMacro === m.id}
                      className="flex w-full cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium">{m.name}</div>
                        {m.description && <div className="truncate text-[10px] text-muted-foreground">{m.description}</div>}
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {m.actions.map((a: any, i: number) => (
                            <span key={i} className="rounded bg-muted px-1 py-0 text-[9px] font-medium text-muted-foreground">
                              {a.type === "reply" ? "Reply" : a.type === "status" ? `Set ${a.value}` : a.type === "tag" ? "Add tag" : a.type}
                            </span>
                          ))}
                        </div>
                      </div>
                      {applyingMacro === m.id && <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {showArticles && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setShowArticles(false); setShowNewArticle(false); }} />
            <div className="relative z-50 mb-2 rounded-md border border-border bg-background p-1.5">
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Articles</span>
                {can('articles:manage') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowNewArticle((v) => !v); }}
                    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                  >
                    <Plus className="h-3 w-3" /> New
                  </button>
                )}
              </div>
              {showNewArticle && (
                <div className="mb-2 rounded-md border border-border bg-muted/40 p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase text-muted-foreground">New article</div>
                  <input
                    autoFocus
                    value={newArticleTitle}
                    onChange={(e) => setNewArticleTitle(e.target.value)}
                    placeholder="Title…"
                    className="mb-1.5 w-full rounded border border-border bg-background px-2 py-1 text-xs focus:border-primary/50 focus:outline-none"
                  />
                  <textarea
                    value={newArticleBody}
                    onChange={(e) => setNewArticleBody(e.target.value)}
                    placeholder="Article body (plain text or HTML)…"
                    rows={4}
                    className="mb-1.5 w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:border-primary/50 focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {(["published", "draft"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setNewArticleState(s)}
                          className={cn("rounded border px-2 py-0.5 text-[10px] font-medium capitalize transition",
                            newArticleState === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}
                        >{s}</button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setShowNewArticle(false)} className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">Cancel</button>
                      <button
                        onClick={handleCreateArticle}
                        disabled={!newArticleTitle.trim() || !newArticleBody.trim() || creatingArticle}
                        className="inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {creatingArticle ? <Loader2 className="h-3 w-3 animate-spin" /> : "Publish"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {articlesLoading ? (
                <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading articles…
                </div>
              ) : articles.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-muted-foreground">No articles yet — create one above</div>
              ) : (
                <div className="max-h-44 overflow-y-auto">
                  {articles.map((a) => (
                    <button key={a.id} onClick={() => handleInsertArticle(a)}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-muted">
                      <span className="flex items-center gap-1.5 min-w-0"><BookOpen className="h-3 w-3 shrink-0 text-primary" /><span className="truncate">{a.title}</span></span>
                      <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">Insert</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
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
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
        {/* Attachment previews */}
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachedFiles.map((f, i) => (
              <div key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-[11px]">
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))} className="ml-0.5 text-muted-foreground hover:text-danger">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={cn("rounded-lg border border-border bg-background", can('conversations:reply') && "focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15")}>
          {can('conversations:reply') ? (
            <textarea
              ref={replyRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                if (e.key === "Escape") { setDraft(""); setToneCheck(null); setTranslatePreview(null); }
              }}
              placeholder="Write a reply… (Enter to send, Shift+Enter for newline)"
              rows={3}
              className="w-full resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none" />
          ) : (
            <div className="px-3 py-4 text-sm text-muted-foreground">You don't have permission to reply to conversations.</div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-0.5">
              {can('conversations:reply') && (
                <ComposerBtn onClick={autoFill} disabled={aiThinking}>
                  {aiThinking ? <><Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" /> Drafting…</> : <><Sparkles className="h-3.5 w-3.5 text-primary" /> Auto-Fill</>}
                </ComposerBtn>
              )}
              {can('conversations:reply') && <ComposerBtn onClick={runToneCheck}><Wand2 className="h-3.5 w-3.5" /> Tone</ComposerBtn>}
              {can('conversations:reply') && <ComposerBtn onClick={translateReply}><Languages className="h-3.5 w-3.5" /> Translate</ComposerBtn>}
              {can('macros:apply') && <ComposerBtn onClick={() => { setShowCanned(!showCanned); setShowArticles(false); }}><FileText className="h-3.5 w-3.5" /> Macros</ComposerBtn>}
              {can('articles:view') && <ComposerBtn onClick={() => { setShowArticles(!showArticles); setShowCanned(false); }}><BookOpen className="h-3.5 w-3.5" /> Articles</ComposerBtn>}
              {can('notes:create') && <ComposerBtn onClick={() => setShowNote(true)}><StickyNote className="h-3.5 w-3.5 text-warning" /> Note</ComposerBtn>}
              {can('conversations:reply') && (
                <ComposerBtn onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-3.5 w-3.5" />
                </ComposerBtn>
              )}
              {can('notes:create') && <ComposerBtn onClick={() => toast("Mention @teammate inside a note")}><AtSign className="h-3.5 w-3.5" /></ComposerBtn>}
            </div>
            <div className="relative flex items-center gap-1.5">
              {/* Keyboard shortcuts popover — fixed so it escapes overflow:hidden parents */}
              {showShortcutsPopover && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowShortcutsPopover(false)} />
                  <div
                    className="fixed z-50 w-80 rounded-xl border border-border bg-card shadow-xl"
                    style={{ bottom: shortcutsPos.bottom, right: shortcutsPos.right }}
                  >
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                    <Keyboard className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-semibold">Keyboard shortcuts</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">Outside input fields</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto px-3 py-2">
                    {[
                      {
                        section: "Reply & compose",
                        items: [
                          ["R", "Focus reply box"],
                          ["Enter", "Send reply"],
                          ["Shift + Enter", "New line in reply"],
                          ["Esc", "Clear draft / close panels"],
                        ],
                      },
                      {
                        section: "AI tools",
                        items: [
                          ["A", "AI auto-fill draft"],
                          ["T", "Tone check on draft"],
                          ["L", "Translate draft to customer's language"],
                        ],
                      },
                      {
                        section: "Panels & actions",
                        items: [
                          ["M", "Open macros / canned responses"],
                          ["N", "Add internal note"],
                          ["C", "Open ClickUp modal"],
                          ["E", "Resolve or reopen conversation"],
                        ],
                      },
                      {
                        section: "Conversation list",
                        items: [
                          ["J / ↓", "Next conversation"],
                          ["K / ↑", "Previous conversation"],
                          ["/", "Focus search"],
                          ["1", "Tab — All conversations"],
                          ["2", "Tab — Open"],
                          ["3", "Tab — Assigned to me"],
                          ["4", "Tab — Pending"],
                          ["5", "Tab — Closed"],
                        ],
                      },
                      {
                        section: "Navigation",
                        items: [
                          ["⌘ 1", "Go to Inbox"],
                          ["⌘ 2", "Go to Analytics"],
                          ["⌘ 3", "Go to Alerts"],
                          ["⌘ 4", "Go to Audit"],
                          ["⌘ B", "Toggle sidebar"],
                          ["?", "Show / hide this panel"],
                        ],
                      },
                    ].map(({ section, items }) => (
                      <div key={section} className="mb-3">
                        <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">{section}</div>
                        <div className="space-y-0.5">
                          {items.map(([key, desc]) => (
                            <div key={key} className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 text-xs hover:bg-muted/50">
                              <span className="text-foreground/75">{desc}</span>
                              <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">{key}</kbd>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                    Press <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">Esc</kbd> or click outside to close
                  </div>
                </div>
                </>
              )}
              <button
                ref={shortcutsBtnRef}
                onClick={() => {
                  if (!showShortcutsPopover && shortcutsBtnRef.current) {
                    const rect = shortcutsBtnRef.current.getBoundingClientRect();
                    setShortcutsPos({
                      bottom: window.innerHeight - rect.top + 8,
                      right: window.innerWidth - rect.right,
                    });
                  }
                  setShowShortcutsPopover((v) => !v);
                }}
                title="Keyboard shortcuts"
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md transition",
                  showShortcutsPopover
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Keyboard className="h-3.5 w-3.5" />
              </button>
              <button onClick={send} disabled={(!draft.trim() && !attachedFiles.length) || sending || !can('conversations:reply')}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40">
                Send <SendHorizonal className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <QuickAction icon={<ExternalLink className="h-3 w-3" />} onClick={() => toast.success("One-click login token issued (15-min). Logged.")}>One-Click Login</QuickAction>
          <QuickAction icon={<CreditCard className="h-3 w-3" />} onClick={() => toast.success("Opening Stripe customer page. Logged.")}>One-Click Stripe</QuickAction>
          {can('clickup:link') && (
            <QuickAction icon={<ClipboardList className="h-3 w-3" />} onClick={() => setClickupOpen(true)}>
              {clickupTicket ? `View ${clickupTicket}` : "Add to ClickUp"}
            </QuickAction>
          )}
          <QuickAction icon={<AlertTriangle className="h-3 w-3" />} variant="warning" onClick={() => toast.success("Escalated to billing")}>Escalate</QuickAction>
        </div>
      </div>

      <ClickUpModal
        open={clickupOpen}
        onOpenChange={setClickupOpen}
        conversation={conversation}
        existingTicket={clickupTicket}
        existingTaskUrl={clickupTaskUrl}
        onCreated={(ticket, taskUrl) => { onLinkClickup?.(ticket, taskUrl); setClickupOpen(false); toast.success(`Created ${ticket} in ClickUp`); }}
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

  const title = (() => {
    // Strip email prefixes and whitespace
    const cleanSubject = subject.replace(/^(re|fwd|fw):\s*/gi, "").trim();

    // Detect the core issue type from message content
    const issueMap: [RegExp, string][] = [
      [/disconnected|disconnect|mailbox.*off/i, "Mailbox disconnection"],
      [/duplicate.*charge|charged.*twice|double.*charge/i, "Duplicate charge"],
      [/refund/i, "Refund request"],
      [/payment.*fail|card.*expir|billing/i, "Billing issue"],
      [/domain.*fail|dns|verify|verification/i, "Domain verification failure"],
      [/api.*error|rate.?limit|429/i, "API rate limit error"],
      [/csv|import|export/i, "Data import issue"],
      [/crash|not.*load|broken|bug/i, "Product bug"],
      [/feature|wish|could you add/i, "Feature request"],
      [/upgrade|downgrade|plan/i, "Plan change request"],
    ];

    let issueLabel = "";
    for (const [pattern, label] of issueMap) {
      if (pattern.test(firstCustomerMsg) || pattern.test(cleanSubject)) {
        issueLabel = label;
        break;
      }
    }

    // If subject is descriptive enough, use it; otherwise synthesize from issue + company
    const isGeneric = cleanSubject.length < 15 || /^(support|help|question|inquiry|issue|problem|ticket|contact|request|hi|hello)$/i.test(cleanSubject);
    const company = conv.customer.company && conv.customer.company !== "Unknown" ? conv.customer.company : conv.customer.name.split(" ")[0];

    let raw: string;
    if (!isGeneric) {
      raw = cleanSubject;
    } else if (issueLabel) {
      raw = `${company} – ${issueLabel}`;
    } else {
      // Fall back to first meaningful sentence of the customer message
      const firstSentence = firstCustomerMsg.split(/[.!?]/)[0].trim();
      raw = firstSentence.length > 10 ? firstSentence : cleanSubject;
    }

    return raw.length > 70 ? raw.slice(0, 67) + "…" : raw;
  })();

  const description =
`Reported by ${conv.customer.name} (${conv.customer.company}) — tier ${conv.customer.tier}.

Summary: ${firstCustomerMsg.slice(0, 240)}${firstCustomerMsg.length > 240 ? "…" : ""}

Account context:
${flags.length ? flags.map((f) => "• " + f).join("\n") : "• No active health flags."}

Conversation link: https://support.zapmail.internal/inbox/${conv.id}`;

  return { title, description, category, priority };
}

// ─── Inline attachment rendering ─────────────────────────────────────────────

function AttachmentImage({ a }: { a: MessageAttachment }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const isBlob = a.url.startsWith("blob:");
  return (
    <a href={isBlob ? undefined : a.url} target={isBlob ? undefined : "_blank"} rel="noreferrer" className="block">
      {/* Shimmer placeholder shown while remote URL loads; hidden immediately for blob (already in memory) */}
      {!loaded && !errored && !isBlob && (
        <div className="h-40 w-64 max-w-full animate-pulse rounded-lg bg-muted" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={a.url}
        alt={a.name}
        className={cn(
          "max-h-64 max-w-full rounded-lg object-contain transition-opacity",
          loaded || isBlob ? "opacity-100" : "opacity-0 absolute"
        )}
        style={{ maxWidth: "min(320px, 100%)" }}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
      {errored && (
        <div className="flex h-16 w-40 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
          Image unavailable
        </div>
      )}
    </a>
  );
}

function MessageAttachments({ attachments, isAgent }: { attachments?: MessageAttachment[]; isAgent: boolean }) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((a, i) => {
        const ct = a.contentType || "";
        if (ct.startsWith("image/")) {
          return <AttachmentImage key={i} a={a} />;
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

interface ClickUpMember {
  id: number;
  name: string;
  email: string;
  profilePicture: string | null;
}

function ClickUpModal({ open, onOpenChange, conversation, existingTicket, existingTaskUrl, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversation: Conversation;
  existingTicket?: string;
  existingTaskUrl?: string;
  onCreated: (ticket: string, taskUrl: string) => void;
}) {
  const draft = useMemo(() => aiDraftFromConversation(conversation), [conversation]);
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [category, setCategory] = useState<ClickUpCategory>(draft.category);
  const [priority, setPriority] = useState<ClickUpPriority>(draft.priority);
  const [members, setMembers] = useState<ClickUpMember[]>([]);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(draft.title);
    setDescription(draft.description);
    setCategory(draft.category);
    setPriority(draft.priority);
    setError(null);
    setAssigneeId(null);

    setLoadingMembers(true);
    api.clickup.getMembers()
      .then((res) => setMembers(res?.data ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [open, draft]);

  const submit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.clickup.createTask({ name: title.trim(), description: description.trim(), priority, assigneeId });
      onCreated(res.data.taskId, res.data.taskUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
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
            <a href={existingTaskUrl || `https://app.clickup.com/t/${existingTicket}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
              Open {existingTicket} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-[11px] text-danger">{error}</div>
            )}
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary/50 focus:outline-none" />
            </Field>
            <Field label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6}
                className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs leading-relaxed focus:border-primary/50 focus:outline-none" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority">
                <select value={priority} onChange={(e) => setPriority(e.target.value as ClickUpPriority)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary/50 focus:outline-none">
                  {(["Low", "Normal", "High", "Urgent"] as ClickUpPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Category">
                <div className="flex gap-1">
                  {(["Bug", "Feature", "Enhancement"] as ClickUpCategory[]).map((c) => (
                    <button key={c} onClick={() => setCategory(c)}
                      className={cn("flex-1 rounded-md border px-2 py-1 text-xs font-medium transition",
                        category === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>{c}</button>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="Assign to">
              {loadingMembers ? (
                <div className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">Loading team members…</div>
              ) : members.length === 0 ? (
                <div className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">No members found — check CLICKUP_LIST_ID</div>
              ) : (
                <select
                  value={assigneeId ?? ""}
                  onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary/50 focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                  ))}
                </select>
              )}
            </Field>
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
