import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import {
  approveSandboxDistribution,
  createProfitDistribution,
  createProfitCapitalSweep,
  claimDailyReconciliationTask,
  clearDailyReconciliationTaskClaim,
  getTreasurySettings,
  getTreasuryOwnerUserId,
  reconcileDailyTreasury,
  setDailyReconciliationTaskUid,
  listProfitCapitalSweeps,
  listProfitSweepApprovals,
  listDailyReconciliations,
  listOperationalLedger,
  listProfitDistributions,
  updateTreasurySettings,
  approveSandboxProfitCapitalSweep,
} from "../db";
import { adminProcedure, router } from "../_core/trpc";
import { createHeartbeatJob } from "../_core/heartbeat";

export const treasuryRouter = router({
  settings: adminProcedure.query(async ({ ctx }) =>
    getTreasurySettings(await getTreasuryOwnerUserId(ctx.user.id))
  ),
  distributions: adminProcedure.query(async ({ ctx }) =>
    listProfitDistributions(await getTreasuryOwnerUserId(ctx.user.id))
  ),
  capitalSweeps: adminProcedure.query(async ({ ctx }) =>
    listProfitCapitalSweeps(await getTreasuryOwnerUserId(ctx.user.id))
  ),
  approvals: adminProcedure.query(async ({ ctx }) =>
    listProfitSweepApprovals(await getTreasuryOwnerUserId(ctx.user.id))
  ),
  reconciliations: adminProcedure.query(async ({ ctx }) =>
    listDailyReconciliations(await getTreasuryOwnerUserId(ctx.user.id))
  ),
  ledger: adminProcedure.query(() => listOperationalLedger()),

  updateSettings: adminProcedure
    .input(
      z.object({
    organizationName: z.string().min(2).max(160),
    stacksWalletAddress: z.string().max(80).nullable(),
    personalProfitWalletAddress: z.string().max(80).nullable(),
    conversionPartner: z.string().max(120),
    conversionPartnerStatus: z.enum([
      "not_selected",
      "due_diligence",
      "contracted",
      "active",
    ]),
    distributionAsset: z.enum(["STX", "sBTC", "stBTC"]),
    cadence: z.enum(["daily", "weekly", "monthly"]),
    approvalMode: z.enum(["manual", "multisig", "automatic"]),
    network: z.enum(["testnet", "mainnet"]),
    taxReserveBps: z.number().int().min(0).max(5000),
    operationalReserveBps: z.number().int().min(0).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) =>
      updateTreasurySettings({
        ownerUserId: await getTreasuryOwnerUserId(ctx.user.id),
        ...input,
      })
    ),

  closePeriod: adminProcedure
    .input(
      z.object({
    periodKey: z.string().regex(/^\d{4}-\d{2}$/),
    idempotencyKey: z.string().min(8).max(160),
      })
    )
    .mutation(async ({ ctx, input }) =>
      createProfitDistribution(
        await getTreasuryOwnerUserId(ctx.user.id),
        input.periodKey,
        input.idempotencyKey
      )
    ),

  approveSandbox: adminProcedure
    .input(z.object({ distributionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
    try {
        return await approveSandboxDistribution(
          await getTreasuryOwnerUserId(ctx.user.id),
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
          await getTreasuryOwnerUserId(ctx.user.id),
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
    .input(
      z.object({
        sweepId: z.number().int().positive(),
        comment: z.string().max(500).nullable().optional(),
        idempotencyKey: z.string().min(8).max(180),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await approveSandboxProfitCapitalSweep(
          await getTreasuryOwnerUserId(ctx.user.id),
          input.sweepId,
          ctx.user.id,
          input.comment ?? null,
          input.idempotencyKey
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
  reconcileDaily: adminProcedure
    .input(z.object({ dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await reconcileDailyTreasury(
          await getTreasuryOwnerUserId(ctx.user.id),
          input.dateKey ?? new Date().toISOString().slice(0, 10)
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao reconciliar o dia.",
        });
      }
    }),
  enableDailyReconciliation: adminProcedure.mutation(async ({ ctx }) => {
    const ownerUserId = await getTreasuryOwnerUserId(ctx.user.id);
    const settings = await getTreasurySettings(ownerUserId);
    if (settings?.dailyReconciliationTaskUid) return settings;
    await claimDailyReconciliationTask(ownerUserId);
    const cookieToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME];
    const authorization = ctx.req.headers.authorization;
    const bearerToken =
      typeof authorization === "string" && authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : "";
    const sessionToken = cookieToken ?? bearerToken;
    try {
      const heartbeat = await createHeartbeatJob(
        {
          name: `treasury-daily-reconciliation-${ownerUserId}`,
          cron: "0 0 3 * * *",
          path: "/api/scheduled/daily-reconciliation",
          description: "Reconcilia diariamente o ledger e os sweeps da tesouraria RendeBit.",
        },
        sessionToken
      );
      return setDailyReconciliationTaskUid(ownerUserId, heartbeat.taskUid);
    } catch (error) {
      await clearDailyReconciliationTaskClaim(ownerUserId);
      throw error;
    }
  }),
});
