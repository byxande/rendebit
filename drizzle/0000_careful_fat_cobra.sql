CREATE TABLE `customer_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`legalName` varchar(180) NOT NULL,
	`cpfMasked` varchar(20) NOT NULL,
	`country` varchar(2) NOT NULL DEFAULT 'BR',
	`pixBank` varchar(120),
	`pixAccountMasked` varchar(80),
	`pixOwnershipConfirmed` boolean NOT NULL DEFAULT false,
	`verificationStatus` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
	`providerReference` varchar(120),
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`purchaseId` int,
	`entryType` enum('customer_cash_in','buy_btc','fee_revenue','customer_position','yield_accrual','pix_out','provider_cost','tax_reserve','operational_reserve','profit_distribution') NOT NULL,
	`direction` enum('debit','credit') NOT NULL,
	`account` varchar(100) NOT NULL,
	`currency` enum('BRL','BTC','STX','sBTC','stBTC') NOT NULL,
	`amount` decimal(30,8) NOT NULL,
	`idempotencyKey` varchar(160) NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ledger_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `ledger_entries_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `profit_distributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`periodKey` varchar(20) NOT NULL,
	`grossRevenueBrl` decimal(18,2) NOT NULL,
	`providerCostsBrl` decimal(18,2) NOT NULL,
	`taxReserveBrl` decimal(18,2) NOT NULL,
	`operationalReserveBrl` decimal(18,2) NOT NULL,
	`distributableProfitBrl` decimal(18,2) NOT NULL,
	`distributionAsset` enum('STX','sBTC','stBTC') NOT NULL,
	`estimatedAssetAmount` decimal(30,8) NOT NULL,
	`stacksWalletAddress` varchar(80),
	`status` enum('blocked','pending_approval','simulated_sent','cancelled') NOT NULL DEFAULT 'blocked',
	`transactionId` varchar(100),
	`idempotencyKey` varchar(160) NOT NULL,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profit_distributions_id` PRIMARY KEY(`id`),
	CONSTRAINT `profit_distributions_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `provider_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('sandbox_kyc','sandbox_pix','sandbox_custody','sandbox_stacks') NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`externalId` varchar(140) NOT NULL,
	`status` enum('received','processed','ignored','failed') NOT NULL DEFAULT 'received',
	`signatureVerified` boolean NOT NULL DEFAULT false,
	`payload` text NOT NULL,
	`idempotencyKey` varchar(180) NOT NULL,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_events_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `purchase_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amountBrl` decimal(18,2) NOT NULL,
	`referenceBtcBrl` decimal(18,2) NOT NULL,
	`executionBtcBrl` decimal(18,2) NOT NULL,
	`spreadBps` int NOT NULL DEFAULT 65,
	`serviceFeeBrl` decimal(18,2) NOT NULL,
	`btcAmount` decimal(30,8) NOT NULL,
	`status` enum('active','expired','confirmed','cancelled') NOT NULL DEFAULT 'active',
	`idempotencyKey` varchar(120) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_quotes_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`quoteId` int NOT NULL,
	`externalReference` varchar(120) NOT NULL,
	`amountBrl` decimal(18,2) NOT NULL,
	`serviceFeeBrl` decimal(18,2) NOT NULL,
	`btcAmount` decimal(30,8) NOT NULL,
	`executionBtcBrl` decimal(18,2) NOT NULL,
	`status` enum('processing','settled','failed','refunded') NOT NULL DEFAULT 'processing',
	`yieldStatus` enum('pending','active','paused','exited') NOT NULL DEFAULT 'pending',
	`confirmedAt` timestamp NOT NULL DEFAULT (now()),
	`settledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchases_quoteId_unique` UNIQUE(`quoteId`),
	CONSTRAINT `purchases_externalReference_unique` UNIQUE(`externalReference`)
);
--> statement-breakpoint
CREATE TABLE `treasury_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`organizationName` varchar(160) NOT NULL DEFAULT 'Organização Nexo',
	`stacksWalletAddress` varchar(80),
	`distributionAsset` enum('STX','sBTC','stBTC') NOT NULL DEFAULT 'sBTC',
	`distributionShareBps` int NOT NULL DEFAULT 10000,
	`taxReserveBps` int NOT NULL DEFAULT 1500,
	`operationalReserveBps` int NOT NULL DEFAULT 1000,
	`cadence` enum('daily','weekly','monthly') NOT NULL DEFAULT 'monthly',
	`approvalMode` enum('manual','multisig','automatic') NOT NULL DEFAULT 'manual',
	`network` enum('testnet','mainnet') NOT NULL DEFAULT 'testnet',
	`status` enum('draft','ready','paused') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `treasury_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `treasury_settings_ownerUserId_unique` UNIQUE(`ownerUserId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD CONSTRAINT `customer_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_purchaseId_purchases_id_fk` FOREIGN KEY (`purchaseId`) REFERENCES `purchases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profit_distributions` ADD CONSTRAINT `profit_distributions_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_quotes` ADD CONSTRAINT `purchase_quotes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_quoteId_purchase_quotes_id_fk` FOREIGN KEY (`quoteId`) REFERENCES `purchase_quotes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treasury_settings` ADD CONSTRAINT `treasury_settings_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;