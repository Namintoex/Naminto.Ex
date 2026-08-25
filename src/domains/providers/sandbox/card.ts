import { createSandboxAdapter } from "./create-sandbox-adapter";

export const CardSandbox = createSandboxAdapter({
  provider: "prepaid_card",
  // Une carte prépayée ne reçoit pas de transferts entrants comme un
  // compte mobile money — voir architecture générale, section 22.
  capabilities: ["balance", "transfer"],
  supportsRefund: true,
});
