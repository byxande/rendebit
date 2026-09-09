import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createPurchaseQuote,
  getCustomerProfile,
  listLedger,
  listPurchases,
} from "../db";
import { calculatePurchaseQuote } from "../finance";
import { ENV } from "../_core/env";
import { protectedProcedure, router } from "../_core/trpc";
import { confirmPurchaseWorkflow } from "../services/purchaseOrchestrator";

export const purchasesRouter = router({
  list: protectedProcedure.query(({ ctx }) => listPurchases(ctx.user.id)),
  ledger: protectedProcedure.query(({ ctx }) => listLedger(ctx.user.id)),

  createQuote: protectedProcedure.input(z.object({
    amountBrl: z.number().min(50).max(1_000_000),
    idempotencyKey: z.string().min(8).max(120),
  })).mutation(async ({ ctx, input }) => {
    const profile = await getCustomerProfile(ctx.user.id);
    if (!profile || profile.verificationStatus !== "verified") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Conclua a verificação sandbox antes de cotar." });
    }
    const quote = calculatePurchaseQuote(input.amountBrl);
    return createPurchaseQuote({
      userId: ctx.user.id,
      quote,
      idempotencyKey: input.idempotencyKey,
      expiresAt: new Date(Date.now() + 60_000),
    });
  }),

  confirm: protectedProcedure.input(z.object({
    quoteId: z.number().int().positive(),
    idempotencyKey: z.string().min(8).max(120),
    paymentMethod: z.enum(["pix", "credit_card"]),
  })).mutation(async ({ ctx, input }) => {
    try {
      const forwardedProto = ctx.req.headers["x-forwarded-proto"];
      const protocol = typeof forwardedProto === "string" ? forwardedProto.split(",")[0] : ctx.req.protocol;
      const returnBaseUrl = ENV.publicBaseUrl || `${protocol}://${ctx.req.get("host")}`;
      return await confirmPurchaseWorkflow({
        userId: ctx.user.id,
        quoteId: input.quoteId,
        idempotencyKey: input.idempotencyKey,
        paymentMethod: input.paymentMethod,
        payerEmail: ctx.user.email ?? null,
        returnBaseUrl,
      });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Falha ao confirmar compra." });
    }
  }),
});
