-- Winter Arc RPG - Extended Schema for Full Battle System
-- This adds all the RPG mechanics: status effects, combos, boss fights, tournaments

-- Extend users table with RPG stats
ALTER TABLE users ADD COLUMN IF NOT EXISTS player_class TEXT DEFAULT 'mage';
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trophies JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS cosmetics JSONB DEFAULT '{}';

-- Extend quests with difficulty and type for RPG mechanics
ALTER TABLE quests ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium'; -- light, medium, heavy
ALTER TABLE quests ADD COLUMN IF NOT EXISTS quest_type TEXT DEFAULT 'attack'; -- attack, defense, healing
ALTER TABLE quests ADD COLUMN IF NOT EXISTS base_damage INTEGER DEFAULT 10;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS base_xp INTEGER DEFAULT 5;

-- Extend battles with RPG mechanics
ALTER TABLE battles ADD COLUMN IF NOT EXISTS battle_type TEXT DEFAULT 'daily'; -- daily, weekly, monthly_boss
ALTER TABLE battles ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS month_year TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM');
ALTER TABLE battles ADD COLUMN IF NOT EXISTS boss_hp INTEGER DEFAULT NULL;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS boss_max_hp INTEGER DEFAULT NULL;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS boss_name TEXT DEFAULT NULL;

-- Extend battle_user_stats with RPG mechanics
ALTER TABLE battle_user_stats ADD COLUMN IF NOT EXISTS max_hp INTEGER DEFAULT 100;
ALTER TABLE battle_user_stats ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE battle_user_stats ADD COLUMN IF NOT EXISTS status_effects JSONB DEFAULT '[]';
ALTER TABLE battle_user_stats ADD COLUMN IF NOT EXISTS combo_count INTEGER DEFAULT 0;
ALTER TABLE battle_user_stats ADD COLUMN IF NOT EXISTS last_action_date DATE DEFAULT NULL;
ALTER TABLE battle_user_stats ADD COLUMN IF NOT EXISTS weekly_wins INTEGER DEFAULT 0;
ALTER TABLE battle_user_stats ADD COLUMN IF NOT EXISTS total_damage_dealt INTEGER DEFAULT 0;

-- Enhanced checkins with RPG scoring
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS llm_score INTEGER DEFAULT NULL;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS damage_dealt INTEGER DEFAULT 0;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS xp_gained INTEGER DEFAULT 0;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS is_critical_hit BOOLEAN DEFAULT FALSE;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS status_effects_applied JSONB DEFAULT '[]';
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS combo_multiplier DECIMAL DEFAULT 1.0;

-- Battle Events (critical hits, random events, combos)
CREATE TABLE IF NOT EXISTS battle_events (
  id SERIAL PRIMARY KEY,
  battle_id INTEGER NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- critical_hit, random_event, combo, status_effect, boss_attack
  event_data JSONB NOT NULL,
  triggered_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- Weekly Tournaments
CREATE TABLE IF NOT EXISTS weekly_tournaments (
  id SERIAL PRIMARY KEY,
  battle_id INTEGER NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  winner_id INTEGER REFERENCES users(id),
  loser_id INTEGER REFERENCES users(id),
  winner_reward JSONB DEFAULT '{}',
  loser_penalty JSONB DEFAULT '{}',
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Monthly Boss Fights
CREATE TABLE IF NOT EXISTS monthly_boss_fights (
  id SERIAL PRIMARY KEY,
  month_year TEXT NOT NULL,
  boss_name TEXT NOT NULL,
  boss_hp INTEGER NOT NULL,
  boss_max_hp INTEGER NOT NULL,
  boss_abilities JSONB DEFAULT '[]',
  participating_battles JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active', -- active, completed, failed
  victory_rewards JSONB DEFAULT '{}',
  failure_penalties JSONB DEFAULT '{}',
  completed_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- LLM Scoring Cache (for consistency)
CREATE TABLE IF NOT EXISTS llm_scoring_cache (
  id SERIAL PRIMARY KEY,
  quest_type TEXT NOT NULL,
  quest_difficulty TEXT NOT NULL,
  completion_quality TEXT NOT NULL, -- excellent, good, average, poor, failed
  base_score INTEGER NOT NULL,
  multipliers JSONB DEFAULT '{}',
  cached_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(quest_type, quest_difficulty, completion_quality)
);

-- Random Events
CREATE TABLE IF NOT EXISTS random_events (
  id SERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- bonus, penalty, challenge, surprise
  description TEXT NOT NULL,
  emoji TEXT NOT NULL,
  effects JSONB NOT NULL,
  probability DECIMAL DEFAULT 0.1,
  conditions JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Status Effects Definitions
CREATE TABLE IF NOT EXISTS status_effects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL,
  description TEXT NOT NULL,
  effect_type TEXT NOT NULL, -- buff, debuff, neutral
  duration_days INTEGER DEFAULT 1,
  effects JSONB NOT NULL, -- {damage_modifier: -0.2, hp_modifier: 0, etc}
  triggers JSONB DEFAULT '{}', -- conditions that cause this effect
  created_at TIMESTAMP DEFAULT NOW()
);

-- Achievement System
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL, -- daily, weekly, monthly, special
  requirements JSONB NOT NULL,
  rewards JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP DEFAULT NOW(),
  battle_id INTEGER REFERENCES battles(id),
  PRIMARY KEY (user_id, achievement_id)
);

-- Insert default status effects
INSERT INTO status_effects (name, emoji, description, effect_type, duration_days, effects, triggers) VALUES
('Frozen', '🥶', 'Cannot combo tomorrow from missing gym', 'debuff', 1, '{"combo_blocked": true, "damage_modifier": -0.1}', '{"missed_quests": ["gym", "exercise"]}'),
('Slowed', '😴', '-20% attack damage from sleeping late', 'debuff', 1, '{"damage_modifier": -0.2}', '{"missed_quests": ["sleep", "bedtime"]}'),
('Burning', '🔥', 'Extra HP loss from junk food', 'debuff', 1, '{"hp_loss_modifier": 1.5, "damage_modifier": -0.1}', '{"missed_quests": ["diet", "nutrition"]}'),
('Shielded', '💎', 'Reduced damage taken from completing defense quests', 'buff', 1, '{"damage_taken_modifier": -0.3}', '{"completed_defense_quests": 1}'),
('Blessed', '✨', 'Bonus XP and damage from meditation/mindfulness', 'buff', 1, '{"xp_modifier": 1.3, "damage_modifier": 1.2}', '{"completed_quests": ["meditation", "mindfulness"]}'),
('Energized', '⚡', 'Bonus damage from completing workout', 'buff', 1, '{"damage_modifier": 1.4, "crit_chance": 0.1}', '{"completed_quests": ["gym", "workout"]}');

-- Insert default random events
INSERT INTO random_events (event_name, event_type, description, emoji, effects, probability) VALUES
('Snowstorm', 'penalty', 'A fierce blizzard doubles the penalty for missed quests!', '❄️', '{"damage_multiplier": 2.0, "hp_loss_multiplier": 2.0}', 0.05),
('Treasure Chest', 'bonus', 'You found a magical chest! Bonus XP for everyone!', '💎', '{"xp_bonus": 20, "damage_bonus": 5}', 0.08),
('Aurora Blessing', 'bonus', 'The northern lights bless your efforts! Critical hit chance increased!', '🌟', '{"crit_chance": 0.3, "damage_multiplier": 1.5}', 0.06),
('Frost Giant Challenge', 'challenge', 'A frost giant appears! Complete an extra quest for massive rewards!', '⛄', '{"extra_quest": true, "completion_reward": {"xp": 50, "damage": 30}}', 0.03),
('Warm Hearth', 'bonus', 'Found a cozy inn! Heal some HP and gain shield!', '🔥', '{"hp_heal": 15, "status_effect": "Shielded"}', 0.07),
('Blizzard Winds', 'penalty', 'Harsh winds make everything harder! Reduced XP gains today.', '🌨️', '{"xp_multiplier": 0.7, "damage_multiplier": 0.8}', 0.04);

-- Insert default achievements
INSERT INTO achievements (name, description, emoji, category, requirements, rewards) VALUES
('First Blood', 'Win your first daily battle', '🩸', 'daily', '{"daily_wins": 1}', '{"xp": 10, "cosmetic": "blood_sword"}'),
('Combo Master', 'Complete all daily quests in one day', '🔥', 'daily', '{"perfect_day": 1}', '{"xp": 25, "cosmetic": "combo_crown"}'),
('Ice Breaker', 'Deal 100+ damage in a single day', '❄️', 'daily', '{"daily_damage": 100}', '{"xp": 20}'),
('Weekly Champion', 'Win a weekly tournament', '🏆', 'weekly', '{"weekly_wins": 1}', '{"xp": 50, "cosmetic": "champion_badge"}'),
('Streak Lord', 'Maintain a 7-day streak', '🔥', 'weekly', '{"max_streak": 7}', '{"xp": 30, "unlocks": ["fire_aura"]}'),
('Boss Slayer', 'Defeat a monthly boss', '🐉', 'monthly', '{"bosses_defeated": 1}', '{"xp": 100, "cosmetic": "dragon_slayer_title"}'),
('Winter Survivor', 'Complete a full month without losing a weekly tournament', '❄️', 'monthly', '{"monthly_consistency": 1}', '{"xp": 200, "cosmetic": "survivor_crown"}');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_battle_events_battle_id ON battle_events(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_events_type ON battle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_weekly_tournaments_battle ON weekly_tournaments(battle_id);
CREATE INDEX IF NOT EXISTS idx_monthly_boss_month ON monthly_boss_fights(month_year);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(date);
CREATE INDEX IF NOT EXISTS idx_logs_battle_date ON logs(battle_id, date);
