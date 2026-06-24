"use client";

import { AgentAnalytics } from "@/components/dashboard/AgentAnalytics";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";

export default function AnalyticsPage() {
  const { isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <AgentAnalytics />;
}
