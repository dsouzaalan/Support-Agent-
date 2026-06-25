"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ConversationsProvider, useConversationsContext } from "@/contexts/ConversationsContext";
import { ConversationList } from "@/components/dashboard/ConversationList";
import { CustomerPanel } from "@/components/dashboard/CustomerPanel";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, RefreshCw, ChevronLeft, UserCircle2, Mail, Building2 } from "lucide-react";

function InboxContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { conversations, loading, loadingMore, hasMore, error, refetch, fetchNextPage, clickupLinks, composingContact } = useConversationsContext();

  const segments = pathname.split("/").filter(Boolean);
  const selectedId = segments[0] === "inbox" && segments.length > 1 ? segments[1] : "";
  const isThreadOpen = selectedId !== "";

  const agentName = user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Agent";
  const agentInitials = user ? (user.firstName[0] + (user.lastName?.[0] ?? "")).toUpperCase() : "AG";
  const clickupTicketMap = Object.fromEntries(Object.entries(clickupLinks).map(([id, v]) => [id, v.ticket]));
  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;

  // Auto-select first open conversation on initial load (Intercom-style)
  useEffect(() => {
    if (!loading && !error && conversations.length > 0 && !isThreadOpen) {
      const defaultConv =
        conversations.find((c) => c.status === "open") ??
        conversations.find((c) => c.status === "pending") ??
        conversations[0];
      router.replace(`/inbox/${defaultConv.id}`);
    }
  }, [loading, error, conversations.length, isThreadOpen]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading conversations…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm">{error}</p>
        <button onClick={refetch} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        No conversations found.
      </div>
    );
  }

  return (
    <div className="grid h-full min-w-0 flex-1 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)_340px]">
      {/* Column 1: Conversation list — hidden on mobile when thread is open */}
      <div className={cn("h-full overflow-hidden", isThreadOpen ? "hidden md:block" : "block")}>
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={(id) => router.push(`/inbox/${id}`)}
          agentName={agentName}
          agentInitials={agentInitials}
          clickupLinks={clickupTicketMap}
          onLoadMore={fetchNextPage}
          loadingMore={loadingMore}
          hasMore={hasMore}
        />
      </div>

      {/* Column 2: Thread area — hidden on mobile when list is shown */}
      <div className={cn("flex h-full min-w-0 flex-col overflow-hidden", !isThreadOpen ? "hidden md:flex" : "flex")}>
        {isThreadOpen && (
          <button
            onClick={() => router.push("/inbox")}
            className="md:hidden flex shrink-0 items-center gap-1.5 border-b border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Conversations
          </button>
        )}
        {children}
      </div>

      {/* Column 3: Customer panel (conversation) or contact preview (new composer) */}
      {selectedConversation ? (
        <div className="hidden lg:flex h-full flex-col overflow-hidden">
          <CustomerPanel
            customer={selectedConversation.customer}
            clickupTicket={clickupLinks[selectedId]?.ticket}
            conversationTags={selectedConversation.tags}
          />
        </div>
      ) : selectedId === "new" ? (
        <div className="hidden lg:flex h-full flex-col overflow-hidden border-l border-border bg-card">
          {composingContact ? (
            /* Contact preview once user picks a recipient */
            <div className="flex flex-col gap-0 overflow-y-auto">
              {/* Header */}
              <div className="flex shrink-0 flex-col items-center gap-3 border-b border-border px-5 py-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                  {(composingContact.name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">{composingContact.name}</p>
                  {composingContact.company && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{composingContact.company}</p>
                  )}
                </div>
              </div>
              {/* Details */}
              <div className="flex flex-col gap-px px-5 py-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">Contact details</p>
                {composingContact.email && (
                  <div className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground/80 hover:bg-muted">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{composingContact.email}</span>
                  </div>
                )}
                {composingContact.company && (
                  <div className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground/80 hover:bg-muted">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{composingContact.company}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Empty state before contact is selected */
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
              <UserCircle2 className="h-10 w-10 opacity-20" />
              <p className="text-sm leading-relaxed">Search for a contact in the <strong className="font-medium text-foreground/60">To</strong> field to see their details here</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConversationsProvider>
      <InboxContent>{children}</InboxContent>
    </ConversationsProvider>
  );
}
