const express = require('express');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');
const { RPGEngine } = require('../utils/rpg-engine');

const router = express.Router();

/*
  Get weekly tournaments for a battle
*/
router.get('/weekly/:battle_id', authenticateToken, async (req, res) => {
  const { battle_id } = req.params;
  
  try {
    // Verify user participation
    const battleRes = await db.query(
      'SELECT player1_id, player2_id FROM battles WHERE id = $1',
      [battle_id]
    );
    
    if (battleRes.rows.length === 0) {
      return res.status(404).json({ message: 'Battle not found' });
    }
    
    const battle = battleRes.rows[0];
    if (battle.player1_id !== req.user.id && battle.player2_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Get tournament history
    const tournaments = await db.query(`
      SELECT 
        wt.*,
        winner.name as winner_name,
        loser.name as loser_name
      FROM weekly_tournaments wt
      LEFT JOIN users winner ON wt.winner_id = winner.id
      LEFT JOIN users loser ON wt.loser_id = loser.id
      WHERE wt.battle_id = $1
      ORDER BY wt.week_start DESC
    `, [battle_id]);
    
    res.json(tournaments.rows);
  } catch (err) {
    console.error('Tournament fetch error:', err);
    res.status(500).json({ message: 'Error fetching tournaments' });
  }
});

/*
  Get current week status
*/
router.get('/current/:battle_id', authenticateToken, async (req, res) => {
  const { battle_id } = req.params;
  const rpgEngine = new RPGEngine(db);
  
  try {
    const weekStart = rpgEngine.getWeekStart();
    const weekEnd = rpgEngine.getWeekEnd();
    
    // Get current week stats
    const stats = await db.query(`
      SELECT 
        bus.user_id,
        u.name,
        bus.hp,
        bus.xp,
        bus.streak,
        bus.total_damage_dealt,
        bus.level,
        bus.status_effects,
        COUNT(c.id) as quests_completed,
        COUNT(CASE WHEN c.is_critical_hit THEN 1 END) as critical_hits
      FROM battle_user_stats bus
      JOIN users u ON bus.user_id = u.id
      LEFT JOIN checkins c ON c.user_id = bus.user_id 
        AND c.battle_id = bus.battle_id 
        AND c.date >= $2 
        AND c.date <= $3
        AND c.completed = true
      WHERE bus.battle_id = $1
      GROUP BY bus.user_id, u.name, bus.hp, bus.xp, bus.streak, 
               bus.total_damage_dealt, bus.level, bus.status_effects
    `, [battle_id, weekStart, weekEnd]);
    
    // Check if tournament already completed for this week
    const existingTournament = await db.query(`
      SELECT * FROM weekly_tournaments 
      WHERE battle_id = $1 AND week_start = $2
    `, [battle_id, weekStart]);
    
    const response = {
      week_start: weekStart,
      week_end: weekEnd,
      players: stats.rows,
      tournament_completed: existingTournament.rows.length > 0,
      tournament_result: existingTournament.rows[0] || null
    };
    
    // Calculate predicted winner if tournament not completed
    if (existingTournament.rows.length === 0 && stats.rows.length === 2) {
      const [player1, player2] = stats.rows;
      let leader;
      
      if (player1.hp > player2.hp) {
        leader = player1;
      } else if (player2.hp > player1.hp) {
        leader = player2;
      } else {
        leader = player1.total_damage_dealt >= player2.total_damage_dealt ? player1 : player2;
      }
      
      response.current_leader = leader.name;
    }
    
    res.json(response);
  } catch (err) {
    console.error('Current week error:', err);
    res.status(500).json({ message: 'Error fetching current week' });
  }
});

/*
  Force process weekly tournament (for testing or manual triggers)
*/
router.post('/process/:battle_id', authenticateToken, async (req, res) => {
  const { battle_id } = req.params;
  const rpgEngine = new RPGEngine(db);
  
  try {
    // Verify user participation
    const battleRes = await db.query(
      'SELECT player1_id, player2_id FROM battles WHERE id = $1',
      [battle_id]
    );
    
    if (battleRes.rows.length === 0) {
      return res.status(404).json({ message: 'Battle not found' });
    }
    
    const battle = battleRes.rows[0];
    if (battle.player1_id !== req.user.id && battle.player2_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const result = await rpgEngine.processWeeklyTournament(battle_id);
    
    if (result) {
      res.json({
        message: 'Tournament processed! 🏆',
        result: result
      });
    } else {
      res.json({ message: 'No tournament to process or insufficient data' });
    }
  } catch (err) {
    console.error('Tournament process error:', err);
    res.status(500).json({ message: 'Error processing tournament' });
  }
});

/*
  Get leaderboard across all battles
*/
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const leaderboard = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.level,
        u.total_xp,
        u.trophies,
        COUNT(wt.id) as tournament_wins,
        COUNT(DISTINCT bus.battle_id) as total_battles,
        AVG(bus.hp) as avg_hp,
        MAX(bus.streak) as best_streak
      FROM users u
      LEFT JOIN weekly_tournaments wt ON wt.winner_id = u.id
      LEFT JOIN battle_user_stats bus ON bus.user_id = u.id
      GROUP BY u.id, u.name, u.level, u.total_xp, u.trophies
      HAVING COUNT(DISTINCT bus.battle_id) > 0
      ORDER BY u.total_xp DESC, tournament_wins DESC
      LIMIT 50
    `);
    
    res.json(leaderboard.rows);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
});

module.exports = router;
