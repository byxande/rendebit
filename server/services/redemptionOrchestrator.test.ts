import { describe, expect, it, vi } from "vitest";
import { confirmRedemptionWorkflow } from "./redemptionOrchestrator";

const processingRedemption = {
  id: 51,
  userId: 7,
  quoteId: 11,
  externalReference: "redemption-key",
  btcAmount: "0.01000000",
  grossBrl: "4000.00",
  protocolFeeBrl: "6.00",
  conversionPixFeeBrl: "18.00",
  netBrl: "3976.00",
  pixDestinationMasked: "Banco Sandbox •••• 0000",
  status: "processing",
  stage: "reserved",
};

function dependencies() {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      startRedemption: vi.fn(async () => ({ ...processingRedemption })),
      advanceRedemption: vi.fn(async input => { calls.push(`stage:${input.stage}`); return { ...processingRedemption, stage: input.stage }; }),
      settleRedemption: vi.fn(async () => ({ ...processingRedemption, status: "settled", stage: "completed" })),
      failRedemption: vi.fn(async () => undefined),
      recordEvent: vi.fn(async input => { calls.push(`event:${input.provider}`); return input; }),
      pix: {
        settleCashIn: vi.fn(),
        settleCashOut: vi.fn(async () => { calls.push("pix-out"); return { externalId: "pix-out-51", status: "settled", payload: { amountBrl: "3976.00", pixDestinationMasked: "Banco Sandbox •••• 0000" } } as const; }),
      },
      custody: {
        buyBitcoin: vi.fn(),
        sellBitcoin: vi.fn(async () => { calls.push("conversion"); return { externalId: "sell-51", status: "settled", payload: { btcAmount: "0.01000000", grossBrl: "4000.00" } } as const; }),
      },
      yieldProvider: {
        provider: "sandbox_stacks" as const,
        network: "sandbox" as const,
        activatePosition: vi.fn(),
        exitPosition: vi.fn(async () => { calls.push("yield-exit"); return { externalId: "stacks-exit-51", status: "settled", payload: { btcAmount: "0.01000000", route: "stBTC>sBTC>BTC", network: "sandbox" } } as const; }),
      },
    },
  };
}

describe("confirmRedemptionWorkflow", () => {
  it("faz saída do protocolo, conversão e Pix antes de liquidar", async () => {
    const { deps, calls } = dependencies();
    const result = await confirmRedemptionWorkflow({ userId: 7, quoteId: 11, idempotencyKey: "redemption-key" }, deps as never);

    expect(result.status).toBe("settled");
    expect(calls).toEqual([
      "yield-exit", "stage:protocol_exit", "event:sandbox_stacks",
      "conversion", "stage:conversion", "event:sandbox_custody",
      "pix-out", "stage:pix", "event:sandbox_pix",
    ]);
    expect(deps.settleRedemption).toHaveBeenCalledOnce();
    expect(deps.failRedemption).not.toHaveBeenCalled();
  });

  it("libera a reserva quando falha antes da saída do protocolo", async () => {
    const { deps } = dependencies();
    deps.yieldProvider.exitPosition.mockRejectedValueOnce(new Error("protocol unavailable") as never);

    await expect(confirmRedemptionWorkflow({ userId: 7, quoteId: 11, idempotencyKey: "redemption-key" }, deps as never)).rejects.toThrow("protocol unavailable");
    expect(deps.custody.sellBitcoin).not.toHaveBeenCalled();
    expect(deps.pix.settleCashOut).not.toHaveBeenCalled();
    expect(deps.failRedemption).toHaveBeenCalledWith(7, 51, "protocol unavailable", false);
  });

  it("envia para revisão manual quando falha depois da saída do protocolo", async () => {
    const { deps } = dependencies();
    deps.custody.sellBitcoin.mockRejectedValueOnce(new Error("conversion unavailable") as never);

    await expect(confirmRedemptionWorkflow({ userId: 7, quoteId: 11, idempotencyKey: "redemption-key" }, deps as never)).rejects.toThrow("conversion unavailable");
    expect(deps.pix.settleCashOut).not.toHaveBeenCalled();
    expect(deps.failRedemption).toHaveBeenCalledWith(7, 51, "conversion unavailable", true);
  });

  it("não repete os provedores quando o resgate já está liquidado", async () => {
    const { deps } = dependencies();
    deps.startRedemption.mockResolvedValueOnce({ ...processingRedemption, status: "settled", stage: "completed" } as never);

    await confirmRedemptionWorkflow({ userId: 7, quoteId: 11, idempotencyKey: "redemption-key" }, deps as never);
    expect(deps.yieldProvider.exitPosition).not.toHaveBeenCalled();
    expect(deps.settleRedemption).not.toHaveBeenCalled();
  });

  it("bloqueia antes de reservar saldo quando o provedor não suporta saída", async () => {
    const { deps } = dependencies();
    delete (deps.yieldProvider as { exitPosition?: unknown }).exitPosition;

    await expect(confirmRedemptionWorkflow({ userId: 7, quoteId: 11, idempotencyKey: "redemption-key" }, deps as never)).rejects.toThrow("não oferece saída automatizada");
    expect(deps.startRedemption).not.toHaveBeenCalled();
  });
});
