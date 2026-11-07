import type { Metadata } from "next";

import { DocumentsView } from "@/components/documents/documents-view";

export const metadata: Metadata = {
  title: "Documents",
  description: "A private, searchable library of the files you use as context with Nexa AI.",
};

export default function DocumentsPage() {
  return <DocumentsView />;
}
