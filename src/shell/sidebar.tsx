"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/design-system/lib/cn";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { NavItem } from "./nav-config";

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ items, className }: { items: NavItem[]; className?: string }) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav
      aria-label="Navigation principale"
      className={cn(
        "hidden w-60 shrink-0 flex-col gap-1 border-r border-border-default bg-surface-raised p-3 lg:flex",
        className
      )}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand/10 text-brand"
                : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
