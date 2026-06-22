"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useConversations } from "@/hooks/useConversations";
import { useSSE } from "@/hooks/useSSE";
import type { Conversation, ConvStatus } from "@/lib/mock-data";
import { toast } from "sonner";

interface ClickUpLink { ticket: string; taskUrl: string }

interface ConversationsContextValue {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upsertConversation: (c: Conversation) => void;
  setLocalStatus: (id: string, status: ConvStatus) => void;
  clickupLinks: Record<string, ClickUpLink>;
  linkClickup: (id: string, ticket: string, taskUrl: string) => void;
  latestUpdate: Conversation | null;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const { conversations, loading, error, refetch, upsertConversation, setLocalStatus } = useConversations();
  const [clickupLinks, setClickupLinks] = useState<Record<string, ClickUpLink>>({});
  const [latestUpdate, setLatestUpdate] = useState<Conversation | null>(null);

  const linkClickup = useCallback((id: string, ticket: string, taskUrl: string) => {
    setClickupLinks((s) => ({ ...s, [id]: { ticket, taskUrl } }));
  }, []);

  useSSE({
    onConversationUpdate: useCallback((conv: Conversation) => {
      upsertConversation(conv);
      setLatestUpdate(conv);
      toast.info("Conversation updated", { duration: 2000 });
    }, [upsertConversation]),
    onNewConversation: useCallback((conv: Conversation) => {
      upsertConversation(conv);
      toast.success(`New conversation from ${conv.customer?.name ?? "customer"}`, { duration: 4000 });
    }, [upsertConversation]),
  });

  return (
    <ConversationsContext.Provider
      value={{ conversations, loading, error, refetch, upsertConversation, setLocalStatus, clickupLinks, linkClickup, latestUpdate }}
    >
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversationsContext() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error("useConversationsContext must be used within ConversationsProvider");
  return ctx;
}
