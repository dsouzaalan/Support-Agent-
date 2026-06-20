"use client";

import { useState, useCallback } from "react";
import { type ConvStatus, type Conversation } from "@/lib/mock-data";
import { useConversations } from "@/hooks/useConversations";
import { useConversation } from "@/hooks/useConversation";
import { useSSE } from "@/hooks/useSSE";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { ConversationList } from "@/components/dashboard/ConversationList";
import { ConversationThread } from "@/components/dashboard/ConversationThread";
import { CustomerPanel } from "@/components/dashboard/CustomerPanel";
import { AgentAnalytics } from "@/components/dashboard/AgentAnalytics";
import { SettingsView, AuditView } from "@/components/dashboard/SettingsView";
import { Toaster } from "@/components/ui/sonner";
import {
  Inbox,
  BarChart3,
  Zap,
  Settings,
  HelpCircle,
  Bell,
  Shield,
  LogOut,
  Loader2,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  ChevronLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Page() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const {
    conversations,
    loading,
    error,
    refetch,
    upsertConversation,
    setLocalStatus,
  } = useConversations();

  const [clickupLinks, setClickupLinks] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"inbox" | "analytics" | "settings" | "audit">("inbox");
  const [mobilePanel, setMobilePanel] = useState<"list" | "thread">("list");

  // Keep selected ID valid as conversations load
  const effectiveSelectedId =
    selectedId && conversations.some((c) => c.id === selectedId)
      ? selectedId
      : conversations[0]?.id ?? null;

  // Fetch full conversation detail (includes complete message history)
  const {
    conversation: fullConversation,
    loading: convLoading,
  } = useConversation(effectiveSelectedId);

  // Use full detail if available, fall back to list-level data for the panel
  const listSelected = conversations.find((c) => c.id === effectiveSelectedId) ?? null;
  const selected = fullConversation ?? listSelected;

  // Real-time updates from backend SSE
  useSSE({
    onConversationUpdate: useCallback(
      (conv: Conversation) => {
        upsertConversation(conv);
        toast.info(`Conversation updated`, { duration: 2000 });
      },
      [upsertConversation]
    ),
    onNewConversation: useCallback(
      (conv: Conversation) => {
        upsertConversation(conv);
        toast.success(`New conversation from ${conv.customer?.name ?? "customer"}`, {
          duration: 4000,
        });
      },
      [upsertConversation]
    ),
  });

  const openFromAlert = (id: string) => {
    setSelectedId(id);
    setView("inbox");
  };

  const handleStatusChange = async (status: ConvStatus) => {
    if (!effectiveSelectedId) return;
    setLocalStatus(effectiveSelectedId, status);
    try {
      await api.conversations.updateStatus(effectiveSelectedId, status);
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
      refetch();
    }
  };

  const linkClickup = (id: string, ticket: string) =>
    setClickupLinks((s) => ({ ...s, [id]: ticket }));

  const agentName = user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Agent";
  const agentInitials = user
    ? (user.firstName[0] + (user.lastName?.[0] ?? "")).toUpperCase()
    : "AG";

  const handleSignOut = () => {
    logout();
    router.push("/auth");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Toaster position="bottom-right" />

      {/* Slim app rail */}
      <nav className="flex h-full w-12 shrink-0 flex-col items-center border-r border-border bg-sidebar-bg py-3 text-sidebar-bg-foreground md:w-14">
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" />
        </div>
        <RailBtn
          active={view === "inbox"}
          onClick={() => setView("inbox")}
          icon={<Inbox className="h-4 w-4" />}
          label="Inbox"
        />
        <RailBtn
          active={view === "analytics"}
          onClick={() => setView("analytics")}
          icon={<BarChart3 className="h-4 w-4" />}
          label="Analytics"
        />
        <RailBtn
          active={view === "settings"}
          onClick={() => setView("settings")}
          icon={<Bell className="h-4 w-4" />}
          label="Alerts"
        />
        <RailBtn
          active={view === "audit"}
          onClick={() => setView("audit")}
          icon={<Shield className="h-4 w-4" />}
          label="Audit"
        />
        <div className="mt-auto flex flex-col gap-1">
          <RailBtn icon={<HelpCircle className="h-4 w-4" />} label="Help" />
          <RailBtn icon={<Settings className="h-4 w-4" />} label="Settings" />
          <RailBtn
            icon={<LogOut className="h-4 w-4" />}
            label="Sign Out"
            onClick={handleSignOut}
          />
        </div>
      </nav>

      {view === "inbox" && (
        <div className="grid h-full min-w-0 flex-1 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)_340px]">
          {loading ? (
            <div className="col-span-full flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading conversations…</span>
            </div>
          ) : error ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm">{error}</p>
              <button
                onClick={refetch}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="col-span-full flex items-center justify-center text-muted-foreground text-sm">
              No conversations found.
            </div>
          ) : (
            <>
              {/* Conversation list — hidden on mobile when thread is open */}
              <div className={cn("h-full overflow-hidden", mobilePanel === "thread" ? "hidden md:block" : "block")}>
                <ConversationList
                  conversations={conversations}
                  selectedId={effectiveSelectedId ?? ""}
                  onSelect={(id) => { setSelectedId(id); setMobilePanel("thread"); }}
                  agentName={agentName}
                  agentInitials={agentInitials}
                  clickupLinks={clickupLinks}
                />
              </div>

              {/* Thread area — hidden on mobile when list is shown */}
              <div className={cn("flex h-full min-w-0 flex-col overflow-hidden", mobilePanel === "list" ? "hidden md:flex" : "flex")}>
                {/* Mobile back button */}
                <button
                  onClick={() => setMobilePanel("list")}
                  className="md:hidden flex shrink-0 items-center gap-1.5 border-b border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Conversations
                </button>

                {convLoading && !selected ? (
                  <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
                  </div>
                ) : selected ? (
                  <ConversationThread
                    conversation={selected}
                    clickupTicket={clickupLinks[selected.id]}
                    onLinkClickup={(t) => linkClickup(selected.id, t)}
                    onStatusChange={handleStatusChange}
                  />
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
                    <MessageSquare className="h-6 w-6 opacity-30" />
                    Select a conversation
                  </div>
                )}
              </div>

              {/* Customer panel — desktop only */}
              {selected && (
                <div className="hidden lg:flex h-full flex-col overflow-hidden">
                  <CustomerPanel
                    customer={selected.customer}
                    clickupTicket={clickupLinks[selected.id]}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === "analytics" && <AgentAnalytics />}
      {view === "settings" && <SettingsView onOpenConversation={openFromAlert} />}
      {view === "audit" && <AuditView />}
    </div>
  );
}

function RailBtn({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "relative mb-1 flex h-8 w-8 items-center justify-center rounded-lg transition md:h-9 md:w-9",
        active
          ? "bg-white/15 text-white"
          : "text-sidebar-bg-foreground/60 hover:bg-white/10 hover:text-white"
      )}
    >
      {icon}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
