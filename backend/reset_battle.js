#!/usr/bin/env node
/**
 * Battle Reset Script for Winter Arc RPG
 * 
 * This script completely resets battles for specified users back to Day 1
 * Usage: node reset_battle.js [date]
 * 
 * If date is provided, battle will start from that date
 * If no date provided, battle starts from today
 */

const db = require('./db');

// Target usernames to reset
const TARGET_USERS = ['skarface', 'zupz'];

async function resetBattleForUsers(startDate = null) {
  console.log('\n🚀 Starting Battle Reset Script...\n');
  
  try {
    // Set start date
    const battleStartDate = startDate || new Date().toISOString().split('T')[0];
    console.log(`📅 Battle will start from: ${battleStartDate}\n`);

    // Step 1: Find target users
    console.log('🔍 Finding target users...');
    const userResults = await db.query(
      'SELECT id, name, email FROM users WHERE LOWER(name) = ANY($1)',
      [TARGET_USERS.map(u => u.toLowerCase())]
    );

    if (userResults.rows.length === 0) {
      console.error('❌ No target users found!');
      console.log(`   Looking for users: ${TARGET_USERS.join(', ')}`);
      return;
    }

    console.log('✅ Found users:');
    userResults.rows.forEach(user => {
      console.log(`   - ${user.name} (ID: ${user.id}, Email: ${user.email})`);
    });

    if (userResults.rows.length < 2) {
      console.warn(`⚠️  Only found ${userResults.rows.length} user(s). Need at least 2 for battle reset.`);
      return;
    }

    const userIds = userResults.rows.map(u => u.id);
    const userNames = userResults.rows.map(u => u.name);

    // Step 2: Find battles between these users
    console.log('\n🔍 Finding battles between target users...');
    const battleResults = await db.query(
      `SELECT id, player1_id, player2_id, status, started_at 
       FROM battles 
       WHERE (player1_id = ANY($1) AND player2_id = ANY($1)) 
       AND player1_id != player2_id`,
      [userIds]
    );

    if (battleResults.rows.length === 0) {
      console.log('ℹ️  No existing battles found between target users.');
      console.log('   You may need to create a battle first through the application.');
      return;
    }

    console.log('✅ Found battles:');
    battleResults.rows.forEach(battle => {
      const user1 = userResults.rows.find(u => u.id === battle.player1_id);
      const user2 = userResults.rows.find(u => u.id === battle.player2_id);
      console.log(`   - Battle ${battle.id}: ${user1.name} vs ${user2.name} (Status: ${battle.status})`);
    });

    const battleIds = battleResults.rows.map(b => b.id);

    // Step 3: Start transaction for atomic reset
    console.log('\n💾 Starting database transaction...');
    await db.query('BEGIN');

    try {
      // Step 4: Clear all battle-related data
      console.log('\n🧹 Clearing battle data...');

      // Clear user achievements
      console.log('   - Clearing user achievements...');
      const achievementResult = await db.query(
        'DELETE FROM user_achievements WHERE user_id = ANY($1)',
        [userIds]
      );
      console.log(`     Deleted ${achievementResult.rowCount} achievements`);

      // Clear battle events
      console.log('   - Clearing battle events...');
      const eventsResult = await db.query(
        'DELETE FROM battle_events WHERE battle_id = ANY($1)',
        [battleIds]
      );
      console.log(`     Deleted ${eventsResult.rowCount} battle events`);

      // Clear weekly tournaments
      console.log('   - Clearing weekly tournaments...');
      const tournamentsResult = await db.query(
        'DELETE FROM weekly_tournaments WHERE battle_id = ANY($1)',
        [battleIds]
      );
      console.log(`     Deleted ${tournamentsResult.rowCount} tournaments`);

      // Clear monthly boss fights
      console.log('   - Clearing monthly boss fights...');
      const bossResult = await db.query(
        'DELETE FROM monthly_boss_fights WHERE participating_battles::jsonb ?| $1',
        [battleIds.map(id => id.toString())]
      );
      console.log(`     Deleted ${bossResult.rowCount} boss fights`);

      // Clear checkins
      console.log('   - Clearing checkins...');
      const checkinsResult = await db.query(
        'DELETE FROM checkins WHERE battle_id = ANY($1)',
        [battleIds]
      );
      console.log(`     Deleted ${checkinsResult.rowCount} checkins`);

      // Clear battle logs
      console.log('   - Clearing battle logs...');
      const logsResult = await db.query(
        'DELETE FROM logs WHERE battle_id = ANY($1)',
        [battleIds]
      );
      console.log(`     Deleted ${logsResult.rowCount} battle logs`);

      // Step 5: Reset battle_user_stats to initial values
      console.log('   - Resetting battle user stats...');
      const statsResetResult = await db.query(`
        UPDATE battle_user_stats 
        SET 
          hp = 100,
          max_hp = 100,
          xp = 0,
          streak = 0,
          level = 1,
          status_effects = '[]'::jsonb,
          combo_count = 0,
          last_action_date = NULL,
          weekly_wins = 0,
          total_damage_dealt = 0
        WHERE battle_id = ANY($1) AND user_id = ANY($2)
      `, [battleIds, userIds]);
      console.log(`     Reset stats for ${statsResetResult.rowCount} battle participants`);

      // Step 6: Reset user-level stats
      console.log('   - Resetting user-level stats...');
      const userResetResult = await db.query(`
        UPDATE users 
        SET 
          total_xp = 0,
          level = 1,
          trophies = '[]'::jsonb,
          cosmetics = '{}'::jsonb
        WHERE id = ANY($1)
      `, [userIds]);
      console.log(`     Reset stats for ${userResetResult.rowCount} users`);

      // Step 7: Reset battle start dates and status
      console.log('   - Updating battle start dates...');
      const battleUpdateResult = await db.query(`
        UPDATE battles 
        SET 
          started_at = $1::timestamp,
          status = 'active',
          week_number = 1,
          month_year = TO_CHAR($1::date, 'YYYY-MM'),
          boss_hp = NULL,
          boss_max_hp = NULL,
          boss_name = NULL
        WHERE id = ANY($2)
      `, [battleStartDate, battleIds]);
      console.log(`     Updated ${battleUpdateResult.rowCount} battles`);

      // Step 8: Commit transaction
      await db.query('COMMIT');
      console.log('\n✅ Transaction committed successfully!');

      // Step 9: Display final summary
      console.log('\n📊 RESET SUMMARY');
      console.log('='.repeat(50));
      console.log(`🎯 Target Users: ${userNames.join(', ')}`);
      console.log(`⚔️  Battles Reset: ${battleIds.length}`);
      console.log(`📅 New Start Date: ${battleStartDate}`);
      console.log(`🗑️  Data Cleared:`);
      console.log(`   - ${achievementResult.rowCount} achievements`);
      console.log(`   - ${eventsResult.rowCount} battle events`);
      console.log(`   - ${tournamentsResult.rowCount} tournaments`);
      console.log(`   - ${bossResult.rowCount} boss fights`);
      console.log(`   - ${checkinsResult.rowCount} checkins`);
      console.log(`   - ${logsResult.rowCount} battle logs`);
      console.log(`🔄 Stats Reset: ${statsResetResult.rowCount} battle participants, ${userResetResult.rowCount} users`);
      
      console.log('\n🎉 Battle reset complete! All users are back to Day 1.');
      console.log('🚀 The Winter Arc begins anew!');

    } catch (error) {
      // Rollback on error
      await db.query('ROLLBACK');
      console.error('\n❌ Error during reset, rolling back transaction...');
      throw error;
    }

  } catch (error) {
    console.error('\n💥 Fatal error during battle reset:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
  } finally {
    // Close database connection
    await db.pool.end();
  }
}

// Handle command line arguments
async function main() {
  const args = process.argv.slice(2);
  const startDate = args[0] || null;

  if (startDate) {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate)) {
      console.error('❌ Invalid date format. Please use YYYY-MM-DD format.');
      process.exit(1);
    }
    
    // Validate date is valid
    const testDate = new Date(startDate);
    if (isNaN(testDate.getTime())) {
      console.error('❌ Invalid date provided.');
      process.exit(1);
    }
  }

  console.log('🎮 Winter Arc RPG - Battle Reset Tool');
  console.log('=' .repeat(40));
  
  if (startDate) {
    console.log(`📅 Custom start date: ${startDate}`);
  } else {
    console.log('📅 Using today as start date');
  }
  
  console.log(`🎯 Resetting battles for: ${TARGET_USERS.join(', ')}`);
  console.log('\n⚠️  WARNING: This will permanently delete all battle data!');
  console.log('   Make sure you have a database backup if needed.\n');
  
  // Add a small delay to let user read the warning
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await resetBattleForUsers(startDate);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { resetBattleForUsers };
