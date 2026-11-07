"use client";

import { Check, ChevronDown, Cpu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ModelOption {
  id: string;
  name: string;
  description: string;
}

interface ModelSelectProps {
  models: ModelOption[];
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  provider?: string;
  compact?: boolean;
}

export function ModelSelect({
  models,
  value,
  onChange,
  disabled = false,
  provider,
  compact = false,
}: ModelSelectProps) {
  const current = models.find((model) => model.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={disabled || models.length === 0}
          className="max-w-[13rem] justify-between gap-1.5 rounded-full bg-background/80 text-xs font-medium"
          aria-label={`Model: ${current?.name ?? (value || "none configured")}`}
        >
          <Cpu aria-hidden />
          <span className="truncate">{current?.name ?? (value || "No model")}</span>
          <ChevronDown className="size-3 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          {provider ? `Models · ${provider}` : "Models"}
        </DropdownMenuLabel>
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onSelect={() => onChange(model.id)}
            className="items-start"
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
              {model.id === value ? <Check className="size-3.5 text-primary" aria-hidden /> : null}
            </span>
            <span className="min-w-0 space-y-0.5">
              <span className="block text-xs font-medium">{model.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {model.description}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
          Models are allowlisted on the server. Selecting one never exposes a provider key.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
