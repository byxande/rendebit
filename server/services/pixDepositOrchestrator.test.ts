import { describe, expect, it, vi } from "vitest";
import { createPixDepositWorkflow, settlePixDepositWorkflow } from "./pixDepositOrchestrator";

const baseDeposit = {
  id: 41,
  userId: 7,
  amountBrl: "500.00",
  status: "created" as const,
  idempotencyKey: "deposit-12345678",
  providerReference: null,
  endToEndId: null,
  qrCodeText: null,
  pixCopyPaste: null,
  expiresAt: new Date(Date.now() + 600_000),
  paidAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function dependencies(deposit = baseDeposit) {
  return {
    pix: {
      createCashInCharge: vi.fn(async () => ({ externalId: "charge-41", status: "active" as const, payload: { amountBrl: "500.00", pixCopyPaste: "PIX-CODE", qrCodeText: "PIX-CODE", expiresAt: deposit.expiresAt.toISOString() } })),
      confirmCashInCharge: vi.fn(async () => ({ externalId: "payment-41", status: "settled" as const, payload: { amountBrl: "500.00", endToEndId: "E123" } })),
      settleCashIn: vi.fn(),
      settleCashOut: vi.fn(),
    },
    start: vi.fn(async () => deposit),
    attach: vi.fn(async () => ({ ...deposit, status: "awaiting_payment" as const, providerReference: "charge-41", pixCopyPaste: "PIX-CODE", qrCodeText: "PIX-CODE" })),
    get: vi.fn(async () => ({ ...deposit, status: "awaiting_payment" as const })),
    settle: vi.fn(async () => ({ ...deposit, status: "paid" as const, endToEndId: "E123", paidAt: new Date() })),
    recordEvent: vi.fn(async () => ({ id: 1 } as never)),
  };
}

describe("pixDepositOrchestrator", () => {
  it("cria uma cobrança antes de expor o QR Code", async () => {
    const deps = dependencies();
    const result = await createPixDepositWorkflow({ userId: 7, amountBrl: 500, idempotencyKey: "deposit-12345678" }, deps);
    expect(result.status).toBe("awaiting_payment");
    expect(deps.pix.createCashInCharge).toHaveBeenCalledOnce();
    expect(deps.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "pix.deposit.charge.created" }));
    expect(deps.recordEvent.mock.invocationCallOrder[0]).toBeLessThan(deps.attach.mock.invocationCallOrder[0]);
  });

  it("liquida somente cobranças válidas e registra o evento antes do crédito", async () => {
    const deps = dependencies();
    const result = await settlePixDepositWorkflow({ userId: 7, depositId: 41, idempotencyKey: "payment-12345678" }, deps);
    expect(result.status).toBe("paid");
    expect(deps.pix.confirmCashInCharge).toHaveBeenCalledOnce();
    expect(deps.recordEvent.mock.invocationCallOrder[0]).toBeLessThan(deps.settle.mock.invocationCallOrder[0]);
  });

  it("bloqueia cobranças expiradas antes de chamar o provedor", async () => {
    const expired = { ...baseDeposit, expiresAt: new Date(Date.now() - 1_000) };
    const deps = dependencies(expired);
    await expect(settlePixDepositWorkflow({ userId: 7, depositId: 41, idempotencyKey: "payment-expired" }, deps)).rejects.toThrow("expirou");
    expect(deps.pix.confirmCashInCharge).not.toHaveBeenCalled();
  });
});
