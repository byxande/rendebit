import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  customerProfiles,
  InsertUser,
  ledgerEntries,
  profitDistributions,
  providerEvents,
  purchaseQuotes,
  purchases,
  treasurySettings,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  calculateDistributableProfit,
  estimateDistributionAsset,
  isValidStacksAddress,
} from "./finance";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function getCustomerProfile(userId: number) {
  const db = await requireDb();
  return (await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1))[0] ?? null;
}

export async function upsertSandboxProfile(input: {
  userId: number;
  legalName: string;
  cpfMasked: string;
  pixBank: string;
  pixAccountMasked: string;
  pixOwnershipConfirmed: boolean;
}) {
  const db = await requireDb();
  await db.insert(customerProfiles).values({
    ...input,
    country: "BR",
    verificationStatus: "pending",
  }).onDuplicateKeyUpdate({ set: {
    legalName: input.legalName,
    cpfMasked: input.cpfMasked,
    pixBank: input.pixBank,
    pixAccountMasked: input.pixAccountMasked,
    pixOwnershipConfirmed: input.pixOwnershipConfirmed,
  } });
  return getCustomerProfile(input.userId);
}

export async function verifySandboxProfile(userId: number, providerReference: string) {
  const db = await requireDb();
  await db.update(customerProfiles).set({
    verificationStatus: "verified",
    providerReference,
    verifiedAt: new Date(),
  }).where(eq(customerProfiles.userId, userId));
  return getCustomerProfile(userId);
}

export async function recordProviderEvent(input: {
  provider: "sandbox_kyc" | "sandbox_pix" | "sandbox_custody" | "sandbox_stacks";
  eventType: string;
  externalId: string;
  payload: unknown;
  idempotencyKey: string;
}) {
  const db = await requireDb();
  const existing = (await db.select().from(providerEvents).where(eq(providerEvents.idempotencyKey, input.idempotencyKey)).limit(1))[0];
  if (existing) return existing;
  await db.insert(providerEvents).values({
    ...input,
    signatureVerified: true,
    status: "processed",
    payload: JSON.stringify(input.payload),
    processedAt: new Date(),
  });
  return (await db.select().from(providerEvents).where(eq(providerEvents.idempotencyKey, input.idempotencyKey)).limit(1))[0];
}

export async function createPurchaseQuote(input: {
  userId: number;
  quote: {
    amountBrl: number;
    referenceBtcBrl: number;
    executionBtcBrl: number;
    spreadBps: number;
    serviceFeeBrl: number;
    btcAmount: number;
  };
  idempotencyKey: string;
  expiresAt: Date;
}) {
  const db = await requireDb();
  const existing = (await db.select().from(purchaseQuotes).where(eq(purchaseQuotes.idempotencyKey, input.idempotencyKey)).limit(1))[0];
  if (existing) return existing;

  await db.insert(purchaseQuotes).values({
    userId: input.userId,
    amountBrl: input.quote.amountBrl.toFixed(2),
    referenceBtcBrl: input.quote.referenceBtcBrl.toFixed(2),
    executionBtcBrl: input.quote.executionBtcBrl.toFixed(2),
    spreadBps: input.quote.spreadBps,
    serviceFeeBrl: input.quote.serviceFeeBrl.toFixed(2),
    btcAmount: input.quote.btcAmount.toFixed(8),
    idempotencyKey: input.idempotencyKey,
    expiresAt: input.expiresAt,
  });
  return (await db.select().from(purchaseQuotes).where(eq(purchaseQuotes.idempotencyKey, input.idempotencyKey)).limit(1))[0];
}

export async function confirmSandboxPurchase(input: {
  userId: number;
  quoteId: number;
  idempotencyKey: string;
}) {
  const db = await requireDb();
  const existing = (await db.select().from(purchases).where(eq(purchases.externalReference, input.idempotencyKey)).limit(1))[0];
  if (existing) return existing;

  const quote = (await db.select().from(purchaseQuotes).where(and(eq(purchaseQuotes.id, input.quoteId), eq(purchaseQuotes.userId, input.userId))).limit(1))[0];
  if (!quote) throw new Error("Cotação não encontrada.");
  if (quote.status !== "active" || quote.expiresAt.getTime() <= Date.now()) throw new Error("Cotação expirada. Gere uma nova cotação.");

  return db.transaction(async tx => {
    await tx.insert(purchases).values({
      userId: input.userId,
      quoteId: quote.id,
      externalReference: input.idempotencyKey,
      amountBrl: quote.amountBrl,
      serviceFeeBrl: quote.serviceFeeBrl,
      btcAmount: quote.btcAmount,
      executionBtcBrl: quote.executionBtcBrl,
      status: "settled",
      yieldStatus: "active",
      settledAt: new Date(),
    });
    const purchase = (await tx.select().from(purchases).where(eq(purchases.externalReference, input.idempotencyKey)).limit(1))[0];
    if (!purchase) throw new Error("Falha ao registrar a compra.");

    await tx.update(purchaseQuotes).set({ status: "confirmed" }).where(eq(purchaseQuotes.id, quote.id));
    await tx.insert(ledgerEntries).values([
      {
        userId: input.userId,
        purchaseId: purchase.id,
        entryType: "customer_cash_in",
        direction: "credit",
        account: "customer_brl_clearing",
        currency: "BRL",
        amount: quote.amountBrl,
        idempotencyKey: `${input.idempotencyKey}:cash-in`,
        metadata: JSON.stringify({ mode: "sandbox" }),
      },
      {
        userId: input.userId,
        purchaseId: purchase.id,
        entryType: "fee_revenue",
        direction: "credit",
        account: "organization_fee_revenue",
        currency: "BRL",
        amount: quote.serviceFeeBrl,
        idempotencyKey: `${input.idempotencyKey}:fee`,
        metadata: JSON.stringify({ fee: "service", mode: "sandbox" }),
      },
      {
        userId: input.userId,
        purchaseId: purchase.id,
        entryType: "customer_position",
        direction: "credit",
        account: "customer_btc_position",
        currency: "BTC",
        amount: quote.btcAmount,
        idempotencyKey: `${input.idempotencyKey}:position`,
        metadata: JSON.stringify({ yieldStatus: "active", mode: "sandbox" }),
      },
    ]);
    return purchase;
  });
}

export async function listPurchases(userId: number) {
  const db = await requireDb();
  return db.select().from(purchases).where(eq(purchases.userId, userId)).orderBy(desc(purchases.createdAt));
}

export async function listLedger(userId: number) {
  const db = await requireDb();
  return db.select().from(ledgerEntries).where(eq(ledgerEntries.userId, userId)).orderBy(desc(ledgerEntries.createdAt));
}

export async function listOperationalLedger() {
  const db = await requireDb();
  return db.select().from(ledgerEntries).orderBy(desc(ledgerEntries.createdAt));
}

export async function getTreasurySettings(ownerUserId: number) {
  const db = await requireDb();
  const existing = (await db.select().from(treasurySettings).where(eq(treasurySettings.ownerUserId, ownerUserId)).limit(1))[0];
  if (existing) return existing;
  await db.insert(treasurySettings).values({ ownerUserId });
  return (await db.select().from(treasurySettings).where(eq(treasurySettings.ownerUserId, ownerUserId)).limit(1))[0];
}

export async function updateTreasurySettings(input: {
  ownerUserId: number;
  organizationName: string;
  stacksWalletAddress: string | null;
  distributionAsset: "STX" | "sBTC" | "stBTC";
  cadence: "daily" | "weekly" | "monthly";
  approvalMode: "manual" | "multisig" | "automatic";
  network: "testnet" | "mainnet";
  taxReserveBps: number;
  operationalReserveBps: number;
}) {
  const db = await requireDb();
  await getTreasurySettings(input.ownerUserId);
  const walletIsValid = input.stacksWalletAddress ? isValidStacksAddress(input.stacksWalletAddress, input.network) : false;
  await db.update(treasurySettings).set({
    organizationName: input.organizationName,
    stacksWalletAddress: input.stacksWalletAddress,
    distributionAsset: input.distributionAsset,
    cadence: input.cadence,
    approvalMode: input.approvalMode,
    network: input.network,
    taxReserveBps: input.taxReserveBps,
    operationalReserveBps: input.operationalReserveBps,
    distributionShareBps: 10000,
    status: walletIsValid ? "ready" : "draft",
  }).where(eq(treasurySettings.ownerUserId, input.ownerUserId));
  return getTreasurySettings(input.ownerUserId);
}

export async function createProfitDistribution(ownerUserId: number, periodKey: string, idempotencyKey: string) {
  const db = await requireDb();
  const existingPeriod = (await db.select().from(profitDistributions).where(and(eq(profitDistributions.ownerUserId, ownerUserId), eq(profitDistributions.periodKey, periodKey))).limit(1))[0];
  if (existingPeriod) return existingPeriod;
  const existing = (await db.select().from(profitDistributions).where(eq(profitDistributions.idempotencyKey, idempotencyKey)).limit(1))[0];
  if (existing) return existing;

  const settings = await getTreasurySettings(ownerUserId);
  if (!settings) throw new Error("Configuração de tesouraria indisponível.");
  const ledger = (await db.select().from(ledgerEntries)).filter(entry => entry.createdAt.toISOString().slice(0, 7) === periodKey);
  const grossRevenueBrl = ledger.filter(entry => entry.entryType === "fee_revenue" && entry.currency === "BRL").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const providerCostsBrl = ledger.filter(entry => entry.entryType === "provider_cost" && entry.currency === "BRL").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const calculation = calculateDistributableProfit({
    grossRevenueBrl,
    providerCostsBrl,
    taxReserveBps: settings.taxReserveBps,
    operationalReserveBps: settings.operationalReserveBps,
    distributionShareBps: settings.distributionShareBps,
  });
  const walletReady = Boolean(settings.stacksWalletAddress) && isValidStacksAddress(settings.stacksWalletAddress ?? "", settings.network);
  const status = walletReady && settings.status === "ready" ? "pending_approval" : "blocked";

  await db.insert(profitDistributions).values({
    ownerUserId,
    periodKey,
    grossRevenueBrl: calculation.grossRevenueBrl.toFixed(2),
    providerCostsBrl: calculation.providerCostsBrl.toFixed(2),
    taxReserveBrl: calculation.taxReserveBrl.toFixed(2),
    operationalReserveBrl: calculation.operationalReserveBrl.toFixed(2),
    distributableProfitBrl: calculation.distributableProfitBrl.toFixed(2),
    distributionAsset: settings.distributionAsset,
    estimatedAssetAmount: estimateDistributionAsset(calculation.distributableProfitBrl, settings.distributionAsset).toFixed(8),
    stacksWalletAddress: settings.stacksWalletAddress,
    status,
    idempotencyKey,
  });
  return (await db.select().from(profitDistributions).where(eq(profitDistributions.idempotencyKey, idempotencyKey)).limit(1))[0];
}

export async function approveSandboxDistribution(ownerUserId: number, distributionId: number) {
  const db = await requireDb();
  const distribution = (await db.select().from(profitDistributions).where(and(eq(profitDistributions.id, distributionId), eq(profitDistributions.ownerUserId, ownerUserId))).limit(1))[0];
  if (!distribution) throw new Error("Distribuição não encontrada.");
  if (distribution.status === "blocked") throw new Error("Configure uma carteira Stacks válida antes de aprovar.");
  if (distribution.status === "simulated_sent") return distribution;

  const transactionId = `sandbox-${distribution.id}-${distribution.periodKey}`;
  await db.transaction(async tx => {
    await tx.update(profitDistributions).set({ status: "simulated_sent", transactionId, approvedAt: new Date() }).where(eq(profitDistributions.id, distribution.id));
    await tx.insert(ledgerEntries).values({
      entryType: "profit_distribution",
      direction: "debit",
      account: "organization_distributable_profit",
      currency: distribution.distributionAsset,
      amount: distribution.estimatedAssetAmount,
      idempotencyKey: `profit-distribution:${distribution.id}`,
      metadata: JSON.stringify({ wallet: distribution.stacksWalletAddress, transactionId, mode: "sandbox" }),
    });
  });
  return (await db.select().from(profitDistributions).where(eq(profitDistributions.id, distribution.id)).limit(1))[0];
}

export async function listProfitDistributions(ownerUserId: number) {
  const db = await requireDb();
  return db.select().from(profitDistributions).where(eq(profitDistributions.ownerUserId, ownerUserId)).orderBy(desc(profitDistributions.createdAt));
}
