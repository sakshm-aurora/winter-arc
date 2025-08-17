const express = require('express');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();

// List active battles for the authenticated user along with stats
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Fetch battles where current user is a participant
    const battles = await db.query(
      `SELECT b.id, b.status, b.started_at,
        u1.id AS player1_id, u1.name AS player1_name, s1.hp AS player1_hp, s1.xp AS player1_xp, s1.streak AS player1_streak,
        u2.id AS player2_id, u2.name AS player2_name, s2.hp AS player2_hp, s2.xp AS player2_xp, s2.streak AS player2_streak
       FROM battles b
       JOIN battle_user_stats s1 ON b.id = s1.battle_id AND s1.user_id = b.player1_id
       JOIN users u1 ON u1.id = b.player1_id
       JOIN battle_user_stats s2 ON b.id = s2.battle_id AND s2.user_id = b.player2_id
       JOIN users u2 ON u2.id = b.player2_id
       WHERE (b.player1_id = $1 OR b.player2_id = $1) AND b.status = 'active'
       ORDER BY b.started_at DESC`,
      [req.user.id]
    );
    res.json(battles.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching battles' });
  }
});

// Fetch logs for a specific battle
router.get('/:id/logs', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Verify user is part of battle
    const battle = await db.query(
      'SELECT id FROM battles WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
      [id, req.user.id]
    );
    if (battle.rows.length === 0) {
      return res.status(403).json({ message: 'You are not a participant of this battle' });
    }
    const logs = await db.query(
      'SELECT id, date, log_text, created_at FROM logs WHERE battle_id = $1 ORDER BY date DESC',
      [id]
    );
    res.json(logs.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching logs' });
  }
});

module.exports = router;