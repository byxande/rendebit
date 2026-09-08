import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAvailableBrlBalance, listOperationalPixDeposits, listPixDeposits } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { createPixDepositWorkflow, settlePixDepositWorkflow } from "../services/pixDepositOrchestrator";

export const pixDepositsRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => ({
    availableBrl: await getAvailableBrlBalance(ctx.user.id),
    deposits: await listPixDeposits(ctx.user.id),
  })),

  create: protectedProcedure.input(z.object({
    amountBrl: z.number().min(10).max(1_000_000),
    idempotencyKey: z.string().min(8).max(120),
  })).mutation(async ({ ctx, input }) => {
    try {
      return await createPixDepositWorkflow({ userId: ctx.user.id, ...input });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Falha ao gerar cobrança Pix." });
    }
  }),

  simulatePayment: protectedProcedure.input(z.object({
    depositId: z.number().int().positive(),
    idempotencyKey: z.string().min(8).max(120),
  })).mutation(async ({ ctx, input }) => {
    try {
      return await settlePixDepositWorkflow({ userId: ctx.user.id, ...input });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Falha ao liquidar depósito Pix." });
    }
  }),

  operationalList: adminProcedure.query(() => listOperationalPixDeposits()),
});
