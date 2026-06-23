"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import type { Conversation } from "@/lib/mock-data";
import { useConversationsContext } from "@/contexts/ConversationsContext";

interface UseConversationReturn {
  conversation: Conversation | null;
  loading: boolean;
  error: string | null;
  update: (c: Conversation) => void;
  refetch: () => void;
}

export function useConversation(id: string | null): UseConversationReturn {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const mounted = useRef(true);
  const { upsertConversation } = useConversationsContext();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!id) {
      setConversation(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api.conversations.get(id)
      .then((res) => {
        if (!cancelled && mounted.current) {
          const full = res?.data ?? null;
          setConversation(full);
          // Push rich data (notes, pastConversations) back into the shared list
          // so the layout's CustomerPanel receives the full customer object
          if (full) upsertConversation(full);
        }
      })
      .catch((err: any) => {
        if (!cancelled && mounted.current) {
          setError(err.message || "Failed to load conversation");
        }
      })
      .finally(() => {
        if (!cancelled && mounted.current) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, version]);

  const update = useCallback((c: Conversation) => {
    if (mounted.current) setConversation(c);
  }, []);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  return { conversation, loading, error, update, refetch };
}
