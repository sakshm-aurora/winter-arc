const express = require('express');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');
const { RPGEngine } = require('../utils/rpg-engine');
const { OpenAI } = require('openai');

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-testing',
});

/*
  Get current monthly boss fight
*/
router.get('/current', authenticateToken, async (req, res) => {
  const rpgEngine = new RPGEngine(db);
  const currentMonth = rpgEngine.getCurrentMonthYear();
  
  try {
    let boss = await db.query(`
      SELECT * FROM monthly_boss_fights WHERE month_year = $1
    `, [currentMonth]);
    
    if (boss.rows.length === 0) {
      // Create new boss for this month
      boss = await rpgEngine.createMonthlyBoss(currentMonth);
    } else {
      boss = boss.rows[0];
    }
    
    // Get participating battles and their progress
    const participatingBattles = await db.query(`
      SELECT 
        b.id,
        b.player1_id,
        b.player2_id,
        p1.name as player1_name,
        p2.name as player2_name,
        SUM(c.damage_dealt) as total_damage_contributed
      FROM battles b
      JOIN users p1 ON b.player1_id = p1.id
      JOIN users p2 ON b.player2_id = p2.id
      LEFT JOIN checkins c ON c.battle_id = b.id 
        AND DATE_TRUNC('month', c.date) = $1::date
        AND c.completed = true
      WHERE b.status = 'active'
        AND DATE_TRUNC('month', b.started_at) <= $1::date
      GROUP BY b.id, b.player1_id, b.player2_id, p1.name, p2.name
    `, [currentMonth + '-01']);
    
    // Calculate total damage dealt to boss
    const totalDamage = participatingBattles.rows.reduce(
      (sum, battle) => sum + (parseInt(battle.total_damage_contributed) || 0), 
      0
    );
    
    const currentBossHP = Math.max(0, boss.boss_max_hp - totalDamage);
    
    // Update boss HP
    await db.query(`
      UPDATE monthly_boss_fights 
      SET boss_hp = $1, participating_battles = $2
      WHERE id = $3
    `, [
      currentBossHP,
      JSON.stringify(participatingBattles.rows.map(b => ({
        battle_id: b.id,
        players: [b.player1_name, b.player2_name],
        damage_contributed: b.total_damage_contributed || 0
      }))),
      boss.id
    ]);
    
    res.json({
      boss: {
        ...boss,
        boss_hp: currentBossHP,
        damage_dealt: totalDamage
      },
      participating_battles: participatingBattles.rows,
      total_damage: totalDamage,
      progress_percentage: ((boss.boss_max_hp - currentBossHP) / boss.boss_max_hp * 100).toFixed(1)
    });
  } catch (err) {
    console.error('Boss fight error:', err);
    res.status(500).json({ message: 'Error fetching boss fight' });
  }
});

/*
  Attack the monthly boss (processes damage from all battles)
*/
router.post('/attack', authenticateToken, async (req, res) => {
  const rpgEngine = new RPGEngine(db);
  const currentMonth = rpgEngine.getCurrentMonthYear();
  
  try {
    // Get current boss
    const bossRes = await db.query(`
      SELECT * FROM monthly_boss_fights WHERE month_year = $1 AND status = 'active'
    `, [currentMonth]);
    
    if (bossRes.rows.length === 0) {
      return res.status(404).json({ message: 'No active boss fight this month' });
    }
    
    const boss = bossRes.rows[0];
    
    // Check if boss is already defeated
    if (boss.boss_hp <= 0) {
      return res.status(400).json({ message: 'Boss already defeated!' });
    }
    
    // Get today's total damage from all battles
    const today = new Date().toISOString().split('T')[0];
    const todayDamage = await db.query(`
      SELECT SUM(c.damage_dealt) as total_damage
      FROM checkins c
      JOIN battles b ON c.battle_id = b.id
      WHERE c.date = $1 AND c.completed = true
    `, [today]);
    
    const damageToday = parseInt(todayDamage.rows[0]?.total_damage) || 0;
    
    if (damageToday === 0) {
      return res.status(400).json({ message: 'No damage dealt today!' });
    }
    
    // Apply damage to boss
    const newBossHP = Math.max(0, boss.boss_hp - damageToday);
    
    // Generate boss reaction narrative
    const bossReaction = await generateBossReaction(boss, damageToday, newBossHP);
    
    // Update boss HP
    await db.query(`
      UPDATE monthly_boss_fights 
      SET boss_hp = $1
      WHERE id = $2
    `, [newBossHP, boss.id]);
    
    // Check if boss is defeated
    let result = {
      damage_dealt: damageToday,
      boss_hp_remaining: newBossHP,
      boss_reaction: bossReaction,
      boss_defeated: newBossHP <= 0
    };
    
    if (newBossHP <= 0) {
      // Boss defeated! Generate rewards
      const rewards = await generateVictoryRewards(boss);
      
      await db.query(`
        UPDATE monthly_boss_fights 
        SET status = 'completed', completed_at = NOW(), victory_rewards = $1
        WHERE id = $2
      `, [JSON.stringify(rewards), boss.id]);
      
      // Distribute rewards to all participants
      await distributeVictoryRewards(boss, rewards);
      
      result.victory_rewards = rewards;
      result.message = `🎉 ${boss.boss_name} has been vanquished! Winter champions emerge victorious!`;
    } else {
      result.message = `⚔️ ${damageToday} damage dealt to ${boss.boss_name}!`;
    }
    
    res.json(result);
  } catch (err) {
    console.error('Boss attack error:', err);
    res.status(500).json({ message: 'Error attacking boss' });
  }
});

/*
  Get boss fight history
*/
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const history = await db.query(`
      SELECT * FROM monthly_boss_fights 
      WHERE status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 12
    `);
    
    res.json(history.rows);
  } catch (err) {
    console.error('Boss history error:', err);
    res.status(500).json({ message: 'Error fetching boss history' });
  }
});

async function generateBossReaction(boss, damage, remainingHP) {
  const prompt = `
BOSS BATTLE UPDATE:
Boss: ${boss.boss_name}
Damage Taken: ${damage}
Remaining HP: ${remainingHP}/${boss.boss_max_hp}

Generate a dramatic boss reaction quote with emojis that reflects the damage taken.
If heavily damaged (< 25% HP), make it desperate.
If lightly damaged (> 75% HP), make it taunting.
Keep it under 50 words and include winter/ice themes.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a Winter RPG boss. Generate dramatic, themed reactions to player attacks. Use emojis and winter imagery.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
      temperature: 0.8
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    const hpPercentage = (remainingHP / boss.boss_max_hp) * 100;
    
    if (hpPercentage <= 0) {
      return `💀 NOOOO! The winter heroes have bested me! My icy reign ends! ❄️💥`;
    } else if (hpPercentage < 25) {
      return `🥶 Impossible! How dare you wound me so! My frost magic weakens! ❄️💀`;
    } else if (hpPercentage < 50) {
      return `😤 You insects dare challenge my power?! Feel my frozen wrath! ❄️⚡`;
    } else {
      return `😈 Pathetic mortals! Your feeble attacks cannot penetrate my icy armor! ❄️🛡️`;
    }
  }
}

async function generateVictoryRewards(boss) {
  const prompt = `
BOSS DEFEATED: ${boss.boss_name}
Boss Max HP: ${boss.boss_max_hp}

Generate epic victory rewards for defeating this monthly boss.
Include:
- XP rewards for all participants
- Special cosmetic unlocks
- Unique titles
- Next month preview

Return JSON format:
{
  "xp_reward": 200,
  "cosmetics": ["Frost Slayer Crown", "Ice Dragon Wings"],
  "titles": ["Vanquisher of Winter", "Frost Hero"],
  "next_month_preview": "Spring's awakening brings new challenges...",
  "celebration_message": "Epic victory description"
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'Generate epic RPG victory rewards in JSON format. Make them feel meaningful and seasonal.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    return JSON.parse(completion.choices[0].message.content.trim());
  } catch (error) {
    return {
      xp_reward: 200,
      cosmetics: ["Winter Champion Crown ❄️👑", "Frost Blade ⚔️"],
      titles: ["Boss Slayer 🐉", "Winter Hero ❄️"],
      next_month_preview: "New challenges await in the changing seasons...",
      celebration_message: "🎉 Epic victory against the forces of winter! Heroes unite! ❄️⚔️"
    };
  }
}

async function distributeVictoryRewards(boss, rewards) {
  try {
    // Get all active battles that participated this month
    const participatingBattles = JSON.parse(boss.participating_battles || '[]');
    
    for (const battleInfo of participatingBattles) {
      const battleId = battleInfo.battle_id;
      
      // Get battle participants
      const battle = await db.query(`
        SELECT player1_id, player2_id FROM battles WHERE id = $1
      `, [battleId]);
      
      if (battle.rows.length > 0) {
        const { player1_id, player2_id } = battle.rows[0];
        
        // Award XP to both players
        for (const userId of [player1_id, player2_id]) {
          await db.query(`
            UPDATE users 
            SET total_xp = total_xp + $1,
                level = (total_xp + $1) / 100 + 1,
                cosmetics = cosmetics || $2,
                trophies = trophies || $3
            WHERE id = $4
          `, [
            rewards.xp_reward,
            JSON.stringify({ boss_defeat: rewards.cosmetics }),
            JSON.stringify([{
              name: `Defeated ${boss.boss_name}`,
              earned_at: new Date().toISOString(),
              month: boss.month_year
            }]),
            userId
          ]);
          
          // Update battle stats
          await db.query(`
            UPDATE battle_user_stats 
            SET xp = xp + $1, level = (xp + $1) / 100 + 1
            WHERE user_id = $2
          `, [rewards.xp_reward, userId]);
        }
      }
    }
  } catch (error) {
    console.error('Reward distribution error:', error);
  }
}

module.exports = router;
