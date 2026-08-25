"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "./button";

const noopSubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle({
  lightLabel = "Clair",
  darkLabel = "Sombre",
}: {
  lightLabel?: string;
  darkLabel?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return <Button variant="secondary" size="sm" disabled aria-hidden className="w-9 sm:w-28" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="secondary"
      size="sm"
      className="px-2 sm:px-4"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? lightLabel : darkLabel}
    >
      {isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      <span className="hidden sm:inline">{isDark ? lightLabel : darkLabel}</span>
    </Button>
  );
}
