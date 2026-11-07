import type { Metadata } from "next";

import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const metadata: Metadata = {
  title: "Coding Assistant",
  description: "A focused Nexa AI workspace for implementation, debugging and code review.",
};

export default function CodePage() {
  return <ChatWorkspace mode="code" />;
}
