"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

type AuthMode = "login" | "signup";

const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-background/60 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

interface ErrorBody {
  error?: { detail?: string };
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("full_name") ?? "").trim();

    const payload = {
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      ...(mode === "signup" ? { full_name: fullName || null } : {}),
    };

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ErrorBody | null;
        setError(body?.error?.detail ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setPending(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {isSignup ? (
        <div className="space-y-1.5">
          <label htmlFor="full_name" className="text-xs font-medium text-foreground/90">
            Full name <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            maxLength={120}
            className={INPUT_CLASS}
            placeholder="Ada Lovelace"
            disabled={pending}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-medium text-foreground/90">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={320}
          className={INPUT_CLASS}
          placeholder="you@example.com"
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-xs font-medium text-foreground/90">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={isSignup ? 8 : undefined}
          maxLength={128}
          className={INPUT_CLASS}
          placeholder={isSignup ? "At least 8 characters" : "Your password"}
          aria-describedby={isSignup ? "password-hint" : undefined}
          disabled={pending}
        />
        {isSignup ? (
          <p id="password-hint" className="text-[11px] text-muted-foreground">
            8–128 characters. Stored as a salted Argon2id hash.
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" className="h-9 w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {pending ? (isSignup ? "Creating account…" : "Signing in…") : isSignup ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
