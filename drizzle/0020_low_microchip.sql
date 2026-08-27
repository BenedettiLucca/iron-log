CREATE TABLE `folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folders_name_unique` ON `folders` (`name`);--> statement-breakpoint
INSERT OR IGNORE INTO `folders` (`name`) VALUES ('Geral');--> statement-breakpoint
UPDATE `routines`
SET `folder` = trim(`folder`)
WHERE `folder` IS NOT NULL;--> statement-breakpoint
UPDATE `routines`
SET `folder` = 'Geral'
WHERE `folder` IS NULL OR `folder` = '';--> statement-breakpoint
UPDATE `routines`
SET `folder` = 'Geral'
WHERE `folder` IS NOT NULL AND lower(`folder`) = lower('Geral');--> statement-breakpoint
UPDATE `routines`
SET `folder` = (
  SELECT MIN(`candidate`.`folder`)
  FROM `routines` AS `candidate`
  WHERE lower(`candidate`.`folder`) = lower(`routines`.`folder`)
)
WHERE `folder` IS NOT NULL AND `folder` <> '';--> statement-breakpoint
INSERT OR IGNORE INTO `folders` (`name`)
SELECT DISTINCT `folder`
FROM `routines`
WHERE `folder` IS NOT NULL AND `folder` <> '';