import type { Metadata } from "next";

import { AnalyticsView } from "@/components/analytics/analytics-view";

export const metadata: Metadata = {
  title: "Data Analytics",
  description: "Measured usage of your Nexa AI workspace: conversations, models and documents.",
};

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
