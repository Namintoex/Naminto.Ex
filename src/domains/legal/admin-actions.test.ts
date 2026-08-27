import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  adminCreateLegalDocument as adminCreateLegalDocumentAction,
  adminSetLegalDocumentPublished as adminSetLegalDocumentPublishedAction,
} from "./admin-mutations";
import { adminListLegalDocuments } from "./queries";

describe("Back Office — Legal admin actions (intégration)", () => {
  const admin = createAdminClient();
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await admin.from("legal_documents").delete().in("id", createdIds);
    }
  });

  it("crée un document non publié par défaut, puis le publie", async () => {
    const title = `Vitest legal doc ${Date.now()}`;
    const created = await adminCreateLegalDocumentAction({
      type: "terms",
      locale: "fr",
      title,
      content: "Contenu de test.",
      version: "1.0",
    });
    expect(created).toEqual({ ok: true });

    const documents = await adminListLegalDocuments();
    const doc = documents.find((d) => d.title === title);
    expect(doc).toBeDefined();
    expect(doc!.published).toBe(false);
    createdIds.push(doc!.id);

    const published = await adminSetLegalDocumentPublishedAction(doc!.id, true);
    expect(published).toEqual({ ok: true });

    const documentsAfter = await adminListLegalDocuments();
    expect(documentsAfter.find((d) => d.id === doc!.id)?.published).toBe(true);
  });

  it("refuse un titre ou contenu vide", async () => {
    const result = await adminCreateLegalDocumentAction({ type: "terms", locale: "fr", title: "", content: "", version: "1.0" });
    expect(result).toEqual({ ok: false, error: "admin.legal.error.required" });
  });
});
