CREATE TABLE `favorites` (
	`user_id` text NOT NULL,
	`property_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `property_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `calculator_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`user_id` text NOT NULL,
	`arv` integer,
	`renovation_cost` integer,
	`target_roi` real DEFAULT 15,
	`mode` text DEFAULT 'flip' NOT NULL,
	`config` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `investor_offer_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`investor_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`sent_at` integer NOT NULL,
	FOREIGN KEY (`investor_id`) REFERENCES `investors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investor_offer_emails_unique` ON `investor_offer_emails` (`investor_id`,`lead_id`);--> statement-breakpoint
CREATE TABLE `investors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`phone` text,
	`email` text,
	`budget` integer,
	`budget_unlimited` integer DEFAULT 0,
	`portal_enabled` integer DEFAULT 0,
	`preferred_model` text,
	`notes` text,
	`last_active_at` integer,
	`login_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lead_events` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `locality_metrics` (
	`city_key` text NOT NULL,
	`source` text NOT NULL,
	`period` text NOT NULL,
	`json_data` text NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`city_key`, `source`, `period`)
);
--> statement-breakpoint
CREATE TABLE `market_cache` (
	`city` text NOT NULL,
	`segment` text DEFAULT 'any' NOT NULL,
	`low` integer NOT NULL,
	`high` integer NOT NULL,
	`median` integer NOT NULL,
	`sample_size` integer NOT NULL,
	`source` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`payload` text,
	PRIMARY KEY(`city`, `segment`)
);
--> statement-breakpoint
CREATE TABLE `poi_metrics` (
	`city_key` text NOT NULL,
	`district` text DEFAULT '' NOT NULL,
	`counts_json` text NOT NULL,
	`walkability` integer,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`city_key`, `district`)
);
--> statement-breakpoint
CREATE TABLE `portal_config` (
	`id` text PRIMARY KEY NOT NULL,
	`fifty_fifty_enabled` integer DEFAULT 1,
	`fifty_fifty_notice` text DEFAULT '',
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `realized_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`url` text,
	`portal_name` text,
	`title` text,
	`price` integer NOT NULL,
	`price_per_sqm` real,
	`area` real,
	`rooms` text,
	`condition` text,
	`building_type` text,
	`address` text,
	`lat` real,
	`lng` real,
	`sold_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rents` (
	`city_key` text NOT NULL,
	`segment` text DEFAULT 'any' NOT NULL,
	`rent_per_sqm` real,
	`median_rent` integer,
	`walkability` integer,
	`counts_json` text,
	`sample_size` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`city_key`, `segment`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_at` integer,
	`priority` text DEFAULT 'medium' NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vykupy_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`debtor_name` text NOT NULL,
	`case_number` text NOT NULL,
	`address` text,
	`region` text,
	`status` text DEFAULT 'NEW' NOT NULL,
	`raw_data` text DEFAULT '{}',
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vykupy_leads_case_number_unique` ON `vykupy_leads` (`case_number`);--> statement-breakpoint
CREATE TABLE `vykupy_regions` (
	`id` text PRIMARY KEY NOT NULL,
	`region` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vykupy_regions_region_unique` ON `vykupy_regions` (`region`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`conditions` text,
	`rules` text DEFAULT '{}',
	`channels` text DEFAULT '["in_app"]',
	`is_active` integer DEFAULT 1,
	`last_triggered` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_alerts`("id", "user_id", "name", "conditions", "rules", "channels", "is_active", "last_triggered", "created_at", "updated_at") SELECT "id", "user_id", "name", "conditions", "rules", "channels", "is_active", "last_triggered", "created_at", "updated_at" FROM `alerts`;--> statement-breakpoint
DROP TABLE `alerts`;--> statement-breakpoint
ALTER TABLE `__new_alerts` RENAME TO `alerts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_properties` (
	`id` text PRIMARY KEY NOT NULL,
	`portal_id` text NOT NULL,
	`portal_name` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`price` integer NOT NULL,
	`price_per_sqm` real,
	`area` real,
	`rooms` text,
	`floor` integer,
	`condition` text,
	`building_type` text,
	`year_built` integer,
	`address` text,
	`lat` real,
	`lng` real,
	`contact_phone` text,
	`contact_name` text,
	`contact_email` text,
	`description` text,
	`image_urls` text DEFAULT '[]',
	`status` text DEFAULT 'active' NOT NULL,
	`removed_at` integer,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`is_active` integer DEFAULT 1,
	`area_locked` integer DEFAULT 0,
	`floor_area` real,
	`usable_area` real,
	`accessory_area` real,
	`area_flag` text,
	`auction_data_json` text,
	`alt_portals` text DEFAULT '[]'
);
--> statement-breakpoint
INSERT INTO `__new_properties`("id", "portal_id", "portal_name", "url", "title", "price", "price_per_sqm", "area", "rooms", "floor", "condition", "building_type", "year_built", "address", "lat", "lng", "contact_phone", "contact_name", "contact_email", "description", "image_urls", "status", "removed_at", "first_seen", "last_seen", "is_active", "area_locked", "floor_area", "usable_area", "accessory_area", "area_flag", "auction_data_json", "alt_portals") SELECT "id", "portal_id", "portal_name", "url", "title", "price", "price_per_sqm", "area", "rooms", "floor", "condition", "building_type", "year_built", "address", "lat", "lng", "contact_phone", "contact_name", "contact_email", "description", "image_urls", "status", "removed_at", "first_seen", "last_seen", "is_active", "area_locked", "floor_area", "usable_area", "accessory_area", "area_flag", "auction_data_json", "alt_portals" FROM `properties`;--> statement-breakpoint
DROP TABLE `properties`;--> statement-breakpoint
ALTER TABLE `__new_properties` RENAME TO `properties`;--> statement-breakpoint
CREATE UNIQUE INDEX `properties_url_unique` ON `properties` (`url`);--> statement-breakpoint
ALTER TABLE `property_analysis` ADD `target_purchase_price` integer;--> statement-breakpoint
ALTER TABLE `property_analysis` ADD `arv_price_per_sqm_high` integer;--> statement-breakpoint
ALTER TABLE `property_analysis` ADD `market_source` text;--> statement-breakpoint
ALTER TABLE `property_analysis` ADD `market_sample_size` integer;--> statement-breakpoint
ALTER TABLE `property_analysis` ADD `monthly_rent` integer;--> statement-breakpoint
ALTER TABLE `property_analysis` ADD `cash_flow_monthly` integer;--> statement-breakpoint
ALTER TABLE `property_analysis` ADD `calc_mode` text DEFAULT 'flip';--> statement-breakpoint
ALTER TABLE `property_analysis` ADD `calc_snapshot` text;--> statement-breakpoint
ALTER TABLE `property_analysis` ADD `locality_score` integer;--> statement-breakpoint
ALTER TABLE `property_analysis` ADD `locality_factors_json` text;--> statement-breakpoint
ALTER TABLE `property_analysis` ADD `ai_locality_verdict` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `investor_id` text REFERENCES investors(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `user_id` text NOT NULL REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `stage_data` text DEFAULT '{}';--> statement-breakpoint
ALTER TABLE `leads` ADD `portal_visible` integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE `leads` ADD `portal_status` text DEFAULT 'available';--> statement-breakpoint
ALTER TABLE `leads` ADD `portal_reserved_investor_id` text REFERENCES investors(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `portal_reserved_model` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `portal_reserved_strategy` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `portal_reserved_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `portal_expires_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `position` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `leads` ADD `stage_entered_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `lost_reason` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `next_step` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `next_step_due_at` integer;