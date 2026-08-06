CREATE TABLE IF NOT EXISTS `investor_offer_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`investor_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`sent_at` integer NOT NULL,
	FOREIGN KEY (`investor_id`) REFERENCES `investors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `investor_offer_emails_unique` ON `investor_offer_emails` (`investor_id`,`lead_id`);
