import { describe, expect, it, vi } from "vitest";

const dbState = {
  actions: [
    {
      id: 44,
      userId: 7,
      actionType: "yield" as const,
      status: "intent_created" as const,
    },
  ],
  notifications: [] as Array<Record<string, unknown>>,
};

function buildChain(result: unknown) {
  const chain = {
    from: () => buildChain(result),
    where: () => buildChain(result),
    orderBy: () => buildChain(result),
    limit: () => Promise.resolve(result),
  };
  return Object.assign(chain, {
    then: <TResult1 = unknown, TResult2 = never>(
      resolve?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise.resolve(result).then(resolve, reject),
  });
}

const insert = vi.fn(() => ({
  values: vi.fn((value: Record<string, unknown>) => ({
    onDuplicateKeyUpdate: vi.fn(async () => {
      if (
        !dbState.notifications.some(item => item.dedupeKey === value.dedupeKey)
      ) {
        dbState.notifications.push({
          ...value,
          id: dbState.notifications.length + 1,
          readAt: null,
          createdAt: new Date(),
        });
      }
    }),
  })),
}));

const update = vi.fn(() => ({
  set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    select: (shape?: Record<string, unknown>) => {
      if (shape && "actionType" in shape) return buildChain(dbState.actions);
      return buildChain(dbState.notifications);
    },
    insert,
    update,
  }),
}));

vi.mock("../server/_core/env", () => ({ ENV: {} }));
vi.mock("../server/finance", () => ({
  calculateDistributableProfit: vi.fn(),
  calculateProfitStbtcSweep: vi.fn(),
  estimateDistributionAsset: vi.fn(),
  isValidStacksAddress: vi.fn(),
}));
vi.mock("../server/providers/sandbox", () => ({
  sandboxProfitConversionQuoteProvider: {},
}));

describe("notificações da conta", () => {
  it("cria somente um aviso para uma confirmação pendente", async () => {
    process.env.DATABASE_URL = "mysql://test";
    const { listAppNotifications } = await import("./db");

    const first = await listAppNotifications(7);
    const second = await listAppNotifications(7);

    expect(first.unreadCount).toBe(1);
    expect(second.notifications).toHaveLength(1);
    expect(second.notifications[0]).toMatchObject({
      title: "Confira uma atualização",
      actionLabel: "Conferir agora",
      actionView: "reservas",
    });
  });

  it("limita avisos à conta autenticada ao marcar como lido", async () => {
    const { markAppNotificationRead } = await import("./db");

    await expect(
      markAppNotificationRead({ userId: 7, notificationId: 1 })
    ).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalled();
  });
});
