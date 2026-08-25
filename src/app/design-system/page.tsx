"use client";

import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Input,
  LocaleToggle,
  Modal,
  ModalClose,
  ModalContent,
  ModalTrigger,
  Select,
  Skeleton,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  ThemeToggle,
  cn,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [notificationsDemo, setNotificationsDemo] = useState(true);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-10 sm:px-8">
      <header className="flex flex-col gap-4 border-b border-border-default pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t("designSystem.title")}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t("designSystem.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleToggle />
          <ThemeToggle lightLabel={t("theme.light")} darkLabel={t("theme.dark")} />
        </div>
      </header>

      <Section title="Tokens — couleurs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { token: "brand-300", className: "bg-brand-300" },
            { token: "brand-500", className: "bg-brand-500" },
            { token: "brand-700", className: "bg-brand-700" },
            { token: "success", className: "bg-success" },
            { token: "warning", className: "bg-warning" },
            { token: "danger", className: "bg-danger" },
            { token: "info", className: "bg-info" },
            { token: "surface-sunken", className: "bg-surface-sunken" },
            { token: "border-default", className: "bg-border-default" },
            { token: "text-secondary", className: "bg-text-secondary" },
          ].map(({ token, className }) => (
            <div key={token} className="flex flex-col gap-2">
              <div className={cn("h-14 rounded-md border border-border-default", className)} />
              <span className="text-xs text-text-secondary">{token}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typographie">
        <div className="flex flex-col gap-2">
          <p className="text-3xl font-bold text-text-primary">Titre 3xl bold</p>
          <p className="text-xl font-semibold text-text-primary">Titre xl semibold</p>
          <p className="text-base text-text-primary">Texte de base — le corps de texte standard.</p>
          <p className="text-sm text-text-secondary">Texte secondaire — sm, text-secondary.</p>
          <p className="font-mono text-sm text-text-secondary">Réf. NEX-8F2A3B1C — police mono</p>
        </div>
      </Section>

      <Section title="Boutons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">{t("button.primary")}</Button>
          <Button variant="secondary">{t("button.secondary")}</Button>
          <Button variant="destructive">{t("button.destructive")}</Button>
          <Button variant="ghost">{t("button.ghost")}</Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            {loading ? t("button.loading") : t("button.primary")}
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </Section>

      <Section title="Formulaires">
        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
            <Input
              label={t("form.label.beneficiary")}
              placeholder={t("form.placeholder.beneficiary")}
              helperText={t("form.helper.beneficiary")}
              required
            />
            <Input label="Champ en erreur" defaultValue="" errorText={t("form.error.required")} required />
            <Select
              label="Réseau"
              placeholder="Choisir un réseau"
              options={[
                { value: "orange", label: "Orange" },
                { value: "mtn", label: "MTN" },
                { value: "moov", label: "Moov" },
                { value: "wave", label: "Wave" },
              ]}
            />
            <Input label="Champ désactivé" placeholder="Non modifiable" disabled />
            <Textarea
              className="sm:col-span-2"
              label="Motif (facultatif)"
              placeholder="Ex. remboursement, cadeau…"
            />
          </CardContent>
        </Card>
      </Section>

      <Section title="Switch">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5">
            <Switch
              label={t("settings.preferences.notifications")}
              checked={notificationsDemo}
              onCheckedChange={setNotificationsDemo}
            />
            <Switch label="Désactivé" disabled />
          </CardContent>
        </Card>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Solde Naminto.Ex</CardTitle>
              <CardDescription>Mis à jour à l&apos;instant</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-text-primary">250 000 FCFA</p>
            </CardContent>
            <CardFooter>
              <Button variant="secondary" size="sm">
                Détails
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Carte opérateur</CardTitle>
              <CardDescription>Orange •••• 4582</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Badge variant="success">{t("badge.active")}</Badge>
              <Badge variant="warning">{t("badge.pending")}</Badge>
              <Badge variant="danger">{t("badge.failed")}</Badge>
              <Badge variant="neutral">Neutral</Badge>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Alertes">
        <div className="flex flex-col gap-3">
          <Alert variant="info" title={t("alert.info.title")}>
            {t("alert.info.body")}
          </Alert>
          <Alert variant="success" title={t("alert.success.title")}>
            {t("alert.success.body")}
          </Alert>
          <Alert variant="warning" title={t("alert.warning.title")}>
            {t("alert.warning.body")}
          </Alert>
          <Alert variant="danger" title={t("alert.danger.title")}>
            {t("alert.danger.body")}
          </Alert>
        </div>
      </Section>

      <Section title="Modal">
        <Modal>
          <ModalTrigger asChild>
            <Button variant="secondary">{t("modal.trigger")}</Button>
          </ModalTrigger>
          <ModalContent title={t("modal.title")} description={t("modal.description")}>
            <div className="flex justify-end gap-2">
              <ModalClose asChild>
                <Button variant="secondary" size="sm">
                  {t("modal.cancel")}
                </Button>
              </ModalClose>
              <ModalClose asChild>
                <Button variant="primary" size="sm">
                  {t("modal.confirm")}
                </Button>
              </ModalClose>
            </div>
          </ModalContent>
        </Modal>
      </Section>

      <Section title="Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.column.reference")}</TableHead>
              <TableHead>{t("table.column.beneficiary")}</TableHead>
              <TableHead>{t("table.column.amount")}</TableHead>
              <TableHead>{t("table.column.status")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { ref: "NEX-8F2A3B", name: "Jean Kouassi", amount: "+25 000 FCFA", status: "success" as const },
              { ref: "NEX-7C1D9E", name: "Awa Traoré", amount: "-10 000 FCFA", status: "warning" as const },
              { ref: "NEX-5B4A2F", name: "Moussa Diarra", amount: "-5 000 FCFA", status: "danger" as const },
            ].map((row) => (
              <TableRow key={row.ref}>
                <TableCell className="font-mono text-xs">{row.ref}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.amount}</TableCell>
                <TableCell>
                  <Badge
                    variant={row.status === "success" ? "success" : row.status === "warning" ? "warning" : "danger"}
                  >
                    {row.status === "success"
                      ? t("badge.active")
                      : row.status === "warning"
                        ? t("badge.pending")
                        : t("badge.failed")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        ⋯
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>{t("dropdown.view")}</DropdownMenuItem>
                      <DropdownMenuItem>{t("dropdown.export")}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-danger">{t("dropdown.delete")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
            <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
            <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <p className="text-sm text-text-secondary">Contenu de l&apos;onglet Aperçu.</p>
          </TabsContent>
          <TabsContent value="history">
            <p className="text-sm text-text-secondary">Contenu de l&apos;onglet Historique.</p>
          </TabsContent>
          <TabsContent value="settings">
            <p className="text-sm text-text-secondary">Contenu de l&apos;onglet Paramètres.</p>
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Loaders / Skeletons">
        <div className="flex flex-wrap items-center gap-8">
          <Spinner label={t("loader.label")} />
          <div className="flex w-64 flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </Section>

      <Section title="États — vide / erreur">
        <div className="grid gap-4 sm:grid-cols-2">
          <EmptyState title={t("emptyState.title")} description={t("emptyState.body")} />
          <ErrorState
            title={t("errorState.title")}
            description={t("errorState.body")}
            retryLabel={t("errorState.retry")}
            onRetry={() => {}}
          />
        </div>
      </Section>
    </main>
  );
}
