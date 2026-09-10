import { z } from "zod";
import {
  getCustomerWalletById,
  listBtcLiquiditySettlements,
  listCustomerWallets,
  listXverseActions,
  markXverseActionSigned,
  recordXverseAction,
  saveCustomerStacksWallet,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const customerWalletsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listCustomerWallets(ctx.user.id)),

  save: protectedProcedure
    .input(
      z.object({
        address: z.string().trim().min(39).max(80),
        network: z.enum(["testnet", "mainnet"]),
        label: z.string().trim().max(100).nullable().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      saveCustomerStacksWallet({
        userId: ctx.user.id,
        address: input.address,
        network: input.network,
        label: input.label ?? null,
      })
    ),

  settlements: protectedProcedure.query(({ ctx }) =>
    listBtcLiquiditySettlements(ctx.user.id)
  ),

  xverseActions: protectedProcedure.query(({ ctx }) =>
    listXverseActions(ctx.user.id)
  ),

  recordXverseConnection: protectedProcedure
    .input(
      z.object({
        walletId: z.number().int().positive(),
        publicKey: z.string().regex(/^[0-9a-fA-F]{2,132}$/),
        walletType: z.enum(["software", "ledger", "keystone"]),
        idempotencyKey: z.string().min(8).max(180),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const wallet = await getCustomerWalletById(ctx.user.id, input.walletId);
      if (!wallet) {
        throw new Error(
          "A carteira Xverse precisa pertencer à sua conta ativa."
        );
      }
      return recordXverseAction({
        userId: ctx.user.id,
        customerWalletId: wallet.id,
        actionType: "wallet_connection",
        network: wallet.network,
        walletAddress: wallet.address,
        status: "connected",
        providerReference: "sats-connect/xverse",
        metadata: { publicKey: input.publicKey, walletType: input.walletType },
        idempotencyKey: input.idempotencyKey,
      });
    }),

  recordXverseSignature: protectedProcedure
    .input(
      z.object({
        actionId: z.number().int().positive(),
        signedTransaction: z.string().min(2).max(200_000),
      })
    )
    .mutation(({ ctx, input }) =>
      markXverseActionSigned({
        userId: ctx.user.id,
        actionId: input.actionId,
        signedTransaction: input.signedTransaction,
      })
    ),
});
