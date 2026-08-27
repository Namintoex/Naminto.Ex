import type { AdminRole } from "@/lib/supabase/database.types";

export type { AdminRole };

export const ADMIN_ROLES: AdminRole[] = [
  "support",
  "kyc",
  "compliance",
  "risk",
  "finance",
  "operations",
  "security",
  "legal",
  "super_admin",
];

/**
 * Permissions (Prompt 23) — « chaque permission doit être explicite » :
 * une chaîne nommée par capacité, jamais un joker/wildcard. Les neuf
 * exemples du prompt (transaction.read/review/cancel, kyc.review,
 * ledger.read, provider.manage, pricing.manage, user.suspend,
 * audit.read) sont repris tels quels ; le reste étend le même schéma
 * `ressource.action` à chacun des 13 modules construits au Prompt 22.
 */
export const PERMISSIONS = [
  "dashboard.read",
  "user.read",
  "user.suspend",
  "kyc.read",
  "kyc.review",
  "transaction.read",
  "transaction.review",
  "transaction.cancel",
  "ledger.read",
  "provider.read",
  "provider.manage",
  "risk.read",
  "fraud.read",
  "support.read",
  "support.manage",
  "pricing.read",
  "pricing.manage",
  "country.manage",
  "faq.manage",
  "legal.manage",
  "notification.read",
  "notification.manage",
  "audit.read",
  "role.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Association rôle → permissions (Prompt 23). Aucune source ne
 * documente cette correspondance précise (seuls les rôles et des
 * exemples de permissions sont donnés) : choix raisonnable assumé ici,
 * un rôle par domaine du Back Office. TODO_DECISION si le produit veut
 * une correspondance différente (voir docs/DECISIONS.md ADR-051).
 * `super_admin` seul reçoit `role.manage` — aucun autre rôle ne peut
 * gérer les rôles d'autrui.
 */
export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  support: ["dashboard.read", "user.read", "transaction.read", "support.read", "support.manage"],
  kyc: ["dashboard.read", "user.read", "kyc.read", "kyc.review"],
  compliance: ["dashboard.read", "user.read", "kyc.read", "transaction.read", "pricing.read", "audit.read"],
  risk: ["dashboard.read", "transaction.read", "risk.read", "fraud.read"],
  finance: ["dashboard.read", "ledger.read", "pricing.read", "pricing.manage", "transaction.read"],
  operations: ["dashboard.read", "provider.read", "provider.manage", "notification.read", "notification.manage"],
  security: ["dashboard.read", "user.read", "user.suspend", "audit.read", "transaction.read"],
  legal: ["dashboard.read", "legal.manage", "faq.manage", "country.manage"],
  super_admin: [...PERMISSIONS],
};

export function permissionsForRoles(roles: AdminRole[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      result.add(permission);
    }
  }
  return result;
}
