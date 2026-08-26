import {
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
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Landmark,
  MessageCircle,
  Percent,
  Plug,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Affiché dans la barre d'onglets mobile (sous-ensemble restreint). */
  primary?: boolean;
};

export const userNavItems: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, primary: true },
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
  { href: "/admin", labelKey: "nav.admin.dashboard", icon: LayoutDashboard, primary: true },
  { href: "/admin/users", labelKey: "nav.admin.users", icon: Users, primary: true },
  { href: "/admin/transactions", labelKey: "nav.admin.transactions", icon: ArrowLeftRight, primary: true },
  { href: "/admin/ledger", labelKey: "nav.admin.ledger", icon: BookOpen, primary: true },
  { href: "/admin/kyc", labelKey: "nav.admin.kyc", icon: BadgeCheck },
  { href: "/admin/providers", labelKey: "nav.admin.providers", icon: Plug },
  { href: "/admin/reconciliation", labelKey: "nav.admin.reconciliation", icon: GitCompare },
  { href: "/admin/risk", labelKey: "nav.admin.risk", icon: AlertTriangle },
  { href: "/admin/fraud", labelKey: "nav.admin.fraud", icon: ShieldAlert },
  { href: "/admin/support", labelKey: "nav.admin.support", icon: LifeBuoy },
  { href: "/admin/pricing", labelKey: "nav.admin.pricing", icon: Percent },
  { href: "/admin/countries", labelKey: "nav.admin.countries", icon: Globe },
  { href: "/admin/faq", labelKey: "nav.admin.faq", icon: HelpCircle },
  { href: "/admin/legal", labelKey: "nav.admin.legal", icon: Scale },
  { href: "/admin/notifications", labelKey: "nav.admin.notifications", icon: Bell },
  { href: "/admin/incidents", labelKey: "nav.admin.incidents", icon: Siren },
  { href: "/admin/audit", labelKey: "nav.admin.audit", icon: ClipboardList },
];
