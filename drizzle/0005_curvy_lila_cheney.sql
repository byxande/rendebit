CREATE TABLE `pix_deposits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amountBrl` decimal(18,2) NOT NULL,
	`status` enum('created','awaiting_payment','paid','expired','cancelled','manual_review') NOT NULL DEFAULT 'created',
	`idempotencyKey` varchar(120) NOT NULL,
	`providerReference` varchar(140),
	`endToEndId` varchar(140),
	`qrCodeText` text,
	`pixCopyPaste` text,
	`expiresAt` timestamp NOT NULL,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pix_deposits_id` PRIMARY KEY(`id`),
	CONSTRAINT `pix_deposits_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `ledger_entries` MODIFY COLUMN `entryType` enum('pix_deposit','customer_cash_in','buy_btc','fee_revenue','customer_position','yield_accrual','yield_exit','sell_btc','pix_out','provider_cost','tax_reserve','operational_reserve','profit_distribution') NOT NULL;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD `pixDepositId` int;--> statement-breakpoint
ALTER TABLE `pix_deposits` ADD CONSTRAINT `pix_deposits_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_pixDepositId_pix_deposits_id_fk` FOREIGN KEY (`pixDepositId`) REFERENCES `pix_deposits`(`id`) ON DELETE no action ON UPDATE no action;