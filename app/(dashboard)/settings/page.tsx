"use client";

import { useRouter } from "next/navigation";
import { AdminSettingsView } from "@/components/dashboard/AdminSettingsView";

export default function SettingsPage() {
  const router = useRouter();
  return (
    <AdminSettingsView onOpenConversation={(id) => router.push(`/inbox/${id}`)} />
  );
}
