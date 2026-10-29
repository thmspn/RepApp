CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`author_key` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`category` text NOT NULL,
	`course` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`kind` text DEFAULT 'concern' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conversations_author_idx` ON `conversations` (`author_key`);--> statement-breakpoint
CREATE INDEX `conversations_feed_idx` ON `conversations` (`visibility`,`created_at`);--> statement-breakpoint
CREATE INDEX `conversations_category_idx` ON `conversations` (`category`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `replies` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`author_key` text NOT NULL,
	`body` text NOT NULL,
	`is_rep` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `replies_conversation_idx` ON `replies` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`conversation_id` text NOT NULL,
	`author_key` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`conversation_id`, `author_key`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`conversation_id` text NOT NULL,
	`author_key` text NOT NULL,
	PRIMARY KEY(`conversation_id`, `author_key`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
