import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { onboardingRouter } from "./routers/onboarding";
import { integrationsRouter } from "./routers/integrations";
import { pixDepositsRouter } from "./routers/pixDeposits";
import { purchasesRouter } from "./routers/purchases";
import { redemptionsRouter } from "./routers/redemptions";
import { treasuryRouter } from "./routers/treasury";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  integrations: integrationsRouter,
  onboarding: onboardingRouter,
  pixDeposits: pixDepositsRouter,
  purchases: purchasesRouter,
  redemptions: redemptionsRouter,
  treasury: treasuryRouter,
});

export type AppRouter = typeof appRouter;
