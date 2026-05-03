CREATE TABLE IF NOT EXISTS `program_exercise_targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`target_reps_min` integer NOT NULL,
	`target_reps_max` integer NOT NULL,
	`target_sets` integer NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `program_exercise_unique` ON `program_exercise_targets` (`program_id`,`exercise_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `program_weeks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`week_number` integer NOT NULL,
	`routine_id` integer,
	`phase` text DEFAULT 'accumulation' NOT NULL,
	`rir_target` integer DEFAULT 0,
	`intensity_mod` real DEFAULT 1,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `program_week_unique` ON `program_weeks` (`program_id`,`week_number`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `programs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`weeks_duration` integer DEFAULT 6 NOT NULL,
	`deload_week` integer,
	`goal` text DEFAULT 'hypertrophy' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `supplement_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplement_id` integer NOT NULL,
	`date` integer NOT NULL,
	`taken_at` integer NOT NULL,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `supplement_logs_date_idx` ON `supplement_logs` (`date`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `supplements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`dosage` text NOT NULL,
	`timing` text NOT NULL,
	`frequency` text DEFAULT 'daily' NOT NULL,
	`reminder_time` text,
	`is_nighttime` integer DEFAULT false NOT NULL,
	`emoji` text DEFAULT '💊',
	`order_index` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `supplements_active_idx` ON `supplements` (`is_active`);
