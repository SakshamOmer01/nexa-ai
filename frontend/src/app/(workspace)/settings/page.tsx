import type { Metadata } from "next";

import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = {
  title: "Settings",
  description: "Appearance, chat defaults, AI provider status and workspace data controls.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
