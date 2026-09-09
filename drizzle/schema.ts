import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const authEvents = mysqlTable("auth_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  provider: mysqlEnum("provider", ["google", "apple"]).notNull(),
  eventType: mysqlEnum("eventType", ["sign_in", "sign_out"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerProfiles = mysqlTable("customer_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id),
  legalName: varchar("legalName", { length: 180 }).notNull(),
  cpfMasked: varchar("cpfMasked", { length: 20 }).notNull(),
  country: varchar("country", { length: 2 }).default("BR").notNull(),
  pixBank: varchar("pixBank", { length: 120 }),
  pixAccountMasked: varchar("pixAccountMasked", { length: 80 }),
  pixOwnershipConfirmed: boolean("pixOwnershipConfirmed").default(false).notNull(),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "rejected"]).default("pending").notNull(),
  providerReference: varchar("providerReference", { length: 120 }),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pixDeposits = mysqlTable("pix_deposits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  amountBrl: decimal("amountBrl", { precision: 18, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["created", "awaiting_payment", "paid", "expired", "cancelled", "manual_review"]).default("created").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 120 }).notNull().unique(),
  providerReference: varchar("providerReference", { length: 140 }),
  endToEndId: varchar("endToEndId", { length: 140 }),
  qrCodeText: text("qrCodeText"),
  pixCopyPaste: text("pixCopyPaste"),
  expiresAt: timestamp("expiresAt").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const purchaseQuotes = mysqlTable("purchase_quotes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  amountBrl: decimal("amountBrl", { precision: 18, scale: 2 }).notNull(),
  referenceBtcBrl: decimal("referenceBtcBrl", { precision: 18, scale: 2 }).notNull(),
  executionBtcBrl: decimal("executionBtcBrl", { precision: 18, scale: 2 }).notNull(),
  spreadBps: int("spreadBps").default(65).notNull(),
  serviceFeeBrl: decimal("serviceFeeBrl", { precision: 18, scale: 2 }).notNull(),
  btcAmount: decimal("btcAmount", { precision: 30, scale: 8 }).notNull(),
  status: mysqlEnum("status", ["active", "expired", "confirmed", "cancelled"]).default("active").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 120 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const purchases = mysqlTable("purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  quoteId: int("quoteId").notNull().unique().references(() => purchaseQuotes.id),
  externalReference: varchar("externalReference", { length: 120 }).notNull().unique(),
  paymentMethod: mysqlEnum("paymentMethod", ["pix", "credit_card"]).default("pix").notNull(),
  paymentProvider: mysqlEnum("paymentProvider", ["sandbox", "mercado_pago"]).default("sandbox").notNull(),
  paymentReference: varchar("paymentReference", { length: 140 }),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "approved", "rejected", "refunded"]).default("pending").notNull(),
  checkoutUrl: text("checkoutUrl"),
  amountBrl: decimal("amountBrl", { precision: 18, scale: 2 }).notNull(),
  serviceFeeBrl: decimal("serviceFeeBrl", { precision: 18, scale: 2 }).notNull(),
  btcAmount: decimal("btcAmount", { precision: 30, scale: 8 }).notNull(),
  executionBtcBrl: decimal("executionBtcBrl", { precision: 18, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["awaiting_payment", "processing", "settled", "failed", "refunded"]).default("awaiting_payment").notNull(),
  yieldStatus: mysqlEnum("yieldStatus", ["pending", "active", "paused", "exited"]).default("pending").notNull(),
  confirmedAt: timestamp("confirmedAt").defaultNow().notNull(),
  settledAt: timestamp("settledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const redemptionQuotes = mysqlTable("redemption_quotes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  btcAmount: decimal("btcAmount", { precision: 30, scale: 8 }).notNull(),
  referenceBtcBrl: decimal("referenceBtcBrl", { precision: 18, scale: 2 }).notNull(),
  grossBrl: decimal("grossBrl", { precision: 18, scale: 2 }).notNull(),
  protocolFeeBps: int("protocolFeeBps").default(15).notNull(),
  protocolFeeBrl: decimal("protocolFeeBrl", { precision: 18, scale: 2 }).notNull(),
  conversionPixFeeBps: int("conversionPixFeeBps").default(45).notNull(),
  conversionPixFeeBrl: decimal("conversionPixFeeBrl", { precision: 18, scale: 2 }).notNull(),
  netBrl: decimal("netBrl", { precision: 18, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["active", "expired", "confirmed", "cancelled"]).default("active").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 120 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const redemptions = mysqlTable("redemptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  quoteId: int("quoteId").notNull().unique().references(() => redemptionQuotes.id),
  externalReference: varchar("externalReference", { length: 120 }).notNull().unique(),
  btcAmount: decimal("btcAmount", { precision: 30, scale: 8 }).notNull(),
  grossBrl: decimal("grossBrl", { precision: 18, scale: 2 }).notNull(),
  protocolFeeBrl: decimal("protocolFeeBrl", { precision: 18, scale: 2 }).notNull(),
  conversionPixFeeBrl: decimal("conversionPixFeeBrl", { precision: 18, scale: 2 }).notNull(),
  netBrl: decimal("netBrl", { precision: 18, scale: 2 }).notNull(),
  pixDestinationMasked: varchar("pixDestinationMasked", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["processing", "settled", "failed", "manual_review", "cancelled"]).default("processing").notNull(),
  stage: mysqlEnum("stage", ["reserved", "protocol_exit", "conversion", "pix", "completed"]).default("reserved").notNull(),
  protocolExitReference: varchar("protocolExitReference", { length: 140 }),
  conversionReference: varchar("conversionReference", { length: 140 }),
  pixEndToEndId: varchar("pixEndToEndId", { length: 140 }),
  failureReason: text("failureReason"),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  settledAt: timestamp("settledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const ledgerEntries = mysqlTable("ledger_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  purchaseId: int("purchaseId").references(() => purchases.id),
  redemptionId: int("redemptionId").references(() => redemptions.id),
  pixDepositId: int("pixDepositId").references(() => pixDeposits.id),
  entryType: mysqlEnum("entryType", [
    "pix_deposit",
    "customer_cash_in",
    "buy_btc",
    "fee_revenue",
    "customer_position",
    "yield_accrual",
    "yield_exit",
    "sell_btc",
    "pix_out",
    "provider_cost",
    "tax_reserve",
    "operational_reserve",
    "profit_distribution",
  ]).notNull(),
  direction: mysqlEnum("direction", ["debit", "credit"]).notNull(),
  account: varchar("account", { length: 100 }).notNull(),
  currency: mysqlEnum("currency", ["BRL", "BTC", "STX", "sBTC", "stBTC"]).notNull(),
  amount: decimal("amount", { precision: 30, scale: 8 }).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull().unique(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const providerEvents = mysqlTable("provider_events", {
  id: int("id").autoincrement().primaryKey(),
  provider: mysqlEnum("provider", ["sandbox_kyc", "sandbox_pix", "sandbox_payments", "mercado_pago", "sandbox_custody", "sandbox_stacks", "stacks_testnet"]).notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  externalId: varchar("externalId", { length: 140 }).notNull(),
  status: mysqlEnum("status", ["received", "processed", "ignored", "failed"]).default("received").notNull(),
  signatureVerified: boolean("signatureVerified").default(false).notNull(),
  payload: text("payload").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 180 }).notNull().unique(),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const treasurySettings = mysqlTable("treasury_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().unique().references(() => users.id),
  organizationName: varchar("organizationName", { length: 160 }).default("Organização RendeBit").notNull(),
  stacksWalletAddress: varchar("stacksWalletAddress", { length: 80 }),
  distributionAsset: mysqlEnum("distributionAsset", ["STX", "sBTC", "stBTC"]).default("sBTC").notNull(),
  distributionShareBps: int("distributionShareBps").default(10000).notNull(),
  taxReserveBps: int("taxReserveBps").default(1500).notNull(),
  operationalReserveBps: int("operationalReserveBps").default(1000).notNull(),
  cadence: mysqlEnum("cadence", ["daily", "weekly", "monthly"]).default("monthly").notNull(),
  approvalMode: mysqlEnum("approvalMode", ["manual", "multisig", "automatic"]).default("manual").notNull(),
  network: mysqlEnum("network", ["testnet", "mainnet"]).default("testnet").notNull(),
  status: mysqlEnum("status", ["draft", "ready", "paused"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const profitDistributions = mysqlTable("profit_distributions", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id),
  periodKey: varchar("periodKey", { length: 20 }).notNull(),
  grossRevenueBrl: decimal("grossRevenueBrl", { precision: 18, scale: 2 }).notNull(),
  providerCostsBrl: decimal("providerCostsBrl", { precision: 18, scale: 2 }).notNull(),
  taxReserveBrl: decimal("taxReserveBrl", { precision: 18, scale: 2 }).notNull(),
  operationalReserveBrl: decimal("operationalReserveBrl", { precision: 18, scale: 2 }).notNull(),
  distributableProfitBrl: decimal("distributableProfitBrl", { precision: 18, scale: 2 }).notNull(),
  distributionAsset: mysqlEnum("distributionAsset", ["STX", "sBTC", "stBTC"]).notNull(),
  estimatedAssetAmount: decimal("estimatedAssetAmount", { precision: 30, scale: 8 }).notNull(),
  stacksWalletAddress: varchar("stacksWalletAddress", { length: 80 }),
  status: mysqlEnum("status", ["blocked", "pending_approval", "simulated_sent", "cancelled"]).default("blocked").notNull(),
  transactionId: varchar("transactionId", { length: 100 }),
  idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull().unique(),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  organizationPeriodUnique: uniqueIndex("profit_distribution_owner_period_unique").on(table.ownerUserId, table.periodKey),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PixDeposit = typeof pixDeposits.$inferSelect;
export type PurchaseQuote = typeof purchaseQuotes.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type RedemptionQuote = typeof redemptionQuotes.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;
export type TreasurySettings = typeof treasurySettings.$inferSelect;
export type ProfitDistribution = typeof profitDistributions.$inferSelect;
