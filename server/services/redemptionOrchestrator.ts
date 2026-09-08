import {
  advanceSandboxRedemption,
  failSandboxRedemption,
  recordProviderEvent,
  settleSandboxRedemption,
  startSandboxRedemption,
} from "../db";
import { sandboxCustodyProvider, sandboxPixProvider, sandboxYieldProvider } from "../providers/sandbox";
import { createStacksTestnetYieldProvider } from "../providers/stacksTestnet";
import type { CustodyProvider, PixProvider, YieldProvider } from "../providers/types";

type RedemptionWorkflowInput = {
  userId: number;
  quoteId: number;
  idempotencyKey: string;
};

type RedemptionWorkflowDependencies = {
  pix: PixProvider;
  custody: CustodyProvider;
  yieldProvider: YieldProvider;
  startRedemption: typeof startSandboxRedemption;
  advanceRedemption: typeof advanceSandboxRedemption;
  settleRedemption: typeof settleSandboxRedemption;
  failRedemption: typeof failSandboxRedemption;
  recordEvent: typeof recordProviderEvent;
};

const defaultYieldProvider = process.env.STACKS_YIELD_MODE === "testnet"
  ? createStacksTestnetYieldProvider()
  : sandboxYieldProvider;

const defaultDependencies: RedemptionWorkflowDependencies = {
  pix: sandboxPixProvider,
  custody: sandboxCustodyProvider,
  yieldProvider: defaultYieldProvider,
  startRedemption: startSandboxRedemption,
  advanceRedemption: advanceSandboxRedemption,
  settleRedemption: settleSandboxRedemption,
  failRedemption: failSandboxRedemption,
  recordEvent: recordProviderEvent,
};

export async function confirmRedemptionWorkflow(
  input: RedemptionWorkflowInput,
  dependencies: RedemptionWorkflowDependencies = defaultDependencies,
) {
  if (!dependencies.yieldProvider.exitPosition) {
    throw new Error("O provedor de rendimento atual ainda não oferece saída automatizada. Nenhum Pix foi iniciado.");
  }

  const redemption = await dependencies.startRedemption(input);
  if (redemption.status === "settled" && redemption.stage === "completed") return redemption;
  if (redemption.status !== "processing") throw new Error("O resgate já foi encerrado e precisa de reconciliação manual.");

  let irreversibleStepCompleted = redemption.stage !== "reserved";
  try {
    const protocolExit = await dependencies.yieldProvider.exitPosition({
      redemptionId: redemption.id,
      btcAmount: redemption.btcAmount,
      idempotencyKey: `${input.idempotencyKey}:yield-exit`,
    });
    irreversibleStepCompleted = true;
    await dependencies.advanceRedemption({
      userId: input.userId,
      redemptionId: redemption.id,
      stage: "protocol_exit",
      externalReference: protocolExit.externalId,
    });
    await dependencies.recordEvent({
      provider: dependencies.yieldProvider.provider,
      eventType: "yield.position.exited",
      externalId: protocolExit.externalId,
      idempotencyKey: `${input.idempotencyKey}:yield-exit-event`,
      payload: { redemptionId: redemption.id, ...protocolExit.payload, result: protocolExit.status, mode: dependencies.yieldProvider.network },
    });

    const conversion = await dependencies.custody.sellBitcoin({
      redemptionId: redemption.id,
      btcAmount: redemption.btcAmount,
      grossBrl: redemption.grossBrl,
      idempotencyKey: `${input.idempotencyKey}:conversion`,
    });
    await dependencies.advanceRedemption({
      userId: input.userId,
      redemptionId: redemption.id,
      stage: "conversion",
      externalReference: conversion.externalId,
    });
    await dependencies.recordEvent({
      provider: "sandbox_custody",
      eventType: "btc.sale.settled",
      externalId: conversion.externalId,
      idempotencyKey: `${input.idempotencyKey}:conversion-event`,
      payload: { redemptionId: redemption.id, ...conversion.payload, result: conversion.status, mode: "sandbox" },
    });

    const pix = await dependencies.pix.settleCashOut({
      redemptionId: redemption.id,
      amountBrl: redemption.netBrl,
      pixDestinationMasked: redemption.pixDestinationMasked,
      idempotencyKey: `${input.idempotencyKey}:pix-out`,
    });
    await dependencies.advanceRedemption({
      userId: input.userId,
      redemptionId: redemption.id,
      stage: "pix",
      externalReference: pix.externalId,
    });
    await dependencies.recordEvent({
      provider: "sandbox_pix",
      eventType: "pix.cash_out.settled",
      externalId: pix.externalId,
      idempotencyKey: `${input.idempotencyKey}:pix-out-event`,
      payload: { redemptionId: redemption.id, ...pix.payload, result: pix.status, mode: "sandbox" },
    });

    return dependencies.settleRedemption({
      userId: input.userId,
      redemptionId: redemption.id,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no resgate.";
    await dependencies.failRedemption(input.userId, redemption.id, message, irreversibleStepCompleted);
    throw error;
  }
}
