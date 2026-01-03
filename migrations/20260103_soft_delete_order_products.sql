-- =====================================================
-- MIGRATION: Soft Delete for Order Products
-- Date: 2026-01-03
-- Description: Adds soft delete columns to order_products
--              and creates index for efficient filtering
-- =====================================================

-- Step 1: Add soft delete columns to order_products
ALTER TABLE order_products
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- Step 2: Create index for efficient filtering of non-deleted products
-- This makes WHERE deleted_at IS NULL queries fast
CREATE INDEX IF NOT EXISTS idx_order_products_deleted_at
ON order_products(deleted_at)
WHERE deleted_at IS NULL;

-- Step 3: Create index for viewing deleted products by date
CREATE INDEX IF NOT EXISTS idx_order_products_deleted_at_desc
ON order_products(deleted_at DESC)
WHERE deleted_at IS NOT NULL;

-- Step 4: Add comment explaining the soft delete pattern
COMMENT ON COLUMN order_products.deleted_at IS 'Timestamp when product was soft-deleted. NULL means active.';
COMMENT ON COLUMN order_products.deleted_by IS 'User ID who deleted the product';
COMMENT ON COLUMN order_products.deleted_by_name IS 'User name who deleted the product (denormalized for history)';
COMMENT ON COLUMN order_products.deletion_reason IS 'Reason provided for deletion (required)';

-- =====================================================
-- VERIFICATION: Run this after migration to confirm
-- =====================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'order_products'
-- AND column_name IN ('deleted_at', 'deleted_by', 'deleted_by_name', 'deletion_reason');
