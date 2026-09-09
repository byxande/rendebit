import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  approveSandboxDistribution,
  createProfitDistribution,
  createProfitCapitalSweep,
  getTreasurySettings,
  listProfitCapitalSweeps,
  listOperationalLedger,
  listProfitDistributions,
  updateTreasurySettings,
  approveSandboxProfitCapitalSweep,
} from "../db";
import { adminProcedure, router } from "../_core/trpc";

export const treasuryRouter = router({
  settings: adminProcedure.query(({ ctx }) => getTreasurySettings(ctx.user.id)),
  distributions: adminProcedure.query(({ ctx }) =>
    listProfitDistributions(ctx.user.id)
  ),
  capitalSweeps: adminProcedure.query(({ ctx }) =>
    listProfitCapitalSweeps(ctx.user.id)
  ),
  ledger: adminProcedure.query(() => listOperationalLedger()),

  updateSettings: adminProcedure
    .input(
      z.object({
    organizationName: z.string().min(2).max(160),
    stacksWalletAddress: z.string().max(80).nullable(),
        personalProfitWalletAddress: z.string().max(80).nullable(),
    distributionAsset: z.enum(["STX", "sBTC", "stBTC"]),
    cadence: z.enum(["daily", "weekly", "monthly"]),
    approvalMode: z.enum(["manual", "multisig", "automatic"]),
    network: z.enum(["testnet", "mainnet"]),
    taxReserveBps: z.number().int().min(0).max(5000),
    operationalReserveBps: z.number().int().min(0).max(5000),
      })
    )
    .mutation(({ ctx, input }) =>
      updateTreasurySettings({ ownerUserId: ctx.user.id, ...input })
    ),

  closePeriod: adminProcedure
    .input(
      z.object({
    periodKey: z.string().regex(/^\d{4}-\d{2}$/),
    idempotencyKey: z.string().min(8).max(160),
      })
    )
    .mutation(({ ctx, input }) =>
      createProfitDistribution(
        ctx.user.id,
        input.periodKey,
        input.idempotencyKey
      )
    ),

  approveSandbox: adminProcedure
    .input(z.object({ distributionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
    try {
        return await approveSandboxDistribution(
          ctx.user.id,
          input.distributionId
        );
    } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao aprovar distribuição.",
        });
      }
    }),
  proposeStbtcSweep: adminProcedure
    .input(
      z.object({
        distributionId: z.number().int().positive(),
        idempotencyKey: z.string().min(8).max(160),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createProfitCapitalSweep(
          ctx.user.id,
          input.distributionId,
          input.idempotencyKey
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao propor sweep de lucro.",
        });
      }
    }),
  approveStbtcSweep: adminProcedure
    .input(z.object({ sweepId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await approveSandboxProfitCapitalSweep(
          ctx.user.id,
          input.sweepId
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao aprovar sweep de lucro.",
        });
    }
  }),
});
