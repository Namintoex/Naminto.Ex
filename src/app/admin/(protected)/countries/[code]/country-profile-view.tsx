"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { CountryProfile } from "@/domains/countries/types";

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-sm text-text-secondary">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant="neutral">
          {item}
        </Badge>
      ))}
    </div>
  );
}

export function CountryProfileView({ profile }: { profile: CountryProfile }) {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/admin/countries" className="flex items-center gap-1.5 text-sm text-text-secondary hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        {t("admin.countries.detail.back")}
      </Link>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            {profile.name} ({profile.code})
          </CardTitle>
          <Badge variant={profile.active ? "success" : "neutral"}>
            {t(profile.active ? "admin.countries.detail.active" : "admin.countries.detail.inactive")}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("admin.countries.column.currency")}</span>
            <span className="font-medium text-text-primary">{profile.currency}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("admin.countries.detail.languages")}</span>
            <TagList items={profile.languages} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("admin.countries.detail.providers")}</span>
            <TagList items={profile.providers} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("admin.countries.detail.rails")}</span>
            <TagList items={profile.rails} />
          </div>
          {profile.privacyNotes && (
            <div className="flex flex-col gap-1 border-t border-border-default pt-3">
              <span className="text-text-secondary">{t("admin.countries.detail.privacy")}</span>
              <p className="text-text-primary">{profile.privacyNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.countries.detail.pricing")}</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.pricing.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("admin.countries.detail.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {profile.pricing.map((rule) => (
                <li key={rule.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-text-primary">
                    {rule.rate_percent}% + {rule.flat_fee}
                  </span>
                  <span className="text-text-secondary">{rule.fee_payer}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.countries.detail.limits")}</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.limits.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("admin.countries.detail.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {profile.limits.map((rule) => (
                <li key={rule.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-text-primary">{rule.limit_type}</span>
                  <span className="text-text-secondary">
                    {rule.max_amount ?? rule.max_count ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.countries.detail.kycAml")}</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.kycAml.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("admin.countries.detail.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {profile.kycAml.map((rule) => (
                <li key={rule.id} className="flex flex-col gap-0.5 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary">{rule.requirement}</span>
                    <span className="text-text-secondary">{rule.rule_type}</span>
                  </div>
                  <span className="text-xs text-text-secondary">{rule.description}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.countries.detail.legalRules")}</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.legalRules.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("admin.countries.detail.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {profile.legalRules.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-text-primary">{doc.title}</span>
                  <span className="text-text-secondary">
                    {doc.type} · {doc.locale} · v{doc.version}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
