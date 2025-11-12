-- Migration: Add sub_manufacturer_id to orders table
ALTER TABLE orders ADD COLUMN sub_manufacturer_id UUID;
-- Optionally, add a foreign key constraint if you want strict referential integrity:
-- ALTER TABLE orders ADD CONSTRAINT fk_sub_manufacturer FOREIGN KEY (sub_manufacturer_id) REFERENCES users(id);