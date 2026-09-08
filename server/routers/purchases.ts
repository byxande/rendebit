import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  confirmSandboxPurchase,
  createPurchaseQuote,
  getCustomerProfile,
  listLedger,
  listPurchases,
  recordProviderEvent,
} from "../db";
import { calculatePurchaseQuote } from "../finance";
import { protectedProcedure, router } from "../_core/trpc";
import { sandboxCustodyProvider, sandboxPixProvider, sandboxYieldProvider } from "../providers/sandbox";

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
  })).mutation(async ({ ctx, input }) => {
    try {
      const purchase = await confirmSandboxPurchase({
        userId: ctx.user.id,
        quoteId: input.quoteId,
        idempotencyKey: input.idempotencyKey,
      });
      const [pix, custody, yieldPosition] = await Promise.all([
        sandboxPixProvider.settleCashIn({ purchaseId: purchase.id, amountBrl: purchase.amountBrl }),
        sandboxCustodyProvider.buyBitcoin({ purchaseId: purchase.id, btcAmount: purchase.btcAmount }),
        sandboxYieldProvider.activatePosition({ purchaseId: purchase.id, btcAmount: purchase.btcAmount }),
      ]);
      await Promise.all([
        recordProviderEvent({
          provider: "sandbox_pix",
          eventType: "pix.cash_in.settled",
          externalId: pix.externalId,
          idempotencyKey: `${input.idempotencyKey}:pix-event`,
          payload: { purchaseId: purchase.id, ...pix.payload, result: pix.status, mode: "sandbox" },
        }),
        recordProviderEvent({
          provider: "sandbox_custody",
          eventType: "btc.purchase.settled",
          externalId: custody.externalId,
          idempotencyKey: `${input.idempotencyKey}:custody-event`,
          payload: { purchaseId: purchase.id, ...custody.payload, result: custody.status, mode: "sandbox" },
        }),
        recordProviderEvent({
          provider: "sandbox_stacks",
          eventType: "yield.position.activated",
          externalId: yieldPosition.externalId,
          idempotencyKey: `${input.idempotencyKey}:stacks-event`,
          payload: { purchaseId: purchase.id, ...yieldPosition.payload, result: yieldPosition.status, mode: "sandbox" },
        }),
      ]);
      return purchase;
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Falha ao confirmar compra." });
    }
  }),
});
