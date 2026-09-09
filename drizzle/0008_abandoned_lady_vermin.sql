CREATE TABLE `profit_capital_sweeps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`profitDistributionId` int NOT NULL,
	`sourceAccount` varchar(100) NOT NULL DEFAULT 'organization_distributable_profit_brl',
	`destinationAccount` varchar(100) NOT NULL DEFAULT 'owner_personal_profit_stbtc',
	`sourceCurrency` enum('BRL') NOT NULL DEFAULT 'BRL',
	`destinationAsset` enum('stBTC') NOT NULL DEFAULT 'stBTC',
	`sourceAmountBrl` decimal(18,2) NOT NULL,
	`referenceAssetBrl` decimal(18,2) NOT NULL,
	`slippageBps` int NOT NULL DEFAULT 50,
	`estimatedAssetAmount` decimal(30,8) NOT NULL,
	`minimumAssetAmount` decimal(30,8) NOT NULL,
	`destinationWalletAddress` varchar(80),
	`network` enum('testnet','mainnet') NOT NULL DEFAULT 'testnet',
	`route` varchar(80) NOT NULL DEFAULT 'BRL>BTC>sBTC>stBTC',
	`status` enum('blocked','pending_approval','simulated_sent','cancelled') NOT NULL DEFAULT 'blocked',
	`blockerReason` text,
	`transactionId` varchar(100),
	`idempotencyKey` varchar(160) NOT NULL,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profit_capital_sweeps_id` PRIMARY KEY(`id`),
	CONSTRAINT `profit_capital_sweeps_profitDistributionId_unique` UNIQUE(`profitDistributionId`),
	CONSTRAINT `profit_capital_sweeps_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `profit_capital_sweeps` ADD CONSTRAINT `pcs_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profit_capital_sweeps` ADD CONSTRAINT `pcs_distribution_fk` FOREIGN KEY (`profitDistributionId`) REFERENCES `profit_distributions`(`id`) ON DELETE no action ON UPDATE no action;
