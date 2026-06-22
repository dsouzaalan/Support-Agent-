"use client";

import { useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConversation } from "@/hooks/useConversation";
import { useConversationsContext } from "@/contexts/ConversationsContext";
import { ConversationThread } from "@/components/dashboard/ConversationThread";
import { api } from "@/lib/api";
import type { ConvStatus } from "@/lib/mock-data";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { conversations, setLocalStatus, refetch: refetchList, clickupLinks, linkClickup, latestUpdate } = useConversationsContext();

  const {
    conversation: fullConversation,
    loading: convLoading,
    update: updateFullConversation,
    refetch: refetchFull,
  } = useConversation(id);

  // When SSE fires an update for this conversation, sync the full detail view
  useEffect(() => {
    if (latestUpdate?.id === id) {
      updateFullConversation(latestUpdate);
      refetchFull();
    }
  }, [latestUpdate]);

  const listConversation = conversations.find((c) => c.id === id) ?? null;
  const conversation = fullConversation ?? listConversation;

  const handleStatusChange = useCallback(async (status: ConvStatus) => {
    if (status === "closed") {
      const next = conversations.find((c) => c.id !== id && c.status !== "closed");
      if (next) router.push(`/inbox/${next.id}`);
      else router.push("/inbox");
    }
    setLocalStatus(id, status);
    try {
      await api.conversations.updateStatus(id, status);
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
      refetchList();
    }
  }, [id, conversations, setLocalStatus, refetchList, router]);

  if (convLoading && !conversation) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        Conversation not found.
      </div>
    );
  }

  return (
    <ConversationThread
      conversation={conversation}
      clickupTicket={clickupLinks[id]?.ticket}
      clickupTaskUrl={clickupLinks[id]?.taskUrl}
      onLinkClickup={(ticket, taskUrl) => linkClickup(id, ticket, taskUrl)}
      onStatusChange={handleStatusChange}
    />
  );
}
