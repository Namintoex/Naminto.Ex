import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { findRecipientByNamintoId } from "./queries";

/**
 * Test d'intégration contre le vrai projet Supabase — `identity_profiles`
 * n'a qu'une policy RLS restreinte au titulaire (0001_identity.sql) :
 * cette résolution passe par service_role, testée ici directement.
 */
describe("findRecipientByNamintoId (intégration)", () => {
  const admin = createAdminClient();
  let userId: string;
  const namintoId = `vitest_recipient_${randomUUID().slice(0, 8)}`;
  const testEmail = `vitest-recipient-${randomUUID()}@example.test`;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: namintoId, legal_name: "Vitest Recipient" },
    });
    if (error || !data.user) {
      throw new Error(`Impossible de créer l'utilisateur de test: ${error?.message}`);
    }
    userId = data.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("trouve un bénéficiaire par son identifiant Naminto.Ex exact", async () => {
    const result = await findRecipientByNamintoId(namintoId);
    expect(result).toEqual({ userId, namintoId, legalName: "Vitest Recipient" });
  });

  it("est insensible à la casse et aux espaces superflus", async () => {
    const result = await findRecipientByNamintoId(`  ${namintoId.toUpperCase()}  `);
    expect(result?.userId).toBe(userId);
  });

  it("renvoie null pour un identifiant inconnu", async () => {
    const result = await findRecipientByNamintoId(`unknown_${randomUUID().slice(0, 8)}`);
    expect(result).toBeNull();
  });
});
