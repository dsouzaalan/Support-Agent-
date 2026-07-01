"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { Inbox, BarChart3, Zap, Settings, HelpCircle, Shield, LogOut, X, Keyboard, Users } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { can, isAdmin } = usePermissions();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleSignOut = () => {
    logout();
    router.push("/auth");
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // ? — toggle shortcuts help (works everywhere)
      if (e.key === "?" && !inInput) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setShowShortcuts(false);
        return;
      }

      // Cmd/Ctrl + number — switch views
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        switch (e.key) {
          case "1": e.preventDefault(); router.push("/inbox"); break;
          case "2": e.preventDefault(); router.push("/analytics"); break;
          case "3": e.preventDefault(); router.push("/team"); break;
          case "4": e.preventDefault(); router.push("/audit"); break;
          case "5": e.preventDefault(); router.push("/settings"); break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Toaster position="bottom-right" />

      <nav className="flex h-full w-12 shrink-0 flex-col items-center border-r border-border bg-sidebar-bg py-3 text-sidebar-bg-foreground md:w-14">
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" />
        </div>
        <RailBtn active={pathname.startsWith("/inbox")} onClick={() => router.push("/inbox")} icon={<Inbox className="h-4 w-4" />} label="Inbox [⌘1]" />
        <RailBtn active={pathname.startsWith("/analytics")} onClick={() => router.push("/analytics")} icon={<BarChart3 className="h-4 w-4" />} label="Analytics [⌘2]" />
        {can("agents:view") && (
          <RailBtn active={pathname.startsWith("/team")} onClick={() => router.push("/team")} icon={<Users className="h-4 w-4" />} label="Team [⌘3]" />
        )}
        {can("audit_logs:view") && (
          <RailBtn active={pathname.startsWith("/audit")} onClick={() => router.push("/audit")} icon={<Shield className="h-4 w-4" />} label="Audit [⌘4]" />
        )}
        <div className="mt-auto flex flex-col gap-1">
          <RailBtn icon={<Keyboard className="h-4 w-4" />} label="Keyboard shortcuts [?]" onClick={() => setShowShortcuts(true)} />
          <RailBtn icon={<HelpCircle className="h-4 w-4" />} label="Help" />
          {(can("alerts:view") || can("macros:manage") || can("articles:manage") || isAdmin) && (
            <RailBtn active={pathname.startsWith("/settings")} onClick={() => router.push("/settings")} icon={<Settings className="h-4 w-4" />} label="Settings [⌘5]" />
          )}
          <RailBtn icon={<LogOut className="h-4 w-4" />} label="Sign Out" onClick={handleSignOut} />
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 overflow-hidden">
        {children}
      </div>

      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

function RailBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "relative mb-1 flex h-8 w-8 items-center justify-center rounded-lg transition md:h-9 md:w-9",
        active ? "bg-white/15 text-white" : "text-sidebar-bg-foreground/60 hover:bg-white/10 hover:text-white"
      )}
    >
      {icon}
    </button>
  );
}

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const groups: { title: string; shortcuts: [string, string][] }[] = [
    {
      title: "Navigation",
      shortcuts: [
        ["⌘ 1", "Go to Inbox"],
        ["⌘ 2", "Go to Analytics"],
        ["⌘ 3", "Go to Team"],
        ["⌘ 4", "Go to Audit"],
        ["⌘ 5", "Go to Settings"],
        ["?", "Toggle this help"],
      ],
    },
    {
      title: "Conversation list",
      shortcuts: [
        ["J / ↓", "Next conversation"],
        ["K / ↑", "Previous conversation"],
        ["/", "Focus search"],
        ["1 – 5", "Switch tabs (All / Open / Assigned / Pending / Closed)"],
      ],
    },
    {
      title: "Thread",
      shortcuts: [
        ["R", "Focus reply box"],
        ["A", "AI auto-fill draft"],
        ["T", "Tone check"],
        ["L", "Translate draft"],
        ["M", "Open macros"],
        ["N", "Add internal note"],
        ["C", "Open ClickUp modal"],
        ["E", "Resolve / Reopen"],
        ["Enter", "Send reply"],
        ["Shift + Enter", "New line in reply"],
        ["Esc", "Clear draft / close panel"],
      ],
    },
    {
      title: "Sidebar",
      shortcuts: [
        ["⌘ B", "Toggle sidebar"],
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Keyboard shortcuts</span>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 grid grid-cols-2 gap-6">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</div>
              <div className="space-y-1.5">
                {g.shortcuts.map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{desc}</span>
                    <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
          Shortcuts fire when not typing in an input field. Press <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">Esc</kbd> to close.
        </div>
      </div>
    </div>
  );
}
