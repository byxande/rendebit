CREATE TABLE `auth_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('google','apple') NOT NULL,
	`eventType` enum('sign_in','sign_out') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auth_events` ADD CONSTRAINT `auth_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;