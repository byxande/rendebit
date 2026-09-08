import {
  attachPixDepositCharge,
  getPixDeposit,
  recordProviderEvent,
  settlePixDeposit,
  startPixDeposit,
} from "../db";
import { sandboxPixProvider } from "../providers/sandbox";
import type { PixProvider } from "../providers/types";

type Dependencies = {
  pix: PixProvider;
  start: typeof startPixDeposit;
  attach: typeof attachPixDepositCharge;
  get: typeof getPixDeposit;
  settle: typeof settlePixDeposit;
  recordEvent: typeof recordProviderEvent;
};

const defaultDependencies: Dependencies = {
  pix: sandboxPixProvider,
  start: startPixDeposit,
  attach: attachPixDepositCharge,
  get: getPixDeposit,
  settle: settlePixDeposit,
  recordEvent: recordProviderEvent,
};

export async function createPixDepositWorkflow(
  input: { userId: number; amountBrl: number; idempotencyKey: string },
  dependencies: Dependencies = defaultDependencies,
) {
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  const deposit = await dependencies.start({ ...input, expiresAt });
  if (deposit.status !== "created") return deposit;
  const chargeKey = `pix-deposit-${deposit.id}:charge`;

  const charge = await dependencies.pix.createCashInCharge({
    depositId: deposit.id,
    amountBrl: deposit.amountBrl,
    expiresAt: deposit.expiresAt,
    idempotencyKey: chargeKey,
  });
  await dependencies.recordEvent({
    provider: "sandbox_pix",
    eventType: "pix.deposit.charge.created",
    externalId: charge.externalId,
    idempotencyKey: `${chargeKey}:event`,
    payload: { depositId: deposit.id, ...charge.payload, result: charge.status, mode: "sandbox" },
  });
  const attached = await dependencies.attach({
    userId: input.userId,
    depositId: deposit.id,
    providerReference: charge.externalId,
    pixCopyPaste: charge.payload.pixCopyPaste,
    qrCodeText: charge.payload.qrCodeText,
  });
  if (!attached) throw new Error("Falha ao registrar a cobrança Pix.");
  return attached;
}

export async function settlePixDepositWorkflow(
  input: { userId: number; depositId: number; idempotencyKey: string },
  dependencies: Dependencies = defaultDependencies,
) {
  const deposit = await dependencies.get(input.userId, input.depositId);
  if (!deposit) throw new Error("Depósito Pix não encontrado.");
  if (deposit.status === "paid") return deposit;
  if (deposit.status !== "awaiting_payment") throw new Error("Depósito Pix não aguarda pagamento.");
  if (deposit.expiresAt.getTime() <= Date.now()) throw new Error("A cobrança Pix expirou. Gere um novo QR Code.");
  const settlementKey = `pix-deposit-${deposit.id}:settlement`;

  const payment = await dependencies.pix.confirmCashInCharge({
    depositId: deposit.id,
    amountBrl: deposit.amountBrl,
    idempotencyKey: settlementKey,
  });
  await dependencies.recordEvent({
    provider: "sandbox_pix",
    eventType: "pix.deposit.paid",
    externalId: payment.externalId,
    idempotencyKey: `${settlementKey}:event`,
    payload: { depositId: deposit.id, ...payment.payload, result: payment.status, mode: "sandbox" },
  });
  return dependencies.settle({
    userId: input.userId,
    depositId: deposit.id,
    endToEndId: payment.payload.endToEndId,
    idempotencyKey: settlementKey,
  });
}
