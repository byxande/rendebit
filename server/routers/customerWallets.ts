import { z } from "zod";
import {
  listBtcLiquiditySettlements,
  listCustomerWallets,
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
});
