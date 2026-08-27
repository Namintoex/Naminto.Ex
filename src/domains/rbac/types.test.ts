import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, PERMISSIONS, ROLE_PERMISSIONS, permissionsForRoles } from "./types";

describe("RBAC — types (Prompt 23)", () => {
  it("chaque rôle a droit à dashboard.read (page d'accueil commune)", () => {
    for (const role of ADMIN_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toContain("dashboard.read");
    }
  });

  it("seul super_admin reçoit role.manage — aucun autre rôle ne peut gérer les rôles d'autrui", () => {
    for (const role of ADMIN_ROLES) {
      if (role === "super_admin") {
        expect(ROLE_PERMISSIONS[role]).toContain("role.manage");
      } else {
        expect(ROLE_PERMISSIONS[role]).not.toContain("role.manage");
      }
    }
  });

  it("super_admin reçoit strictement toutes les permissions déclarées", () => {
    expect(new Set(ROLE_PERMISSIONS.super_admin)).toEqual(new Set(PERMISSIONS));
  });

  it("permissionsForRoles fait l'union des permissions de plusieurs rôles", () => {
    const result = permissionsForRoles(["kyc", "risk"]);
    expect(result.has("kyc.review")).toBe(true);
    expect(result.has("risk.read")).toBe(true);
    expect(result.has("fraud.read")).toBe(true);
    expect(result.has("pricing.manage")).toBe(false);
  });

  it("permissionsForRoles([]) ne renvoie aucune permission", () => {
    expect(permissionsForRoles([]).size).toBe(0);
  });

  it("chaque permission suit le schéma ressource.action, jamais de joker", () => {
    for (const permission of PERMISSIONS) {
      expect(permission).toMatch(/^[a-z]+\.[a-z]+$/);
      expect(permission).not.toContain("*");
    }
  });
});
