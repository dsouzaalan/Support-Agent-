"use client";

import { useState } from "react";
import { conversations as rawConversations, slackAlerts, type ConvStatus } from "@/lib/mock-data";
import { ConversationList } from "@/components/dashboard/ConversationList";
import { ConversationThread } from "@/components/dashboard/ConversationThread";
import { CustomerPanel } from "@/components/dashboard/CustomerPanel";
import { AgentAnalytics } from "@/components/dashboard/AgentAnalytics";
import { SettingsView, AuditView } from "@/components/dashboard/SettingsView";
import { Toaster } from "@/components/ui/sonner";
import { Inbox, BarChart3, Zap, Settings, HelpCircle, Bell, Shield, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function Page() {
  const router = useRouter();
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ConvStatus>>({});
  const [clickupLinks, setClickupLinks] = useState<Record<string, string>>({});
  const conversations = rawConversations.map((c) =>
    statusOverrides[c.id] ? { ...c, status: statusOverrides[c.id] } : c,
  );
  const [selectedId, setSelectedId] = useState(conversations[0].id);
  const [view, setView] = useState<"inbox" | "analytics" | "settings" | "audit">("inbox");
  const selected = conversations.find((c) => c.id === selectedId) ?? conversations[0];
  const openFromAlert = (id: string) => { setSelectedId(id); setView("inbox"); };
  const setStatus = (id: string, status: ConvStatus) => setStatusOverrides((s) => ({ ...s, [id]: status }));
  const linkClickup = (id: string, ticket: string) => setClickupLinks((s) => ({ ...s, [id]: ticket }));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Toaster position="bottom-right" />
      {/* Slim app rail */}
      <nav className="flex h-full w-14 shrink-0 flex-col items-center border-r border-border bg-sidebar-bg py-3 text-sidebar-bg-foreground">
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" />
        </div>
        <RailBtn active={view === "inbox"} onClick={() => setView("inbox")} icon={<Inbox className="h-4 w-4" />} label="Inbox" />
        <RailBtn active={view === "analytics"} onClick={() => setView("analytics")} icon={<BarChart3 className="h-4 w-4" />} label="Analytics" />
        <RailBtn active={view === "settings"} onClick={() => setView("settings")} icon={<Bell className="h-4 w-4" />} label="Alerts" badge={slackAlerts.length} />
        <RailBtn active={view === "audit"} onClick={() => setView("audit")} icon={<Shield className="h-4 w-4" />} label="Audit" />
        <div className="mt-auto flex flex-col gap-1">
          <RailBtn icon={<HelpCircle className="h-4 w-4" />} label="Help" />
          <RailBtn icon={<Settings className="h-4 w-4" />} label="Settings" />
          <RailBtn
            icon={<LogOut className="h-4 w-4" />}
            label="Sign Out"
            onClick={() => {
              document.cookie = "auth-session=; path=/; max-age=0";
              router.push("/auth");
            }}
          />
        </div>
      </nav>

      {view === "inbox" && (
        <div className="grid h-full min-w-0 flex-1 grid-cols-[320px_minmax(0,1fr)_360px]">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            agentName="Riley Park"
            agentInitials="RP"
            clickupLinks={clickupLinks}
          />
          <ConversationThread
            conversation={selected}
            clickupTicket={clickupLinks[selected.id]}
            onLinkClickup={(t) => linkClickup(selected.id, t)}
            onStatusChange={(s) => setStatus(selected.id, s)}
          />
          <CustomerPanel
            customer={selected.customer}
            clickupTicket={clickupLinks[selected.id]}
          />
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
        "relative mb-1 flex h-9 w-9 items-center justify-center rounded-lg transition",
        active ? "bg-white/15 text-white" : "text-sidebar-bg-foreground/60 hover:bg-white/10 hover:text-white",
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
