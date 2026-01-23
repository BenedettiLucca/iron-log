CREATE TABLE `body_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` integer NOT NULL,
	`type` text DEFAULT 'daily',
	`weight` real,
	`waist` real,
	`arm_right` real,
	`thigh_right` real,
	`chest` real,
	`calf` real,
	`photo_front` text,
	`photo_back` text,
	`photo_side` text
);
--> statement-breakpoint
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
	`created_at` integer DEFAULT 1768949783115,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sets`("id", "session_id", "exercise_id", "exercise_name", "set_number", "weight_kg", "reps", "duration_seconds", "rir", "created_at") SELECT "id", "session_id", "exercise_id", "exercise_name", "set_number", "weight_kg", "reps", "duration_seconds", "rir", "created_at" FROM `sets`;--> statement-breakpoint
DROP TABLE `sets`;--> statement-breakpoint
ALTER TABLE `__new_sets` RENAME TO `sets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;