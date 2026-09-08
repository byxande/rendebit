import { adminProcedure, router } from "../_core/trpc";
import { getStacksTestnetStatus } from "../providers/stacksTestnet";
import { xverseCapabilities } from "../providers/xverse";

export const integrationsRouter = router({
  stacksTestnet: adminProcedure.query(() => getStacksTestnetStatus()),
  xverse: adminProcedure.query(() => xverseCapabilities),
});
