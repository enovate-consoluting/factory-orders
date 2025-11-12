-- Migration: Add created_by field to users table
ALTER TABLE users ADD COLUMN created_by UUID;
-- Optionally, add a foreign key constraint if you want to enforce referential integrity
-- ALTER TABLE users ADD CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users(id);