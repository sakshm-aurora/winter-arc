const express = require('express');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * Get battle results for a specific battle
 * Query params:
 * - timeframe: 'day', 'week', 'month'
 */
router.get('/:battleId', authenticateToken, async (req, res) => {
  const { battleId } = req.params;
  const { timeframe = 'week' } = req.query;

  try {
    // Verify user has access to this battle
    const battleRes = await db.query(
      'SELECT * FROM battles WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
      [battleId, req.user.id]
    );

    if (battleRes.rows.length === 0) {
      return res.status(404).json({ message: 'Battle not found or access denied' });
    }

    const battle = battleRes.rows[0];

    let results = [];

    if (timeframe === 'day') {
      results = await getDailyResults(battleId);
    } else if (timeframe === 'week') {
      results = await getWeeklyResults(battleId);
    } else if (timeframe === 'month') {
      results = await getMonthlyResults(battleId);
    }

    res.json({
      battle_id: battleId,
      timeframe,
      results,
      summary: await getBattleSummary(battleId, req.user.id)
    });

  } catch (error) {
    console.error('Error fetching battle results:', error);
    res.status(500).json({ message: 'Error fetching battle results' });
  }
});

/**
 * Get monthly detailed results for a battle
 */
router.get('/:battleId/monthly', authenticateToken, async (req, res) => {
  const { battleId } = req.params;

  try {
    // Verify access
    const battleRes = await db.query(
      'SELECT * FROM battles WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
      [battleId, req.user.id]
    );

    if (battleRes.rows.length === 0) {
      return res.status(404).json({ message: 'Battle not found or access denied' });
    }

    const battle = battleRes.rows[0];
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Get user stats for current month
    const userStatsRes = await db.query(`
      SELECT 
        SUM(damage_dealt) as total_damage,
        SUM(xp_gained) as total_xp,
        MAX(c.created_at::date - b.created_at::date) as current_day,
        MAX(
          SELECT COUNT(*) FROM checkins c2 
          WHERE c2.battle_id = $1 AND c2.user_id = $2 
          AND c2.date < c.date AND completed = true
        ) as best_streak,
        AVG(CASE WHEN completed THEN 1.0 ELSE 0.0 END) as completion_rate
      FROM checkins c
      JOIN battles b ON c.battle_id = b.id
      WHERE c.battle_id = $1 AND c.user_id = $2 
      AND c.date >= $3
    `, [battleId, req.user.id, currentMonth + '-01']);

    const userStats = userStatsRes.rows[0] || {};

    // Get boss fight info if exists
    const bossFightRes = await db.query(`
      SELECT * FROM monthly_boss_fights 
      WHERE battle_id = $1 AND month_year = $2
      ORDER BY created_at DESC 
      LIMIT 1
    `, [battleId, currentMonth]);

    const bossFight = bossFightRes.rows[0] || null;

    // Get achievements for the month
    const achievementsRes = await db.query(`
      SELECT DISTINCT event_data 
      FROM battle_events 
      WHERE battle_id = $1 AND user_id = $2 
      AND event_type = 'achievement'
      AND created_at >= $3
    `, [battleId, req.user.id, currentMonth + '-01']);

    const achievements = achievementsRes.rows.map(row => 
      JSON.parse(row.event_data)
    );

    const monthlyData = {
      month_name: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      current_day: userStats.current_day || 1,
      total_days: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
      user_stats: {
        total_damage: parseInt(userStats.total_damage) || 0,
        total_xp: parseInt(userStats.total_xp) || 0,
        best_streak: parseInt(userStats.best_streak) || 0,
        completion_rate: parseFloat(userStats.completion_rate) || 0
      },
      boss_fight: bossFight ? {
        boss_name: bossFight.boss_name,
        current_hp: bossFight.boss_hp,
        max_hp: bossFight.boss_max_hp,
        status: bossFight.status,
        rewards: bossFight.rewards ? JSON.parse(bossFight.rewards) : []
      } : null,
      achievements
    };

    res.json(monthlyData);

  } catch (error) {
    console.error('Error fetching monthly results:', error);
    res.status(500).json({ message: 'Error fetching monthly results' });
  }
});

async function getDailyResults(battleId) {
  const results = await db.query(`
    SELECT 
      c.date,
      c.date::date - b.created_at::date + 1 as battle_day,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'user_id', c.user_id,
          'damage_dealt', c.damage_dealt,
          'xp_gained', c.xp_gained,
          'quests_completed', SUM(CASE WHEN c.completed THEN 1 ELSE 0 END),
          'total_quests', COUNT(*),
          'outcome', CASE 
            WHEN SUM(c.damage_dealt) = (
              SELECT MAX(daily_damage) FROM (
                SELECT user_id, SUM(damage_dealt) as daily_damage 
                FROM checkins 
                WHERE battle_id = $1 AND date = c.date 
                GROUP BY user_id
              ) x
            ) THEN 'victory'
            ELSE 'defeat'
          END
        )
      ) as participants,
      COALESCE(
        JSON_AGG(
          CASE WHEN be.event_type IN ('random_event', 'combo', 'critical_hit') 
          THEN JSON_BUILD_OBJECT('emoji', '⚡', 'name', be.event_type)
          ELSE NULL END
        ) FILTER (WHERE be.event_type IS NOT NULL), 
        '[]'::json
      ) as special_events
    FROM checkins c
    JOIN battles b ON c.battle_id = b.id
    LEFT JOIN battle_events be ON be.battle_id = c.battle_id AND be.created_at::date = c.date::date
    WHERE c.battle_id = $1
    GROUP BY c.date, b.created_at
    ORDER BY c.date DESC
    LIMIT 30
  `, [battleId]);

  return results.rows;
}

async function getWeeklyResults(battleId) {
  const results = await db.query(`
    SELECT 
      DATE_TRUNC('week', c.date) as week_start,
      EXTRACT(week from c.date) as week_number,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'user_id', c.user_id,
          'total_damage', SUM(c.damage_dealt),
          'total_xp', SUM(c.xp_gained),
          'quests_completed', SUM(CASE WHEN c.completed THEN 1 ELSE 0 END),
          'total_quests', COUNT(*)
        )
      ) as participants,
      (
        SELECT JSON_BUILD_OBJECT(
          'emoji', '🏆',
          'description', wt.reward_description
        )
        FROM weekly_tournaments wt 
        WHERE wt.battle_id = $1 
        AND wt.week_start = DATE_TRUNC('week', c.date)
        LIMIT 1
      ) as tournament_reward
    FROM checkins c
    WHERE c.battle_id = $1
    GROUP BY DATE_TRUNC('week', c.date), EXTRACT(week from c.date)
    ORDER BY week_start DESC
    LIMIT 12
  `, [battleId]);

  return results.rows;
}

async function getMonthlyResults(battleId) {
  const results = await db.query(`
    SELECT 
      DATE_TRUNC('month', c.date) as month_start,
      EXTRACT(month from c.date) as month_number,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'user_id', c.user_id,
          'total_damage', SUM(c.damage_dealt),
          'total_xp', SUM(c.xp_gained),
          'quests_completed', SUM(CASE WHEN c.completed THEN 1 ELSE 0 END),
          'total_quests', COUNT(*)
        )
      ) as participants
    FROM checkins c
    WHERE c.battle_id = $1
    GROUP BY DATE_TRUNC('month', c.date), EXTRACT(month from c.date)
    ORDER BY month_start DESC
    LIMIT 6
  `, [battleId]);

  return results.rows;
}

async function getBattleSummary(battleId, userId) {
  const summaryRes = await db.query(`
    SELECT 
      COUNT(DISTINCT c.date) as total_battle_days,
      SUM(c.damage_dealt) as total_damage_dealt,
      SUM(c.xp_gained) as total_xp_gained,
      SUM(CASE WHEN c.completed THEN 1 ELSE 0 END) as total_quests_completed,
      COUNT(*) as total_quest_attempts,
      (
        SELECT COUNT(*) FROM weekly_tournaments wt 
        WHERE wt.battle_id = $1 AND wt.winner_id = $2
      ) as weekly_wins,
      (
        SELECT COUNT(*) FROM monthly_boss_fights mbf 
        WHERE mbf.battle_id = $1 AND mbf.status = 'defeated'
      ) as boss_fights_won
    FROM checkins c
    WHERE c.battle_id = $1 AND c.user_id = $2
  `, [battleId, userId]);

  return summaryRes.rows[0] || {};
}

module.exports = router;
