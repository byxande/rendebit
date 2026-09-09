CREATE TABLE `btc_liquidity_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseId` int NOT NULL,
	`userId` int NOT NULL,
	`customerWalletId` int,
	`provider` enum('sandbox_binance','binance') NOT NULL DEFAULT 'sandbox_binance',
	`mode` enum('sandbox','test','production') NOT NULL DEFAULT 'sandbox',
	`network` enum('testnet','mainnet') NOT NULL DEFAULT 'testnet',
	`status` enum('pending_liquidity','liquidity_settled','stacks_pending','stacks_submitted','confirmed','blocked','failed') NOT NULL DEFAULT 'pending_liquidity',
	`amountBrl` decimal(18,2) NOT NULL,
	`btcAmount` decimal(30,8) NOT NULL,
	`executionBtcBrl` decimal(18,2) NOT NULL,
	`externalOrderId` varchar(140),
	`stacksTxId` varchar(140),
	`blockerReason` text,
	`failureReason` text,
	`idempotencyKey` varchar(180) NOT NULL,
	`liquiditySettledAt` timestamp,
	`stacksSubmittedAt` timestamp,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `btc_liquidity_settlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `btc_liquidity_settlements_purchaseId_unique` UNIQUE(`purchaseId`),
	CONSTRAINT `btc_liquidity_settlements_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `customer_wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`network` enum('testnet','mainnet') NOT NULL DEFAULT 'testnet',
	`address` varchar(80) NOT NULL,
	`label` varchar(100),
	`isPrimary` boolean NOT NULL DEFAULT true,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_wallet_user_network_address_unique` UNIQUE(`userId`,`network`,`address`)
);
--> statement-breakpoint
ALTER TABLE `provider_events` MODIFY COLUMN `provider` enum('sandbox_kyc','sandbox_pix','sandbox_payments','sandbox_binance','binance','mercado_pago','sandbox_custody','sandbox_stacks','stacks_testnet') NOT NULL;--> statement-breakpoint
ALTER TABLE `btc_liquidity_settlements` ADD CONSTRAINT `bls_purchase_fk` FOREIGN KEY (`purchaseId`) REFERENCES `purchases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `btc_liquidity_settlements` ADD CONSTRAINT `bls_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `btc_liquidity_settlements` ADD CONSTRAINT `bls_wallet_fk` FOREIGN KEY (`customerWalletId`) REFERENCES `customer_wallets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_wallets` ADD CONSTRAINT `cw_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
