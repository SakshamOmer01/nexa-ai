"use client";

import {
  ArrowRight,
  BarChart3,
  FileText,
  MessagesSquare,
  MessageSquareText,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/workspace/page-header";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace/provider";
import { summarizeWorkspace, type AnalyticsRange } from "@/lib/workspace/analytics";
import { formatDay } from "@/lib/workspace/format";
import { cn } from "@/lib/utils";

const RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 0, label: "All time" },
];

const RANGE_LABEL: Record<AnalyticsRange, string> = {
  7: "the last 7 days",
  30: "the last 30 days",
  0: "all time",
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof MessagesSquare;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <Icon className="size-3.5 text-primary" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

export function AnalyticsView() {
  const router = useRouter();
  const { conversations, documents, ready, selectConversation } = useWorkspace();
  const [range, setRange] = useState<AnalyticsRange>(7);

  const summary = useMemo(
    () => summarizeWorkspace(conversations, documents, range),
    [conversations, documents, range],
  );
  const maxDaily = Math.max(1, ...summary.daily.map((day) => day.messages));
  const isEmpty = summary.conversations === 0 && summary.documents === 0;
  const recent = conversations.filter((item) => item.messages.length > 0).slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        icon={BarChart3}
        eyebrow="Insights"
        title="Data analytics"
        description="A measured view of how you use Nexa. Every number is computed from conversations and documents in this browser — there is no demo data to inflate it."
        actions={
          <div
            role="group"
            aria-label="Analytics time range"
            className="flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 p-0.5"
          >
            {RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                aria-pressed={range === option.value}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  range === option.value
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      {!ready ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-live="polite">
          {[0, 1, 2, 3].map((card) => (
            <div key={card} className="h-28 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-sm font-semibold">No activity to measure yet</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Analytics fills in from your real conversations and documents. Start a chat or add a
            document and come back.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button asChild>
              <Link href="/chat">
                Start a chat
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/documents">
                <FileText aria-hidden />
                Add a document
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={MessagesSquare}
              label="Active conversations"
              value={summary.conversations}
              hint={`With messages in ${RANGE_LABEL[range]}`}
            />
            <StatCard
              icon={MessageSquareText}
              label="Messages"
              value={summary.messages}
              hint={`${summary.userMessages} sent · ${summary.assistantMessages} received`}
            />
            <StatCard
              icon={Sparkles}
              label="Average thread"
              value={`${summary.averageMessages}`}
              hint="Messages per active conversation"
            />
            <StatCard
              icon={FileText}
              label="Documents"
              value={summary.documents}
              hint={`${summary.attachments} attached to messages`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">Messages per day</h2>
                <p className="text-[10px] text-muted-foreground">{summary.messages} total in this window</p>
              </div>

              <div className="mt-5 flex h-40 items-end gap-1.5" role="img" aria-label="Bar chart of messages per day">
                {summary.daily.map((day) => (
                  <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
                    <div
                      className={cn(
                        "rounded-t-sm bg-linear-to-t from-brand-blue/70 to-brand-violet/80 transition-all group-hover:from-brand-blue group-hover:to-brand-violet",
                        day.messages === 0 && "bg-muted",
                      )}
                      style={{ height: `${Math.max(3, (day.messages / maxDaily) * 100)}%` }}
                      title={`${day.label}: ${day.messages} messages`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground">
                <span>{summary.daily[0]?.label}</span>
                <span>{summary.daily[summary.daily.length - 1]?.label}</span>
              </div>

              <table className="sr-only">
                <caption>Messages per day</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.daily.map((day) => (
                    <tr key={day.date}>
                      <th scope="row">{day.label}</th>
                      <td>{day.messages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
                <h2 className="text-sm font-semibold">Model usage</h2>
                {summary.modelUsage.length === 0 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Messages attributed to a model will appear here.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {summary.modelUsage.map((slice) => {
                      const max = Math.max(...summary.modelUsage.map((item) => item.value));
                      return (
                        <li key={slice.label} className="space-y-1">
                          <div className="flex items-baseline justify-between gap-2 text-[11px]">
                            <span className="truncate font-mono text-muted-foreground">{slice.label}</span>
                            <span className="tabular-nums">{slice.value}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-linear-to-r from-brand-blue to-brand-violet"
                              style={{ width: `${(slice.value / max) * 100}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
                <h2 className="text-sm font-semibold">Where you work</h2>
                <ul className="mt-2 space-y-1.5">
                  {summary.modeUsage.length === 0 ? (
                    <li className="text-[11px] text-muted-foreground">No conversations yet.</li>
                  ) : (
                    summary.modeUsage.map((slice) => (
                      <li key={slice.label} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{slice.label}</span>
                        <span className="tabular-nums">{slice.value} conversations</span>
                      </li>
                    ))
                  )}
                </ul>
                <p className="mt-3 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                  {summary.words.toLocaleString()} words in this window
                  {summary.longestConversation
                    ? ` · longest thread: “${summary.longestConversation.title}” (${summary.longestConversation.messages})`
                    : ""}
                </p>
              </div>
            </section>
          </div>

          {recent.length > 0 ? (
            <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recent activity</h2>
                <span className="text-[10px] text-muted-foreground">
                  {summary.documents} documents · {summary.words.toLocaleString()} words
                </span>
              </div>
              <ul className="mt-3 divide-y divide-border/60">
                {recent.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => {
                        selectConversation(conversation.id);
                        router.push(conversation.mode === "code" ? "/code" : "/chat");
                      }}
                      className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{conversation.title}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          {conversation.mode === "code" ? "Coding" : "Chat"} ·{" "}
                          {conversation.messages.length} messages · {formatDay(conversation.updatedAt)}
                        </span>
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
