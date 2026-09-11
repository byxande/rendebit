CREATE TABLE `app_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('confirmation_required','info','success','warning') NOT NULL DEFAULT 'info',
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`actionLabel` varchar(80),
	`actionView` varchar(40),
	`relatedXverseActionId` int,
	`dedupeKey` varchar(180) NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_notifications_dedupeKey_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
CREATE INDEX `app_notifications_user_read_created` ON `app_notifications` (`userId`,`readAt`,`createdAt`);--> statement-breakpoint
ALTER TABLE `app_notifications` ADD CONSTRAINT `app_notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_notifications` ADD CONSTRAINT `app_notifications_relatedXverseActionId_xverse_actions_id_fk` FOREIGN KEY (`relatedXverseActionId`) REFERENCES `xverse_actions`(`id`) ON DELETE no action ON UPDATE no action;
