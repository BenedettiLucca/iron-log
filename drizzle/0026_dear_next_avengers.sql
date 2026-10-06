DROP INDEX `routines_name_unique`;--> statement-breakpoint
ALTER TABLE `routines` ADD `is_archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `routines_folder_idx` ON `routines` (`folder`);--> statement-breakpoint
CREATE INDEX `routines_is_archived_idx` ON `routines` (`is_archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `routines_name_unique` ON `routines` (`name`) WHERE is_archived = 0;