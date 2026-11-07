import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AnalyticsPage, { metadata as analyticsMeta } from "@/app/(workspace)/analytics/page";
import ChatPage, { metadata as chatMeta } from "@/app/(workspace)/chat/page";
import CodePage, { metadata as codeMeta } from "@/app/(workspace)/code/page";
import DocumentsPage, { metadata as documentsMeta } from "@/app/(workspace)/documents/page";
import ProfilePage, { metadata as profileMeta } from "@/app/(workspace)/profile/page";
import SettingsPage, { metadata as settingsMeta } from "@/app/(workspace)/settings/page";

vi.mock("@/components/chat/chat-workspace", () => ({
  ChatWorkspace: ({ mode }: { mode: string }) => <div data-testid="chat-workspace">{mode}</div>,
}));
vi.mock("@/components/documents/documents-view", () => ({
  DocumentsView: () => <div data-testid="documents-view" />,
}));
vi.mock("@/components/analytics/analytics-view", () => ({
  AnalyticsView: () => <div data-testid="analytics-view" />,
}));
vi.mock("@/components/settings/settings-view", () => ({
  SettingsView: () => <div data-testid="settings-view" />,
}));
vi.mock("@/components/profile/profile-view", () => ({
  ProfileView: () => <div data-testid="profile-view" />,
}));

describe("workspace route pages", () => {
  it("wires the chat and coding surfaces to the shared workspace", () => {
    const { rerender } = render(<ChatPage />);
    expect(screen.getByTestId("chat-workspace")).toHaveTextContent("chat");

    rerender(<CodePage />);
    expect(screen.getByTestId("chat-workspace")).toHaveTextContent("code");

    expect(chatMeta.title).toBe("AI Chat");
    expect(codeMeta.title).toBe("Coding Assistant");
  });

  it("renders every supporting page", () => {
    render(
      <>
        <DocumentsPage />
        <AnalyticsPage />
        <SettingsPage />
        <ProfilePage />
      </>,
    );

    expect(screen.getByTestId("documents-view")).toBeInTheDocument();
    expect(screen.getByTestId("analytics-view")).toBeInTheDocument();
    expect(screen.getByTestId("settings-view")).toBeInTheDocument();
    expect(screen.getByTestId("profile-view")).toBeInTheDocument();
  });

  it("publishes metadata for each route", () => {
    expect(documentsMeta.title).toBe("Documents");
    expect(analyticsMeta.title).toBe("Data Analytics");
    expect(settingsMeta.title).toBe("Settings");
    expect(profileMeta.title).toBe("Profile");
    for (const meta of [chatMeta, codeMeta, documentsMeta, analyticsMeta, settingsMeta, profileMeta]) {
      expect(String(meta.description).length).toBeGreaterThan(10);
    }
  });
});
