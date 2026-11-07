"use client";

import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Settings2,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ModelSelect } from "@/components/chat/model-select";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PageHeader } from "@/components/workspace/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/lib/hooks/use-theme";
import { useModels } from "@/lib/hooks/use-models";
import { downloadText } from "@/lib/download";
import { displayName } from "@/lib/workspace/format";
import { useWorkspace } from "@/lib/workspace/provider";
import type { ResponseStyle } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const RESPONSE_STYLES: Array<{ value: ResponseStyle; label: string; description: string }> = [
  { value: "concise", label: "Concise", description: "Short, direct answers with no filler." },
  { value: "balanced", label: "Balanced", description: "Clear explanations with examples when useful." },
  { value: "detailed", label: "Detailed", description: "Step-by-step reasoning, edge cases and a summary." },
];

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Palette;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card">
      <div className="flex items-start gap-3 border-b border-border/60 p-4 sm:p-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { user, settings, updateSettings, documents, exportData, clearConversations, clearDocuments } =
    useWorkspace();
  const { state: modelsState, retry: retryModels } = useModels();
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmClearDocuments, setConfirmClearDocuments] = useState(false);

  const catalog = modelsState.phase === "ready" ? modelsState.data : null;
  const models = catalog?.models ?? [];
  const modelValue = settings.defaultModel || catalog?.defaultModel || models[0]?.id || "";

  function exportWorkspace() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`nexa-workspace-${stamp}.json`, exportData());
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        icon={Settings2}
        eyebrow="Preferences"
        title="Settings"
        description="Control how Nexa looks and responds, inspect the AI connection, and manage the data stored in this browser."
        actions={<ThemeToggle withLabel />}
      />

      <div className="mt-6 space-y-4">
        <Section
          icon={Palette}
          title="Appearance"
          description="The choice is stored in this browser and applied before the first paint."
        >
          <div role="group" aria-label="Theme" className="grid gap-2 sm:grid-cols-3">
            {[
              { value: "light" as const, label: "Light", icon: Sun },
              { value: "dark" as const, label: "Dark", icon: Moon },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={theme === option.value}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                  theme === option.value
                    ? "border-primary/50 bg-primary/5 text-foreground"
                    : "border-border/70 text-muted-foreground hover:bg-muted/40",
                )}
              >
                <option.icon className="size-4" aria-hidden />
                {option.label}
                {theme === option.value ? <Check className="ml-auto size-3.5 text-primary" aria-hidden /> : null}
              </button>
            ))}
            <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border/70 p-3 text-[11px] text-muted-foreground">
              <Monitor className="size-4" aria-hidden />
              Follows your device until you choose.
            </div>
          </div>
        </Section>

        <Section
          icon={Settings2}
          title="Chat defaults"
          description="These preferences apply to new messages on this account and device."
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Default model</p>
                <p className="text-[11px] text-muted-foreground">
                  Used for new conversations unless you choose another model in chat.
                </p>
              </div>
              <ModelSelect
                models={models}
                value={modelValue}
                onChange={(model) => updateSettings({ defaultModel: model })}
                disabled={models.length === 0}
                provider={catalog?.provider}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">Response style</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {RESPONSE_STYLES.map((style) => (
                  <label
                    key={style.value}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
                      settings.responseStyle === style.value
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/70 hover:bg-muted/40",
                    )}
                  >
                    <span className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="radio"
                        name="response-style"
                        value={style.value}
                        checked={settings.responseStyle === style.value}
                        onChange={() => updateSettings({ responseStyle: style.value })}
                        className="size-3.5 accent-[var(--primary)]"
                      />
                      {style.label}
                    </span>
                    <span className="pl-5 text-[10px] leading-relaxed text-muted-foreground">
                      {style.description}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
              <div className="space-y-0.5">
                <Label htmlFor="send-on-enter" className="text-xs">
                  Send with Enter
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Off means ⌘/Ctrl + Enter sends, and Enter adds a new line.
                </p>
              </div>
              <Switch
                id="send-on-enter"
                checked={settings.sendOnEnter}
                onCheckedChange={(checked) => updateSettings({ sendOnEnter: checked })}
                aria-label="Send with Enter"
              />
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
              <div className="space-y-0.5">
                <Label htmlFor="show-timestamps" className="text-xs">
                  Show timestamps
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Display the time beside each message.
                </p>
              </div>
              <Switch
                id="show-timestamps"
                checked={settings.showTimestamps}
                onCheckedChange={(checked) => updateSettings({ showTimestamps: checked })}
                aria-label="Show message timestamps"
              />
            </div>
          </div>
        </Section>

        <Section
          icon={KeyRound}
          title="AI provider"
          description="The server proxies every model call; this page only sees the allowlisted catalog."
        >
          {modelsState.phase === "loading" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Checking the model catalog…
            </p>
          ) : modelsState.phase === "error" ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-destructive" role="alert">
              <AlertTriangle className="size-3.5" aria-hidden />
              {modelsState.message}
              <Button variant="outline" size="xs" onClick={retryModels}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge
                  variant="outline"
                  className={
                    catalog?.configured
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      catalog?.configured ? "bg-emerald-500" : "bg-amber-500",
                    )}
                    aria-hidden
                  />
                  {catalog?.configured ? "Connected" : "Not connected"}
                </Badge>
                <span className="text-muted-foreground">
                  {catalog?.configured
                    ? `${catalog.provider} · ${catalog.models.length} models available`
                    : "Set AI_API_KEY on the server to receive real answers."}
                </span>
              </div>
              <dl className="grid gap-2 text-[11px] sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                  <dt className="text-muted-foreground">Default model</dt>
                  <dd className="mt-0.5 font-mono">{catalog?.defaultModel || "Unavailable"}</dd>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                  <dt className="text-muted-foreground">Allowlist</dt>
                  <dd className="mt-0.5 truncate font-mono" title={models.map((model) => model.id).join(", ")}>
                    {models.map((model) => model.id).join(", ") || "None"}
                  </dd>
                </div>
              </dl>
              {!catalog?.configured ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Add <code className="font-mono">AI_API_KEY</code> (and optionally{" "}
                  <code className="font-mono">AI_BASE_URL</code>,{" "}
                  <code className="font-mono">AI_MODELS</code>) to the server environment, then
                  restart. The browser never receives the key.
                </p>
              ) : null}
            </div>
          )}
        </Section>

        <Section
          icon={FileText}
          title="Data & privacy"
          description="Conversations and documents are stored in this browser, scoped to your account."
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Export workspace</p>
                <p className="text-[11px] text-muted-foreground">
                  Download conversations, documents and preferences as one JSON file.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={exportWorkspace}>
                <Download aria-hidden />
                Export JSON
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Clear conversation history</p>
                <p className="text-[11px] text-muted-foreground">
                  Removes every thread from this browser. Documents are kept.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmClearHistory(true)}
                className="text-destructive"
              >
                <Trash2 aria-hidden />
                Clear history
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Delete all documents</p>
                <p className="text-[11px] text-muted-foreground">
                  {documents.length} {documents.length === 1 ? "document" : "documents"} in your
                  library. Messages keep the text they already referenced.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmClearDocuments(true)}
                className="text-destructive"
                disabled={documents.length === 0}
              >
                <Trash2 aria-hidden />
                Delete documents
              </Button>
            </div>
          </div>
        </Section>

        <Section
          icon={UserRound}
          title="Account"
          description="Your profile is served by the API; workspace data never leaves this browser."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-medium">{displayName(user.full_name, user.email)}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/profile">View profile</Link>
              </Button>
              <SignOutButton />
            </div>
          </div>
        </Section>
      </div>

      <Dialog open={confirmClearHistory} onOpenChange={setConfirmClearHistory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear every conversation?</DialogTitle>
            <DialogDescription>
              All threads in this browser will be deleted. This cannot be undone. Export first if
              you want a copy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClearHistory(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearConversations();
                setConfirmClearHistory(false);
              }}
            >
              <Trash2 aria-hidden />
              Clear history
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClearDocuments} onOpenChange={setConfirmClearDocuments}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all documents?</DialogTitle>
            <DialogDescription>
              Every file in your library will be removed from this browser. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClearDocuments(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearDocuments();
                setConfirmClearDocuments(false);
              }}
            >
              <Trash2 aria-hidden />
              Delete documents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
