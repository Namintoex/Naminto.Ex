"use client";

import { useActionState } from "react";
import { BadgeCheck, IdCard, Phone } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Switch,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { updatePreferencesAction, type ActionResult } from "@/domains/user/actions";
import type { Database } from "@/lib/supabase/database.types";

type Profile = Pick<
  Database["public"]["Tables"]["identity_profiles"]["Row"],
  | "naminto_id"
  | "legal_name"
  | "phone_number"
  | "phone_verified"
  | "kyc_status"
  | "preferred_language"
  | "preferred_currency"
  | "notifications_enabled"
  | "sound_enabled"
  | "notify_in_app"
  | "notify_push"
  | "notify_sms"
>;

function kycBadgeVariant(status: Profile["kyc_status"]) {
  if (status === "verified") return "success" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "pending" || status === "requires_action") return "warning" as const;
  return "neutral" as const;
}

export function SettingsView({ profile, email }: { profile: Profile; email: string | null }) {
  const { t } = useLocale();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updatePreferencesAction,
    null
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="size-4 text-text-secondary" aria-hidden />
            {t("settings.profile.section")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("auth.namintoId")}</span>
            <span className="font-medium text-text-primary">{profile.naminto_id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("auth.legalName")}</span>
            <span className="font-medium text-text-primary">{profile.legal_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("auth.email")}</span>
            <span className="font-medium text-text-primary">{email ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <Phone className="size-3.5" aria-hidden />
              {t("auth.phoneNumber")}
            </span>
            {profile.phone_number ? (
              <span className="flex items-center gap-2">
                <span className="font-medium text-text-primary">{profile.phone_number}</span>
                <Badge variant={profile.phone_verified ? "success" : "neutral"}>
                  {profile.phone_verified
                    ? t("settings.profile.phoneVerified")
                    : t("settings.profile.phoneUnverified")}
                </Badge>
              </span>
            ) : (
              <span className="text-text-secondary">{t("settings.profile.phoneNone")}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="size-4 text-text-secondary" aria-hidden />
            {t("settings.kyc.section")}
          </CardTitle>
          <Badge variant={kycBadgeVariant(profile.kyc_status)}>
            {t(`settings.kyc.${profile.kyc_status}`)}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary">{t("settings.kyc.threshold")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.preferences.section")}</CardTitle>
        </CardHeader>
        <CardContent>
          {state && "success" in state && (
            <Alert variant="success" className="mb-4">
              {t("settings.success.updated")}
            </Alert>
          )}
          {state && "error" in state && (
            <Alert variant="danger" className="mb-4">
              {t(state.error)}
            </Alert>
          )}
          <form action={formAction} className="flex flex-col gap-5">
            <Select
              name="preferredLanguage"
              label={t("settings.preferences.language")}
              defaultValue={profile.preferred_language}
              options={[
                { value: "fr", label: "Français" },
                { value: "en", label: "English" },
              ]}
            />
            <Select
              name="preferredCurrency"
              label={t("settings.preferences.currency")}
              defaultValue={profile.preferred_currency}
              options={[{ value: "XOF", label: t("currency.XOF") }]}
            />
            <Switch
              name="notificationsEnabled"
              label={t("settings.preferences.notifications")}
              defaultChecked={profile.notifications_enabled}
            />
            <Switch
              name="soundEnabled"
              label={t("settings.preferences.sound")}
              defaultChecked={profile.sound_enabled}
            />
            <div className="flex flex-col gap-3 border-t border-border-default pt-4">
              <p className="text-xs font-medium text-text-secondary">
                {t("settings.preferences.channels.section")}
              </p>
              <Switch
                name="notifyInApp"
                label={t("settings.preferences.channels.inApp")}
                defaultChecked={profile.notify_in_app}
              />
              <Switch
                name="notifyPush"
                label={t("settings.preferences.channels.push")}
                defaultChecked={profile.notify_push}
              />
              <Switch
                name="notifySms"
                label={t("settings.preferences.channels.sms")}
                defaultChecked={profile.notify_sms}
              />
            </div>
            <Button type="submit" loading={pending} className="self-start">
              {t("settings.preferences.save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
