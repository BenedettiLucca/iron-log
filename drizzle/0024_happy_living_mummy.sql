ALTER TABLE `sets` ADD `operation_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `sets_operation_id_unique` ON `sets` (`operation_id`);