import { z } from "zod";
import {
  listAppNotifications,
  markAllAppNotificationsRead,
  markAppNotificationRead,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const notificationsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    listAppNotifications(ctx.user.id)
  ),

  markRead: protectedProcedure
    .input(z.object({ notificationId: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      markAppNotificationRead({
        userId: ctx.user.id,
        notificationId: input.notificationId,
      })
    ),

  markAllRead: protectedProcedure.mutation(({ ctx }) =>
    markAllAppNotificationsRead(ctx.user.id)
  ),
});
