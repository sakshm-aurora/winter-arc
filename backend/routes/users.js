const express = require('express');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();

// Get all users except current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email FROM users WHERE id != $1 ORDER BY name', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

module.exports = router;