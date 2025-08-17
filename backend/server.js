const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const questRoutes = require('./routes/quests');
const inviteRoutes = require('./routes/invites');
const battleRoutes = require('./routes/battles');
const checkinRoutes = require('./routes/checkins');
const tournamentRoutes = require('./routes/tournaments');
const bossFightRoutes = require('./routes/boss-fights');
const battleResultsRoutes = require('./routes/battle-results');
const dailyConclusionRoutes = require('./routes/daily-conclusion');
const processingStatusRoutes = require('./routes/processing-status');

const app = express();

// Middleware
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://winter-arc.up.railway.app'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// API Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/quests', questRoutes);
app.use('/invites', inviteRoutes);
app.use('/battles', battleRoutes);
app.use('/checkins', checkinRoutes);
app.use('/tournaments', tournamentRoutes);
app.use('/boss-fights', bossFightRoutes);
app.use('/api/battle-results', battleResultsRoutes);
app.use('/daily-conclusion', dailyConclusionRoutes);
app.use('/processing-status', processingStatusRoutes);

// Default route
app.get('/', (req, res) => {
  res.send('Winter Arc RPG backend is running');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});