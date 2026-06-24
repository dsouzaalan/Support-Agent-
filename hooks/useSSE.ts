"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { Conversation } from "@/lib/mock-data";

interface SSEHandlers {
  onConversationUpdate?: (conversation: Conversation) => void;
  onNewConversation?: (conversation: Conversation) => void;
  onPermissionsUpdated?: (authToken: string) => void;
  onAuditLogNew?: (log: any) => void;
  onAgentUpdated?: (agent: { id: string; firstName: string; lastName: string | null; email: string; role: string; status: string }) => void;
}

export function useSSE(handlers: SSEHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const url = api.sseUrl();
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

      es.addEventListener("audit_log:new", (e: MessageEvent) => {
        try {
          const { log } = JSON.parse(e.data);
          handlersRef.current.onAuditLogNew?.(log);
        } catch {}
      });

      es.addEventListener("agent:updated", (e: MessageEvent) => {
        try {
          const agent = JSON.parse(e.data);
          handlersRef.current.onAgentUpdated?.(agent);
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
