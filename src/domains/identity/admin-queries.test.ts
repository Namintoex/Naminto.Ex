import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminGetUserDetail, adminListUsers } from "./admin-queries";

/**
 * Test d'intégration contre le vrai projet Supabase — vérifie deux
 * correctifs du Prompt 28 (ADR-056) : l'injection de filtre PostgREST
 * dans la recherche admin, et la forme restreinte de la fiche
 * utilisateur (devices/security_events) qui ne doit plus exposer
 * ip_hash/device_fingerprint/metadata brut au navigateur.
 */
describe("identity — admin-queries (intégration, Prompt 28)", () => {
  const admin = createAdminClient();
  let userId: string;
  const namintoId = `vitest_adminq_${randomUUID().slice(0, 8)}`;
  const legalName = `Vitest AdminQ (Injection),Test`; // virgule/parenthèse volontaires
  const email = `vitest-adminq-${randomUUID()}@example.test`;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: namintoId, legal_name: legalName },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    userId = data.user.id;

    await admin.from("devices").insert({
      user_id: userId,
      device_fingerprint: "vitest-secret-fingerprint-value",
      platform: "vitest-platform",
      status: "active",
    });
    await admin.from("security_events").insert({
      user_id: userId,
      type: "login_success",
      ip_hash: "vitest-secret-ip-hash-value",
      metadata: { secretDetail: "should-not-reach-the-client" },
    });
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("un terme de recherche contenant des caractères spéciaux PostgREST (, . ( )) ne casse pas la requête et retrouve le bon compte", async () => {
    const result = await adminListUsers({ search: legalName });
    expect(result.users.some((u) => u.user_id === userId)).toBe(true);
  });

  it("un terme de recherche contenant une clause injectée ne renvoie pas tous les comptes", async () => {
    // Tentative d'injection classique : fermer la clause ilike puis en
    // ajouter une toujours vraie. Si l'échappement échoue, ceci renverrait
    // potentiellement l'intégralité de la table.
    const injected = `${randomUUID()}),legal_name.neq.`;
    const result = await adminListUsers({ search: injected });
    expect(result.users).toHaveLength(0);
  });

  it("adminGetUserDetail n'expose plus ip_hash/device_fingerprint/metadata brut", async () => {
    const detail = await adminGetUserDetail(userId);
    expect(detail).toBeTruthy();

    expect(detail!.devices).toHaveLength(1);
    expect(detail!.devices[0]).toEqual({ id: expect.any(String), platform: "vitest-platform", status: "active" });
    expect(detail!.devices[0]).not.toHaveProperty("device_fingerprint");

    expect(detail!.securityEvents.length).toBeGreaterThanOrEqual(1);
    const event = detail!.securityEvents.find((e) => e.type === "login_success");
    expect(event).toEqual({ id: expect.any(String), type: "login_success", created_at: expect.any(String) });
    expect(event).not.toHaveProperty("ip_hash");
    expect(event).not.toHaveProperty("metadata");
  });
});
