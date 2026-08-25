import { createSandboxAdapter } from "./create-sandbox-adapter";

export const MTNSandbox = createSandboxAdapter({
  provider: "mtn",
  capabilities: ["balance", "transfer", "receive"],
  supportsRefund: true,
});
