"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { Conversation, ConvStatus } from "@/lib/mock-data";

const PER_PAGE = 150;

interface UseConversationsReturn {
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
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      pageRef.current = 1;
      const res = await api.conversations.list({ perPage: PER_PAGE, page: 1, status: 'all' });
      if (!mounted.current) return;
      const fetched: Conversation[] = res?.data?.conversations ?? [];
      setConversations(fetched);
      setHasMore(fetched.length === PER_PAGE);
    } catch (err: any) {
      if (mounted.current) setError(err.message || "Failed to load conversations");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const fetchNextPage = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = pageRef.current + 1;
      const res = await api.conversations.list({ perPage: PER_PAGE, page: nextPage, status: 'all' });
      if (!mounted.current) return;
      const fetched: Conversation[] = res?.data?.conversations ?? [];
      setConversations((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const fresh = fetched.filter((c) => !existingIds.has(c.id));
        return [...prev, ...fresh];
      });
      pageRef.current = nextPage;
      setHasMore(fetched.length === PER_PAGE);
    } catch (err: any) {
      // silently fail — existing conversations stay visible
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

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

  const patchConversation = useCallback((id: string, patch: Partial<Conversation>) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  }, []);

  return { conversations, loading, loadingMore, hasMore, error, refetch: fetchAll, fetchNextPage, upsertConversation, setLocalStatus, patchConversation };
}
