import { describe, expect, it, vi } from "vitest";
import { confirmPurchaseWorkflow } from "./purchaseOrchestrator";

const awaitingPurchase = {
  id: 42,
  userId: 7,
  quoteId: 9,
  externalReference: "purchase-key",
  amountBrl: "1000.00",
  serviceFeeBrl: "5.00",
  btcAmount: "0.00247144",
  executionBtcBrl: "402600.00",
  paymentMethod: "pix",
  paymentProvider: "sandbox",
  paymentReference: null,
  paymentStatus: "pending",
  checkoutUrl: null,
  status: "awaiting_payment",
  yieldStatus: "pending",
};

const workflowInput = {
  userId: 7,
  quoteId: 9,
  idempotencyKey: "purchase-key",
  paymentMethod: "pix" as const,
  payerEmail: "user@example.com",
  returnBaseUrl: "https://sandbox.rendebit.local",
};

function dependencies(paymentStatus: "approved" | "pending" = "approved") {
  const calls: string[] = [];
  const processingPurchase = { ...awaitingPurchase, paymentReference: "payment-42", paymentStatus, checkoutUrl: paymentStatus === "pending" ? "https://checkout.example" : null, status: paymentStatus === "approved" ? "processing" : "awaiting_payment" };
  return {
    calls,
    deps: {
      startPurchase: vi.fn(async () => ({ ...awaitingPurchase })),
      attachPayment: vi.fn(async () => ({ ...processingPurchase })),
      approvePayment: vi.fn(async () => ({ ...processingPurchase, paymentStatus: "approved", status: "processing" })),
      getPurchase: vi.fn(async () => ({ ...processingPurchase })),
      settlePurchase: vi.fn(async () => ({ ...processingPurchase, status: "settled", yieldStatus: "active" })),
      failPurchase: vi.fn(async () => undefined),
      recordEvent: vi.fn(async input => { calls.push(`event:${input.provider}`); return input; }),
      payment: {
        provider: "sandbox_payments" as const,
        mode: "sandbox" as const,
        createCheckout: vi.fn(async () => {
          calls.push("payment");
          return { externalId: "payment-42", status: paymentStatus, payload: { checkoutUrl: paymentStatus === "pending" ? "https://checkout.example" : null, paymentMethod: "pix" as const, paymentStatus } } as const;
        }),
      },
      custody: { buyBitcoin: vi.fn(async () => { calls.push("custody"); return { externalId: "custody-42", status: "settled", payload: { btcAmount: "0.00247144" } } as const; }) },
      sbtcConversion: {
        provider: "sandbox_custody" as const,
        network: "sandbox" as const,
        preflight: vi.fn(async () => { calls.push("sbtc-preflight"); }),
        convertBtcToSbtc: vi.fn(async () => { calls.push("sbtc-conversion"); return { externalId: "sbtc-42", status: "settled", payload: { btcAmount: "0.00247144", sbtcAmount: "0.00247144", route: "BTC>sBTC" as const, network: "sandbox" as const } }; }),
      },
      yieldProvider: {
        provider: "sandbox_stacks" as const,
        network: "sandbox" as const,
        preflight: vi.fn(async () => { calls.push("preflight"); }),
        activatePosition: vi.fn(async () => { calls.push("yield"); return { externalId: "stacks-42", status: "active", payload: { btcAmount: "0.00247144", sbtcAmount: "0.00247144", route: "BTC>sBTC>stBTC" } } as const; }),
      },
    },
  };
}

describe("confirmPurchaseWorkflow", () => {
  it("executa custódia e rendimento somente depois do pagamento aprovado", async () => {
    const { deps, calls } = dependencies("approved");
    const result = await confirmPurchaseWorkflow(workflowInput, deps as never);
    expect(result.status).toBe("settled");
    expect(calls).toEqual(["sbtc-preflight", "preflight", "payment", "event:sandbox_payments", "sbtc-preflight", "preflight", "custody", "event:sandbox_custody", "sbtc-conversion", "event:sandbox_custody", "yield", "event:sandbox_stacks"]);
    expect(deps.sbtcConversion.convertBtcToSbtc).toHaveBeenCalledWith(expect.objectContaining({ btcAmount: "0.00247144" }));
    expect(deps.yieldProvider.activatePosition).toHaveBeenCalledWith(expect.objectContaining({ sbtcAmount: "0.00247144" }));
    expect(deps.settlePurchase).toHaveBeenCalledOnce();
  });

  it("mantém a compra aguardando quando o checkout hospedado ainda está pendente", async () => {
    const { deps } = dependencies("pending");
    const result = await confirmPurchaseWorkflow(workflowInput, deps as never);
    expect(result.status).toBe("awaiting_payment");
    expect(result.checkoutUrl).toBe("https://checkout.example");
    expect(deps.custody.buyBitcoin).not.toHaveBeenCalled();
    expect(deps.yieldProvider.activatePosition).not.toHaveBeenCalled();
  });

  it("não ativa rendimento quando a conversão BTC para sBTC falha", async () => {
    const { deps } = dependencies("approved");
    deps.sbtcConversion.convertBtcToSbtc.mockRejectedValueOnce(new Error("Conversão BTC para sBTC indisponível") as never);
    await expect(confirmPurchaseWorkflow(workflowInput, deps as never)).rejects.toThrow("Conversão BTC para sBTC indisponível");
    expect(deps.custody.buyBitcoin).toHaveBeenCalledOnce();
    expect(deps.yieldProvider.activatePosition).not.toHaveBeenCalled();
    expect(deps.failPurchase).toHaveBeenCalledOnce();
  });

  it("não cria checkout quando o preflight dos contratos falha", async () => {
    const { deps } = dependencies();
    deps.yieldProvider.preflight.mockRejectedValueOnce(new Error("stBTC testnet não configurado") as never);
    await expect(confirmPurchaseWorkflow(workflowInput, deps as never)).rejects.toThrow("stBTC testnet não configurado");
    expect(deps.payment.createCheckout).not.toHaveBeenCalled();
    expect(deps.custody.buyBitcoin).not.toHaveBeenCalled();
  });

  it("não repete provedores quando a compra já está liquidada", async () => {
    const { deps } = dependencies();
    deps.startPurchase.mockResolvedValueOnce({ ...awaitingPurchase, status: "settled", paymentStatus: "approved", yieldStatus: "active" } as never);
    await confirmPurchaseWorkflow(workflowInput, deps as never);
    expect(deps.payment.createCheckout).not.toHaveBeenCalled();
    expect(deps.settlePurchase).not.toHaveBeenCalled();
  });
});
