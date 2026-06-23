"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { Conversation } from "@/lib/mock-data";

interface SSEHandlers {
  onConversationUpdate?: (conversation: Conversation) => void;
  onNewConversation?: (conversation: Conversation) => void;
  onPermissionsUpdated?: (authToken: string) => void;
}

export function useSSE(handlers: SSEHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = api.sseUrl();
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource(url);

      es.addEventListener("conversation:update", (e: MessageEvent) => {
        try {
          const { conversation } = JSON.parse(e.data);
          handlersRef.current.onConversationUpdate?.(conversation);
        } catch {}
      });

      es.addEventListener("conversation:new", (e: MessageEvent) => {
        try {
          const { conversation } = JSON.parse(e.data);
          handlersRef.current.onNewConversation?.(conversation);
        } catch {}
      });

      es.addEventListener("permissions_updated", (e: MessageEvent) => {
        try {
          const { authToken } = JSON.parse(e.data) as { authToken: string };
          handlersRef.current.onPermissionsUpdated?.(authToken);
        } catch {}
      });

      es.onerror = () => {
        es.close();
        // Exponential backoff reconnect (max 30s)
        reconnectTimer = setTimeout(connect, Math.min(30_000, 5_000));
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      es?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
