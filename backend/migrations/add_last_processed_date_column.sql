-- Add last_processed_date column to battles table
-- This tracks when a battle's daily processing was last completed

ALTER TABLE battles ADD COLUMN IF NOT EXISTS last_processed_date DATE DEFAULT NULL;

-- Add index for efficient queries on processing status
CREATE INDEX IF NOT EXISTS idx_battles_last_processed ON battles(last_processed_date);

-- Add comment for clarity
COMMENT ON COLUMN battles.last_processed_date IS 'Date when this battle was last processed by daily battle processor. NULL means needs processing.';
