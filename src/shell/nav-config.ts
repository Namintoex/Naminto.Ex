import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpen,
  ClipboardList,
  GitCompare,
  Globe,
  HandCoins,
  HelpCircle,
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Landmark,
  MessageCircle,
  Percent,
  Plug,
  Radio,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/domains/rbac/types";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Affiché dans la barre d'onglets mobile (sous-ensemble restreint). */
  primary?: boolean;
  /** Libellé plus court réservé à la barre d'onglets mobile (largeur très contrainte) — absent = `labelKey` réutilisé tel quel. */
  mobileLabelKey?: string;
  /** Prompt 23 — absente = visible par tout rôle admin (ex. modules encore STUB). */
  permission?: Permission;
};

export const userNavItems: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", mobileLabelKey: "nav.dashboard.short", icon: LayoutDashboard, primary: true },
  { href: "/send", labelKey: "nav.send", icon: ArrowUpRight, primary: true },
  { href: "/receive", labelKey: "nav.receive", icon: ArrowDownLeft, primary: true },
  { href: "/history", labelKey: "nav.history", icon: History, primary: true },
  { href: "/request", labelKey: "nav.request", icon: HandCoins },
  { href: "/accounts", labelKey: "nav.accounts", icon: Link2 },
  { href: "/notifications", labelKey: "nav.notifications", icon: Bell },
  { href: "/assist", labelKey: "nav.assist", icon: MessageCircle },
  { href: "/security", labelKey: "nav.security", icon: ShieldCheck },
  { href: "/trust", labelKey: "nav.trust", icon: Landmark },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

export const adminNavItems: NavItem[] = [
  { href: "/admin", labelKey: "nav.admin.dashboard", mobileLabelKey: "nav.dashboard.short", icon: LayoutDashboard, primary: true, permission: "dashboard.read" },
  { href: "/admin/users", labelKey: "nav.admin.users", icon: Users, primary: true, permission: "user.read" },
  {
    href: "/admin/transactions",
    labelKey: "nav.admin.transactions",
    icon: ArrowLeftRight,
    primary: true,
    permission: "transaction.read",
  },
  { href: "/admin/ledger", labelKey: "nav.admin.ledger", icon: BookOpen, primary: true, permission: "ledger.read" },
  { href: "/admin/kyc", labelKey: "nav.admin.kyc", icon: BadgeCheck, permission: "kyc.read" },
  { href: "/admin/providers", labelKey: "nav.admin.providers", icon: Plug, permission: "provider.read" },
  { href: "/admin/webhooks", labelKey: "nav.admin.webhooks", icon: Webhook, permission: "webhook.read" },
  { href: "/admin/events", labelKey: "nav.admin.events", icon: Radio, permission: "event.read" },
  {
    href: "/admin/reconciliation",
    labelKey: "nav.admin.reconciliation",
    icon: GitCompare,
    permission: "reconciliation.read",
  },
  { href: "/admin/risk", labelKey: "nav.admin.risk", icon: AlertTriangle, permission: "risk.read" },
  { href: "/admin/fraud", labelKey: "nav.admin.fraud", icon: ShieldAlert, permission: "fraud.read" },
  { href: "/admin/support", labelKey: "nav.admin.support", icon: LifeBuoy, permission: "support.read" },
  { href: "/admin/pricing", labelKey: "nav.admin.pricing", icon: Percent, permission: "pricing.read" },
  { href: "/admin/countries", labelKey: "nav.admin.countries", icon: Globe, permission: "country.manage" },
  { href: "/admin/faq", labelKey: "nav.admin.faq", icon: HelpCircle, permission: "faq.manage" },
  { href: "/admin/legal", labelKey: "nav.admin.legal", icon: Scale, permission: "legal.manage" },
  { href: "/admin/notifications", labelKey: "nav.admin.notifications", icon: Bell, permission: "notification.read" },
  { href: "/admin/incidents", labelKey: "nav.admin.incidents", icon: Siren, permission: "incident.read" },
  { href: "/admin/audit", labelKey: "nav.admin.audit", icon: ClipboardList, permission: "audit.read" },
  {
    href: "/admin/observability",
    labelKey: "nav.admin.observability",
    icon: Activity,
    permission: "observability.read",
  },
  { href: "/admin/roles", labelKey: "nav.admin.roles", icon: KeyRound, permission: "role.manage" },
];
