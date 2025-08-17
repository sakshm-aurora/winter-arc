# Battle Reset Script

## Overview

This script completely resets battles for specific users back to Day 1 state. It's designed to reset battles between users "skarface" and "zupz" but can be easily modified for other users.

## What Gets Reset

The script performs a comprehensive reset of all battle-related data:

### User Data
- Total XP reset to 0
- Level reset to 1
- Trophies cleared
- Cosmetics cleared
- User achievements deleted

### Battle Data
- HP reset to 100 (full health)
- XP reset to 0
- Streak reset to 0
- Level reset to 1
- Status effects cleared
- Combat stats reset (damage dealt, XP gained, etc.)

### Game Progress
- All daily checkins deleted
- All battle logs deleted
- Weekly tournaments deleted
- Monthly boss fights deleted
- Battle events deleted
- Battle start date updated

## Usage

### Basic Usage (Start from today)
```bash
cd backend
node reset_battle.js
```

### Custom Start Date
```bash
cd backend
node reset_battle.js 2024-01-15
```

The date format must be `YYYY-MM-DD`.

## Prerequisites

1. Make sure the database is running and accessible
2. Ensure the `.env` file has correct database credentials
3. The target users ("skarface" and "zupz") must exist in the database
4. There must be at least one battle between the target users

## Safety Features

- **Transaction-based**: All operations are wrapped in a database transaction
- **Rollback on error**: If anything fails, all changes are rolled back
- **User verification**: Script verifies users exist before proceeding
- **Battle verification**: Script verifies battles exist before proceeding
- **Detailed logging**: Comprehensive output shows exactly what was reset

## Customization

To reset different users, modify the `TARGET_USERS` array in `reset_battle.js`:

```javascript
const TARGET_USERS = ['user1', 'user2'];
```

## Sample Output

```
🎮 Winter Arc RPG - Battle Reset Tool
========================================
📅 Using today as start date
🎯 Resetting battles for: skarface, zupz

⚠️  WARNING: This will permanently delete all battle data!
   Make sure you have a database backup if needed.

🚀 Starting Battle Reset Script...

📅 Battle will start from: 2024-01-15

🔍 Finding target users...
✅ Found users:
   - skarface (ID: 1, Email: skarface@example.com)
   - zupz (ID: 2, Email: zupz@example.com)

🔍 Finding battles between target users...
✅ Found battles:
   - Battle 1: skarface vs zupz (Status: active)

💾 Starting database transaction...

🧹 Clearing battle data...
   - Clearing user achievements...
     Deleted 0 achievements
   - Clearing battle events...
     Deleted 5 battle events
   - Clearing weekly tournaments...
     Deleted 1 tournaments
   - Clearing monthly boss fights...
     Deleted 0 boss fights
   - Clearing checkins...
     Deleted 24 checkins
   - Clearing battle logs...
     Deleted 12 battle logs
   - Resetting battle user stats...
     Reset stats for 2 battle participants
   - Resetting user-level stats...
     Reset stats for 2 users
   - Updating battle start dates...
     Updated 1 battles

✅ Transaction committed successfully!

📊 RESET SUMMARY
==================================================
🎯 Target Users: skarface, zupz
⚔️  Battles Reset: 1
📅 New Start Date: 2024-01-15
🗑️  Data Cleared:
   - 0 achievements
   - 5 battle events
   - 1 tournaments
   - 0 boss fights
   - 24 checkins
   - 12 battle logs
🔄 Stats Reset: 2 battle participants, 2 users

🎉 Battle reset complete! All users are back to Day 1.
🚀 The Winter Arc begins anew!
```

## Database Backup Recommendation

Before running the reset script, consider backing up your database:

```bash
# PostgreSQL backup example
pg_dump your_database_name > backup_before_reset.sql
```

## Troubleshooting

### "No target users found"
- Check that the usernames in `TARGET_USERS` match exactly (case-insensitive)
- Verify users exist in the database

### "No existing battles found"
- Users need to have at least one battle between them
- Create a battle through the application first

### Database connection errors
- Check your `.env` file has correct database credentials
- Ensure the database server is running
- Verify network connectivity

## Integration with Application

After running the reset script, the application will automatically treat the battle as starting fresh from Day 1. No additional configuration is needed.

## Security Note

This script requires direct database access and will permanently delete data. Only run this script when you're certain you want to reset the battle progress.
