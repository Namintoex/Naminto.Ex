"use client";

import { LogOut, Shield, Settings as SettingsIcon, ArrowLeftRight, UserCircle } from "lucide-react";
import Link from "next/link";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";

export function ProfileMenu({ variant }: { variant: "user" | "admin" }) {
  const { t } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 px-2"
          aria-label={t("profile.viewProfile")}
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
            NX
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <UserCircle className="size-8 text-text-secondary" aria-hidden />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-primary">
              {t("profile.guest")}
            </span>
          </div>
        </div>
        <DropdownMenuSeparator />
        {variant === "user" && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/security">
                <Shield className="size-4" aria-hidden />
                {t("profile.security")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <SettingsIcon className="size-4" aria-hidden />
                {t("profile.settings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href={variant === "user" ? "/admin" : "/"}>
            <ArrowLeftRight className="size-4" aria-hidden />
            {variant === "user" ? t("profile.goToBackOffice") : t("profile.backToApp")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger" disabled>
          <LogOut className="size-4" aria-hidden />
          {t("profile.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
