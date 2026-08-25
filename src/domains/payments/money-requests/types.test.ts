import { describe, expect, it } from "vitest";
import { effectiveStatus } from "./types";

describe("effectiveStatus (pur)", () => {
  it("une demande pending dont l'échéance n'est pas dépassée reste pending", () => {
    const status = effectiveStatus({
      status: "pending",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(status).toBe("pending");
  });

  it("une demande pending dont l'échéance est dépassée devient expired", () => {
    const status = effectiveStatus({
      status: "pending",
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(status).toBe("expired");
  });

  it("un statut déjà terminal (fulfilled/cancelled) n'est jamais réécrit en expired", () => {
    expect(
      effectiveStatus({ status: "fulfilled", expires_at: new Date(Date.now() - 60_000).toISOString() })
    ).toBe("fulfilled");
    expect(
      effectiveStatus({ status: "cancelled", expires_at: new Date(Date.now() - 60_000).toISOString() })
    ).toBe("cancelled");
  });
});
