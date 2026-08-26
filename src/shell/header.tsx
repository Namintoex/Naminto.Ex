import Link from "next/link";
import { Badge, LocaleToggle, ThemeToggle } from "@/design-system";
import type { Database } from "@/lib/supabase/database.types";
import { NotificationsMenu } from "./notifications-menu";
import { ProfileMenu } from "./profile-menu";

type NotificationRow = Pick<
  Database["public"]["Tables"]["notifications"]["Row"],
  "id" | "title" | "body" | "read_at" | "created_at"
>;

export function Header({
  homeHref,
  spaceLabel,
  brandName,
  lightLabel,
  darkLabel,
  variant,
  userDisplayName,
  notifications,
}: {
  homeHref: string;
  spaceLabel: string;
  brandName: string;
  lightLabel: string;
  darkLabel: string;
  variant: "user" | "admin";
  userDisplayName?: string | null;
  notifications?: NotificationRow[];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border-default bg-surface-raised px-3 sm:gap-3 sm:px-6">
      <Link href={homeHref} className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-sm font-bold tracking-tight text-text-primary">
          {brandName}
        </span>
        <Badge variant={variant === "admin" ? "info" : "neutral"} className="hidden sm:inline-flex">
          {spaceLabel}
        </Badge>
      </Link>
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <NotificationsMenu notifications={notifications} />
        <LocaleToggle />
        <ThemeToggle lightLabel={lightLabel} darkLabel={darkLabel} />
        <ProfileMenu variant={variant} displayName={userDisplayName} />
      </div>
    </header>
  );
}
