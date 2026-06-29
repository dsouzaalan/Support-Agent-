"use client";

import { useEffect, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useConversation } from "@/hooks/useConversation";
import { useConversationsContext } from "@/contexts/ConversationsContext";
import { ConversationThread } from "@/components/dashboard/ConversationThread";
import { api } from "@/lib/api";
import type { ConvStatus } from "@/lib/mock-data";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function ConversationPageContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightMessageId = searchParams.get("msg") ?? undefined;
  const searchQuery = searchParams.get("q") ?? undefined;
  const { conversations, setLocalStatus, patchConversation, refetch: refetchList, clickupLinks, linkClickup, latestUpdate } = useConversationsContext();

  const {
    conversation: fullConversation,
    loading: convLoading,
    update: updateFullConversation,
    refetch: refetchFull,
  } = useConversation(id);

  // When SSE fires an update for this conversation, sync or navigate away if closed
  useEffect(() => {
    if (latestUpdate?.id !== id) return;
    if (latestUpdate.status === "closed") {
      // Someone closed this conversation externally (e.g. from Intercom)
      const next = conversations.find((c) => c.id !== id && c.status !== "closed");
      toast.info("This conversation was closed");
      if (next) router.push(`/inbox/${next.id}`);
      else router.push("/inbox");
      return;
    }
    updateFullConversation(latestUpdate);
    refetchFull();
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

  const handleSnooze = useCallback(async (snoozedUntil: number) => {
    const next = conversations.find((c) => c.id !== id && c.status === "open");
    patchConversation(id, { status: "pending", snoozedUntil });
    try {
      await api.conversations.snooze(id, snoozedUntil);
      toast.success("Conversation snoozed");
      if (next) router.push(`/inbox/${next.id}`);
      else router.push("/inbox");
    } catch (err: any) {
      toast.error(`Failed to snooze: ${err.message}`);
      patchConversation(id, { status: "open", snoozedUntil: null });
    }
  }, [id, conversations, patchConversation, router]);

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
      onTagsChange={(tags) => patchConversation(id, { tags })}
      onSnooze={handleSnooze}
      onPriorityChange={(level) => {
        const TIER_SCORE: Record<string, number> = { Platinum: 40, Gold: 30, Silver: 20, New: 10 };
        let score = TIER_SCORE[conversation.customer?.tier ?? 'New'] ?? 10;
        if (conversation.sla?.firstReplyBreached || conversation.sla?.nextReplyBreached) score += 30;
        if ((conversation.waitMinutes ?? 0) > 0 && (conversation.slaMinutes ?? 0) > 0 && conversation.waitMinutes / conversation.slaMinutes >= 1) score += 20;
        if (conversation.firstResponsePending) score += 10;
        if (level === 'high' || level === 'urgent') score = Math.max(score, 90);
        else if (level === 'medium') score = Math.max(score, 60);
        else if (level === 'low') score = Math.max(score, 30);
        patchConversation(id, {
          priorityLevel: level,
          isHighPriority: level === 'high' || level === 'urgent',
          priorityScore: Math.min(score, 100),
        });
      }}
      highlightMessageId={highlightMessageId}
      searchQuery={searchQuery}
    />
  );
}

export default function ConversationPage() {
  return (
    <Suspense>
      <ConversationPageContent />
    </Suspense>
  );
}
