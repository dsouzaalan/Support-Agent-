"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useConversations } from "@/hooks/useConversations";
import { useSSE } from "@/hooks/useSSE";
import type { Conversation, ConvStatus } from "@/lib/mock-data";
import { toast } from "sonner";

interface ClickUpLink { ticket: string; taskUrl: string }

export interface ComposingContact {
  id: string;
  name: string;
  email: string;
  company: string;
}

interface ConversationsContextValue {
  conversations: Conversation[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  fetchNextPage: () => Promise<void>;
  upsertConversation: (c: Conversation) => void;
  setLocalStatus: (id: string, status: ConvStatus) => void;
  patchConversation: (id: string, patch: Partial<Conversation>) => void;
  clickupLinks: Record<string, ClickUpLink>;
  linkClickup: (id: string, ticket: string, taskUrl: string) => void;
  latestUpdate: Conversation | null;
  composingContact: ComposingContact | null;
  setComposingContact: (c: ComposingContact | null) => void;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const { conversations, loading, loadingMore, hasMore, error, refetch, fetchNextPage, upsertConversation, setLocalStatus, patchConversation } = useConversations();
  const [clickupLinks, setClickupLinks] = useState<Record<string, ClickUpLink>>({});
  const [latestUpdate, setLatestUpdate] = useState<Conversation | null>(null);
  const [composingContact, setComposingContact] = useState<ComposingContact | null>(null);

  const linkClickup = useCallback((id: string, ticket: string, taskUrl: string) => {
    setClickupLinks((s) => ({ ...s, [id]: { ticket, taskUrl } }));
  }, []);

  useSSE({
    onConversationUpdate: useCallback((conv: Conversation) => {
      upsertConversation(conv);
      setLatestUpdate(conv);
      // Don't toast for closed — the conversation page handles navigation + its own toast
      if (conv.status !== "closed") {
        toast.info("Conversation updated", { duration: 2000 });
      }
    }, [upsertConversation]),
    onNewConversation: useCallback((conv: Conversation) => {
      upsertConversation(conv);
      toast.success(`New conversation from ${conv.customer?.name ?? "customer"}`, { duration: 4000 });
    }, [upsertConversation]),
    onPermissionsUpdated: useCallback(() => {
      // AuthContext updates localStorage synchronously when it handles this same event.
      // Wait one tick so the new token is in place before we refetch with updated permissions.
      setTimeout(() => refetch(), 100);
    }, [refetch]),
  });

  return (
    <ConversationsContext.Provider
      value={{ conversations, loading, loadingMore, hasMore, error, refetch, fetchNextPage, upsertConversation, setLocalStatus, patchConversation, clickupLinks, linkClickup, latestUpdate, composingContact, setComposingContact }}
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
