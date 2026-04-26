PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`exercise_name` text,
	`set_number` integer NOT NULL,
	`weight_kg` real NOT NULL,
	`reps` integer NOT NULL,
	`duration_seconds` integer,
	`rir` integer,
	`is_warmup` integer DEFAULT false NOT NULL,
	`is_edited` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT 1777175164571,
	`deleted_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sets`("id", "session_id", "exercise_id", "exercise_name", "set_number", "weight_kg", "reps", "duration_seconds", "rir", "is_warmup", "is_edited", "created_at", "deleted_at") SELECT "id", "session_id", "exercise_id", "exercise_name", "set_number", "weight_kg", "reps", "duration_seconds", "rir", "is_warmup", "is_edited", "created_at", "deleted_at" FROM `sets`;--> statement-breakpoint
DROP TABLE `sets`;--> statement-breakpoint
ALTER TABLE `__new_sets` RENAME TO `sets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `sessions` ADD `deleted_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `pr_exercise_type_unique` ON `personal_records` (`exercise_id`,`record_type`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sessions_date_idx` ON `sessions` (`start_time`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sets_session_id_idx` ON `sets` (`session_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sets_exercise_id_idx` ON `sets` (`exercise_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `body_metrics_date_idx` ON `body_metrics` (`date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pr_exercise_type_idx` ON `personal_records` (`exercise_id`,`record_type`);
