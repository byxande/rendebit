import { adminProcedure, router } from "../_core/trpc";
import { xverseCapabilities } from "../providers/xverse";

export const integrationsRouter = router({
  xverse: adminProcedure.query(() => xverseCapabilities),
});
