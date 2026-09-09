CREATE TABLE `daily_reconciliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`dateKey` varchar(10) NOT NULL,
	`status` enum('balanced','attention','failed') NOT NULL DEFAULT 'attention',
	`totalLedgerEntries` int NOT NULL DEFAULT 0,
	`pendingSweepCount` int NOT NULL DEFAULT 0,
	`approvedSweepCount` int NOT NULL DEFAULT 0,
	`currencySummary` text NOT NULL,
	`exceptions` text,
	`idempotencyKey` varchar(180) NOT NULL,
	`reconciledAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_reconciliations_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_reconciliations_idempotencyKey_unique` UNIQUE(`idempotencyKey`),
	CONSTRAINT `daily_reconciliation_owner_date_unique` UNIQUE(`ownerUserId`,`dateKey`)
);
--> statement-breakpoint
CREATE TABLE `profit_sweep_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sweepId` int NOT NULL,
	`approverUserId` int NOT NULL,
	`approvalSequence` int NOT NULL,
	`decision` enum('approved','rejected') NOT NULL DEFAULT 'approved',
	`comment` text,
	`idempotencyKey` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profit_sweep_approvals_id` PRIMARY KEY(`id`),
	CONSTRAINT `profit_sweep_approvals_idempotencyKey_unique` UNIQUE(`idempotencyKey`),
	CONSTRAINT `profit_sweep_approver_unique` UNIQUE(`sweepId`,`approverUserId`)
);
--> statement-breakpoint
ALTER TABLE `profit_capital_sweeps` ADD `quoteProvider` varchar(60) DEFAULT 'sandbox_quote' NOT NULL;--> statement-breakpoint
ALTER TABLE `profit_capital_sweeps` ADD `quoteExternalId` varchar(140);--> statement-breakpoint
ALTER TABLE `profit_capital_sweeps` ADD `quoteStatus` enum('active','expired','consumed','rejected') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `profit_capital_sweeps` ADD `quoteExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `profit_capital_sweeps` ADD `approvalRequired` int DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `treasury_settings` ADD `conversionPartner` varchar(120) DEFAULT 'not_selected' NOT NULL;--> statement-breakpoint
ALTER TABLE `treasury_settings` ADD `conversionPartnerStatus` enum('not_selected','due_diligence','contracted','active') DEFAULT 'not_selected' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_reconciliations` ADD CONSTRAINT `daily_reconciliations_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profit_sweep_approvals` ADD CONSTRAINT `profit_sweep_approvals_sweepId_profit_capital_sweeps_id_fk` FOREIGN KEY (`sweepId`) REFERENCES `profit_capital_sweeps`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profit_sweep_approvals` ADD CONSTRAINT `profit_sweep_approvals_approverUserId_users_id_fk` FOREIGN KEY (`approverUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;