import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  customerProfiles,
  InsertUser,
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
  provider: "sandbox_kyc" | "sandbox_pix" | "sandbox_payments" | "mercado_pago" | "sandbox_custody" | "sandbox_stacks" | "stacks_testnet";
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
  }).onDuplicateKeyUpdate({
    set: { idempotencyKey: input.idempotencyKey },
  });
  return (await db.select().from(providerEvents).where(eq(providerEvents.idempotencyKey, input.idempotencyKey)).limit(1))[0];
}

export async function getProviderEventByIdempotencyKey(idempotencyKey: string) {
  const db = await requireDb();
  return (await db.select().from(providerEvents).where(eq(providerEvents.idempotencyKey, idempotencyKey)).limit(1))[0];
}

export async function startPixDeposit(input: { userId: number; amountBrl: number; idempotencyKey: string; expiresAt: Date }) {
  const db = await requireDb();
  const existing = (await db.select().from(pixDeposits).where(eq(pixDeposits.idempotencyKey, input.idempotencyKey)).limit(1))[0];
  if (existing) {
    if (existing.userId !== input.userId) throw new Error("Chave idempotente já pertence a outro usuário.");
    return existing;
  }
  const profile = await getCustomerProfile(input.userId);
  if (!profile || profile.verificationStatus !== "verified") throw new Error("Conclua a verificação sandbox antes de depositar via Pix.");
  await db.insert(pixDeposits).values({
    userId: input.userId,
    amountBrl: input.amountBrl.toFixed(2),
    idempotencyKey: input.idempotencyKey,
    expiresAt: input.expiresAt,
  });
  return (await db.select().from(pixDeposits).where(eq(pixDeposits.idempotencyKey, input.idempotencyKey)).limit(1))[0];
}

export async function attachPixDepositCharge(input: { userId: number; depositId: number; providerReference: string; pixCopyPaste: string; qrCodeText: string }) {
  const db = await requireDb();
  await db.update(pixDeposits).set({
    providerReference: input.providerReference,
    pixCopyPaste: input.pixCopyPaste,
    qrCodeText: input.qrCodeText,
    status: "awaiting_payment",
  }).where(and(eq(pixDeposits.id, input.depositId), eq(pixDeposits.userId, input.userId), eq(pixDeposits.status, "created")));
  return (await db.select().from(pixDeposits).where(and(eq(pixDeposits.id, input.depositId), eq(pixDeposits.userId, input.userId))).limit(1))[0];
}

export async function settlePixDeposit(input: { userId: number; depositId: number; endToEndId: string; idempotencyKey: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM users WHERE id = ${input.userId} FOR UPDATE`);
    const deposit = (await tx.select().from(pixDeposits).where(and(eq(pixDeposits.id, input.depositId), eq(pixDeposits.userId, input.userId))).limit(1))[0];
    if (!deposit) throw new Error("Depósito Pix não encontrado.");
    if (deposit.status === "paid") return deposit;
    if (deposit.status !== "awaiting_payment") throw new Error("Depósito Pix não pode ser liquidado no estado atual.");
    if (deposit.expiresAt.getTime() <= Date.now()) {
      await tx.update(pixDeposits).set({ status: "expired" }).where(eq(pixDeposits.id, deposit.id));
      throw new Error("A cobrança Pix expirou. Gere um novo QR Code.");
    }
    await tx.insert(ledgerEntries).values({
      userId: input.userId,
      pixDepositId: deposit.id,
      entryType: "pix_deposit",
      direction: "credit",
      account: "customer_brl_available",
      currency: "BRL",
      amount: deposit.amountBrl,
      idempotencyKey: `${input.idempotencyKey}:brl-credit`,
      metadata: JSON.stringify({ endToEndId: input.endToEndId, mode: "sandbox" }),
    }).onDuplicateKeyUpdate({ set: { idempotencyKey: `${input.idempotencyKey}:brl-credit` } });
    await tx.update(pixDeposits).set({ status: "paid", endToEndId: input.endToEndId, paidAt: new Date() }).where(eq(pixDeposits.id, deposit.id));
    return (await tx.select().from(pixDeposits).where(eq(pixDeposits.id, deposit.id)).limit(1))[0];
  });
}

export async function listPixDeposits(userId: number) {
  const db = await requireDb();
  return db.select().from(pixDeposits).where(eq(pixDeposits.userId, userId)).orderBy(desc(pixDeposits.createdAt));
}

export async function getPixDeposit(userId: number, depositId: number) {
  const db = await requireDb();
  return (await db.select().from(pixDeposits).where(and(eq(pixDeposits.id, depositId), eq(pixDeposits.userId, userId))).limit(1))[0] ?? null;
}

export async function listOperationalPixDeposits() {
  const db = await requireDb();
  return db.select().from(pixDeposits).orderBy(desc(pixDeposits.createdAt));
}

export async function getAvailableBrlBalance(userId: number) {
  const deposits = await listPixDeposits(userId);
  return deposits.filter(item => item.status === "paid").reduce((sum, item) => sum + Number(item.amountBrl), 0);
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

export async function startSandboxPurchase(input: {
  userId: number;
  quoteId: number;
  idempotencyKey: string;
  paymentMethod: "pix" | "credit_card";
  paymentProvider: "sandbox" | "mercado_pago";
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
      paymentMethod: input.paymentMethod,
      paymentProvider: input.paymentProvider,
      paymentStatus: "pending",
      amountBrl: quote.amountBrl,
      serviceFeeBrl: quote.serviceFeeBrl,
      btcAmount: quote.btcAmount,
      executionBtcBrl: quote.executionBtcBrl,
      status: "awaiting_payment",
      yieldStatus: "pending",
    });
    const purchase = (await tx.select().from(purchases).where(eq(purchases.externalReference, input.idempotencyKey)).limit(1))[0];
    if (!purchase) throw new Error("Falha ao registrar a compra.");

    await tx.update(purchaseQuotes).set({ status: "confirmed" }).where(eq(purchaseQuotes.id, quote.id));
    return purchase;
  });
}

export async function attachPurchasePayment(input: {
  userId: number;
  purchaseId: number;
  paymentReference: string;
  paymentStatus: "pending" | "approved";
  checkoutUrl: string | null;
}) {
  const db = await requireDb();
  await db.update(purchases).set({
    paymentReference: input.paymentReference,
    paymentStatus: input.paymentStatus,
    checkoutUrl: input.checkoutUrl,
    status: input.paymentStatus === "approved" ? "processing" : "awaiting_payment",
  }).where(and(eq(purchases.id, input.purchaseId), eq(purchases.userId, input.userId), eq(purchases.status, "awaiting_payment")));
  return (await db.select().from(purchases).where(and(eq(purchases.id, input.purchaseId), eq(purchases.userId, input.userId))).limit(1))[0];
}

export async function getPurchaseById(purchaseId: number) {
  const db = await requireDb();
  return (await db.select().from(purchases).where(eq(purchases.id, purchaseId)).limit(1))[0] ?? null;
}

export async function approvePurchasePayment(input: { purchaseId: number; paymentReference: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const purchase = (await tx.select().from(purchases).where(eq(purchases.id, input.purchaseId)).limit(1))[0];
    if (!purchase) throw new Error("Compra não encontrada para conciliação.");
    if (purchase.paymentReference && purchase.paymentReference !== input.paymentReference && purchase.paymentProvider !== "mercado_pago") {
      throw new Error("Referência de pagamento não corresponde à compra.");
    }
    if (purchase.status === "settled") return purchase;
    if (purchase.status !== "awaiting_payment" && purchase.status !== "processing") throw new Error("Compra não pode receber aprovação no estado atual.");
    await tx.update(purchases).set({
      paymentReference: input.paymentReference,
      paymentStatus: "approved",
      status: "processing",
    }).where(eq(purchases.id, input.purchaseId));
    return (await tx.select().from(purchases).where(eq(purchases.id, input.purchaseId)).limit(1))[0];
  });
}

export async function rejectPurchasePayment(input: { purchaseId: number; paymentReference: string }) {
  const db = await requireDb();
  await db.update(purchases).set({
    paymentReference: input.paymentReference,
    paymentStatus: "rejected",
    status: "failed",
  }).where(and(eq(purchases.id, input.purchaseId), eq(purchases.status, "awaiting_payment")));
}

export async function settleSandboxPurchase(input: {
  userId: number;
  purchaseId: number;
  idempotencyKey: string;
}) {
  const db = await requireDb();
  const purchase = (await db.select().from(purchases).where(and(eq(purchases.id, input.purchaseId), eq(purchases.userId, input.userId))).limit(1))[0];
  if (!purchase) throw new Error("Compra não encontrada.");
  if (purchase.status === "settled" && purchase.yieldStatus === "active") return purchase;
  if (purchase.status !== "processing") throw new Error("Compra não pode ser liquidada no estado atual.");

  return db.transaction(async tx => {
    await tx.insert(ledgerEntries).values([
      {
        userId: input.userId,
        purchaseId: input.purchaseId,
        entryType: "customer_cash_in",
        direction: "credit",
        account: "customer_brl_clearing",
        currency: "BRL",
        amount: purchase.amountBrl,
        idempotencyKey: `${input.idempotencyKey}:cash-in`,
        metadata: JSON.stringify({ mode: "sandbox" }),
      },
      {
        userId: input.userId,
        purchaseId: input.purchaseId,
        entryType: "fee_revenue",
        direction: "credit",
        account: "organization_fee_revenue",
        currency: "BRL",
        amount: purchase.serviceFeeBrl,
        idempotencyKey: `${input.idempotencyKey}:fee`,
        metadata: JSON.stringify({ fee: "service", mode: "sandbox" }),
      },
      {
        userId: input.userId,
        purchaseId: input.purchaseId,
        entryType: "customer_position",
        direction: "credit",
        account: "customer_btc_position",
        currency: "BTC",
        amount: purchase.btcAmount,
        idempotencyKey: `${input.idempotencyKey}:position`,
        metadata: JSON.stringify({ yieldStatus: "active", mode: "sandbox" }),
      },
    ]);
    await tx.update(purchases).set({ status: "settled", yieldStatus: "active", settledAt: new Date() }).where(eq(purchases.id, input.purchaseId));
    return (await tx.select().from(purchases).where(eq(purchases.id, input.purchaseId)).limit(1))[0];
  });
}

export async function failSandboxPurchase(userId: number, purchaseId: number) {
  const db = await requireDb();
  await db.update(purchases).set({ status: "failed", yieldStatus: "pending" }).where(and(eq(purchases.id, purchaseId), eq(purchases.userId, userId), eq(purchases.status, "processing")));
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

export async function getAvailableBtcBalance(userId: number) {
  const db = await requireDb();
  const [purchaseRows, redemptionRows] = await Promise.all([
    db.select({ btcAmount: purchases.btcAmount, status: purchases.status }).from(purchases).where(eq(purchases.userId, userId)),
    db.select({ btcAmount: redemptions.btcAmount, status: redemptions.status }).from(redemptions).where(eq(redemptions.userId, userId)),
  ]);
  const acquiredBtc = purchaseRows.filter(item => item.status === "settled").reduce((sum, item) => sum + Number(item.btcAmount), 0);
  const unavailableBtc = redemptionRows.filter(item => !["failed", "cancelled"].includes(item.status)).reduce((sum, item) => sum + Number(item.btcAmount), 0);
  return Math.max(0, Math.round((acquiredBtc - unavailableBtc) * 100_000_000) / 100_000_000);
}

export async function createRedemptionQuote(input: {
  userId: number;
  quote: {
    btcAmount: number;
    referenceBtcBrl: number;
    grossBrl: number;
    protocolFeeBps: number;
    protocolFeeBrl: number;
    conversionPixFeeBps: number;
    conversionPixFeeBrl: number;
    netBrl: number;
  };
  idempotencyKey: string;
  expiresAt: Date;
}) {
  const db = await requireDb();
  const existing = (await db.select().from(redemptionQuotes).where(eq(redemptionQuotes.idempotencyKey, input.idempotencyKey)).limit(1))[0];
  if (existing) {
    if (existing.userId !== input.userId) throw new Error("Chave idempotente já pertence a outro usuário.");
    return existing;
  }
  const availableBtc = await getAvailableBtcBalance(input.userId);
  if (input.quote.btcAmount > availableBtc) throw new Error("Saldo disponível insuficiente para este resgate.");

  await db.insert(redemptionQuotes).values({
    userId: input.userId,
    btcAmount: input.quote.btcAmount.toFixed(8),
    referenceBtcBrl: input.quote.referenceBtcBrl.toFixed(2),
    grossBrl: input.quote.grossBrl.toFixed(2),
    protocolFeeBps: input.quote.protocolFeeBps,
    protocolFeeBrl: input.quote.protocolFeeBrl.toFixed(2),
    conversionPixFeeBps: input.quote.conversionPixFeeBps,
    conversionPixFeeBrl: input.quote.conversionPixFeeBrl.toFixed(2),
    netBrl: input.quote.netBrl.toFixed(2),
    idempotencyKey: input.idempotencyKey,
    expiresAt: input.expiresAt,
  });
  return (await db.select().from(redemptionQuotes).where(eq(redemptionQuotes.idempotencyKey, input.idempotencyKey)).limit(1))[0];
}

export async function startSandboxRedemption(input: { userId: number; quoteId: number; idempotencyKey: string }) {
  const db = await requireDb();
  const existing = (await db.select().from(redemptions).where(eq(redemptions.externalReference, input.idempotencyKey)).limit(1))[0];
  if (existing) {
    if (existing.userId !== input.userId || existing.quoteId !== input.quoteId) throw new Error("Chave idempotente não corresponde a este resgate.");
    return existing;
  }

  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM users WHERE id = ${input.userId} FOR UPDATE`);
    const concurrentExisting = (await tx.select().from(redemptions).where(eq(redemptions.externalReference, input.idempotencyKey)).limit(1))[0];
    if (concurrentExisting) {
      if (concurrentExisting.userId !== input.userId || concurrentExisting.quoteId !== input.quoteId) throw new Error("Chave idempotente não corresponde a este resgate.");
      return concurrentExisting;
    }
    const quote = (await tx.select().from(redemptionQuotes).where(and(eq(redemptionQuotes.id, input.quoteId), eq(redemptionQuotes.userId, input.userId))).limit(1))[0];
    if (!quote) throw new Error("Cotação de resgate não encontrada.");
    if (quote.status !== "active" || quote.expiresAt.getTime() <= Date.now()) throw new Error("Cotação expirada. Gere uma nova cotação.");
    const profile = (await tx.select().from(customerProfiles).where(eq(customerProfiles.userId, input.userId)).limit(1))[0];
    if (!profile || profile.verificationStatus !== "verified" || !profile.pixOwnershipConfirmed || !profile.pixAccountMasked) {
      throw new Error("Conta Pix de mesma titularidade não verificada.");
    }

    const purchaseRows = await tx.select({ btcAmount: purchases.btcAmount, status: purchases.status }).from(purchases).where(eq(purchases.userId, input.userId));
    const redemptionRows = await tx.select({ btcAmount: redemptions.btcAmount, status: redemptions.status }).from(redemptions).where(eq(redemptions.userId, input.userId));
    const acquiredBtc = purchaseRows.filter(item => item.status === "settled").reduce((sum, item) => sum + Number(item.btcAmount), 0);
    const unavailableBtc = redemptionRows.filter(item => !["failed", "cancelled"].includes(item.status)).reduce((sum, item) => sum + Number(item.btcAmount), 0);
    const availableBtc = Math.max(0, Math.round((acquiredBtc - unavailableBtc) * 100_000_000) / 100_000_000);
    if (Number(quote.btcAmount) > availableBtc) throw new Error("Saldo disponível mudou. Gere uma nova cotação.");

    await tx.insert(redemptions).values({
      userId: input.userId,
      quoteId: quote.id,
      externalReference: input.idempotencyKey,
      btcAmount: quote.btcAmount,
      grossBrl: quote.grossBrl,
      protocolFeeBrl: quote.protocolFeeBrl,
      conversionPixFeeBrl: quote.conversionPixFeeBrl,
      netBrl: quote.netBrl,
      pixDestinationMasked: profile.pixAccountMasked,
      status: "processing",
      stage: "reserved",
    });
    await tx.update(redemptionQuotes).set({ status: "confirmed" }).where(eq(redemptionQuotes.id, quote.id));
    return (await tx.select().from(redemptions).where(eq(redemptions.externalReference, input.idempotencyKey)).limit(1))[0];
  });
}

export async function advanceSandboxRedemption(input: {
  userId: number;
  redemptionId: number;
  stage: "protocol_exit" | "conversion" | "pix";
  externalReference: string;
}) {
  const db = await requireDb();
  const condition = and(eq(redemptions.id, input.redemptionId), eq(redemptions.userId, input.userId), eq(redemptions.status, "processing"));
  if (input.stage === "protocol_exit") {
    await db.update(redemptions).set({ stage: "protocol_exit", protocolExitReference: input.externalReference }).where(condition);
  } else if (input.stage === "conversion") {
    await db.update(redemptions).set({ stage: "conversion", conversionReference: input.externalReference }).where(condition);
  } else {
    await db.update(redemptions).set({ stage: "pix", pixEndToEndId: input.externalReference }).where(condition);
  }
  return (await db.select().from(redemptions).where(and(eq(redemptions.id, input.redemptionId), eq(redemptions.userId, input.userId))).limit(1))[0];
}

export async function settleSandboxRedemption(input: { userId: number; redemptionId: number; idempotencyKey: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM users WHERE id = ${input.userId} FOR UPDATE`);
    const redemption = (await tx.select().from(redemptions).where(and(eq(redemptions.id, input.redemptionId), eq(redemptions.userId, input.userId))).limit(1))[0];
    if (!redemption) throw new Error("Resgate não encontrado.");
    if (redemption.status === "settled") return redemption;
    if (redemption.status !== "processing" || redemption.stage !== "pix") throw new Error("Resgate não pode ser liquidado no estado atual.");

    await tx.insert(ledgerEntries).values([
      { userId: input.userId, redemptionId: redemption.id, entryType: "yield_exit", direction: "debit", account: "customer_btc_position", currency: "BTC", amount: redemption.btcAmount, idempotencyKey: `${input.idempotencyKey}:position-exit`, metadata: JSON.stringify({ mode: "sandbox" }) },
      { userId: input.userId, redemptionId: redemption.id, entryType: "sell_btc", direction: "credit", account: "customer_brl_redemption", currency: "BRL", amount: redemption.grossBrl, idempotencyKey: `${input.idempotencyKey}:conversion`, metadata: JSON.stringify({ mode: "sandbox" }) },
      { userId: input.userId, redemptionId: redemption.id, entryType: "provider_cost", direction: "debit", account: "protocol_redemption_cost", currency: "BRL", amount: redemption.protocolFeeBrl, idempotencyKey: `${input.idempotencyKey}:protocol-fee`, metadata: JSON.stringify({ mode: "sandbox" }) },
      { userId: input.userId, redemptionId: redemption.id, entryType: "fee_revenue", direction: "credit", account: "organization_redemption_fee", currency: "BRL", amount: redemption.conversionPixFeeBrl, idempotencyKey: `${input.idempotencyKey}:service-fee`, metadata: JSON.stringify({ mode: "sandbox" }) },
      { userId: input.userId, redemptionId: redemption.id, entryType: "pix_out", direction: "debit", account: "customer_brl_redemption", currency: "BRL", amount: redemption.netBrl, idempotencyKey: `${input.idempotencyKey}:pix-out`, metadata: JSON.stringify({ destination: redemption.pixDestinationMasked, endToEndId: redemption.pixEndToEndId, mode: "sandbox" }) },
    ]);
    await tx.update(redemptions).set({ status: "settled", stage: "completed", settledAt: new Date() }).where(eq(redemptions.id, redemption.id));
    return (await tx.select().from(redemptions).where(eq(redemptions.id, redemption.id)).limit(1))[0];
  });
}

export async function failSandboxRedemption(userId: number, redemptionId: number, reason: string, manualReview: boolean) {
  const db = await requireDb();
  await db.update(redemptions).set({
    status: manualReview ? "manual_review" : "failed",
    failureReason: reason.slice(0, 2_000),
  }).where(and(eq(redemptions.id, redemptionId), eq(redemptions.userId, userId), eq(redemptions.status, "processing")));
}

export async function listRedemptions(userId: number) {
  const db = await requireDb();
  return db.select().from(redemptions).where(eq(redemptions.userId, userId)).orderBy(desc(redemptions.createdAt));
}

export async function listOperationalRedemptions() {
  const db = await requireDb();
  return db.select().from(redemptions).orderBy(desc(redemptions.createdAt));
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
