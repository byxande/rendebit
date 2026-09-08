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
  amountBrl: decimal("amountBrl", { precision: 18, scale: 2 }).notNull(),
  serviceFeeBrl: decimal("serviceFeeBrl", { precision: 18, scale: 2 }).notNull(),
  btcAmount: decimal("btcAmount", { precision: 30, scale: 8 }).notNull(),
  executionBtcBrl: decimal("executionBtcBrl", { precision: 18, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["processing", "settled", "failed", "refunded"]).default("processing").notNull(),
  yieldStatus: mysqlEnum("yieldStatus", ["pending", "active", "paused", "exited"]).default("pending").notNull(),
  confirmedAt: timestamp("confirmedAt").defaultNow().notNull(),
  settledAt: timestamp("settledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const ledgerEntries = mysqlTable("ledger_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  purchaseId: int("purchaseId").references(() => purchases.id),
  entryType: mysqlEnum("entryType", [
    "customer_cash_in",
    "buy_btc",
    "fee_revenue",
    "customer_position",
    "yield_accrual",
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
  provider: mysqlEnum("provider", ["sandbox_kyc", "sandbox_pix", "sandbox_custody", "sandbox_stacks"]).notNull(),
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
export type PurchaseQuote = typeof purchaseQuotes.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type TreasurySettings = typeof treasurySettings.$inferSelect;
export type ProfitDistribution = typeof profitDistributions.$inferSelect;
