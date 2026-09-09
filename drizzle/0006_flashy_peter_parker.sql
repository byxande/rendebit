ALTER TABLE `provider_events` MODIFY COLUMN `provider` enum('sandbox_kyc','sandbox_pix','sandbox_payments','mercado_pago','sandbox_custody','sandbox_stacks','stacks_testnet') NOT NULL;--> statement-breakpoint
ALTER TABLE `purchases` MODIFY COLUMN `status` enum('awaiting_payment','processing','settled','failed','refunded') NOT NULL DEFAULT 'awaiting_payment';--> statement-breakpoint
ALTER TABLE `purchases` ADD `paymentMethod` enum('pix','credit_card') DEFAULT 'pix' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchases` ADD `paymentProvider` enum('sandbox','mercado_pago') DEFAULT 'sandbox' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchases` ADD `paymentReference` varchar(140);--> statement-breakpoint
ALTER TABLE `purchases` ADD `paymentStatus` enum('pending','approved','rejected','refunded') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchases` ADD `checkoutUrl` text;