const express = require('express');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');
const { 
  filterAvailableQuests, 
  getQuestAvailabilityInfo, 
  isEndOfWeek, 
  isEndOfMonth 
} = require('../utils/quest-availability');

const router = express.Router();

// List all quests for the authenticated user with availability info
router.get('/', authenticateToken, async (req, res) => {
  const { include_availability } = req.query;
  
  try {
    const result = await db.query(
      'SELECT id, name, emoji, category, frequency, target_value, comparison FROM quests WHERE user_id = $1 ORDER BY created_at',
      [req.user.id]
    );
    
    if (include_availability === 'true') {
      // Add availability information to each quest
      const questsWithAvailability = result.rows.map(quest => 
        getQuestAvailabilityInfo(quest)
      );
      res.json(questsWithAvailability);
    } else {
      res.json(result.rows);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching quests' });
  }
});

// Get only available quests for the current time
router.get('/available', authenticateToken, async (req, res) => {
  const { date } = req.query;
  const currentDate = date || new Date().toISOString().split('T')[0];
  
  try {
    const result = await db.query(
      'SELECT id, name, emoji, category, frequency, target_value, comparison FROM quests WHERE user_id = $1 ORDER BY created_at',
      [req.user.id]
    );
    
    // Filter quests by availability
    const availableQuests = filterAvailableQuests(result.rows, currentDate);
    
    res.json({
      date: currentDate,
      current_period: {
        is_end_of_week: isEndOfWeek(currentDate),
        is_end_of_month: isEndOfMonth(currentDate)
      },
      available_quests: availableQuests,
      total_quests: result.rows.length,
      available_count: availableQuests.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching available quests' });
  }
});

// Create a new quest for the authenticated user
router.post('/', authenticateToken, async (req, res) => {
  const { name, emoji, category, frequency, target_value, comparison } = req.body;
  if (!name || !frequency || target_value === undefined || !comparison) {
    return res.status(400).json({ message: 'Name, frequency, target_value and comparison are required' });
  }
  try {
    const result = await db.query(
      'INSERT INTO quests (user_id, name, emoji, category, frequency, target_value, comparison) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, emoji, category, frequency, target_value, comparison',
      [req.user.id, name, emoji || '', category || '', frequency, target_value, comparison]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating quest' });
  }
});

// Update a quest
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, emoji, category, frequency, target_value, comparison } = req.body;
  try {
    // Verify quest belongs to user
    const check = await db.query('SELECT id FROM quests WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Quest not found' });
    }
    const result = await db.query(
      `UPDATE quests SET name = $1, emoji = $2, category = $3, frequency = $4, target_value = $5, comparison = $6 WHERE id = $7 RETURNING id, name, emoji, category, frequency, target_value, comparison`,
      [name, emoji, category, frequency, target_value, comparison, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating quest' });
  }
});

// Delete a quest
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Verify quest belongs to user
    const check = await db.query('SELECT id FROM quests WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Quest not found' });
    }
    await db.query('DELETE FROM quests WHERE id = $1', [id]);
    res.json({ message: 'Quest deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting quest' });
  }
});

module.exports = router;