"use client";

import { AuditView } from "@/components/dashboard/SettingsView";
import { usePermissions } from "@/hooks/usePermissions";
import { Shield } from "lucide-react";

export default function AuditPage() {
  const { can } = usePermissions();

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
