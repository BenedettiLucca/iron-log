ALTER TABLE `routines` ADD `is_archived` integer DEFAULT 0 NOT NULL;
DROP INDEX IF EXISTS `routines_name_unique`;
CREATE UNIQUE INDEX `routines_name_unique` ON `routines` (`name`) WHERE `is_archived` = 0;
CREATE INDEX `routines_folder_idx` ON `routines` (`folder`);
CREATE INDEX `routines_is_archived_idx` ON `routines` (`is_archived`);