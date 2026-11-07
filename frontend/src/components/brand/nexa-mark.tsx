import { cn } from "@/lib/utils";

/**
 * Nexa AI brand mark: an original warm-blue-to-violet monogram shaped like a gateway.
 * The gradient id is namespaced so several marks can share a document.
 */
export function NexaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Nexa AI"
      className={cn("size-8 shrink-0", className)}
    >
      <defs>
        <linearGradient id="nexa-mark-gradient" x1="2" y1="2" x2="30" y2="30">
          <stop offset="0%" stopColor="oklch(0.66 0.18 248)" />
          <stop offset="52%" stopColor="oklch(0.56 0.22 277)" />
          <stop offset="100%" stopColor="oklch(0.58 0.24 300)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#nexa-mark-gradient)" />
      <path
        d="M9.6 22.4V9.6h3.1l6.6 8.2V9.6h3.1v12.8h-3.1l-6.6-8.2v8.2H9.6Z"
        fill="white"
        fillOpacity="0.98"
      />
      <path
        d="M9.6 22.4h12.8"
        stroke="white"
        strokeOpacity="0.35"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NexaWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <NexaMark />
      <span className="text-[0.95rem] font-semibold tracking-tight text-foreground">
        Nexa <span className="text-muted-foreground">AI</span>
      </span>
    </span>
  );
}
