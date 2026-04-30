PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_routine_exercises` (
	`routine_id` integer,
	`exercise_id` integer,
	`order_index` integer,
	`target` text,
	`notes` text,
	`rest_seconds` integer,
	PRIMARY KEY(`routine_id`, `exercise_id`),
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_routine_exercises`("routine_id", "exercise_id", "order_index", "target", "notes", "rest_seconds") SELECT "routine_id", "exercise_id", "order_index", "target", "notes", "rest_seconds" FROM `routine_exercises`;--> statement-breakpoint
DROP TABLE `routine_exercises`;--> statement-breakpoint
ALTER TABLE `__new_routine_exercises` RENAME TO `routine_exercises`;--> statement-breakpoint
PRAGMA foreign_keys=ON;