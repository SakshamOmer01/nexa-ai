"use client";

import {
  ArrowRight,
  Check,
  Copy,
  Download,
  FileText,
  KeyRound,
  Mail,
  MessagesSquare,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageHeader } from "@/components/workspace/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadText } from "@/lib/download";
import { displayName, formatDay, initials } from "@/lib/workspace/format";
import { useWorkspace } from "@/lib/workspace/provider";

export function ProfileView() {
  const router = useRouter();
  const { user, conversations, documents, settings, selectConversation, exportData } = useWorkspace();
  const [copied, setCopied] = useState(false);

  const messageCount = conversations.reduce((total, thread) => total + thread.messages.length, 0);
  const memberSince = formatDay(user.created_at);
  const name = displayName(user.full_name, user.email);
  const recent = conversations.filter((thread) => thread.messages.length > 0).slice(0, 4);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        icon={UserRound}
        eyebrow="Account"
        title="Your profile"
        description="The account behind your session, a summary of the workspace stored in this browser, and the controls that keep both separate."
        actions={
          <Button variant="outline" asChild>
            <Link href="/settings">Open settings</Link>
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-blue/20 to-brand-violet/25 text-lg font-semibold text-primary">
              {initials(user.full_name, user.email)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight">{name}</h2>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Mail className="size-3" aria-hidden />
                {user.email}
              </p>
            </div>
            <Badge
              variant="outline"
              className="ml-auto hidden border-emerald-500/30 bg-emerald-500/10 text-emerald-700 sm:inline-flex dark:text-emerald-300"
            >
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              {user.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>

          <dl className="mt-5 divide-y divide-border/60 text-xs">
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">Full name</dt>
              <dd className="truncate">{user.full_name ?? "Not set"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">Member since</dt>
              <dd>{memberSince}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">Account status</dt>
              <dd>{user.is_active ? "Active" : "Inactive"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <span className="max-w-44 truncate font-mono text-[10px] text-muted-foreground" title={user.id}>
                  {user.id}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={copyId}
                  aria-label="Copy user ID"
                >
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                </Button>
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <SignOutButton />
            <Button variant="outline" size="sm" onClick={() => downloadText(`nexa-profile-${new Date().toISOString().slice(0, 10)}.json`, exportData())}>
              <Download aria-hidden />
              Export my data
            </Button>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MessagesSquare className="size-4 text-primary" aria-hidden />
              Workspace in this browser
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: "Conversations", value: conversations.length },
                { label: "Messages", value: messageCount },
                { label: "Documents", value: documents.length },
                { label: "Default style", value: settings.responseStyle },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                  <dt className="text-[10px] text-muted-foreground">{stat.label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold capitalize tabular-nums">{stat.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              Counts come from local history, not a server-side demo dataset.
            </p>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              Session security
            </h2>
            <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              {[
                "Access and refresh tokens live in httpOnly, SameSite=Lax cookies.",
                "The proxy rotates an expiring access token before the page renders.",
                "Signing out revokes the refresh-token family on the API.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <KeyRound className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="mt-4 rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-primary" aria-hidden />
            Recent conversations
          </h2>
          <Link href="/chat" className="text-[11px] font-medium text-primary hover:underline">
            Open chat
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No conversations yet. Your first thread will appear here.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60">
            {recent.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectConversation(thread.id);
                    router.push(thread.mode === "code" ? "/code" : "/chat");
                  }}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">{thread.title}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {thread.messages.length} messages · {formatDay(thread.updatedAt)}
                    </span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
