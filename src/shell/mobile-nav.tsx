"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { cn } from "@/design-system/lib/cn";
import type { NavItem } from "./nav-config";

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  const primaryItems = items.filter((item) => item.primary).slice(0, 4);

  return (
    <nav
      aria-label="Navigation mobile"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border-default bg-surface-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {primaryItems.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors active:scale-95",
              active ? "text-brand" : "text-text-secondary"
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="max-w-full truncate whitespace-nowrap px-0.5">
              {t(item.mobileLabelKey ?? item.labelKey)}
            </span>
          </Link>
        );
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-text-secondary"
            aria-label={t("shell.openMenu")}
          >
            <Menu className="size-5" aria-hidden />
            {t("shell.more")}
          </button>
        </SheetTrigger>
        <SheetContent side="left" title={title}>
          <div className="flex flex-col gap-1">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
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
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
