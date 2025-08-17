const express = require('express');
const db = require('../db');
const { generateBattleNarration } = require('../utils/llm');

const router = express.Router();

/*
  Force duel conclusions for all active battles
  This should be called automatically at end of day (11:59 PM)
  Or can be triggered manually for testing
*/
router.post('/conclude-all-duels', async (req, res) => {
  const { date } = req.body;
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  try {
    // Get all active battles
    const activeBattles = await db.query(
      'SELECT * FROM battles WHERE status = $1',
      ['active']
    );

    let concludedDuels = 0;
    let results = [];

    for (const battle of activeBattles.rows) {
      const duelResult = await concludeDuelForBattle(battle.id, targetDate);
      if (duelResult.concluded) {
        concludedDuels++;
        results.push({
          battle_id: battle.id,
          result: duelResult
        });
      }
    }

    res.json({
      success: true,
      message: `Concluded ${concludedDuels} duels for ${targetDate}`,
      duels_concluded: concludedDuels,
      results: results
    });

  } catch (err) {
    console.error('Error concluding daily duels:', err);
    res.status(500).json({ message: 'Error concluding daily duels' });
  }
});

/*
  Force conclusion for a specific battle
*/
router.post('/conclude-duel/:battle_id', async (req, res) => {
  const { battle_id } = req.params;
  const { date } = req.body;
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  try {
    const result = await concludeDuelForBattle(battle_id, targetDate);
    
    if (result.concluded) {
      res.json({
        success: true,
        message: 'Duel concluded!',
        result: result
      });
    } else {
      res.json({
        success: false,
        message: result.reason || 'Duel already concluded or no submissions today',
        result: result
      });
    }

  } catch (err) {
    console.error('Error concluding duel:', err);
    res.status(500).json({ message: 'Error concluding duel' });
  }
});

// Helper function to conclude a duel for a specific battle and date
async function concludeDuelForBattle(battle_id, dateStr) {
  try {
    // Check if we already have a battle log for this date
    const existingLog = await db.query(
      'SELECT id FROM logs WHERE battle_id = $1 AND date = $2',
      [battle_id, dateStr]
    );

    if (existingLog.rows.length > 0) {
      return {
        concluded: false,
        reason: 'Duel already concluded (battle log exists)'
      };
    }

    // Get battle info
    const battleRes = await db.query(
      'SELECT * FROM battles WHERE id = $1 AND status = $2',
      [battle_id, 'active']
    );

    if (battleRes.rows.length === 0) {
      return {
        concluded: false,
        reason: 'Battle not found or not active'
      };
    }

    const battle = battleRes.rows[0];

    // Check if either player submitted today
    const submissionsToday = await db.query(
      'SELECT user_id FROM checkins WHERE battle_id = $1 AND date = $2',
      [battle_id, dateStr]
    );

    if (submissionsToday.rows.length === 0) {
      return {
        concluded: false,
        reason: 'No submissions today - nothing to conclude'
      };
    }

    // If only one player submitted, that's still a valid duel conclusion
    // Generate battle narrative even with partial data
    const playersData = await gatherPlayersDataForConclusion(battle_id, dateStr, battle);
    
    // Calculate day number properly
    const firstLogRes = await db.query(
      'SELECT MIN(date) as first_date FROM logs WHERE battle_id = $1',
      [battle_id]
    );
    
    let dayNumber = 1;
    if (firstLogRes.rows[0]?.first_date) {
      const firstDate = new Date(firstLogRes.rows[0].first_date);
      const currentDate = new Date(dateStr);
      dayNumber = Math.floor((currentDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    // Determine duel characteristics
    const player1Submitted = submissionsToday.rows.some(s => s.user_id === battle.player1_id);
    const player2Submitted = submissionsToday.rows.some(s => s.user_id === battle.player2_id);
    const bothSubmitted = player1Submitted && player2Submitted;

    const logText = await generateBattleNarration(dateStr, playersData, {
      dayNumber,
      bothSubmitted,
      onePlayerMissing: !bothSubmitted,
      missedPlayer: !player1Submitted ? playersData[0]?.name : !player2Submitted ? playersData[1]?.name : null
    });

    // Store the battle log
    await db.query(
      'INSERT INTO logs (battle_id, date, log_text) VALUES ($1, $2, $3)', 
      [battle_id, dateStr, logText]
    );

    return {
      concluded: true,
      battle_id: battle_id,
      date: dateStr,
      day_number: dayNumber,
      both_submitted: bothSubmitted,
      battle_log: logText,
      players_data: playersData
    };

  } catch (err) {
    console.error('Error in concludeDuelForBattle:', err);
    return {
      concluded: false,
      reason: 'Error processing duel conclusion',
      error: err.message
    };
  }
}

// Helper function to gather player data for conclusion
async function gatherPlayersDataForConclusion(battle_id, dateStr, battle) {
  const playersData = [];
  
  // Get both players
  const playerIds = [battle.player1_id, battle.player2_id];
  
  for (const playerId of playerIds) {
    // Get user info
    const userRes = await db.query('SELECT name FROM users WHERE id = $1', [playerId]);
    const userName = userRes.rows[0]?.name || 'Unknown Warrior';
    
    // Get user stats
    const statsRes = await db.query(
      'SELECT * FROM battle_user_stats WHERE battle_id = $1 AND user_id = $2',
      [battle_id, playerId]
    );
    const userStats = statsRes.rows[0] || {};
    
    // Get today's submissions (might be empty for one player)
    const submissionsRes = await db.query(`
      SELECT c.*, q.name as quest_name, q.difficulty
      FROM checkins c
      JOIN quests q ON c.quest_id = q.id
      WHERE c.battle_id = $1 AND c.user_id = $2 AND c.date = $3
      ORDER BY c.created_at
    `, [battle_id, playerId, dateStr]);
    
    const todaySubmissions = submissionsRes.rows;
    const totalDamage = todaySubmissions.reduce((sum, s) => sum + (s.damage_dealt || 0), 0);
    const totalXP = todaySubmissions.reduce((sum, s) => sum + (s.xp_gained || 0), 0);
    const criticalHits = todaySubmissions.filter(s => s.is_critical_hit).length;
    const completedQuests = todaySubmissions.filter(s => s.completed).length;
    const submitted = todaySubmissions.length > 0;
    
    playersData.push({
      name: userName,
      hp: userStats.hp || 100,
      xp: userStats.xp || 0,
      level: userStats.level || 1,
      streak: userStats.streak || 0,
      player_class: userStats.player_class || 'Warrior',
      status_effects: userStats.status_effects || [],
      submitted_today: submitted,
      today: {
        damage_dealt: totalDamage,
        xp_gained: totalXP,
        critical_hits: criticalHits,
        quests_completed: completedQuests,
        quest_details: todaySubmissions.map(s => ({
          name: s.quest_name,
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

module.exports = router;
