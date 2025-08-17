const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-testing',
});

/**
 * Winter Arc RPG Engine - LLM-Based Scoring System
 * Provides consistent, narrative-driven quest evaluation and battle mechanics
 */

class RPGEngine {
  constructor(db) {
    this.db = db;
    this.scoringCache = new Map();
  }

  /**
   * Calculate quest outcome (adapter method for checkins route)
   * Bridges the parameter differences between routes and evaluation
   */
  async calculateQuestOutcome(quest, completed, value, userStats, opponentStats) {
    const checkinData = {
      completed: completed,
      value: value
    };
    
    const userContext = {
      streak: userStats.streak || 0,
      hp: userStats.hp || 100,
      status_effects: userStats.status_effects || [],
      level: userStats.level || 1,
      days_since_last: 0 // Could be calculated from last_action_date if needed
    };
    
    return await this.evaluateQuestCompletion(quest, checkinData, userContext);
  }

  /**
   * LLM-Based Quest Scoring for Consistency
   * Evaluates quest completion quality and determines RPG consequences
   */
  async evaluateQuestCompletion(quest, checkinData, userContext = {}) {
    const cacheKey = `${quest.quest_type}-${quest.difficulty}-${checkinData.completed}-${checkinData.value}`;
    
    // Check cache first for consistency
    if (this.scoringCache.has(cacheKey)) {
      return this.scoringCache.get(cacheKey);
    }

    const prompt = this.buildScoringPrompt(quest, checkinData, userContext);
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You are the Winter Arc RPG scoring engine. Evaluate quest completions consistently and return ONLY a JSON object with this exact structure:
{
  "quality": "excellent|good|average|poor|failed",
  "damage_dealt": 0-50,
  "xp_gained": 0-30,
  "is_critical_hit": false,
  "status_effects_applied": [],
  "narrative": "brief RPG explanation",
  "multiplier": 1.0-2.0
}

Base scoring:
- Failed quest: quality="failed", damage=0, xp=0, hp_loss=10-25
- Poor completion: quality="poor", damage=3-7, xp=1-3
- Average completion: quality="average", damage=8-15, xp=4-8  
- Good completion: quality="good", damage=16-25, xp=9-15
- Excellent completion: quality="excellent", damage=26-40, xp=16-25

Critical hits (15% chance for excellent): double damage
Status effects based on quest type and performance.

Be consistent - same inputs should give same outputs.`
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.3 // Lower temperature for consistency
      });

      const result = JSON.parse(completion.choices[0].message.content.trim());
      this.scoringCache.set(cacheKey, result);
      
      // Cache in database for long-term consistency
      await this.cacheScoring(quest, checkinData, result);
      
      return result;
    } catch (error) {
      console.error('LLM Scoring Error:', error);
      return this.getFallbackScoring(quest, checkinData);
    }
  }

  buildScoringPrompt(quest, checkinData, userContext) {
    return `
QUEST EVALUATION:
Quest: ${quest.emoji} ${quest.name}
Type: ${quest.quest_type} (attack/defense/healing)
Difficulty: ${quest.difficulty} (light/medium/heavy)
Target: ${quest.comparison} ${quest.target_value}

USER SUBMISSION:
Completed: ${checkinData.completed ? 'YES' : 'NO'}
Value: ${checkinData.value || 'N/A'}
Previous Streak: ${userContext.streak || 0}
Current HP: ${userContext.hp || 100}

CONTEXT:
- User has ${userContext.status_effects?.length || 0} active status effects
- Last action was ${userContext.days_since_last || 0} days ago
- This is a ${quest.difficulty} difficulty ${quest.quest_type} quest

Evaluate the quality of completion and determine RPG consequences.
`;
  }

  async cacheScoring(quest, checkinData, result) {
    try {
      const completionQuality = result.quality;
      await this.db.query(`
        INSERT INTO llm_scoring_cache (quest_type, quest_difficulty, completion_quality, base_score, multipliers)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (quest_type, quest_difficulty, completion_quality) 
        DO UPDATE SET base_score = $4, multipliers = $5, cached_at = NOW()
      `, [
        quest.quest_type,
        quest.difficulty,
        completionQuality,
        result.damage_dealt + result.xp_gained,
        JSON.stringify({
          damage: result.damage_dealt,
          xp: result.xp_gained,
          multiplier: result.multiplier,
          crit_chance: result.is_critical_hit ? 0.15 : 0
        })
      ]);
    } catch (error) {
      console.error('Cache storing error:', error);
    }
  }

  getFallbackScoring(quest, checkinData) {
    // Consistent fallback scoring when LLM fails
    const isCompleted = checkinData.completed;
    const difficulty = quest.difficulty || 'medium';
    
    const baseDamage = { light: 8, medium: 15, heavy: 25 }[difficulty];
    const baseXP = { light: 3, medium: 8, heavy: 15 }[difficulty];
    
    if (!isCompleted) {
      return {
        quality: 'failed',
        damage_dealt: 0,
        xp_gained: 0,
        is_critical_hit: false,
        status_effects_applied: this.getFailureStatusEffects(quest),
        narrative: `${quest.name} failed! ❌`,
        multiplier: 0,
        hp_loss: Math.floor(baseDamage * 0.6) // Self-damage for failure
      };
    }

    return {
      quality: 'average',
      damage_dealt: baseDamage,
      xp_gained: baseXP,
      is_critical_hit: false,
      status_effects_applied: [],
      narrative: `${quest.name} completed! ⚔️`,
      multiplier: 1.0
    };
  }

  /**
   * Calculate Combo Multipliers
   */
  calculateComboMultiplier(completedQuests, totalQuests) {
    const completionRate = completedQuests / totalQuests;
    
    if (completionRate === 1.0) {
      return 2.0; // Perfect day = 2x multiplier
    } else if (completionRate >= 0.8) {
      return 1.5; // 80%+ = 1.5x multiplier
    } else if (completionRate >= 0.6) {
      return 1.2; // 60%+ = 1.2x multiplier
    }
    
    return 1.0; // No bonus
  }

  /**
   * Apply Status Effects to User Stats
   */
  async applyStatusEffects(userStats, statusEffectsToApply) {
    // Clone the current user stats
    const newUserStats = { ...userStats };
    
    // Ensure status_effects is an array
    if (!newUserStats.status_effects || !Array.isArray(newUserStats.status_effects)) {
      newUserStats.status_effects = [];
    }
    
    // Process new status effects
    for (const effectName of statusEffectsToApply) {
      // Get effect definition from database
      const effectRes = await this.db.query(
        'SELECT * FROM status_effects WHERE name = $1',
        [effectName]
      );
      
      if (effectRes.rows.length > 0) {
        const effect = effectRes.rows[0];
        
        // Remove existing effect of same type
        newUserStats.status_effects = newUserStats.status_effects.filter(
          e => e.name !== effectName
        );
        
        // Add new effect with expiration
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + effect.duration_days);
        
        newUserStats.status_effects.push({
          name: effect.name,
          emoji: effect.emoji,
          description: effect.description,
          effect_type: effect.effect_type,
          effects: effect.effects,
          expires_at: expiration.toISOString().split('T')[0]
        });
      }
    }
    
    // Clean up expired effects
    const today = new Date().toISOString().split('T')[0];
    newUserStats.status_effects = newUserStats.status_effects.filter(
      effect => effect.expires_at >= today
    );
    
    return newUserStats;
  }

  /**
   * Apply Status Effects Based on Quest Results
   */
  getFailureStatusEffects(quest) {
    const effects = [];
    
    // Check quest categories for specific status effects
    const questName = quest.name.toLowerCase();
    const category = quest.category?.toLowerCase() || '';
    
    if (questName.includes('gym') || questName.includes('workout') || category.includes('fitness')) {
      effects.push('Frozen'); // Can't combo tomorrow
    }
    
    if (questName.includes('sleep') || questName.includes('bedtime') || category.includes('sleep')) {
      effects.push('Slowed'); // -20% damage tomorrow
    }
    
    if (questName.includes('diet') || questName.includes('food') || category.includes('nutrition')) {
      effects.push('Burning'); // Extra HP loss
    }
    
    return effects;
  }

  getSuccessStatusEffects(quest, quality) {
    const effects = [];
    
    if (quality === 'excellent' && quest.quest_type === 'defense') {
      effects.push('Shielded'); // Reduced damage taken
    }
    
    if (quest.name.toLowerCase().includes('meditation') || quest.name.toLowerCase().includes('mindfulness')) {
      effects.push('Blessed'); // Bonus XP and damage
    }
    
    if (quest.name.toLowerCase().includes('workout') || quest.name.toLowerCase().includes('gym')) {
      effects.push('Energized'); // Bonus damage and crit chance
    }
    
    return effects;
  }

  /**
   * Generate Random Events
   */
  async triggerRandomEvent(battle_id, user_id, context = {}) {
    // 10% chance of random event per day
    if (Math.random() > 0.1) return null;
    
    const events = await this.db.query(`
      SELECT * FROM random_events 
      WHERE active = true 
      ORDER BY RANDOM() 
      LIMIT 1
    `);
    
    if (events.rows.length === 0) return null;
    
    const event = events.rows[0];
    
    // Store the event
    await this.db.query(`
      INSERT INTO battle_events (battle_id, user_id, event_type, event_data)
      VALUES ($1, $2, 'random_event', $3)
    `, [battle_id, user_id, JSON.stringify({
      event_id: event.id,
      name: event.event_name,
      description: event.description,
      emoji: event.emoji,
      effects: event.effects
    })]);
    
    return event;
  }

  /**
   * Weekly Tournament Logic
   */
  async processWeeklyTournament(battle_id) {
    const weekStart = this.getWeekStart();
    const weekEnd = this.getWeekEnd();
    
    // Get battle stats for the week
    const stats = await this.db.query(`
      SELECT 
        bus.user_id,
        u.name,
        bus.hp,
        bus.total_damage_dealt,
        bus.xp,
        COUNT(c.id) as completed_quests
      FROM battle_user_stats bus
      JOIN users u ON bus.user_id = u.id
      LEFT JOIN checkins c ON c.user_id = bus.user_id 
        AND c.battle_id = bus.battle_id 
        AND c.date >= $2 
        AND c.date <= $3
        AND c.completed = true
      WHERE bus.battle_id = $1
      GROUP BY bus.user_id, u.name, bus.hp, bus.total_damage_dealt, bus.xp
    `, [battle_id, weekStart, weekEnd]);
    
    if (stats.rows.length < 2) return null;
    
    const [player1, player2] = stats.rows;
    
    // Determine winner based on HP and performance
    let winner, loser;
    if (player1.hp > player2.hp) {
      winner = player1;
      loser = player2;
    } else if (player2.hp > player1.hp) {
      winner = player2;
      loser = player1;
    } else {
      // Tie - check total damage dealt
      if (player1.total_damage_dealt >= player2.total_damage_dealt) {
        winner = player1;
        loser = player2;
      } else {
        winner = player2;
        loser = player1;
      }
    }
    
    // Generate rewards and penalties with LLM
    const rewards = await this.generateTournamentRewards(winner, loser, stats.rows);
    
    // Store tournament result
    await this.db.query(`
      INSERT INTO weekly_tournaments (
        battle_id, week_start, week_end, winner_id, loser_id, 
        winner_reward, loser_penalty, completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      battle_id, weekStart, weekEnd, winner.user_id, loser.user_id,
      JSON.stringify(rewards.winner), JSON.stringify(rewards.loser), true
    ]);
    
    return {
      winner: winner.name,
      loser: loser.name,
      rewards
    };
  }

  async generateTournamentRewards(winner, loser, allStats) {
    const prompt = `
WEEKLY TOURNAMENT RESULT:
Winner: ${winner.name} (HP: ${winner.hp}, Quests: ${winner.completed_quests})
Loser: ${loser.name} (HP: ${loser.hp}, Quests: ${loser.completed_quests})

Generate fun, themed rewards for winner and creative penalties for loser. Make them engaging but not too harsh.

Return JSON:
{
  "winner": {
    "xp_bonus": 50,
    "trophy": "Blizzard Champion",
    "unlock": "ice_sword_move",
    "description": "Epic description"
  },
  "loser": {
    "penalty_type": "dare",
    "penalty_description": "Post a frozen selfie 🥶📸",
    "xp_reduction": 10,
    "motivation": "encouraging message"
  }
}
`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'Generate fun, winter-themed tournament rewards and penalties in JSON format. Keep penalties light-hearted but motivating.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 400,
        temperature: 0.7
      });

      return JSON.parse(completion.choices[0].message.content.trim());
    } catch (error) {
      return {
        winner: {
          xp_bonus: 50,
          trophy: "Weekly Champion 🏆",
          unlock: "champion_aura",
          description: "Victorious in the frozen battlefield!"
        },
        loser: {
          penalty_type: "dare",
          penalty_description: "Do 10 pushups and post it! 💪",
          xp_reduction: 0,
          motivation: "Every defeat is a lesson in the Winter Arc! ❄️"
        }
      };
    }
  }

  /**
   * Monthly Boss Fight System
   */
  async processMonthlyBoss(month_year) {
    // Get or create boss for this month
    let boss = await this.db.query(`
      SELECT * FROM monthly_boss_fights WHERE month_year = $1
    `, [month_year]);

    if (boss.rows.length === 0) {
      boss = await this.createMonthlyBoss(month_year);
    } else {
      boss = boss.rows[0];
    }

    return boss;
  }

  async createMonthlyBoss(month_year) {
    const bosses = [
      { name: "Frost Titan ⛰️", hp: 1000, abilities: ["Ice Smash", "Frozen Breath", "Avalanche"] },
      { name: "Winter Demon ❄️", hp: 1200, abilities: ["Soul Freeze", "Dark Blizzard", "Despair Aura"] },
      { name: "Debt Dragon 🐉", hp: 800, abilities: ["Money Burn", "Stress Breath", "Procrastination Cloud"] },
      { name: "Chaos Beast 🌪️", hp: 1100, abilities: ["Reality Distortion", "Focus Drain", "Habit Break"] }
    ];

    const selectedBoss = bosses[Math.floor(Math.random() * bosses.length)];

    const result = await this.db.query(`
      INSERT INTO monthly_boss_fights (
        month_year, boss_name, boss_hp, boss_max_hp, boss_abilities, status
      ) VALUES ($1, $2, $3, $3, $4, 'active')
      RETURNING *
    `, [
      month_year, 
      selectedBoss.name, 
      selectedBoss.hp,
      JSON.stringify(selectedBoss.abilities)
    ]);

    return result.rows[0];
  }

  // Utility functions
  getWeekStart() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);
    return start.toISOString().split('T')[0];
  }

  getWeekEnd() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const end = new Date(now);
    end.setDate(now.getDate() + (6 - dayOfWeek));
    return end.toISOString().split('T')[0];
  }

  getCurrentMonthYear() {
    return new Date().toISOString().slice(0, 7); // YYYY-MM format
  }
}

module.exports = { RPGEngine };
