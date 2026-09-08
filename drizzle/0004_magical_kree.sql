CREATE TABLE `redemption_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`btcAmount` decimal(30,8) NOT NULL,
	`referenceBtcBrl` decimal(18,2) NOT NULL,
	`grossBrl` decimal(18,2) NOT NULL,
	`protocolFeeBps` int NOT NULL DEFAULT 15,
	`protocolFeeBrl` decimal(18,2) NOT NULL,
	`conversionPixFeeBps` int NOT NULL DEFAULT 45,
	`conversionPixFeeBrl` decimal(18,2) NOT NULL,
	`netBrl` decimal(18,2) NOT NULL,
	`status` enum('active','expired','confirmed','cancelled') NOT NULL DEFAULT 'active',
	`idempotencyKey` varchar(120) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `redemption_quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `redemption_quotes_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`quoteId` int NOT NULL,
	`externalReference` varchar(120) NOT NULL,
	`btcAmount` decimal(30,8) NOT NULL,
	`grossBrl` decimal(18,2) NOT NULL,
	`protocolFeeBrl` decimal(18,2) NOT NULL,
	`conversionPixFeeBrl` decimal(18,2) NOT NULL,
	`netBrl` decimal(18,2) NOT NULL,
	`pixDestinationMasked` varchar(120) NOT NULL,
	`status` enum('processing','settled','failed','manual_review','cancelled') NOT NULL DEFAULT 'processing',
	`stage` enum('reserved','protocol_exit','conversion','pix','completed') NOT NULL DEFAULT 'reserved',
	`protocolExitReference` varchar(140),
	`conversionReference` varchar(140),
	`pixEndToEndId` varchar(140),
	`failureReason` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`settledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `redemptions_quoteId_unique` UNIQUE(`quoteId`),
	CONSTRAINT `redemptions_externalReference_unique` UNIQUE(`externalReference`)
);
--> statement-breakpoint
ALTER TABLE `ledger_entries` MODIFY COLUMN `entryType` enum('customer_cash_in','buy_btc','fee_revenue','customer_position','yield_accrual','yield_exit','sell_btc','pix_out','provider_cost','tax_reserve','operational_reserve','profit_distribution') NOT NULL;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD `redemptionId` int;--> statement-breakpoint
ALTER TABLE `redemption_quotes` ADD CONSTRAINT `redemption_quotes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `redemptions` ADD CONSTRAINT `redemptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `redemptions` ADD CONSTRAINT `redemptions_quoteId_redemption_quotes_id_fk` FOREIGN KEY (`quoteId`) REFERENCES `redemption_quotes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_redemptionId_redemptions_id_fk` FOREIGN KEY (`redemptionId`) REFERENCES `redemptions`(`id`) ON DELETE no action ON UPDATE no action;