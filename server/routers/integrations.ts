import { adminProcedure, router } from "../_core/trpc";
import { getStacksTestnetStatus } from "../providers/stacksTestnet";
import { xverseCapabilities } from "../providers/xverse";
import { mercadoPagoConfig } from "../providers/mercadoPago";

export const integrationsRouter = router({
  stacksTestnet: adminProcedure.query(() => getStacksTestnetStatus()),
  xverse: adminProcedure.query(() => xverseCapabilities),
  mercadoPago: adminProcedure.query(() => mercadoPagoConfig),
});
