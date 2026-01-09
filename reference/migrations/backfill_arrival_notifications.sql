-- Backfill Arrival Notifications
-- Run AFTER creating the arrival_notifications table
-- IMPORTANT: Run each query separately in Supabase SQL Editor
-- Set "No limit" in the dropdown before running

-- ============================================================
-- QUERY 1: Preview what inventory items will get notifications
-- ============================================================
SELECT
  i.id as inventory_id,
  i.product_name,
  i.order_number,
  i.client_name,
  i.received_at,
  i.rack_location,
  i.total_quantity
FROM inventory i
WHERE i.status = 'in_stock'
  AND i.received_at >= NOW() - INTERVAL '5 days'
ORDER BY i.received_at DESC
LIMIT 50;


-- ============================================================
-- QUERY 2: Insert notifications (RUN THIS ONE)
-- ============================================================
INSERT INTO arrival_notifications (
  inventory_id,
  user_id,
  product_name,
  order_number,
  client_name,
  received_at,
  received_by_name,
  rack_location,
  total_quantity,
  dismissed,
  created_at
)
SELECT
  i.id,
  admin_users.id,
  i.product_name,
  i.order_number,
  i.client_name,
  i.received_at,
  receiver.name,
  i.rack_location,
  COALESCE(i.total_quantity, 0),
  false,
  i.received_at
FROM inventory i
CROSS JOIN (SELECT id, name FROM users WHERE role IN ('admin', 'super_admin')) admin_users
LEFT JOIN users receiver ON i.received_by = receiver.id
WHERE i.status = 'in_stock'
  AND i.received_at >= NOW() - INTERVAL '5 days'
  AND NOT EXISTS (
    SELECT 1 FROM arrival_notifications an
    WHERE an.inventory_id = i.id AND an.user_id = admin_users.id
  );


-- ============================================================
-- QUERY 3: Verify what was inserted
-- ============================================================
SELECT
  product_name,
  order_number,
  client_name,
  received_at,
  dismissed
FROM arrival_notifications
ORDER BY received_at DESC
LIMIT 50;
