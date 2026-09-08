import { describe, expect, it, vi } from "vitest";
import { confirmPurchaseWorkflow } from "./purchaseOrchestrator";

const processingPurchase = {
  id: 42,
  userId: 7,
  quoteId: 9,
  externalReference: "purchase-key",
  amountBrl: "1000.00",
  serviceFeeBrl: "5.00",
  btcAmount: "0.00247144",
  executionBtcBrl: "402600.00",
  status: "processing",
  yieldStatus: "pending",
};

function dependencies() {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      startPurchase: vi.fn(async () => ({ ...processingPurchase })),
      settlePurchase: vi.fn(async () => ({ ...processingPurchase, status: "settled", yieldStatus: "active" })),
      failPurchase: vi.fn(async () => undefined),
      recordEvent: vi.fn(async input => { calls.push(`event:${input.provider}`); return input; }),
      pix: { settleCashIn: vi.fn(async () => { calls.push("pix"); return { externalId: "pix-42", status: "settled", payload: { amountBrl: "1000.00" } } as const; }) },
      custody: { buyBitcoin: vi.fn(async () => { calls.push("custody"); return { externalId: "custody-42", status: "settled", payload: { btcAmount: "0.00247144" } } as const; }) },
      yieldProvider: { activatePosition: vi.fn(async () => { calls.push("yield"); return { externalId: "stacks-42", status: "active", payload: { btcAmount: "0.00247144", route: "BTC>sBTC>stBTC" } } as const; }) },
    },
  };
}

describe("confirmPurchaseWorkflow", () => {
  it("liquida somente depois de Pix, custódia e ativação do rendimento", async () => {
    const { deps, calls } = dependencies();
    const result = await confirmPurchaseWorkflow({ userId: 7, quoteId: 9, idempotencyKey: "purchase-key" }, deps as never);

    expect(result.status).toBe("settled");
    expect(calls).toEqual([
      "pix", "event:sandbox_pix",
      "custody", "event:sandbox_custody",
      "yield", "event:sandbox_stacks",
    ]);
    expect(deps.settlePurchase).toHaveBeenCalledOnce();
    expect(deps.failPurchase).not.toHaveBeenCalled();
  });

  it("marca a compra como falha e não ativa rendimento quando a custódia falha", async () => {
    const { deps } = dependencies();
    deps.custody.buyBitcoin.mockRejectedValueOnce(new Error("custody unavailable") as never);

    await expect(confirmPurchaseWorkflow({ userId: 7, quoteId: 9, idempotencyKey: "purchase-key" }, deps as never)).rejects.toThrow("custody unavailable");
    expect(deps.yieldProvider.activatePosition).not.toHaveBeenCalled();
    expect(deps.settlePurchase).not.toHaveBeenCalled();
    expect(deps.failPurchase).toHaveBeenCalledWith(7, 42);
  });

  it("não repete provedores quando a compra já está liquidada", async () => {
    const { deps } = dependencies();
    deps.startPurchase.mockResolvedValueOnce({ ...processingPurchase, status: "settled", yieldStatus: "active" } as never);

    await confirmPurchaseWorkflow({ userId: 7, quoteId: 9, idempotencyKey: "purchase-key" }, deps as never);
    expect(deps.pix.settleCashIn).not.toHaveBeenCalled();
    expect(deps.settlePurchase).not.toHaveBeenCalled();
  });
});
