import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUpdateKycStatus as adminUpdateKycStatusAction } from "./admin-queries";

describe("Back Office — adminUpdateKycStatusAction (intégration)", () => {
  const admin = createAdminClient();
  let userId: string;
  const testEmail = `vitest-admin-kyc-${randomUUID()}@example.test`;

  it("passe unverified → verified, journalise l'événement, refuse une transition vers le même statut", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: {
        naminto_id: `vitest_admkyc_${randomUUID().slice(0, 8)}`,
        legal_name: "Vitest Admin KYC Test",
      },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    userId = data.user.id;

    const { data: before } = await admin.from("identity_profiles").select("kyc_status").eq("user_id", userId).single();
    expect(before?.kyc_status).toBe("unverified");

    const result = await adminUpdateKycStatusAction(userId, "verified");
    expect(result).toEqual({ ok: true });

    const { data: after } = await admin.from("identity_profiles").select("kyc_status").eq("user_id", userId).single();
    expect(after?.kyc_status).toBe("verified");

    const { data: events } = await admin
      .from("security_events")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "kyc_status_changed");
    expect(events).toHaveLength(1);
    expect(events![0].metadata).toMatchObject({ from: "unverified", to: "verified" });

    const sameStatus = await adminUpdateKycStatusAction(userId, "verified");
    expect(sameStatus).toEqual({ ok: false, error: "admin.kyc.error.invalidTransition" });
  });

  it("renvoie une erreur pour un utilisateur introuvable", async () => {
    const result = await adminUpdateKycStatusAction(randomUUID(), "verified");
    expect(result).toEqual({ ok: false, error: "admin.users.error.notFound" });
  });

  afterAll(async () => {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });
});
