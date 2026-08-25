import { createSandboxAdapter } from "./create-sandbox-adapter";

export const WaveSandbox = createSandboxAdapter({
  provider: "wave",
  capabilities: ["balance", "transfer", "receive"],
  supportsRefund: false,
});
