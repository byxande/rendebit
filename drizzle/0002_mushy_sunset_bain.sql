ALTER TABLE `treasury_settings` MODIFY COLUMN `organizationName` varchar(160) NOT NULL DEFAULT 'Organização RendeBit';
UPDATE `treasury_settings` SET `organizationName` = 'Organização RendeBit' WHERE `organizationName` = 'Organização Nexo';
