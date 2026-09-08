import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getCustomerProfile,
  recordProviderEvent,
  upsertSandboxProfile,
  verifySandboxProfile,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { sandboxKycProvider } from "../providers/sandbox";

export const onboardingRouter = router({
  get: protectedProcedure.query(({ ctx }) => getCustomerProfile(ctx.user.id)),

  save: protectedProcedure.input(z.object({
    legalName: z.string().min(3).max(180),
    cpfMasked: z.string().min(8).max(20),
    pixBank: z.string().min(2).max(120),
    pixAccountMasked: z.string().min(4).max(80),
    residentBrazil: z.literal(true),
    cpfConfirmed: z.literal(true),
    pixOwnershipConfirmed: z.literal(true),
  })).mutation(async ({ ctx, input }) => {
    if (!input.residentBrazil || !input.cpfConfirmed || !input.pixOwnershipConfirmed) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Confirme todos os critérios de elegibilidade." });
    }
    return upsertSandboxProfile({
      userId: ctx.user.id,
      legalName: input.legalName,
      cpfMasked: input.cpfMasked,
      pixBank: input.pixBank,
      pixAccountMasked: input.pixAccountMasked,
      pixOwnershipConfirmed: input.pixOwnershipConfirmed,
    });
  }),

  simulateKycApproval: protectedProcedure.input(z.object({
    idempotencyKey: z.string().min(8).max(180),
  })).mutation(async ({ ctx, input }) => {
    const profile = await getCustomerProfile(ctx.user.id);
    if (!profile) throw new TRPCError({ code: "BAD_REQUEST", message: "Salve os dados antes de simular o KYC." });

    const result = await sandboxKycProvider.verifyIdentity({ userId: ctx.user.id, cpfMasked: profile.cpfMasked });
    await recordProviderEvent({
      provider: "sandbox_kyc",
      eventType: "verification.approved",
      externalId: result.externalId,
      idempotencyKey: input.idempotencyKey,
      payload: { userId: ctx.user.id, cpf: profile.cpfMasked, ...result.payload, result: result.status, mode: "sandbox" },
    });
    return verifySandboxProfile(ctx.user.id, result.externalId);
  }),
});
