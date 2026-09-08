import { eq } from "drizzle-orm";
import {
  customerProfiles,
  ledgerEntries,
  profitDistributions,
  providerEvents,
  purchaseQuotes,
  purchases,
  treasurySettings,
  users,
} from "../drizzle/schema";
import {
  confirmSandboxPurchase,
  createProfitDistribution,
  createPurchaseQuote,
  getDb,
  recordProviderEvent,
  updateTreasurySettings,
  upsertSandboxProfile,
  verifySandboxProfile,
} from "../server/db";
import { calculatePurchaseQuote } from "../server/finance";

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

  const quote = calculatePurchaseQuote(1_000);
  const storedQuote = await createPurchaseQuote({
    userId,
    quote,
    idempotencyKey: `quote-${suffix}`,
    expiresAt: new Date(Date.now() + 60_000),
  });
  if (!storedQuote) throw new Error("Cotação não foi persistida.");

  const firstPurchase = await confirmSandboxPurchase({ userId, quoteId: storedQuote.id, idempotencyKey: `purchase-${suffix}` });
  const duplicatePurchase = await confirmSandboxPurchase({ userId, quoteId: storedQuote.id, idempotencyKey: `purchase-${suffix}` });
  if (firstPurchase.id !== duplicatePurchase.id) throw new Error("Idempotência da compra falhou.");

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
    quotes: (await db.select().from(purchaseQuotes).where(eq(purchaseQuotes.userId, userId))).length,
    purchases: (await db.select().from(purchases).where(eq(purchases.userId, userId))).length,
    ledgerEntries: (await db.select().from(ledgerEntries).where(eq(ledgerEntries.userId, userId))).length,
    providerEvents: (await db.select().from(providerEvents).where(eq(providerEvents.idempotencyKey, `event-${suffix}`))).length,
    closings: (await db.select().from(profitDistributions).where(eq(profitDistributions.ownerUserId, userId))).length,
  };
  console.log(JSON.stringify({ ok: true, counts, status: firstClosing?.status }, null, 2));
} finally {
  if (userId !== null) {
    const ownedPurchases = await db.select({ id: purchases.id }).from(purchases).where(eq(purchases.userId, userId));
    for (const purchase of ownedPurchases) {
      await db.delete(ledgerEntries).where(eq(ledgerEntries.purchaseId, purchase.id));
    }
    await db.delete(ledgerEntries).where(eq(ledgerEntries.userId, userId));
    await db.delete(profitDistributions).where(eq(profitDistributions.ownerUserId, userId));
    await db.delete(treasurySettings).where(eq(treasurySettings.ownerUserId, userId));
    await db.delete(purchases).where(eq(purchases.userId, userId));
    await db.delete(purchaseQuotes).where(eq(purchaseQuotes.userId, userId));
    await db.delete(customerProfiles).where(eq(customerProfiles.userId, userId));
    await db.delete(providerEvents).where(eq(providerEvents.idempotencyKey, `event-${suffix}`));
    await db.delete(users).where(eq(users.id, userId));
  }
}

process.exit(0);
