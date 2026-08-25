"use client";

import Link from "next/link";
import { KeyRound, Laptop, Smartphone } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { Database } from "@/lib/supabase/database.types";
import { RevokeDeviceButton } from "./revoke-device-button";

type Device = Database["public"]["Tables"]["devices"]["Row"];
type SecurityEvent = Pick<
  Database["public"]["Tables"]["security_events"]["Row"],
  "id" | "type" | "created_at" | "metadata"
>;

function statusVariant(status: Device["status"]) {
  if (status === "active") return "success" as const;
  if (status === "untrusted") return "warning" as const;
  return "danger" as const;
}

export function SecurityView({
  devices,
  events,
  pinSet,
  currentDeviceFingerprint,
}: {
  devices: Pick<
    Device,
    "id" | "device_fingerprint" | "platform" | "status" | "trusted" | "last_seen_at"
  >[];
  events: SecurityEvent[];
  pinSet: boolean;
  currentDeviceFingerprint: string | null;
}) {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("security.title")}</h1>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-text-secondary" aria-hidden />
            {t("security.pin.section")}
          </CardTitle>
          <Badge variant={pinSet ? "success" : "warning"}>
            {pinSet ? t("badge.active") : t("badge.pending")}
          </Badge>
        </CardHeader>
        <CardContent>
          <Button asChild variant="secondary" size="sm">
            <Link href="/security/pin">{t("security.pin.changeLink")}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("security.devices.section")}</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <EmptyState title={t("security.devices.empty")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("security.devices.section")}</TableHead>
                  <TableHead>{t("table.column.status")}</TableHead>
                  <TableHead>{t("security.devices.lastSeen")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => {
                  const isCurrent = device.device_fingerprint === currentDeviceFingerprint;
                  const isMobile = device.platform?.toLowerCase().includes("mobile");
                  return (
                    <TableRow key={device.id}>
                      <TableCell className="max-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          {isMobile ? (
                            <Smartphone className="size-4 shrink-0 text-text-secondary" aria-hidden />
                          ) : (
                            <Laptop className="size-4 shrink-0 text-text-secondary" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm" title={device.platform ?? undefined}>
                            {device.platform ?? "—"}
                          </span>
                          {isCurrent && (
                            <Badge variant="info" className="shrink-0">
                              {t("security.devices.thisDevice")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(device.status)}>{device.status}</Badge>
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {new Date(device.last_seen_at).toLocaleString(locale)}
                      </TableCell>
                      <TableCell>
                        {device.status !== "revoked" && (
                          <RevokeDeviceButton deviceId={device.id} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("security.history.section")}</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState title={t("security.history.empty")} />
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {events.map((event) => (
                <li key={event.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-text-primary">
                    {t(`security.event.${event.type}`)}
                  </span>
                  <span className="text-text-secondary">
                    {new Date(event.created_at).toLocaleString(locale)}
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
