"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { Sparkles, X, Send, Loader2, FileText, BookOpen, AlignLeft, PenLine, Bot } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  conversationId: string;
  onUseDraft?: (text: string) => void;
  onClose?: () => void;
}

const QUICK_ACTIONS = [
  { label: "Summarise",   icon: AlignLeft,  message: "Summarise this conversation and suggest the best next action." },
  { label: "Draft reply", icon: PenLine,    message: "Draft a helpful reply to the customer's latest message." },
  { label: "Find article",icon: BookOpen,   message: "Which help article is most relevant to this conversation?" },
  { label: "Best macro",  icon: FileText,   message: "Which macro best fits this conversation and why?" },
];

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    const isBullet = /^[•\-\*]\s/.test(line.trim());
    const formatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    return (
      <span
        key={i}
        className={cn("block", isBullet && "pl-3 before:content-['•'] before:mr-1.5 before:-ml-3")}
        dangerouslySetInnerHTML={{ __html: formatted || "&nbsp;" }}
      />
    );
  });
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

export function AiCopilotPanel({ conversationId, onUseDraft, onClose }: Props) {
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const send = async (messageOverride?: string) => {
    const message = (messageOverride ?? input).trim();
    if (!message || loading) return;

    const userMsg: Message = { role: "user", content: message };
    setHistory(h => [...h, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.ai.chat(
        conversationId,
        message,
        history.map(h => ({ role: h.role, content: h.content }))
      );
      const reply = res?.data?.reply || "No response.";
      setHistory(h => [...h, { role: "assistant", content: reply }]);
    } catch (err: any) {
      toast.error(err.message || "AI error");
      setHistory(h => h.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const extractDraft = (text: string): string | null => {
    const match = text.match(/Draft reply:\s*([\s\S]+)/i);
    return match?.[1]?.trim() || null;
  };

  return (
    <div className="flex h-full flex-col bg-card overflow-hidden">

      {/* Header — gradient like Fin */}
      <div className="relative shrink-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-4 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm ring-2 ring-white/30">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Zapmail Agent</p>
              <p className="text-[11px] text-white/70 mt-0.5">Powered by Claude</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
            {onClose && (
              <button onClick={onClose} className="rounded-full p-1 text-white/70 hover:bg-white/15 hover:text-white transition">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.label}
              onClick={() => send(a.message)}
              disabled={loading}
              className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-50"
            >
              <a.icon className="h-3 w-3" />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 pt-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/30 dark:to-violet-900/30">
              <Bot className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">How can I help?</p>
              <p className="mt-1 text-xs text-muted-foreground">Use a quick action above or ask me anything about this conversation.</p>
            </div>
          </div>
        )}

        {history.map((msg, i) => (
          <div key={i} className={cn("flex items-end gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            {/* Avatar */}
            {msg.role === "assistant" && (
              <div className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            )}

            <div className="flex flex-col gap-1 max-w-[85%]">
              <div className={cn(
                "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm",
                msg.role === "user"
                  ? "rounded-br-sm bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                  : "rounded-bl-sm border border-border bg-background text-foreground"
              )}>
                {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
              </div>

              {msg.role === "assistant" && onUseDraft && extractDraft(msg.content) && (
                <button
                  onClick={() => { onUseDraft(extractDraft(msg.content)!); toast.success("Draft copied to composer"); }}
                  className="self-start rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-400"
                >
                  Use this draft →
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-end gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <div className="rounded-2xl rounded-bl-sm border border-border bg-background px-3.5 py-2.5 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-background/80 p-3 backdrop-blur-sm">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3.5 py-2.5 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask anything…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow transition hover:opacity-90 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">Claude suggests — you decide and execute.</p>
      </div>
    </div>
  );
}
