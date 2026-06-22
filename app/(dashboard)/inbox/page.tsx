import { MessageSquare } from "lucide-react";

export default function InboxPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
      <MessageSquare className="h-6 w-6 opacity-30" />
      Select a conversation
    </div>
  );
}
