-- Add processed_at column to track when checkins have been LLM processed
-- This enables batch processing at midnight IST

ALTER TABLE checkins ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP DEFAULT NULL;

-- Add index for efficient queries on unprocessed checkins
CREATE INDEX IF NOT EXISTS idx_checkins_processed_at ON checkins(processed_at);
CREATE INDEX IF NOT EXISTS idx_checkins_unprocessed ON checkins(battle_id, date) WHERE processed_at IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN checkins.processed_at IS 'Timestamp when this checkin was processed by LLM batch job. NULL means pending processing.';
