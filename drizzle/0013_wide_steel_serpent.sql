CREATE TABLE `xverse_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`customerWalletId` int,
	`actionType` enum('wallet_connection','withdrawal','swap','yield') NOT NULL,
	`network` enum('testnet','mainnet') NOT NULL DEFAULT 'testnet',
	`walletAddress` varchar(80) NOT NULL,
	`status` enum('connected','intent_created','signed','submitted','confirmed','rejected','blocked') NOT NULL DEFAULT 'connected',
	`unsignedTransaction` text,
	`signedTransaction` text,
	`transactionId` varchar(140),
	`providerReference` varchar(180),
	`failureReason` text,
	`metadata` text,
	`idempotencyKey` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `xverse_actions_id` PRIMARY KEY(`id`),
	CONSTRAINT `xverse_actions_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `xverse_actions` ADD CONSTRAINT `xverse_actions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `xverse_actions` ADD CONSTRAINT `xverse_actions_customerWalletId_customer_wallets_id_fk` FOREIGN KEY (`customerWalletId`) REFERENCES `customer_wallets`(`id`) ON DELETE no action ON UPDATE no action;