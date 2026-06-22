"use client";

import { useRouter } from "next/navigation";
import { SettingsView } from "@/components/dashboard/SettingsView";

export default function SettingsPage() {
  const router = useRouter();
  return (
    <SettingsView onOpenConversation={(id) => router.push(`/inbox/${id}`)} />
  );
}
