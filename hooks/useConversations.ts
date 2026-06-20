"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { Conversation, ConvStatus } from "@/lib/mock-data";

interface UseConversationsReturn {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upsertConversation: (c: Conversation) => void;
  setLocalStatus: (id: string, status: ConvStatus) => void;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.conversations.list({ perPage: 50 });
      if (mounted.current) {
        setConversations(res?.data?.conversations ?? []);
      }
    } catch (err: any) {
      if (mounted.current) {
        setError(err.message || "Failed to load conversations");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upsertConversation = useCallback((updated: Conversation) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }, []);

  const setLocalStatus = useCallback((id: string, status: ConvStatus) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
  }, []);

  return { conversations, loading, error, refetch: fetchAll, upsertConversation, setLocalStatus };
}
