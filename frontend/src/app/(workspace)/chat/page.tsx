import type { Metadata } from "next";

import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const metadata: Metadata = {
  title: "AI Chat",
  description: "Ask Nexa AI, attach documents, and keep a searchable conversation history.",
};

export default function ChatPage() {
  return <ChatWorkspace mode="chat" />;
}
