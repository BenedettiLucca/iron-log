ALTER TABLE `routine_exercises` ADD `superset_group_id` text;--> statement-breakpoint
CREATE INDEX `re_routine_superset_idx` ON `routine_exercises` (`routine_id`,`superset_group_id`);--> statement-breakpoint
ALTER TABLE `session_exercises` ADD `superset_group_id` text;--> statement-breakpoint
CREATE INDEX `se_session_superset_idx` ON `session_exercises` (`session_id`,`superset_group_id`);