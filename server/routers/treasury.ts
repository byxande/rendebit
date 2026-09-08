import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  approveSandboxDistribution,
  createProfitDistribution,
  getTreasurySettings,
  listOperationalLedger,
  listProfitDistributions,
  updateTreasurySettings,
} from "../db";
import { adminProcedure, router } from "../_core/trpc";

export const treasuryRouter = router({
  settings: adminProcedure.query(({ ctx }) => getTreasurySettings(ctx.user.id)),
  distributions: adminProcedure.query(({ ctx }) => listProfitDistributions(ctx.user.id)),
  ledger: adminProcedure.query(() => listOperationalLedger()),

  updateSettings: adminProcedure.input(z.object({
    organizationName: z.string().min(2).max(160),
    stacksWalletAddress: z.string().max(80).nullable(),
    distributionAsset: z.enum(["STX", "sBTC", "stBTC"]),
    cadence: z.enum(["daily", "weekly", "monthly"]),
    approvalMode: z.enum(["manual", "multisig", "automatic"]),
    network: z.enum(["testnet", "mainnet"]),
    taxReserveBps: z.number().int().min(0).max(5000),
    operationalReserveBps: z.number().int().min(0).max(5000),
  })).mutation(({ ctx, input }) => updateTreasurySettings({ ownerUserId: ctx.user.id, ...input })),

  closePeriod: adminProcedure.input(z.object({
    periodKey: z.string().regex(/^\d{4}-\d{2}$/),
    idempotencyKey: z.string().min(8).max(160),
  })).mutation(({ ctx, input }) => createProfitDistribution(ctx.user.id, input.periodKey, input.idempotencyKey)),

  approveSandbox: adminProcedure.input(z.object({ distributionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      return await approveSandboxDistribution(ctx.user.id, input.distributionId);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Falha ao aprovar distribuição." });
    }
  }),
});
