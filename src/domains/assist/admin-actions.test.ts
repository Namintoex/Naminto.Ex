import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUpdateTicketStatus as adminUpdateTicketStatusAction } from "./admin-queries";

describe("Back Office — adminUpdateTicketStatusAction (intégration)", () => {
  const admin = createAdminClient();
  let userId: string;
  let ticketId: string;
  const testEmail = `vitest-admin-ticket-${randomUUID()}@example.test`;

  it("open → in_progress → resolved → closed, chaque étape journalisée ; rejette une transition invalide", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: {
        naminto_id: `vitest_admtkt_${randomUUID().slice(0, 8)}`,
        legal_name: "Vitest Admin Ticket Test",
      },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    userId = data.user.id;

    const { data: ticket, error: ticketError } = await admin
      .from("support_tickets")
      .insert({ user_id: userId, subject: "Test", description: "Test ticket", category: "other" })
      .select("id")
      .single();
    if (ticketError || !ticket) throw new Error(`Setup ticket échoué: ${ticketError?.message}`);
    ticketId = ticket.id;

    // closed n'est pas atteignable directement depuis open dans NEXT_STATUS ? si, "closed" fait partie des options de "open".
    const toInProgress = await adminUpdateTicketStatusAction(ticketId, "in_progress");
    expect(toInProgress).toEqual({ ok: true });

    const invalidBackToOpen = await adminUpdateTicketStatusAction(ticketId, "open");
    expect(invalidBackToOpen).toEqual({ ok: false, error: "admin.support.error.invalidTransition" });

    const toResolved = await adminUpdateTicketStatusAction(ticketId, "resolved");
    expect(toResolved).toEqual({ ok: true });

    const toClosed = await adminUpdateTicketStatusAction(ticketId, "closed");
    expect(toClosed).toEqual({ ok: true });

    const { data: finalTicket } = await admin.from("support_tickets").select("status").eq("id", ticketId).single();
    expect(finalTicket?.status).toBe("closed");

    const fromClosed = await adminUpdateTicketStatusAction(ticketId, "resolved");
    expect(fromClosed).toEqual({ ok: false, error: "admin.support.error.invalidTransition" });

    const { data: events } = await admin
      .from("security_events")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "support_ticket_status_changed");
    expect(events).toHaveLength(3);
  });

  it("renvoie une erreur pour un ticket introuvable", async () => {
    const result = await adminUpdateTicketStatusAction(randomUUID(), "resolved");
    expect(result).toEqual({ ok: false, error: "admin.support.error.notFound" });
  });

  afterAll(async () => {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });
});
