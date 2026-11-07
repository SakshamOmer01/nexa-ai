"use client";

import {
  BarChart3,
  Code2,
  FileText,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { NexaWordmark } from "@/components/brand/nexa-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, Label } from "@/components/ui/input";
import { accountNav, siteConfig, workspaceNav } from "@/config/site";
import { useWorkspace } from "@/lib/workspace/provider";
import {
  displayName,
  formatDay,
  formatMessageTime,
  HISTORY_GROUP_ORDER,
  historyGroup,
  initials,
  type HistoryGroup,
} from "@/lib/workspace/format";
import type { Conversation } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  chat: MessageSquare,
  code: Code2,
  documents: FileText,
  analytics: BarChart3,
  overview: LayoutDashboard,
  settings: Settings,
  profile: UserRound,
};

function matchesQuery(conversation: Conversation, query: string): boolean {
  if (!query) {
    return true;
  }
  const needle = query.toLowerCase();
  return (
    conversation.title.toLowerCase().includes(needle) ||
    conversation.messages.some((message) => message.content.toLowerCase().includes(needle))
  );
}

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    conversations,
    activeId,
    ready,
    selectConversation,
    renameConversation,
    deleteConversation,
    pending,
  } = useWorkspace();

  const [query, setQuery] = useState("");
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);

  const filtered = useMemo(
    () => conversations.filter((conversation) => matchesQuery(conversation, query.trim())),
    [conversations, query],
  );

  const groups = useMemo(() => {
    const buckets = new Map<HistoryGroup, Conversation[]>();
    for (const conversation of filtered) {
      const group = historyGroup(conversation.updatedAt);
      const list = buckets.get(group) ?? [];
      list.push(conversation);
      buckets.set(group, list);
    }
    return HISTORY_GROUP_ORDER.filter((group) => (buckets.get(group)?.length ?? 0) > 0).map(
      (group) => ({ group, items: buckets.get(group) ?? [] }),
    );
  }, [filtered]);

  function openConversation(conversation: Conversation) {
    selectConversation(conversation.id);
    router.push(conversation.mode === "code" ? "/code" : "/chat");
    onNavigate?.();
  }

  function startNewChat() {
    selectConversation(null);
    router.push("/chat");
    onNavigate?.();
  }

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (renameTarget) {
      renameConversation(renameTarget.id, renameValue);
    }
    setRenameTarget(null);
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-4">
        <Link
          href="/"
          aria-label={`${siteConfig.name} home`}
          className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          onClick={onNavigate}
        >
          <NexaWordmark />
        </Link>
        <ThemeToggle />
      </div>

      <div className="space-y-2.5 p-3">
        <Button onClick={startNewChat} className="h-9 w-full justify-start rounded-lg shadow-xs">
          <Plus aria-hidden />
          New chat
        </Button>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-8 bg-background/70 pl-8 text-xs"
          />
        </div>
      </div>

      <nav aria-label="History" className="nexa-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!ready ? (
          <div className="space-y-2 p-2" aria-busy="true" aria-live="polite">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-8 animate-pulse rounded-md bg-sidebar-accent/70" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
            {query
              ? "No conversations match that search."
              : "Your conversations will appear here after your first message."}
          </p>
        ) : (
          groups.map(({ group, items }) => (
            <section key={group} className="mb-3">
              <h2 className="px-2.5 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {group}
              </h2>
              <ul className="space-y-0.5">
                {items.map((conversation) => {
                  const active = conversation.id === activeId;
                  const generating = pending?.conversationId === conversation.id;
                  return (
                    <li key={conversation.id} className="group/item relative flex items-center">
                      <button
                        type="button"
                        onClick={() => openConversation(conversation)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pr-8 pl-2.5 text-left text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        )}
                      >
                        {generating ? (
                          <span
                            className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary"
                            aria-label="Generating"
                          />
                        ) : conversation.mode === "code" ? (
                          <Code2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
                        ) : null}
                        <span className="truncate">{conversation.title}</span>
                        <span className="ml-auto shrink-0 text-[10px] opacity-60">
                          {active ? formatMessageTime(conversation.updatedAt) : formatDay(conversation.updatedAt)}
                        </span>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="absolute right-1 opacity-70 sm:opacity-0 sm:group-hover/item:opacity-100 sm:focus-visible:opacity-100 data-[state=open]:opacity-100"
                            aria-label={`Actions for ${conversation.title}`}
                          >
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setRenameTarget(conversation);
                              setRenameValue(conversation.title);
                            }}
                          >
                            <Pencil aria-hidden />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleteTarget(conversation)}
                          >
                            <Trash2 aria-hidden />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </nav>

      <nav aria-label="Workspace" className="space-y-1 border-t border-sidebar-border p-2">
        {[...workspaceNav, ...accountNav].map((item) => {
          const Icon = ICONS[item.icon] ?? MessageSquare;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-blue/20 to-brand-violet/25 text-[11px] font-semibold text-primary">
            {initials(user.full_name, user.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{displayName(user.full_name, user.email)}</p>
            <p className="truncate text-[10px] text-muted-foreground" title={user.email}>
              {user.email}
            </p>
          </div>
          <ThemeToggle className="hidden sm:inline-flex" />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Link
            href="/profile"
            onClick={onNavigate}
            className="rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            View profile
          </Link>
          <SignOutButton />
        </div>
      </div>

      <Dialog open={renameTarget !== null} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent>
          <form onSubmit={submitRename} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Rename conversation</DialogTitle>
              <DialogDescription>Use a short name you will recognise in the sidebar.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="conversation-title">Title</Label>
              <Input
                id="conversation-title"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                maxLength={80}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim()}>
                Save title
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.title}” and its messages will be removed from this browser. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  deleteConversation(deleteTarget.id);
                }
                setDeleteTarget(null);
              }}
            >
              <Trash2 aria-hidden />
              Delete conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
