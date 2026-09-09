import {
  approvePurchasePayment,
  attachPurchasePayment,
  failSandboxPurchase,
  getPurchaseById,
  recordProviderEvent,
  settleSandboxPurchase,
  startSandboxPurchase,
} from "../db";
import { ENV } from "../_core/env";
import { createMercadoPagoPaymentProvider } from "../providers/mercadoPago";
import { sandboxCustodyProvider, sandboxPurchasePaymentProvider, sandboxYieldProvider } from "../providers/sandbox";
import { createStacksTestnetYieldProvider } from "../providers/stacksTestnet";
import type { CustodyProvider, PurchasePaymentMethod, PurchasePaymentProvider, YieldProvider } from "../providers/types";

type WorkflowInput = {
  userId: number;
  quoteId: number;
  idempotencyKey: string;
  paymentMethod: PurchasePaymentMethod;
  payerEmail: string | null;
  returnBaseUrl: string;
};

type WorkflowDependencies = {
  payment: PurchasePaymentProvider;
  custody: CustodyProvider;
  yieldProvider: YieldProvider;
  startPurchase: typeof startSandboxPurchase;
  attachPayment: typeof attachPurchasePayment;
  approvePayment: typeof approvePurchasePayment;
  getPurchase: typeof getPurchaseById;
  settlePurchase: typeof settleSandboxPurchase;
  failPurchase: typeof failSandboxPurchase;
  recordEvent: typeof recordProviderEvent;
};

const defaultYieldProvider = process.env.STACKS_YIELD_MODE === "testnet"
  ? createStacksTestnetYieldProvider()
  : sandboxYieldProvider;

const defaultPaymentProvider = ENV.paymentsProvider === "mercado_pago"
  ? createMercadoPagoPaymentProvider()
  : sandboxPurchasePaymentProvider;

const defaultDependencies: WorkflowDependencies = {
  payment: defaultPaymentProvider,
  custody: sandboxCustodyProvider,
  yieldProvider: defaultYieldProvider,
  startPurchase: startSandboxPurchase,
  attachPayment: attachPurchasePayment,
  approvePayment: approvePurchasePayment,
  getPurchase: getPurchaseById,
  settlePurchase: settleSandboxPurchase,
  failPurchase: failSandboxPurchase,
  recordEvent: recordProviderEvent,
};

async function activateApprovedPurchase(
  purchase: NonNullable<Awaited<ReturnType<typeof getPurchaseById>>>,
  idempotencyKey: string,
  dependencies: WorkflowDependencies,
) {
  if (purchase.status === "settled" && purchase.yieldStatus === "active") return purchase;
  if (purchase.status !== "processing" || purchase.paymentStatus !== "approved") {
    throw new Error("O pagamento ainda não foi aprovado e conciliado.");
  }
  try {
    await dependencies.yieldProvider.preflight?.({
      purchaseId: purchase.id,
      btcAmount: purchase.btcAmount,
      idempotencyKey: `${idempotencyKey}:yield-preflight`,
    });

    const custody = await dependencies.custody.buyBitcoin({
      purchaseId: purchase.id,
      btcAmount: purchase.btcAmount,
      idempotencyKey: `${idempotencyKey}:custody`,
    });
    await dependencies.recordEvent({
      provider: "sandbox_custody",
      eventType: "btc.purchase.settled",
      externalId: custody.externalId,
      idempotencyKey: `${idempotencyKey}:custody-event`,
      payload: { purchaseId: purchase.id, ...custody.payload, result: custody.status, paymentProvider: purchase.paymentProvider },
    });

    const yieldPosition = await dependencies.yieldProvider.activatePosition({
      purchaseId: purchase.id,
      btcAmount: purchase.btcAmount,
      idempotencyKey: `${idempotencyKey}:yield`,
    });
    await dependencies.recordEvent({
      provider: dependencies.yieldProvider.provider,
      eventType: "yield.position.activated",
      externalId: yieldPosition.externalId,
      idempotencyKey: `${idempotencyKey}:stacks-event`,
      payload: { purchaseId: purchase.id, ...yieldPosition.payload, result: yieldPosition.status, mode: dependencies.yieldProvider.network },
    });

    return dependencies.settlePurchase({ userId: purchase.userId, purchaseId: purchase.id, idempotencyKey });
  } catch (error) {
    await dependencies.failPurchase(purchase.userId, purchase.id);
    throw error;
  }
}

export async function confirmPurchaseWorkflow(input: WorkflowInput, dependencies: WorkflowDependencies = defaultDependencies) {
  const purchase = await dependencies.startPurchase({
    userId: input.userId,
    quoteId: input.quoteId,
    idempotencyKey: input.idempotencyKey,
    paymentMethod: input.paymentMethod,
    paymentProvider: dependencies.payment.provider === "mercado_pago" ? "mercado_pago" : "sandbox",
  });
  if (purchase.status === "settled" && purchase.yieldStatus === "active") return purchase;
  if (purchase.status === "processing" && purchase.paymentStatus === "approved") {
    return activateApprovedPurchase(purchase, input.idempotencyKey, dependencies);
  }
  if (purchase.status !== "awaiting_payment") throw new Error("A compra já foi encerrada e precisa de reconciliação manual.");

  await dependencies.yieldProvider.preflight?.({
    purchaseId: purchase.id,
    btcAmount: purchase.btcAmount,
    idempotencyKey: `${input.idempotencyKey}:yield-preflight`,
  });

  const payment = await dependencies.payment.createCheckout({
    purchaseId: purchase.id,
    amountBrl: purchase.amountBrl,
    payerEmail: input.payerEmail,
    paymentMethod: input.paymentMethod,
    idempotencyKey: `${input.idempotencyKey}:payment`,
    returnBaseUrl: input.returnBaseUrl,
  });
  const updated = await dependencies.attachPayment({
    userId: purchase.userId,
    purchaseId: purchase.id,
    paymentReference: payment.externalId,
    paymentStatus: payment.payload.paymentStatus,
    checkoutUrl: payment.payload.checkoutUrl,
  });
  await dependencies.recordEvent({
    provider: dependencies.payment.provider,
    eventType: payment.payload.paymentStatus === "approved" ? "payment.approved" : "payment.checkout.created",
    externalId: payment.externalId,
    idempotencyKey: `${input.idempotencyKey}:payment-event`,
    payload: { purchaseId: purchase.id, amountBrl: purchase.amountBrl, ...payment.payload, mode: dependencies.payment.mode },
  });

  if (!updated) throw new Error("Falha ao persistir o estado do pagamento.");
  if (payment.payload.paymentStatus === "pending") return updated;
  return activateApprovedPurchase(updated, input.idempotencyKey, dependencies);
}

export async function settleMercadoPagoPurchase(input: {
  purchaseId: number;
  paymentReference: string;
  amountBrl: number;
}, dependencies: WorkflowDependencies = defaultDependencies) {
  const purchase = await dependencies.getPurchase(input.purchaseId);
  if (!purchase) throw new Error("Compra não encontrada.");
  if (purchase.paymentProvider !== "mercado_pago") throw new Error("Compra não pertence ao Mercado Pago.");
  if (Math.abs(Number(purchase.amountBrl) - input.amountBrl) > 0.01) throw new Error("Valor aprovado diverge da compra registrada.");
  const approved = await dependencies.approvePayment({ purchaseId: purchase.id, paymentReference: input.paymentReference });
  if (!approved) throw new Error("Falha ao conciliar o pagamento aprovado.");
  await dependencies.recordEvent({
    provider: "mercado_pago",
    eventType: "payment.approved",
    externalId: input.paymentReference,
    idempotencyKey: `mp-payment-${input.paymentReference}`,
    payload: { purchaseId: purchase.id, amountBrl: input.amountBrl, signatureVerified: true },
  });
  return activateApprovedPurchase(approved, purchase.externalReference, dependencies);
}
