PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_routine_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer,
	`exercise_id` integer,
	`order_index` integer,
	`target` text,
	`notes` text,
	`rest_seconds` integer,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_routine_exercises`("routine_id", "exercise_id", "order_index", "target", "notes", "rest_seconds") SELECT "routine_id", "exercise_id", "order_index", "target", "notes", "rest_seconds" FROM `routine_exercises`;--> statement-breakpoint
DROP TABLE `routine_exercises`;--> statement-breakpoint
ALTER TABLE `__new_routine_exercises` RENAME TO `routine_exercises`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `re_routine_id_idx` ON `routine_exercises` (`routine_id`);--> statement-breakpoint
CREATE INDEX `re_exercise_id_idx` ON `routine_exercises` (`exercise_id`);--> statement-breakpoint
ALTER TABLE `sets` ADD `routine_exercise_id` integer REFERENCES routine_exercises(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `sets_routine_exercise_id_idx` ON `sets` (`routine_exercise_id`);