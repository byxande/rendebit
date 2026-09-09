import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { onboardingRouter } from "./routers/onboarding";
import { integrationsRouter } from "./routers/integrations";
import { customerWalletsRouter } from "./routers/customerWallets";
import { marketRouter } from "./routers/market";
import { pixDepositsRouter } from "./routers/pixDeposits";
import { purchasesRouter } from "./routers/purchases";
import { redemptionsRouter } from "./routers/redemptions";
import { treasuryRouter } from "./routers/treasury";
import { recordAuthEvent } from "./db";
import {
  normalizeSocialProvider,
  SOCIAL_AUTH_PROVIDERS,
} from "./services/socialAuth";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    providers: publicProcedure.query(() => ({
      mode: "managed_oauth" as const,
      providers: SOCIAL_AUTH_PROVIDERS,
      passwordStoredByRendeBit: false,
    })),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      const provider = normalizeSocialProvider(ctx.user?.loginMethod);
      if (ctx.user && provider) {
        try {
          await recordAuthEvent({
            userId: ctx.user.id,
            provider,
            eventType: "sign_out",
          });
        } catch (error) {
          console.error("[Auth] Failed to record sign-out audit event", error);
        }
      }
      return { success: true } as const;
    }),
  }),
  integrations: integrationsRouter,
  wallets: customerWalletsRouter,
  market: marketRouter,
  onboarding: onboardingRouter,
  pixDeposits: pixDepositsRouter,
  purchases: purchasesRouter,
  redemptions: redemptionsRouter,
  treasury: treasuryRouter,
});

export type AppRouter = typeof appRouter;
