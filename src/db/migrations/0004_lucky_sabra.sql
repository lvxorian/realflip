CREATE TABLE `crawl_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`portal` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`step` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
