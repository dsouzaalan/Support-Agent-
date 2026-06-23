"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConversationsContext } from "@/contexts/ConversationsContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Search, Send, Loader2, X, MessageSquare, Mail, Phone, Smartphone,
} from "lucide-react";

type Channel = "chat" | "email" | "whatsapp" | "sms";

const CHANNELS: { id: Channel; label: string; icon: React.ReactNode; available: boolean }[] = [
  { id: "chat",      label: "Chat",      icon: <MessageSquare className="h-3 w-3" />, available: true },
  { id: "email",     label: "Email",     icon: <Mail          className="h-3 w-3" />, available: true },
  { id: "whatsapp",  label: "WhatsApp",  icon: <Phone         className="h-3 w-3" />, available: false },
  { id: "sms",       label: "SMS",       icon: <Smartphone    className="h-3 w-3" />, available: false },
];

interface ContactResult {
  id: string;
  name: string;
  email: string;
  company: string;
}

export function NewConversationComposer() {
  const router = useRouter();
  const { refetch, setComposingContact, upsertConversation } = useConversationsContext();
  const { user } = useAuth();

  const [channel, setChannel] = useState<Channel>("chat");
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [contacts, setContacts] = useState<ContactResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear contact preview panel on unmount
  useEffect(() => () => setComposingContact(null), []);

  const agentName = user
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`.trim()
    : "Agent";

  const handleSearch = useCallback((value: string) => {
    setSearchQ(value);
    setSelectedContact(null);
    setComposingContact(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setContacts([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.contacts.search(value.trim());
        setContacts(res.data ?? []);
      } catch {
        setContacts([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleSend = async () => {
    if (!selectedContact) { toast.error("Select a recipient first"); return; }
    if (!body.trim()) { toast.error("Enter a message"); return; }
    if (channel === "email" && !subject.trim()) { toast.error("Subject is required for email"); return; }
    setSubmitting(true);
    try {
      const res = await api.conversations.create(
        selectedContact.id,
        body.trim(),
        channel === "email" ? subject.trim() : undefined,
        channel === "email" ? "email" : "inapp",
      );
      const newId = res.data?.id;
      if (newId) {
        // Fetch the specific conversation and inject it into the list directly
        // so it appears immediately without relying on refetch() timing or SSE
        try {
          const convRes = await api.conversations.get(newId);
          if (convRes?.data) upsertConversation(convRes.data);
        } catch {}
        router.push(`/inbox/${newId}`);
      } else {
        await refetch();
        router.push("/inbox");
      }
      toast.success("Conversation started");
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-card">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
        <span className="text-sm font-semibold">New Conversation</span>
        <button
          onClick={() => router.back()}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Channel selector ───────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
        <span className="w-14 shrink-0 text-xs text-muted-foreground">Channel</span>
        <div className="flex items-center gap-1.5">
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => ch.available && setChannel(ch.id)}
              title={!ch.available ? "Not yet available" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                ch.id === channel && ch.available
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : ch.available
                  ? "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  : "cursor-not-allowed border-border/40 text-muted-foreground/35"
              )}
            >
              {ch.icon}
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── From ───────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
        <span className="w-14 shrink-0 text-xs text-muted-foreground">From</span>
        <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground/80">
          {agentName}
        </span>
      </div>

      {/* ── To ─────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-3">
        <span className="w-14 shrink-0 pt-1 text-xs text-muted-foreground">To</span>
        <div className="relative min-w-0 flex-1">
          {selectedContact ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {selectedContact.name}
              <button
                onClick={() => { setSelectedContact(null); setComposingContact(null); setSearchQ(""); }}
                className="ml-0.5 hover:text-primary/60"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQ}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                />
                {searching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
              </div>

              {contacts.length > 0 && (
                <div className="absolute left-0 top-full z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
                  {contacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedContact(c); setComposingContact(c); setSearchQ(c.name); setContacts([]); }}
                      className="flex w-full items-center gap-2.5 border-b border-border/50 px-3 py-2.5 text-left transition hover:bg-muted last:border-b-0"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(c.name?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {c.email}{c.company ? ` · ${c.company}` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQ.trim().length > 1 && !searching && contacts.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">No contacts found.</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Subject (email only) ────────────────────────────────── */}
      {channel === "email" && (
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
          <span className="w-14 shrink-0 text-xs text-muted-foreground">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Add a subject…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      )}

      {/* ── Message body ────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 px-5 py-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="h-full w-full resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
        <button className="rounded-md px-2 py-1.5 text-xs font-bold tracking-widest text-muted-foreground transition hover:bg-muted hover:text-foreground">
          •••
        </button>
        <button
          onClick={handleSend}
          disabled={submitting || !selectedContact || !body.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
        >
          {submitting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Send className="h-4 w-4" />}
          {submitting ? "Sending…" : "Send"}
        </button>
      </div>

    </div>
  );
}
