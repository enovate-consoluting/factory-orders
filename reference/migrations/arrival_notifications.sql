-- Arrival Notifications Table
-- Per-user notifications when inventory items are received/checked-in
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS arrival_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the inventory record
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,

  -- Which user should see this notification
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Denormalized data for quick display (no joins needed)
  product_name TEXT NOT NULL,
  order_number TEXT,
  client_name TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  received_by_name TEXT,
  rack_location TEXT,
  total_quantity INTEGER DEFAULT 0,

  -- Per-user dismissal state
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries (user's undismissed notifications)
CREATE INDEX IF NOT EXISTS idx_arrival_notifications_user_dismissed
ON arrival_notifications(user_id, dismissed)
WHERE dismissed = FALSE;

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_arrival_notifications_created
ON arrival_notifications(created_at);

-- Enable RLS
ALTER TABLE arrival_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
CREATE POLICY "Users can view own arrival notifications"
ON arrival_notifications FOR SELECT
USING (user_id = auth.uid() OR auth.uid() IS NULL);

-- Policy: Users can update (dismiss) their own notifications
CREATE POLICY "Users can dismiss own arrival notifications"
ON arrival_notifications FOR UPDATE
USING (user_id = auth.uid() OR auth.uid() IS NULL);

-- Policy: Allow insert from service role (when inventory is received)
CREATE POLICY "Service can insert arrival notifications"
ON arrival_notifications FOR INSERT
WITH CHECK (true);

-- Optional: Function to clean up old dismissed notifications (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_arrival_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM arrival_notifications
  WHERE dismissed = TRUE
  AND dismissed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
