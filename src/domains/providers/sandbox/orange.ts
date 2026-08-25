import { createSandboxAdapter } from "./create-sandbox-adapter";

export const OrangeSandbox = createSandboxAdapter({
  provider: "orange",
  capabilities: ["balance", "transfer", "receive"],
  supportsRefund: true,
});
