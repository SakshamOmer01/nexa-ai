"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** Show the current mode as text next to the icon. */
  withLabel?: boolean;
}

export function ThemeToggle({ className, withLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size={withLabel ? "sm" : "icon-sm"}
      onClick={toggleTheme}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
      {withLabel ? <span>Switch to {next} mode</span> : null}
    </Button>
  );
}
