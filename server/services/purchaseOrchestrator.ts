import {
  approvePurchasePayment,
  createBtcLiquiditySettlement,
  attachPurchasePayment,
  failSandboxPurchase,
  getPurchaseById,
  getPrimaryCustomerStacksWallet,
  recordProviderEvent,
  settleSandboxPurchase,
  startSandboxPurchase,
} from "../db";
import { ENV } from "../_core/env";
import { createMercadoPagoPaymentProvider } from "../providers/mercadoPago";
import { createBinanceBtcLiquidityProvider } from "../providers/binance";
import {
  sandboxBinanceLiquidityProvider,
  sandboxCustodyProvider,
  sandboxPurchasePaymentProvider,
  sandboxSbtcConversionProvider,
  sandboxYieldProvider,
} from "../providers/sandbox";
import {
  createStacksTestnetSbtcConversionProvider,
  createStacksTestnetYieldProvider,
} from "../providers/stacksTestnet";
import type {
  BtcLiquidityProvider,
  CustodyProvider,
  PurchasePaymentMethod,
  PurchasePaymentProvider,
  SbtcConversionProvider,
  YieldProvider,
} from "../providers/types";

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
  liquidity?: BtcLiquidityProvider;
  sbtcConversion: SbtcConversionProvider;
  yieldProvider: YieldProvider;
  startPurchase: typeof startSandboxPurchase;
  attachPayment: typeof attachPurchasePayment;
  approvePayment: typeof approvePurchasePayment;
  getPurchase: typeof getPurchaseById;
  settlePurchase: typeof settleSandboxPurchase;
  failPurchase: typeof failSandboxPurchase;
  recordEvent: typeof recordProviderEvent;
  registerLiquiditySettlement?: typeof createBtcLiquiditySettlement;
  getCustomerStacksWallet?: typeof getPrimaryCustomerStacksWallet;
};

const defaultYieldProvider =
  process.env.STACKS_YIELD_MODE === "testnet"
    ? createStacksTestnetYieldProvider()
    : sandboxYieldProvider;
const defaultSbtcConversionProvider =
  process.env.STACKS_YIELD_MODE === "testnet"
    ? createStacksTestnetSbtcConversionProvider()
    : sandboxSbtcConversionProvider;

const defaultPaymentProvider =
  ENV.paymentsProvider === "mercado_pago"
    ? createMercadoPagoPaymentProvider()
    : sandboxPurchasePaymentProvider;
const defaultLiquidityProvider =
  ENV.realBtcLiquidityEnabled && process.env.STACKS_YIELD_MODE === "testnet"
    ? createBinanceBtcLiquidityProvider()
    : sandboxBinanceLiquidityProvider;

const defaultDependencies: WorkflowDependencies = {
  payment: defaultPaymentProvider,
  custody: sandboxCustodyProvider,
  liquidity: defaultLiquidityProvider,
  sbtcConversion: defaultSbtcConversionProvider,
  yieldProvider: defaultYieldProvider,
  startPurchase: startSandboxPurchase,
  attachPayment: attachPurchasePayment,
  approvePayment: approvePurchasePayment,
  getPurchase: getPurchaseById,
  settlePurchase: settleSandboxPurchase,
  failPurchase: failSandboxPurchase,
  recordEvent: recordProviderEvent,
  registerLiquiditySettlement: createBtcLiquiditySettlement,
  getCustomerStacksWallet: getPrimaryCustomerStacksWallet,
};

async function assertCustomerStacksDestination(
  userId: number,
  dependencies: WorkflowDependencies
) {
  if (dependencies.liquidity?.mode !== "production") return;
  const wallet = await dependencies.getCustomerStacksWallet?.(
    userId,
    "testnet"
  );
  if (!wallet) {
    throw new Error(
      "Cadastre uma carteira pública Stacks testnet antes de habilitar a liquidez BTCBRL real."
    );
  }
}

async function activateApprovedPurchase(
  purchase: NonNullable<Awaited<ReturnType<typeof getPurchaseById>>>,
  idempotencyKey: string,
  dependencies: WorkflowDependencies
) {
  if (purchase.status === "settled" && purchase.yieldStatus === "active")
    return purchase;
  if (
    purchase.status !== "processing" ||
    purchase.paymentStatus !== "approved"
  ) {
    throw new Error("O pagamento ainda não foi aprovado e conciliado.");
  }
  try {
    await assertCustomerStacksDestination(purchase.userId, dependencies);
    await dependencies.sbtcConversion.preflight?.({
      purchaseId: purchase.id,
      btcAmount: purchase.btcAmount,
      idempotencyKey: `${idempotencyKey}:sbtc-preflight`,
    });
    await dependencies.yieldProvider.preflight?.({
      purchaseId: purchase.id,
      btcAmount: purchase.btcAmount,
      idempotencyKey: `${idempotencyKey}:yield-preflight`,
    });

    await dependencies.liquidity?.preflight?.({
      purchaseId: purchase.id,
      amountBrl: purchase.amountBrl,
      btcAmount: purchase.btcAmount,
      idempotencyKey: `${idempotencyKey}:binance-preflight`,
    });
    const liquidity = dependencies.liquidity
      ? await dependencies.liquidity.buyBitcoin({
          purchaseId: purchase.id,
          amountBrl: purchase.amountBrl,
          btcAmount: purchase.btcAmount,
          executionBtcBrl: purchase.executionBtcBrl,
          idempotencyKey: `${idempotencyKey}:binance-order`,
        })
      : await dependencies.custody.buyBitcoin({
          purchaseId: purchase.id,
          btcAmount: purchase.btcAmount,
          idempotencyKey: `${idempotencyKey}:custody`,
        });
    await dependencies.recordEvent({
      provider: dependencies.liquidity?.provider ?? "sandbox_custody",
      eventType: dependencies.liquidity
        ? "btc.brl.order.settled"
        : "btc.purchase.settled",
      externalId: liquidity.externalId,
      idempotencyKey: `${idempotencyKey}:liquidity-event`,
      payload: {
        purchaseId: purchase.id,
        ...liquidity.payload,
        result: liquidity.status,
        paymentProvider: purchase.paymentProvider,
      },
    });

    const liquidityPayload = liquidity.payload as {
      amountBrl?: string;
      btcAmount?: string;
      executionBtcBrl?: string;
      orderId?: string;
    };
    const btcAmount = liquidityPayload.btcAmount ?? purchase.btcAmount;
    const liquiditySettlement =
      await dependencies.registerLiquiditySettlement?.({
        purchaseId: purchase.id,
        userId: purchase.userId,
        liquidity: {
          provider: dependencies.liquidity?.provider ?? "sandbox_binance",
          mode: dependencies.liquidity?.mode ?? "sandbox",
          amountBrl: liquidityPayload.amountBrl ?? purchase.amountBrl,
          btcAmount,
          executionBtcBrl:
            liquidityPayload.executionBtcBrl ?? purchase.executionBtcBrl,
          orderId: liquidityPayload.orderId ?? liquidity.externalId,
        },
        idempotencyKey: `${idempotencyKey}:liquidity-settlement`,
      });
    if (liquiditySettlement) {
      await dependencies.recordEvent({
        provider: dependencies.yieldProvider.provider,
        eventType: "stacks.customer.settlement.pending",
        externalId: `stacks-settlement-${purchase.id}`,
        idempotencyKey: `${idempotencyKey}:stacks-customer-settlement`,
        payload: {
          purchaseId: purchase.id,
          settlementId: liquiditySettlement.id,
          status: liquiditySettlement.status,
          blockerReason: liquiditySettlement.blockerReason,
          network: liquiditySettlement.network,
          nextAction: "Aguardar carteira pública Stacks e preflight testnet",
        },
      });
    }

    const conversion = await dependencies.sbtcConversion.convertBtcToSbtc({
      purchaseId: purchase.id,
      btcAmount,
      idempotencyKey: `${idempotencyKey}:sbtc-conversion`,
    });
    await dependencies.recordEvent({
      provider: dependencies.sbtcConversion.provider,
      eventType: "sbtc.conversion.completed",
      externalId: conversion.externalId,
      idempotencyKey: `${idempotencyKey}:sbtc-event`,
      payload: {
        purchaseId: purchase.id,
        ...conversion.payload,
        result: conversion.status,
        mode: dependencies.sbtcConversion.network,
      },
    });

    const yieldPosition = await dependencies.yieldProvider.activatePosition({
      purchaseId: purchase.id,
      sbtcAmount: conversion.payload.sbtcAmount,
      idempotencyKey: `${idempotencyKey}:yield`,
      customerWalletAddress: (
        await dependencies.getCustomerStacksWallet?.(purchase.userId, "testnet")
      )?.address,
    });
    await dependencies.recordEvent({
      provider: dependencies.yieldProvider.provider,
      eventType: "yield.position.activated",
      externalId: yieldPosition.externalId,
      idempotencyKey: `${idempotencyKey}:stacks-event`,
      payload: {
        purchaseId: purchase.id,
        ...yieldPosition.payload,
        result: yieldPosition.status,
        mode: dependencies.yieldProvider.network,
      },
    });

    return dependencies.settlePurchase({
      userId: purchase.userId,
      purchaseId: purchase.id,
      idempotencyKey,
    });
  } catch (error) {
    await dependencies.failPurchase(purchase.userId, purchase.id);
    throw error;
  }
}

export async function confirmPurchaseWorkflow(
  input: WorkflowInput,
  dependencies: WorkflowDependencies = defaultDependencies
) {
  const purchase = await dependencies.startPurchase({
    userId: input.userId,
    quoteId: input.quoteId,
    idempotencyKey: input.idempotencyKey,
    paymentMethod: input.paymentMethod,
    paymentProvider:
      dependencies.payment.provider === "mercado_pago"
        ? "mercado_pago"
        : "sandbox",
  });
  if (purchase.status === "settled" && purchase.yieldStatus === "active")
    return purchase;
  if (
    purchase.status === "processing" &&
    purchase.paymentStatus === "approved"
  ) {
    return activateApprovedPurchase(
      purchase,
      input.idempotencyKey,
      dependencies
    );
  }
  if (purchase.status !== "awaiting_payment")
    throw new Error(
      "A compra já foi encerrada e precisa de reconciliação manual."
    );

  await assertCustomerStacksDestination(purchase.userId, dependencies);
  await dependencies.sbtcConversion.preflight?.({
    purchaseId: purchase.id,
    btcAmount: purchase.btcAmount,
    idempotencyKey: `${input.idempotencyKey}:sbtc-preflight`,
  });
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
    eventType:
      payment.payload.paymentStatus === "approved"
        ? "payment.approved"
        : "payment.checkout.created",
    externalId: payment.externalId,
    idempotencyKey: `${input.idempotencyKey}:payment-event`,
    payload: {
      purchaseId: purchase.id,
      amountBrl: purchase.amountBrl,
      ...payment.payload,
      mode: dependencies.payment.mode,
    },
  });

  if (!updated) throw new Error("Falha ao persistir o estado do pagamento.");
  if (payment.payload.paymentStatus === "pending") return updated;
  return activateApprovedPurchase(updated, input.idempotencyKey, dependencies);
}

export async function settleMercadoPagoPurchase(
  input: {
    purchaseId: number;
    paymentReference: string;
    amountBrl: number;
  },
  dependencies: WorkflowDependencies = defaultDependencies
) {
  const purchase = await dependencies.getPurchase(input.purchaseId);
  if (!purchase) throw new Error("Compra não encontrada.");
  if (purchase.paymentProvider !== "mercado_pago")
    throw new Error("Compra não pertence ao Mercado Pago.");
  if (Math.abs(Number(purchase.amountBrl) - input.amountBrl) > 0.01)
    throw new Error("Valor aprovado diverge da compra registrada.");
  const approved = await dependencies.approvePayment({
    purchaseId: purchase.id,
    paymentReference: input.paymentReference,
  });
  if (!approved) throw new Error("Falha ao conciliar o pagamento aprovado.");
  await dependencies.recordEvent({
    provider: "mercado_pago",
    eventType: "payment.approved",
    externalId: input.paymentReference,
    idempotencyKey: `mp-payment-${input.paymentReference}`,
    payload: {
      purchaseId: purchase.id,
      amountBrl: input.amountBrl,
      signatureVerified: true,
    },
  });
  return activateApprovedPurchase(
    approved,
    purchase.externalReference,
    dependencies
  );
}
