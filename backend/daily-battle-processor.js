#!/usr/bin/env node
/**
 * Daily Battle Processor - Midnight IST Batch Job
 * 
 * This script runs at midnight IST to process all daily quest submissions
 * with LLM scoring, generate battle narratives, and update stats.
 * 
 * Features:
 * - Batch LLM processing for token efficiency
 * - Consistent daily storylines
 * - Weekly/monthly quest handling
 * - Scheduled sidequest generation
 * - Tournament and boss fight processing
 */

const db = require('./db');
const { generateBattleNarration } = require('./utils/llm');
const { RPGEngine } = require('./utils/rpg-engine');

class DailyBattleProcessor {
  constructor() {
    this.rpgEngine = new RPGEngine(db);
    this.processedBattles = 0;
    this.processedCheckins = 0;
    this.generatedNarratives = 0;
  }

  /**
   * Main processing function - called by scheduler
   */
  async processDaily(targetDate = null) {
    const processingDate = targetDate || new Date().toISOString().split('T')[0];
    const istTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    
    console.log('\n🌙 MIDNIGHT IST BATTLE PROCESSOR');
    console.log('=' .repeat(50));
    console.log(`📅 Processing Date: ${processingDate}`);
    console.log(`🕛 IST Time: ${istTime}`);
    console.log('');

    try {
      // 1. Process all unprocessed checkins for the day
      await this.processUnprocessedCheckins(processingDate);
      
      // 2. Generate battle narratives for completed days
      await this.generateDailyBattleNarratives(processingDate);
      
      // 3. Process weekly tournaments (if end of week)
      await this.processWeeklyTournaments(processingDate);
      
      // 4. Process monthly boss fights (if end of month)
      await this.processMonthlyBossFights(processingDate);
      
      // 5. Generate scheduled sidequests for tomorrow
      await this.generateScheduledSidequests(processingDate);
      
      // 6. Cleanup expired status effects
      await this.cleanupExpiredStatusEffects(processingDate);

      console.log('\n📊 PROCESSING SUMMARY');
      console.log('=' .repeat(30));
      console.log(`⚔️  Battles Processed: ${this.processedBattles}`);
      console.log(`📝 Checkins Processed: ${this.processedCheckins}`);
      console.log(`📜 Narratives Generated: ${this.generatedNarratives}`);
      console.log('\n✅ Daily processing complete!\n');

    } catch (error) {
      console.error('\n💥 Daily processing failed:', error);
      throw error;
    }
  }

  /**
   * Process all unprocessed checkins with LLM scoring
   */
  async processUnprocessedCheckins(processingDate) {
    console.log('🔄 Processing unprocessed checkins...');
    
    // Get all battles with unprocessed checkins for this date
    const battlesWithUnprocessed = await db.query(`
      SELECT DISTINCT battle_id
      FROM checkins 
      WHERE date = $1 AND processed_at IS NULL
    `, [processingDate]);

    for (const { battle_id } of battlesWithUnprocessed.rows) {
      await this.processBattleDay(battle_id, processingDate);
      this.processedBattles++;
    }
  }

  /**
   * Process a single battle day
   */
  async processBattleDay(battleId, processingDate) {
    console.log(`  📋 Processing Battle ${battleId} for ${processingDate}...`);

    // Get battle info
    const battleRes = await db.query('SELECT * FROM battles WHERE id = $1', [battleId]);
    if (battleRes.rows.length === 0) return;
    
    const battle = battleRes.rows[0];
    const playerIds = [battle.player1_id, battle.player2_id];

    // Process each player's submissions
    for (const userId of playerIds) {
      await this.processPlayerSubmissions(battleId, userId, processingDate);
    }

    // Update battle stats after processing
    await this.updateBattleStats(battleId, processingDate);
  }

  /**
   * Process a single player's submissions for the day
   */
  async processPlayerSubmissions(battleId, userId, processingDate) {
    // Get unprocessed checkins for this player
    const checkins = await db.query(`
      SELECT c.*, q.name, q.quest_type, q.difficulty, q.frequency, q.base_damage, q.base_xp
      FROM checkins c
      JOIN quests q ON c.quest_id = q.id
      WHERE c.battle_id = $1 AND c.user_id = $2 AND c.date = $3 AND c.processed_at IS NULL
      ORDER BY c.submission_sequence
    `, [battleId, userId, processingDate]);

    if (checkins.rows.length === 0) return;

    // Get user stats
    const userStatsRes = await db.query(
      'SELECT * FROM battle_user_stats WHERE battle_id = $1 AND user_id = $2',
      [battleId, userId]
    );
    const userStats = userStatsRes.rows[0];

    // Get opponent stats
    const opponentId = await this.getOpponentId(battleId, userId);
    const opponentStatsRes = await db.query(
      'SELECT * FROM battle_user_stats WHERE battle_id = $1 AND user_id = $2',
      [battleId, opponentId]
    );
    const opponentStats = opponentStatsRes.rows[0];

    let totalDamage = 0;
    let totalXP = 0;
    let statusEffectsToApply = [];
    let criticalHits = 0;

    // Process each checkin with LLM
    for (const checkin of checkins.rows) {
      const quest = {
        id: checkin.quest_id,
        name: checkin.name,
        quest_type: checkin.quest_type,
        difficulty: checkin.difficulty,
        frequency: checkin.frequency,
        base_damage: checkin.base_damage,
        base_xp: checkin.base_xp
      };

      // LLM evaluation
      const evaluation = await this.rpgEngine.calculateQuestOutcome(
        quest, checkin.completed, checkin.value, userStats, opponentStats
      );

      // Update checkin with LLM results
      await db.query(`
        UPDATE checkins 
        SET 
          llm_score = $1,
          damage_dealt = $2,
          xp_gained = $3,
          is_critical_hit = $4,
          status_effects_applied = $5,
          combo_multiplier = $6,
          processed_at = NOW()
        WHERE id = $7
      `, [
        evaluation.damage_dealt + evaluation.xp_gained,
        Math.floor(evaluation.damage_dealt),
        Math.floor(evaluation.xp_gained),
        evaluation.is_critical_hit,
        JSON.stringify(evaluation.status_effects_applied || []),
        evaluation.multiplier || 1.0,
        checkin.id
      ]);

      if (evaluation.quality !== 'failed') {
        totalDamage += evaluation.damage_dealt;
        totalXP += evaluation.xp_gained;
        if (evaluation.is_critical_hit) criticalHits++;
        statusEffectsToApply.push(...(evaluation.status_effects_applied || []));
      }

      this.processedCheckins++;
    }

    // Apply combo bonuses
    const completedQuests = checkins.rows.filter(c => c.completed);
    let comboMultiplier = 1.0;
    
    const activeStatusEffects = userStats.status_effects || [];
    const isComboBlocked = activeStatusEffects.some(effect => 
      effect.name === 'Frozen' && effect.effect?.combo_blocked
    );

    if (!isComboBlocked && completedQuests.length >= 2) {
      comboMultiplier = completedQuests.length >= 3 ? 1.5 : 1.2;
      const comboBonus = Math.floor(totalDamage * (comboMultiplier - 1));
      totalDamage += comboBonus;
      totalXP += comboBonus;
    }

    // Apply status effects
    const newUserStats = await this.rpgEngine.applyStatusEffects(userStats, statusEffectsToApply);

    // Update user stats
    const finalDamage = Math.floor(totalDamage);
    const finalXP = Math.floor(totalXP);
    const newXP = userStats.xp + finalXP;
    const newStreak = completedQuests.length > 0 ? userStats.streak + 1 : Math.max(0, userStats.streak - 1);
    const newLevel = Math.floor(newXP / 100) + 1;

    await db.query(`
      UPDATE battle_user_stats 
      SET 
        xp = $1, 
        streak = $2, 
        level = $3, 
        status_effects = $4,
        total_damage_dealt = total_damage_dealt + $5,
        last_action_date = $6
      WHERE battle_id = $7 AND user_id = $8
    `, [newXP, newStreak, newLevel, JSON.stringify(newUserStats.status_effects), 
        finalDamage, processingDate, battleId, userId]);

    // Damage opponent
    const newOpponentHP = Math.max(0, opponentStats.hp - finalDamage);
    await db.query(`
      UPDATE battle_user_stats 
      SET hp = $1
      WHERE battle_id = $2 AND user_id = $3
    `, [newOpponentHP, battleId, opponentId]);

    console.log(`    ✅ Processed ${checkins.rows.length} checkins for user ${userId} (${finalDamage} dmg, ${finalXP} xp)`);
  }

  /**
   * Generate daily battle narratives
   */
  async generateDailyBattleNarratives(processingDate) {
    console.log('📜 Generating daily battle narratives...');

    // Get battles that need narratives (at least one player has submissions, no log exists)
    const battlesNeedingNarratives = await db.query(`
      SELECT DISTINCT b.id as battle_id, b.player1_id, b.player2_id
      FROM battles b
      WHERE b.status = 'active'
      AND (
        EXISTS (
          SELECT 1 FROM checkins c1 
          WHERE c1.battle_id = b.id AND c1.user_id = b.player1_id AND c1.date = $1
        )
        OR EXISTS (
          SELECT 1 FROM checkins c2 
          WHERE c2.battle_id = b.id AND c2.user_id = b.player2_id AND c2.date = $1
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM logs l 
        WHERE l.battle_id = b.id AND l.date = $1
      )
    `, [processingDate]);

    for (const battle of battlesNeedingNarratives.rows) {
      await this.generateBattleNarrative(battle.battle_id, processingDate);
      this.generatedNarratives++;
    }
  }

  /**
   * Generate narrative for a single battle
   */
  async generateBattleNarrative(battleId, processingDate) {
    try {
      // Get battle info
      const battleRes = await db.query('SELECT * FROM battles WHERE id = $1', [battleId]);
      const battle = battleRes.rows[0];

      // Calculate day number
      const firstLogRes = await db.query(
        'SELECT MIN(date) as first_date FROM logs WHERE battle_id = $1',
        [battleId]
      );
      
      let dayNumber = 1;
      if (firstLogRes.rows[0]?.first_date) {
        const firstDate = new Date(firstLogRes.rows[0].first_date);
        const currentDate = new Date(processingDate);
        dayNumber = Math.floor((currentDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
      }

      // Gather players data
      const playersData = await this.gatherPlayersData(battleId, processingDate, battle);
      
      // Check if both players submitted
      const player1Submitted = playersData[0]?.submitted_today || false;
      const player2Submitted = playersData[1]?.submitted_today || false;
      const bothSubmitted = player1Submitted && player2Submitted;
      const onePlayerMissing = !bothSubmitted;
      const missedPlayer = !player1Submitted ? playersData[0]?.name : !player2Submitted ? playersData[1]?.name : null;
      
      // Determine daily winner based on damage dealt
      let dailyWinner = null;
      let dailyLoser = null;
      if (player1Submitted && player2Submitted) {
        const player1Damage = playersData[0]?.today?.damage_dealt || 0;
        const player2Damage = playersData[1]?.today?.damage_dealt || 0;
        if (player1Damage > player2Damage) {
          dailyWinner = playersData[0]?.name;
          dailyLoser = playersData[1]?.name;
        } else if (player2Damage > player1Damage) {
          dailyWinner = playersData[1]?.name;
          dailyLoser = playersData[0]?.name;
        }
        // If equal damage, it's a tie (no winner/loser)
      } else if (player1Submitted && !player2Submitted) {
        dailyWinner = playersData[0]?.name;
        dailyLoser = playersData[1]?.name;
      } else if (player2Submitted && !player1Submitted) {
        dailyWinner = playersData[1]?.name;
        dailyLoser = playersData[0]?.name;
      }
      
      // Generate narrative
      const logText = await generateBattleNarration(processingDate, playersData, {
        dayNumber,
        bothSubmitted,
        onePlayerMissing,
        missedPlayer,
        dailyWinner,
        dailyLoser,
        isScheduledProcessing: true
      });

      // Store battle log
      await db.query(
        'INSERT INTO logs (battle_id, date, log_text) VALUES ($1, $2, $3)', 
        [battleId, processingDate, logText]
      );

      console.log(`    ✅ Generated narrative for Battle ${battleId} (Day ${dayNumber})`);

      // Check for battle conclusion
      const statsRes = await db.query(
        'SELECT hp FROM battle_user_stats WHERE battle_id = $1',
        [battleId]
      );
      
      const hasDefeatedPlayer = statsRes.rows.some(stat => stat.hp <= 0);
      if (hasDefeatedPlayer) {
        await db.query('UPDATE battles SET status = $1 WHERE id = $2', ['completed', battleId]);
        console.log(`    🏆 Battle ${battleId} concluded!`);
      }

    } catch (error) {
      console.error(`    ❌ Failed to generate narrative for Battle ${battleId}:`, error.message);
    }
  }

  /**
   * Process weekly tournaments
   */
  async processWeeklyTournaments(processingDate) {
    const date = new Date(processingDate);
    const dayOfWeek = date.getDay();
    
    // Only process on Sundays (end of week)
    if (dayOfWeek !== 0) return;

    console.log('🏆 Processing weekly tournaments...');

    const activeBattles = await db.query('SELECT id FROM battles WHERE status = $1', ['active']);
    
    for (const { id: battleId } of activeBattles.rows) {
      const result = await this.rpgEngine.processWeeklyTournament(battleId);
      if (result) {
        console.log(`    ✅ Tournament processed for Battle ${battleId}: ${result.winner} wins!`);
      }
    }
  }

  /**
   * Process monthly boss fights
   */
  async processMonthlyBossFights(processingDate) {
    const date = new Date(processingDate);
    const isLastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() === date.getDate();
    
    if (!isLastDayOfMonth) return;

    console.log('🐉 Processing monthly boss fights...');

    const monthYear = processingDate.slice(0, 7); // YYYY-MM
    const boss = await this.rpgEngine.processMonthlyBoss(monthYear);
    
    if (boss) {
      console.log(`    ✅ Monthly boss processed: ${boss.boss_name}`);
    }
  }

  /**
   * Generate scheduled sidequests for tomorrow
   */
  async generateScheduledSidequests(processingDate) {
    console.log('🎲 Generating scheduled sidequests...');

    // 20% chance of generating a sidequest for each active battle
    const activeBattles = await db.query('SELECT id FROM battles WHERE status = $1', ['active']);
    
    for (const { id: battleId } of activeBattles.rows) {
      if (Math.random() < 0.2) {
        await this.generateSidequest(battleId, processingDate);
      }
    }
  }

  /**
   * Generate a sidequest for a battle
   */
  async generateSidequest(battleId, processingDate) {
    const sidequests = [
      {
        name: "Winter Meditation Challenge",
        emoji: "🧘",
        description: "Meditate for 15 minutes in silence",
        difficulty: "light",
        quest_type: "healing",
        frequency: "daily"
      },
      {
        name: "Frozen Productivity Sprint",
        emoji: "❄️",
        description: "Complete a 25-minute focused work session",
        difficulty: "medium", 
        quest_type: "attack",
        frequency: "daily"
      },
      {
        name: "Ice Bath Challenge",
        emoji: "🛁",
        description: "Take a cold shower for 2+ minutes",
        difficulty: "heavy",
        quest_type: "defense", 
        frequency: "daily"
      }
    ];

    const sidequest = sidequests[Math.floor(Math.random() * sidequests.length)];
    
    // Add to battle events as a scheduled sidequest
    await db.query(`
      INSERT INTO battle_events (battle_id, event_type, event_data, triggered_at)
      VALUES ($1, 'scheduled_sidequest', $2, NOW())
    `, [battleId, JSON.stringify({
      ...sidequest,
      expires_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Tomorrow
    })]);

    console.log(`    ✅ Sidequest generated for Battle ${battleId}: ${sidequest.name}`);
  }

  /**
   * Cleanup expired status effects
   */
  async cleanupExpiredStatusEffects(processingDate) {
    console.log('🧹 Cleaning up expired status effects...');

    const usersWithEffects = await db.query(`
      SELECT battle_id, user_id, status_effects 
      FROM battle_user_stats 
      WHERE status_effects != '[]'::jsonb
    `);

    for (const user of usersWithEffects.rows) {
      const statusEffects = user.status_effects || [];
      const activeEffects = statusEffects.filter(effect => 
        effect.expires_at >= processingDate
      );

      if (activeEffects.length !== statusEffects.length) {
        await db.query(`
          UPDATE battle_user_stats 
          SET status_effects = $1 
          WHERE battle_id = $2 AND user_id = $3
        `, [JSON.stringify(activeEffects), user.battle_id, user.user_id]);
      }
    }
  }

  // Helper methods

  async getOpponentId(battleId, userId) {
    const battleRes = await db.query('SELECT player1_id, player2_id FROM battles WHERE id = $1', [battleId]);
    const battle = battleRes.rows[0];
    return battle.player1_id === userId ? battle.player2_id : battle.player1_id;
  }

  async updateBattleStats(battleId, processingDate) {
    // Update battle metadata if needed
    await db.query(`
      UPDATE battles 
      SET last_processed_date = $1 
      WHERE id = $2
    `, [processingDate, battleId]);
  }

  async gatherPlayersData(battleId, dateStr, battle) {
    const playersData = [];
    const playerIds = [battle.player1_id, battle.player2_id];
    
    for (const playerId of playerIds) {
      // Get user info
      const userRes = await db.query('SELECT name FROM users WHERE id = $1', [playerId]);
      const userName = userRes.rows[0]?.name || 'Unknown Warrior';
      
      // Get user stats
      const statsRes = await db.query(
        'SELECT * FROM battle_user_stats WHERE battle_id = $1 AND user_id = $2',
        [battleId, playerId]
      );
      const userStats = statsRes.rows[0] || {};
      
      // Get today's processed submissions
      const submissionsRes = await db.query(`
        SELECT c.*, q.name as quest_name, q.difficulty, q.frequency
        FROM checkins c
        JOIN quests q ON c.quest_id = q.id
        WHERE c.battle_id = $1 AND c.user_id = $2 AND c.date = $3
        AND c.processed_at IS NOT NULL
        ORDER BY c.created_at
      `, [battleId, playerId, dateStr]);
      
      const todaySubmissions = submissionsRes.rows;
      const totalDamage = todaySubmissions.reduce((sum, s) => sum + (s.damage_dealt || 0), 0);
      const totalXP = todaySubmissions.reduce((sum, s) => sum + (s.xp_gained || 0), 0);
      const criticalHits = todaySubmissions.filter(s => s.is_critical_hit).length;
      const completedQuests = todaySubmissions.filter(s => s.completed).length;
      
      playersData.push({
        name: userName,
        hp: userStats.hp || 100,
        xp: userStats.xp || 0,
        level: userStats.level || 1,
        streak: userStats.streak || 0,
        player_class: userStats.player_class || 'Warrior',
        status_effects: userStats.status_effects || [],
        submitted_today: todaySubmissions.length > 0,
        today: {
          damage_dealt: totalDamage,
          xp_gained: totalXP,
          critical_hits: criticalHits,
          quests_completed: completedQuests,
          quest_details: todaySubmissions.map(s => ({
            name: s.quest_name,
            frequency: s.frequency,
            difficulty: s.difficulty,
            completed: s.completed,
            damage: s.damage_dealt,
            xp: s.xp_gained,
            critical: s.is_critical_hit
          }))
        }
      });
    }
    
    return playersData;
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const targetDate = args[0] || null;

  const processor = new DailyBattleProcessor();
  
  try {
    await processor.processDaily(targetDate);
    process.exit(0);
  } catch (error) {
    console.error('💥 Processing failed:', error);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

// Export for use as module or run directly
if (require.main === module) {
  main();
}

module.exports = { DailyBattleProcessor };
