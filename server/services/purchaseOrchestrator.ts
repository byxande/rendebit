import {
  failSandboxPurchase,
  recordProviderEvent,
  settleSandboxPurchase,
  startSandboxPurchase,
} from "../db";
import { sandboxCustodyProvider, sandboxPixProvider, sandboxYieldProvider } from "../providers/sandbox";
import { createStacksTestnetYieldProvider } from "../providers/stacksTestnet";
import type { CustodyProvider, PixProvider, YieldProvider } from "../providers/types";

type WorkflowInput = {
  userId: number;
  quoteId: number;
  idempotencyKey: string;
};

type WorkflowDependencies = {
  pix: PixProvider;
  custody: CustodyProvider;
  yieldProvider: YieldProvider;
  startPurchase: typeof startSandboxPurchase;
  settlePurchase: typeof settleSandboxPurchase;
  failPurchase: typeof failSandboxPurchase;
  recordEvent: typeof recordProviderEvent;
};

const defaultYieldProvider = process.env.STACKS_YIELD_MODE === "testnet"
  ? createStacksTestnetYieldProvider()
  : sandboxYieldProvider;

const defaultDependencies: WorkflowDependencies = {
  pix: sandboxPixProvider,
  custody: sandboxCustodyProvider,
  yieldProvider: defaultYieldProvider,
  startPurchase: startSandboxPurchase,
  settlePurchase: settleSandboxPurchase,
  failPurchase: failSandboxPurchase,
  recordEvent: recordProviderEvent,
};

export async function confirmPurchaseWorkflow(input: WorkflowInput, dependencies: WorkflowDependencies = defaultDependencies) {
  const purchase = await dependencies.startPurchase(input);
  if (purchase.status === "settled" && purchase.yieldStatus === "active") return purchase;
  if (purchase.status !== "processing") throw new Error("A compra já foi encerrada e precisa de reconciliação manual.");

  try {
    await dependencies.yieldProvider.preflight?.({
      purchaseId: purchase.id,
      btcAmount: purchase.btcAmount,
      idempotencyKey: `${input.idempotencyKey}:yield-preflight`,
    });

    const pix = await dependencies.pix.settleCashIn({
      purchaseId: purchase.id,
      amountBrl: purchase.amountBrl,
      idempotencyKey: `${input.idempotencyKey}:pix`,
    });
    await dependencies.recordEvent({
      provider: "sandbox_pix",
      eventType: "pix.cash_in.settled",
      externalId: pix.externalId,
      idempotencyKey: `${input.idempotencyKey}:pix-event`,
      payload: { purchaseId: purchase.id, ...pix.payload, result: pix.status, mode: "sandbox" },
    });

    const custody = await dependencies.custody.buyBitcoin({
      purchaseId: purchase.id,
      btcAmount: purchase.btcAmount,
      idempotencyKey: `${input.idempotencyKey}:custody`,
    });
    await dependencies.recordEvent({
      provider: "sandbox_custody",
      eventType: "btc.purchase.settled",
      externalId: custody.externalId,
      idempotencyKey: `${input.idempotencyKey}:custody-event`,
      payload: { purchaseId: purchase.id, ...custody.payload, result: custody.status, mode: "sandbox" },
    });

    const yieldPosition = await dependencies.yieldProvider.activatePosition({
      purchaseId: purchase.id,
      btcAmount: purchase.btcAmount,
      idempotencyKey: `${input.idempotencyKey}:yield`,
    });
    await dependencies.recordEvent({
      provider: dependencies.yieldProvider.provider,
      eventType: "yield.position.activated",
      externalId: yieldPosition.externalId,
      idempotencyKey: `${input.idempotencyKey}:stacks-event`,
      payload: { purchaseId: purchase.id, ...yieldPosition.payload, result: yieldPosition.status, mode: dependencies.yieldProvider.network },
    });

    return await dependencies.settlePurchase({
      userId: input.userId,
      purchaseId: purchase.id,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    await dependencies.failPurchase(input.userId, purchase.id);
    throw error;
  }
}
