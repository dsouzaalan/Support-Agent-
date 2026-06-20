"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { Conversation } from "@/lib/mock-data";

interface UseConversationReturn {
  conversation: Conversation | null;
  loading: boolean;
  error: string | null;
}

export function useConversation(id: string | null): UseConversationReturn {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

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
          setConversation(res?.data ?? null);
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
  }, [id]);

  return { conversation, loading, error };
}
