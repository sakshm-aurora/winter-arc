const express = require('express');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * Get processing status for a battle and date
 */
router.get('/:battle_id', authenticateToken, async (req, res) => {
  const { battle_id } = req.params;
  const { date } = req.query;
  const checkDate = date || new Date().toISOString().split('T')[0];

  try {
    // Verify user has access to this battle
    const battleRes = await db.query(
      'SELECT * FROM battles WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
      [battle_id, req.user.id]
    );

    if (battleRes.rows.length === 0) {
      return res.status(404).json({ message: 'Battle not found or access denied' });
    }

    // Get processing status for the date
    const processingStatus = await db.query(`
      SELECT 
        COUNT(*) as total_checkins,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_checkins,
        COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as pending_checkins,
        MIN(created_at) as first_submission,
        MAX(processed_at) as last_processed
      FROM checkins 
      WHERE battle_id = $1 AND date = $2
    `, [battle_id, checkDate]);

    const status = processingStatus.rows[0];

    // Check if battle log exists for this date
    const battleLogRes = await db.query(
      'SELECT id, created_at FROM logs WHERE battle_id = $1 AND date = $2',
      [battle_id, checkDate]
    );

    const hasBattleLog = battleLogRes.rows.length > 0;

    // Get user-specific submission status
    const userSubmissions = await db.query(`
      SELECT 
        COUNT(*) as user_submissions,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as user_processed,
        MAX(created_at) as last_submission
      FROM checkins 
      WHERE battle_id = $1 AND user_id = $2 AND date = $3
    `, [battle_id, req.user.id, checkDate]);

    const userStatus = userSubmissions.rows[0];

    // Get opponent submission status
    const battle = battleRes.rows[0];
    const opponentId = battle.player1_id === req.user.id ? battle.player2_id : battle.player1_id;
    
    const opponentSubmissions = await db.query(`
      SELECT 
        COUNT(*) as opponent_submissions,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as opponent_processed
      FROM checkins 
      WHERE battle_id = $1 AND user_id = $2 AND date = $3
    `, [battle_id, opponentId, checkDate]);

    const opponentStatus = opponentSubmissions.rows[0];

    // Calculate IST time for next processing
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const nextMidnight = new Date(istNow);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);

    const responseData = {
      battle_id: parseInt(battle_id),
      date: checkDate,
      processing_status: {
        is_processed: parseInt(status.pending_checkins) === 0 && parseInt(status.total_checkins) > 0,
        total_checkins: parseInt(status.total_checkins),
        processed_checkins: parseInt(status.processed_checkins),
        pending_checkins: parseInt(status.pending_checkins),
        first_submission: status.first_submission,
        last_processed: status.last_processed,
        battle_log_generated: hasBattleLog,
        battle_log_timestamp: battleLogRes.rows[0]?.created_at
      },
      user_status: {
        submissions: parseInt(userStatus.user_submissions),
        processed: parseInt(userStatus.user_processed),
        last_submission: userStatus.last_submission,
        can_submit_more: true // Always true with new system
      },
      opponent_status: {
        submissions: parseInt(opponentStatus.opponent_submissions),
        processed: parseInt(opponentStatus.opponent_processed)
      },
      scheduling: {
        current_ist_time: istNow.toISOString(),
        next_processing: nextMidnight.toISOString(),
        processing_description: 'LLM processing occurs at midnight IST (00:00 India Standard Time)',
        hours_until_processing: Math.ceil((nextMidnight - istNow) / (1000 * 60 * 60))
      }
    };

    res.json(responseData);

  } catch (err) {
    console.error('Processing status error:', err);
    res.status(500).json({ message: 'Error fetching processing status' });
  }
});

/**
 * Get overall system processing status
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get system-wide stats
    const systemStatus = await db.query(`
      SELECT 
        COUNT(DISTINCT battle_id) as active_battles,
        COUNT(*) as total_checkins_today,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_today,
        COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as pending_today
      FROM checkins c
      JOIN battles b ON c.battle_id = b.id
      WHERE c.date = $1 AND b.status = 'active'
    `, [today]);

    const stats = systemStatus.rows[0];

    // Get battle logs generated today
    const logsToday = await db.query(`
      SELECT COUNT(*) as logs_generated
      FROM logs 
      WHERE date = $1
    `, [today]);

    const istTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });

    res.json({
      date: today,
      current_ist_time: istTime,
      system_status: {
        active_battles: parseInt(stats.active_battles),
        total_checkins_today: parseInt(stats.total_checkins_today),
        processed_checkins: parseInt(stats.processed_today),
        pending_checkins: parseInt(stats.pending_today),
        battle_logs_generated: parseInt(logsToday.rows[0].logs_generated),
        processing_complete: parseInt(stats.pending_today) === 0
      },
      next_processing: 'Midnight IST (00:00 India Standard Time)'
    });

  } catch (err) {
    console.error('System status error:', err);
    res.status(500).json({ message: 'Error fetching system status' });
  }
});

module.exports = router;
