import { createSandboxAdapter } from "./create-sandbox-adapter";

export const MoovSandbox = createSandboxAdapter({
  provider: "moov",
  capabilities: ["balance", "transfer", "receive"],
  supportsRefund: false,
});
