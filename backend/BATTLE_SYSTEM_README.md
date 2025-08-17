# Winter Arc RPG - New Battle System

## Overview

The Winter Arc RPG now uses a **token-efficient batch processing system** where quest submissions happen in real-time, but LLM processing occurs once daily at **midnight IST** for consistent storylines and reduced costs.

## Architecture Changes

### 🔄 New Flow

1. **Real-time Submissions**: Users submit quest completions anytime during the day
2. **Storage Only**: Submissions are stored immediately without LLM processing  
3. **Midnight Processing**: At 00:00 IST, batch job processes all daily submissions
4. **LLM Scoring**: Battle narratives, damage calculation, and scoring happen together
5. **Consistent Stories**: All daily events get processed as one cohesive narrative

## 📁 New Files Created

### Core Processing
- `daily-battle-processor.js` - Main batch processing engine
- `scheduler.js` - Cron scheduler for midnight IST execution  
- `routes/processing-status.js` - API for checking processing status
- `migrations/add_processed_at_column.sql` - Database schema update

### Updated Files
- `routes/checkins.js` - Simplified real-time submission logic
- `server.js` - Added processing status route
- `package.json` - Added node-cron dependency and scripts

## 🗄️ Database Changes

### New Column: `checkins.processed_at`
```sql
ALTER TABLE checkins ADD COLUMN processed_at TIMESTAMP DEFAULT NULL;
```

- `NULL` = Pending processing
- `NOT NULL` = Processed by LLM batch job

### New Indexes
```sql
CREATE INDEX idx_checkins_processed_at ON checkins(processed_at);
CREATE INDEX idx_checkins_unprocessed ON checkins(battle_id, date) WHERE processed_at IS NULL;
```

## 🚀 Usage

### Starting the System

```bash
# Start the main server
npm start

# Start the scheduler (separate process)
npm run scheduler

# Development mode (with test runs every 5 minutes)
npm run scheduler:dev
```

### Manual Processing
```bash
# Process today manually
npm run process:manual

# Process specific date
node scheduler.js manual 2024-12-01
```

### Battle Reset
```bash
# Reset battle for skarface and zupz
npm run reset:battle
```

## 📊 Quest Frequency Logic

### Daily Quests
- Can be submitted once per day
- Reset at midnight IST

### Weekly Quests  
- Can be submitted once per week (Monday-Sunday)
- Reset every Monday

### Monthly Quests
- Can be submitted once per month
- Reset on 1st of each month

### Scheduled Sidequests
- Generated randomly by LLM at midnight
- 20% chance per battle per day
- Expire after 24 hours
- One-time completion only

## 🕛 Scheduling

### Midnight IST Processing
- **Time**: 00:00 India Standard Time
- **Frequency**: Daily
- **Cron**: `'0 0 * * *'` in Asia/Kolkata timezone

### Development Mode
- Additional test runs every 5 minutes
- Set `NODE_ENV=development`

## 📡 API Endpoints

### Processing Status
```
GET /processing-status/:battle_id?date=YYYY-MM-DD
GET /processing-status/ (system-wide)
```

**Response:**
```json
{
  "battle_id": 1,
  "date": "2024-12-01",
  "processing_status": {
    "is_processed": false,
    "total_checkins": 5,
    "processed_checkins": 0,
    "pending_checkins": 5,
    "battle_log_generated": false
  },
  "scheduling": {
    "current_ist_time": "2024-12-01T15:30:00.000Z",
    "next_processing": "2024-12-02T00:00:00.000Z",
    "hours_until_processing": 8
  }
}
```

### Quest Submission (Updated)
```
POST /checkins
```

**New Response:**
```json
{
  "success": true,
  "message": "3 quest(s) submitted successfully! Scores will be updated at midnight IST.",
  "submitted_quests": [...],
  "current_stats": {
    "hp": 100,
    "xp": 450,
    "level": 5,
    "streak": 3
  },
  "daily_progress": {
    "your_submissions": 3,
    "opponent_submissions": 2,
    "processing_status": "pending_midnight_processing"
  },
  "next_processing": "Midnight IST (00:00 India Standard Time)"
}
```

## 🔧 Daily Processing Features

### LLM Batch Processing
- Process all unprocessed checkins for the day
- Consistent scoring and narrative generation
- Status effect application and cleanup

### Battle Narratives
- Generated once both players have submissions
- Cohesive storyline for the entire day
- Stored in `logs` table

### Weekly Tournaments
- Processed on Sundays (end of week)
- Winner/loser determination and rewards

### Monthly Boss Fights
- Processed on last day of month
- Collaborative boss battle mechanics

### Scheduled Sidequests
- Random generation for next day
- LLM-created unique challenges
- Automatic expiration

### Status Effect Management
- Apply new effects from daily activities
- Clean up expired effects
- Handle combo bonuses and penalties

## 💾 Data Flow

### Real-time Submission
```
User submits quest → Validate frequency → Store raw data → Return confirmation
```

### Midnight Processing
```
Scheduler triggers → Find unprocessed checkins → LLM batch process → Update stats → Generate narratives → Mark processed
```

## 🛠️ Troubleshooting

### Check Processing Status
```bash
# View logs
tail -f logs/scheduler.log

# Manual status check
curl "http://localhost:3001/processing-status/1?date=2024-12-01"
```

### Common Issues

1. **Submissions not processing**: Check if scheduler is running
2. **No battle narratives**: Ensure both players have submissions
3. **Quest frequency errors**: Verify date/time logic for weekly/monthly

### Database Queries

```sql
-- Check unprocessed checkins
SELECT battle_id, date, COUNT(*) 
FROM checkins 
WHERE processed_at IS NULL 
GROUP BY battle_id, date;

-- View processing status
SELECT 
  battle_id,
  date,
  COUNT(*) as total,
  COUNT(processed_at) as processed,
  COUNT(*) - COUNT(processed_at) as pending
FROM checkins 
GROUP BY battle_id, date;
```

## 🎯 Benefits

### Token Efficiency
- **Before**: LLM call per quest submission (potentially 10+ calls/day)
- **After**: 1 LLM call per battle per day (2 calls/day maximum)
- **Savings**: ~80-90% reduction in LLM costs

### Consistent Narratives
- All daily events processed together
- Coherent storylines and battle outcomes
- Better player experience

### Performance
- Real-time submissions are fast (no LLM waiting)
- Batch processing is more efficient
- Better user experience during peak hours

### Reliability
- Failed LLM calls don't block user submissions
- Retry logic for batch processing
- Graceful degradation

## 🔄 Migration Guide

### From Old System
1. All existing functionality preserved
2. Old checkins remain processed
3. New submissions use new flow
4. No data loss or breaking changes

### Deployment
1. Apply database migration
2. Install node-cron dependency
3. Start scheduler service
4. Monitor processing logs

The new system maintains full backward compatibility while providing significant improvements in cost efficiency and narrative consistency!
