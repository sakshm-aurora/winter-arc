const express = require('express');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');
const { generateBattleNarration } = require('../utils/llm');
const { RPGEngine } = require('../utils/rpg-engine');
const { isQuestAvailable } = require('../utils/quest-availability');

const router = express.Router();

/*
  Submit daily check-ins for a battle - SIMPLIFIED REAL-TIME SUBMISSION
  
  NEW LOGIC:
  - Users can submit quest completions anytime during the day
  - Submissions are stored immediately without LLM processing
  - LLM scoring and battle processing happens at midnight IST via scheduled job
  - Each quest can only be submitted ONCE per period (daily/weekly/monthly)
  
  Request body:
  {
    battle_id: number,
    date: optional ISO date string (defaults to today),
    results: [
      { quest_id: number, completed: boolean, value: integer | null }
    ]
  }
*/
router.post('/', authenticateToken, async (req, res) => {
  const { battle_id, date, results } = req.body;
  if (!battle_id || !results || !Array.isArray(results)) {
    return res.status(400).json({ message: 'battle_id and results are required' });
  }

  const checkDate = date ? new Date(date) : new Date();
  const dateStr = checkDate.toISOString().split('T')[0];

  try {
    // Verify user participates in battle
    const battleRes = await db.query(
      'SELECT * FROM battles WHERE id = $1 AND status = $2',
      [battle_id, 'active']
    );
    if (battleRes.rows.length === 0) {
      return res.status(404).json({ message: 'Battle not found or not active' });
    }

    const battle = battleRes.rows[0];
    if (battle.player1_id !== req.user.id && battle.player2_id !== req.user.id) {
      return res.status(403).json({ message: 'You are not a participant of this battle' });
    }

    // Check which quests are already submitted for their respective periods
    const questsToSubmit = [];
    const lockedQuests = [];
    
    for (const result of results) {
      const { quest_id, completed, value } = result;
      
      // Get quest details to determine frequency
      const questRes = await db.query('SELECT * FROM quests WHERE id = $1', [quest_id]);
      if (questRes.rows.length === 0) {
        lockedQuests.push({ quest_id, reason: 'Quest not found' });
        continue;
      }
      const quest = questRes.rows[0];

      // First check if quest is available for this time period
      const availability = isQuestAvailable(quest.frequency, dateStr);
      if (!availability.available) {
        lockedQuests.push({
          quest_id,
          quest_name: quest.name,
          reason: availability.reason,
          next_available: availability.next_available
        });
        continue;
      }

      // Then check if quest is already submitted for its period
      const isLocked = await isQuestLockedForPeriod(battle_id, req.user.id, quest_id, quest.frequency, dateStr);
      
      if (isLocked.locked) {
        lockedQuests.push({ 
          quest_id, 
          quest_name: quest.name,
          reason: isLocked.reason,
          next_available: isLocked.nextAvailable
        });
        continue;
      }

      questsToSubmit.push({ quest_id, quest, completed, value });
    }

    // If all quests are locked, return error
    if (questsToSubmit.length === 0) {
      return res.status(400).json({ 
        message: 'All selected quests are already submitted for their period!',
        locked_quests: lockedQuests
      });
    }

    // Get current submission sequence for today
    const todaySubmissions = await db.query(
      'SELECT MAX(submission_sequence) as max_seq FROM checkins WHERE battle_id = $1 AND user_id = $2 AND date = $3',
      [battle_id, req.user.id, dateStr]
    );
    const currentSequence = (todaySubmissions.rows[0]?.max_seq || 0) + 1;

    // Store quest submissions WITHOUT LLM processing
    const submittedQuests = [];
    for (const { quest_id, quest, completed, value } of questsToSubmit) {
      // Store raw submission - LLM processing happens at midnight
      await db.query(`
        INSERT INTO checkins (
          battle_id, user_id, date, quest_id, value, completed,
          submission_sequence, created_at, processed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL)
      `, [
        battle_id, req.user.id, dateStr, quest_id, 
        value !== undefined ? value : null,
        completed,
        currentSequence
      ]);

      submittedQuests.push({
        quest_id,
        quest_name: quest.name,
        frequency: quest.frequency,
        completed,
        value
      });
    }

    // Get current user stats for display (no updates yet)
    const userStatsRes = await db.query(
      'SELECT * FROM battle_user_stats WHERE battle_id = $1 AND user_id = $2',
      [battle_id, req.user.id]
    );
    const userStats = userStatsRes.rows[0] || {};

    // Count today's submissions
    const todayCount = await db.query(
      'SELECT COUNT(*) as count FROM checkins WHERE battle_id = $1 AND user_id = $2 AND date = $3',
      [battle_id, req.user.id, dateStr]
    );

    // Check if opponent has submitted today
    const opponentId = battle.player1_id === req.user.id ? battle.player2_id : battle.player1_id;
    const opponentSubmittedToday = await db.query(
      'SELECT COUNT(*) as count FROM checkins WHERE battle_id = $1 AND user_id = $2 AND date = $3',
      [battle_id, opponentId, dateStr]
    );

    const responseData = {
      success: true,
      message: `${questsToSubmit.length} quest(s) submitted successfully! Scores will be updated at midnight IST.`,
      submitted_quests: submittedQuests,
      locked_quests: lockedQuests,
      current_stats: {
        hp: userStats.hp || 100,
        xp: userStats.xp || 0,
        level: userStats.level || 1,
        streak: userStats.streak || 0
      },
      daily_progress: {
        your_submissions: parseInt(todayCount.rows[0].count),
        opponent_submissions: parseInt(opponentSubmittedToday.rows[0].count),
        processing_status: 'pending_midnight_processing'
      },
      next_processing: 'Midnight IST (00:00 India Standard Time)'
    };

    res.json(responseData);

  } catch (err) {
    console.error('Quest Submission Error:', err);
    res.status(500).json({ message: 'Error submitting quests!' });
  }
});

// Helper function to check if a quest is locked for its period
async function isQuestLockedForPeriod(battle_id, user_id, quest_id, frequency, currentDate) {
  const current = new Date(currentDate);
  let startDate, endDate;

  switch (frequency?.toLowerCase()) {
    case 'daily':
      startDate = currentDate; // Same day
      endDate = currentDate;
      break;
    
    case 'weekly':
      // Get start of current week (Monday)
      const dayOfWeek = current.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(current);
      monday.setDate(current.getDate() + mondayOffset);
      startDate = monday.toISOString().split('T')[0];
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      endDate = sunday.toISOString().split('T')[0];
      break;
    
    case 'monthly':
      // Get start and end of current month
      const firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
      const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      startDate = firstDay.toISOString().split('T')[0];
      endDate = lastDay.toISOString().split('T')[0];
      break;

    case 'sidequest':
      // Sidequests are one-time until they expire
      startDate = currentDate;
      endDate = currentDate;
      
      // Check if this is a valid sidequest that hasn't expired
      const sidequestRes = await db.query(`
        SELECT event_data FROM battle_events 
        WHERE battle_id = $1 AND event_type = 'scheduled_sidequest' 
        AND event_data->>'expires_date' >= $2
        AND event_data->>'quest_id' = $3
        LIMIT 1
      `, [battle_id, currentDate, quest_id.toString()]);

      if (sidequestRes.rows.length === 0) {
        return {
          locked: true,
          reason: 'Sidequest not available or expired',
          nextAvailable: null
        };
      }
      break;
    
    default:
      // Default to daily if frequency is not specified
      startDate = currentDate;
      endDate = currentDate;
      break;
  }

  // Check if quest was already submitted in this period
  const existingSubmission = await db.query(`
    SELECT id, date FROM checkins 
    WHERE battle_id = $1 AND user_id = $2 AND quest_id = $3 
    AND date >= $4 AND date <= $5 
    LIMIT 1
  `, [battle_id, user_id, quest_id, startDate, endDate]);

  if (existingSubmission.rows.length > 0) {
    // Calculate next available date
    let nextAvailable;
    switch (frequency?.toLowerCase()) {
      case 'daily':
        const tomorrow = new Date(current);
        tomorrow.setDate(current.getDate() + 1);
        nextAvailable = tomorrow.toISOString().split('T')[0];
        break;
      case 'weekly':
        const nextMonday = new Date(endDate);
        nextMonday.setDate(nextMonday.getDate() + 1);
        nextAvailable = nextMonday.toISOString().split('T')[0];
        break;
      case 'monthly':
        const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        nextAvailable = nextMonth.toISOString().split('T')[0];
        break;
      case 'sidequest':
        nextAvailable = 'After new sidequest is generated';
        break;
      default:
        const nextDay = new Date(current);
        nextDay.setDate(current.getDate() + 1);
        nextAvailable = nextDay.toISOString().split('T')[0];
        break;
    }

    return {
      locked: true,
      reason: `Already completed this ${frequency || 'daily'} quest. Submitted on ${existingSubmission.rows[0].date}`,
      nextAvailable: nextAvailable
    };
  }

  return { locked: false };
}

// Helper function to gather player data for battle narration
async function gatherPlayersData(battle_id, dateStr, battle) {
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
    
    // Get today's submissions
    const submissionsRes = await db.query(`
      SELECT c.*, q.name as quest_name, q.difficulty, q.frequency
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

/*
  Get checkins for a specific battle and date range
*/
router.get('/:battle_id', authenticateToken, async (req, res) => {
  const { battle_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT c.*, q.name as quest_name, q.difficulty, q.frequency, u.name as user_name
      FROM checkins c
      JOIN quests q ON c.quest_id = q.id  
      JOIN users u ON c.user_id = u.id
      WHERE c.battle_id = $1
    `;
    let params = [battle_id];

    if (start_date) {
      query += ` AND c.date >= $${params.length + 1}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND c.date <= $${params.length + 1}`;
      params.push(end_date);
    }

    query += ' ORDER BY c.date DESC, c.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching checkins:', err);
    res.status(500).json({ message: 'Error fetching checkins' });
  }
});

/*
  Get locked quests for a user
*/
router.get('/locked/:battle_id', authenticateToken, async (req, res) => {
  const { battle_id } = req.params;
  const { date } = req.query;
  const checkDate = date || new Date().toISOString().split('T')[0];

  try {
    // Get all user's quests
    const userQuests = await db.query(
      'SELECT * FROM quests WHERE user_id = $1 AND is_active = true',
      [req.user.id]
    );

    const lockedQuests = [];
    for (const quest of userQuests.rows) {
      const lockStatus = await isQuestLockedForPeriod(
        battle_id, 
        req.user.id, 
        quest.id, 
        quest.frequency, 
        checkDate
      );
      
      if (lockStatus.locked) {
        lockedQuests.push({
          ...quest,
          lock_reason: lockStatus.reason,
          next_available: lockStatus.nextAvailable
        });
      }
    }

    res.json(lockedQuests);
  } catch (err) {
    console.error('Error fetching locked quests:', err);
    res.status(500).json({ message: 'Error fetching locked quests' });
  }
});

module.exports = router;