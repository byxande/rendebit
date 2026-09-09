import { eq, like } from "drizzle-orm";
import {
  customerProfiles,
  ledgerEntries,
  pixDeposits,
  profitDistributions,
  providerEvents,
  purchaseQuotes,
  purchases,
  redemptionQuotes,
  redemptions,
  treasurySettings,
  users,
} from "../drizzle/schema";
import {
  createProfitDistribution,
  createPurchaseQuote,
  createRedemptionQuote,
  getAvailableBtcBalance,
  getAvailableBrlBalance,
  getDb,
  recordProviderEvent,
  updateTreasurySettings,
  upsertSandboxProfile,
  verifySandboxProfile,
} from "../server/db";
import { calculatePurchaseQuote, calculateRedemptionQuote } from "../server/finance";
import { confirmPurchaseWorkflow } from "../server/services/purchaseOrchestrator";
import { createPixDepositWorkflow, settlePixDepositWorkflow } from "../server/services/pixDepositOrchestrator";
import { confirmRedemptionWorkflow } from "../server/services/redemptionOrchestrator";

const db = await getDb();
if (!db) throw new Error("DATABASE_URL não disponível.");

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const openId = `sandbox-verifier-${suffix}`;
let userId: number | null = null;

try {
  await db.insert(users).values({ openId, name: "Verificador Sandbox", role: "admin" });
  const user = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
  if (!user) throw new Error("Usuário de verificação não foi criado.");
  userId = user.id;

  await upsertSandboxProfile({
    userId,
    legalName: "Verificador Sandbox",
    cpfMasked: "•••.000.•••-••",
    pixBank: "Banco Sandbox",
    pixAccountMasked: "•••• 0000",
    pixOwnershipConfirmed: true,
  });
  await verifySandboxProfile(userId, `kyc-${suffix}`);
  const firstEvent = await recordProviderEvent({
    provider: "sandbox_kyc",
    eventType: "verification.approved",
    externalId: `kyc-${suffix}`,
    idempotencyKey: `event-${suffix}`,
    payload: { result: "approved", mode: "verification" },
  });
  const duplicateEvent = await recordProviderEvent({
    provider: "sandbox_kyc",
    eventType: "verification.approved",
    externalId: `kyc-${suffix}`,
    idempotencyKey: `event-${suffix}`,
    payload: { result: "duplicate", mode: "verification" },
  });
  if (firstEvent?.id !== duplicateEvent?.id) throw new Error("Idempotência de webhook falhou.");

  const firstDeposit = await createPixDepositWorkflow({ userId, amountBrl: 500, idempotencyKey: `pix-deposit-${suffix}` });
  const duplicateDeposit = await createPixDepositWorkflow({ userId, amountBrl: 500, idempotencyKey: `pix-deposit-${suffix}` });
  if (firstDeposit.id !== duplicateDeposit.id || firstDeposit.status !== "awaiting_payment") throw new Error("Idempotência da cobrança Pix falhou.");
  const paidDeposit = await settlePixDepositWorkflow({ userId, depositId: firstDeposit.id, idempotencyKey: `pix-payment-${suffix}` });
  const duplicatePayment = await settlePixDepositWorkflow({ userId, depositId: firstDeposit.id, idempotencyKey: `pix-payment-${suffix}` });
  if (paidDeposit.id !== duplicatePayment.id || await getAvailableBrlBalance(userId) !== 500) throw new Error("Liquidação ou saldo Pix falhou.");

  const quote = calculatePurchaseQuote(1_000);
  const storedQuote = await createPurchaseQuote({
    userId,
    quote,
    idempotencyKey: `quote-${suffix}`,
    expiresAt: new Date(Date.now() + 60_000),
  });
  if (!storedQuote) throw new Error("Cotação não foi persistida.");

  const paymentInput = { userId, quoteId: storedQuote.id, idempotencyKey: `purchase-${suffix}`, paymentMethod: "pix" as const, payerEmail: "sandbox@example.com", returnBaseUrl: "https://sandbox.rendebit.local" };
  const firstPurchase = await confirmPurchaseWorkflow(paymentInput);
  const duplicatePurchase = await confirmPurchaseWorkflow(paymentInput);
  if (firstPurchase.id !== duplicatePurchase.id) throw new Error("Idempotência da compra falhou.");

  const availableBefore = await getAvailableBtcBalance(userId);
  const redemptionQuote = calculateRedemptionQuote(0.001);
  const storedRedemptionQuote = await createRedemptionQuote({
    userId,
    quote: redemptionQuote,
    idempotencyKey: `redemption-quote-${suffix}`,
    expiresAt: new Date(Date.now() + 60_000),
  });
  if (!storedRedemptionQuote) throw new Error("Cotação de resgate não foi persistida.");
  const firstRedemption = await confirmRedemptionWorkflow({ userId, quoteId: storedRedemptionQuote.id, idempotencyKey: `redemption-${suffix}` });
  const duplicateRedemption = await confirmRedemptionWorkflow({ userId, quoteId: storedRedemptionQuote.id, idempotencyKey: `redemption-${suffix}` });
  if (firstRedemption.id !== duplicateRedemption.id) throw new Error("Idempotência do resgate falhou.");
  const availableAfter = await getAvailableBtcBalance(userId);
  if (availableAfter !== Math.round((availableBefore - 0.001) * 100_000_000) / 100_000_000) throw new Error("Saldo disponível não refletiu o resgate.");

  await updateTreasurySettings({
    ownerUserId: userId,
    organizationName: "Organização de verificação",
    stacksWalletAddress: "ST000000000000000000002AMW42H",
    distributionAsset: "sBTC",
    cadence: "monthly",
    approvalMode: "manual",
    network: "testnet",
    taxReserveBps: 1_500,
    operationalReserveBps: 1_000,
  });
  const periodKey = new Date().toISOString().slice(0, 7);
  const firstClosing = await createProfitDistribution(userId, periodKey, `close-${suffix}`);
  const duplicateClosing = await createProfitDistribution(userId, periodKey, `close-duplicate-${suffix}`);
  if (firstClosing?.id !== duplicateClosing?.id) throw new Error("Idempotência do fechamento falhou.");

  const counts = {
    profiles: (await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId))).length,
    pixDeposits: (await db.select().from(pixDeposits).where(eq(pixDeposits.userId, userId))).length,
    pixProviderEvents: (await db.select().from(providerEvents).where(like(providerEvents.idempotencyKey, `pix-deposit-${firstDeposit.id}:%`))).length,
    quotes: (await db.select().from(purchaseQuotes).where(eq(purchaseQuotes.userId, userId))).length,
    purchases: (await db.select().from(purchases).where(eq(purchases.userId, userId))).length,
    redemptionQuotes: (await db.select().from(redemptionQuotes).where(eq(redemptionQuotes.userId, userId))).length,
    redemptions: (await db.select().from(redemptions).where(eq(redemptions.userId, userId))).length,
    ledgerEntries: (await db.select().from(ledgerEntries).where(eq(ledgerEntries.userId, userId))).length,
    providerEvents: (await db.select().from(providerEvents).where(like(providerEvents.idempotencyKey, `%${suffix}%`))).length,
    closings: (await db.select().from(profitDistributions).where(eq(profitDistributions.ownerUserId, userId))).length,
  };
  if (counts.pixProviderEvents !== 2) throw new Error("Trilha de eventos Pix incompleta.");
  console.log(JSON.stringify({ ok: true, counts, status: firstClosing?.status }, null, 2));
} finally {
  if (userId !== null) {
    const ownedPixDeposits = await db.select({ id: pixDeposits.id }).from(pixDeposits).where(eq(pixDeposits.userId, userId));
    for (const deposit of ownedPixDeposits) {
      await db.delete(providerEvents).where(like(providerEvents.idempotencyKey, `pix-deposit-${deposit.id}:%`));
    }
    const ownedPurchases = await db.select({ id: purchases.id }).from(purchases).where(eq(purchases.userId, userId));
    for (const purchase of ownedPurchases) {
      await db.delete(ledgerEntries).where(eq(ledgerEntries.purchaseId, purchase.id));
    }
    const ownedRedemptions = await db.select({ id: redemptions.id }).from(redemptions).where(eq(redemptions.userId, userId));
    for (const redemption of ownedRedemptions) {
      await db.delete(ledgerEntries).where(eq(ledgerEntries.redemptionId, redemption.id));
    }
    await db.delete(ledgerEntries).where(eq(ledgerEntries.userId, userId));
    await db.delete(profitDistributions).where(eq(profitDistributions.ownerUserId, userId));
    await db.delete(treasurySettings).where(eq(treasurySettings.ownerUserId, userId));
    await db.delete(pixDeposits).where(eq(pixDeposits.userId, userId));
    await db.delete(purchases).where(eq(purchases.userId, userId));
    await db.delete(purchaseQuotes).where(eq(purchaseQuotes.userId, userId));
    await db.delete(redemptions).where(eq(redemptions.userId, userId));
    await db.delete(redemptionQuotes).where(eq(redemptionQuotes.userId, userId));
    await db.delete(customerProfiles).where(eq(customerProfiles.userId, userId));
    await db.delete(providerEvents).where(like(providerEvents.idempotencyKey, `%${suffix}%`));
    await db.delete(users).where(eq(users.id, userId));
  }
}

process.exit(0);
