"use client";

import { AuditView } from "@/components/dashboard/SettingsView";
import { usePermissions } from "@/hooks/usePermissions";
import { Shield, Loader2 } from "lucide-react";

export default function AuditPage() {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!can("audit_logs:view")) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Shield className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Access restricted</p>
        <p className="text-xs text-muted-foreground">You don&apos;t have permission to view audit logs.</p>
      </div>
    );
  }

  return <AuditView />;
}
