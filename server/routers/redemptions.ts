import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createRedemptionQuote,
  getAvailableBtcBalance,
  getCustomerProfile,
  listOperationalRedemptions,
  listRedemptions,
} from "../db";
import { calculateRedemptionQuote } from "../finance";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { confirmRedemptionWorkflow } from "../services/redemptionOrchestrator";
import { assertBrazilianCustomer } from "../services/brazilEligibility";
import { getBtcBrlQuote } from "../services/btcBrlQuote";

export const redemptionsRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => ({
    availableBtc: await getAvailableBtcBalance(ctx.user.id),
    redemptions: await listRedemptions(ctx.user.id),
  })),

  operationalList: adminProcedure.query(() => listOperationalRedemptions()),

  createQuote: protectedProcedure.input(z.object({
    btcAmount: z.number().min(0.00001).max(100),
    idempotencyKey: z.string().min(8).max(120),
  })).mutation(async ({ ctx, input }) => {
    try {
      const profile = await getCustomerProfile(ctx.user.id);
      assertBrazilianCustomer(profile, { requirePix: true });
      const marketQuote = await getBtcBrlQuote();
      const quote = calculateRedemptionQuote(input.btcAmount, marketQuote.priceBrl);
      const stored = await createRedemptionQuote({
        userId: ctx.user.id,
        quote,
        idempotencyKey: input.idempotencyKey,
        expiresAt: new Date(Date.now() + 60_000),
      });
      return { ...stored, pixDestinationMasked: profile.pixAccountMasked! };
    } catch (error) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Não foi possível gerar a cotação de resgate." });
    }
  }),

  confirm: protectedProcedure.input(z.object({
    quoteId: z.number().int().positive(),
    idempotencyKey: z.string().min(8).max(120),
    riskAccepted: z.literal(true),
  })).mutation(async ({ ctx, input }) => {
    try {
      assertBrazilianCustomer(await getCustomerProfile(ctx.user.id), { requirePix: true });
      return await confirmRedemptionWorkflow({
        userId: ctx.user.id,
        quoteId: input.quoteId,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Falha ao confirmar resgate." });
    }
  }),
});
