ALTER TABLE `leads` ADD COLUMN `portal_visible` integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE `leads` ADD COLUMN `portal_status` text DEFAULT 'available';--> statement-breakpoint
ALTER TABLE `leads` ADD COLUMN `portal_reserved_investor_id` text REFERENCES `investors`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
ALTER TABLE `investors` ADD COLUMN `portal_enabled` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `investors` ADD COLUMN `portal_password_hash` text;
