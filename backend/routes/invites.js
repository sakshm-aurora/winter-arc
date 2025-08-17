const express = require('express');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');

const router = express.Router();

// Send an invite to another user
// Body: { receiver_id }
router.post('/', authenticateToken, async (req, res) => {
  const { receiver_id } = req.body;
  if (!receiver_id) {
    return res.status(400).json({ message: 'receiver_id is required' });
  }
  if (parseInt(receiver_id) === req.user.id) {
    return res.status(400).json({ message: 'Cannot invite yourself' });
  }
  try {
    // Check if receiver exists
    const receiver = await db.query('SELECT id FROM users WHERE id = $1', [receiver_id]);
    if (receiver.rows.length === 0) {
      return res.status(404).json({ message: 'Receiver not found' });
    }
    // Check if there is already a pending invite or active battle between users
    const pending = await db.query(
      `SELECT id FROM invites WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)) AND status = 'pending'`,
      [req.user.id, receiver_id]
    );
    if (pending.rows.length > 0) {
      return res.status(400).json({ message: 'An invite already exists between these users' });
    }
    const battleCheck = await db.query(
      `SELECT id FROM battles WHERE ((player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1)) AND status = 'active'`,
      [req.user.id, receiver_id]
    );
    if (battleCheck.rows.length > 0) {
      return res.status(400).json({ message: 'A battle already exists between these users' });
    }
    const result = await db.query(
      'INSERT INTO invites (sender_id, receiver_id, status) VALUES ($1, $2, $3) RETURNING id, sender_id, receiver_id, status, created_at',
      [req.user.id, receiver_id, 'pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating invite' });
  }
});

// List invites for authenticated user
// Returns invites sent to the user that are pending and invites the user has sent pending
router.get('/', authenticateToken, async (req, res) => {
  try {
    const received = await db.query(
      'SELECT id, sender_id, receiver_id, status, created_at FROM invites WHERE receiver_id = $1 AND status = $2',
      [req.user.id, 'pending']
    );
    const sent = await db.query(
      'SELECT id, sender_id, receiver_id, status, created_at FROM invites WHERE sender_id = $1 AND status = $2',
      [req.user.id, 'pending']
    );
    res.json({ received: received.rows, sent: sent.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching invites' });
  }
});

// Accept an invite
router.post('/:id/accept', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Check invite exists and user is receiver
    const inviteRes = await db.query('SELECT * FROM invites WHERE id = $1', [id]);
    if (inviteRes.rows.length === 0) {
      return res.status(404).json({ message: 'Invite not found' });
    }
    const invite = inviteRes.rows[0];
    if (invite.receiver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not your invite to accept' });
    }
    if (invite.status !== 'pending') {
      return res.status(400).json({ message: 'Invite is not pending' });
    }
    // Create battle
    const battleResult = await db.query(
      'INSERT INTO battles (player1_id, player2_id, status) VALUES ($1, $2, $3) RETURNING id',
      [invite.sender_id, invite.receiver_id, 'active']
    );
    const battleId = battleResult.rows[0].id;
    // Initialize stats for both players
    await db.query(
      'INSERT INTO battle_user_stats (battle_id, user_id, hp, xp, streak) VALUES ($1, $2, $3, $4, $5), ($1, $6, $3, $4, $5)',
      [battleId, invite.sender_id, 100, 0, 0, invite.receiver_id]
    );
    // Update invite to accepted
    await db.query('UPDATE invites SET status = $1 WHERE id = $2', ['accepted', id]);
    res.json({ message: 'Invite accepted and battle started', battleId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error accepting invite' });
  }
});

// Reject an invite
router.post('/:id/reject', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const inviteRes = await db.query('SELECT * FROM invites WHERE id = $1', [id]);
    if (inviteRes.rows.length === 0) {
      return res.status(404).json({ message: 'Invite not found' });
    }
    const invite = inviteRes.rows[0];
    if (invite.receiver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not your invite to reject' });
    }
    if (invite.status !== 'pending') {
      return res.status(400).json({ message: 'Invite is not pending' });
    }
    await db.query('UPDATE invites SET status = $1 WHERE id = $2', ['rejected', id]);
    res.json({ message: 'Invite rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error rejecting invite' });
  }
});

module.exports = router;