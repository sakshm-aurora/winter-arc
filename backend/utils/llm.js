const { OpenAI } = require('openai');
require('dotenv').config();

// Initialize OpenAI client with API key from env. If no key is provided
// the constructor will throw, so ensure your .env contains OPENAI_API_KEY.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-testing',
});

/*
 * Generates a battle narration for Winter Arc duels.
 * playersData format:
 * [
 *   {
 *     name: string,
 *     hp: number,
 *     xp: number,
 *     level: number,
 *     streak: number,
 *     player_class: string,
 *     status_effects: array,
 *     submitted_today: boolean,
 *     today: {
 *       damage_dealt: number,
 *       xp_gained: number,
 *       critical_hits: number,
 *       quests_completed: number,
 *       quest_details: array
 *     }
 *   }
 * ]
 * options: { dayNumber, combos, criticalHits, statusEffects, bothSubmitted, onePlayerMissing, missedPlayer }
 */
async function generateBattleNarration(dateStr, playersData, options = {}) {
  const dayNumber = options.dayNumber || 1;
  const bothSubmitted = options.bothSubmitted !== false; // Default to true unless explicitly false
  const onePlayerMissing = options.onePlayerMissing || false;
  const missedPlayer = options.missedPlayer || null;
  
  let summary = `🌨️ Winter Arc – Day ${dayNumber} ❄️\n\n`;
  
  // Duel Status Header
  if (onePlayerMissing && missedPlayer) {
    summary += `⚠️ INCOMPLETE DUEL: ${missedPlayer} failed to appear for battle!\n\n`;
  } else if (bothSubmitted) {
    summary += `⚔️ FULL DUEL: Both warriors have submitted their quests!\n\n`;
  }
  
  // Player Status Lines
  summary += playersData
    .map(p => {
      const classEmoji = getClassEmoji(p.player_class);
      const statusLine = `${classEmoji} ${p.name} (❤️ ${p.hp} | ⭐ ${p.xp} | 🔥 ${p.streak})`;
      
      if (!p.submitted_today) {
        return statusLine + ` [❌ NO SUBMISSION]`;
      }
      return statusLine;
    })
    .join('\n') + '\n\n';
  
  // Battle Actions Summary
  summary += `📋 BATTLE SUMMARY:\n`;
  for (const p of playersData) {
    if (!p.submitted_today) {
      summary += `${p.name}: Absent from battle (0 damage, 0 XP)\n`;
      continue;
    }
    
    const today = p.today;
    summary += `${p.name}: ${today.quests_completed} quests completed\n`;
    summary += `  → 💥 ${today.damage_dealt} damage dealt\n`;
    summary += `  → ⭐ ${today.xp_gained} XP gained\n`;
    
    if (today.critical_hits > 0) {
      summary += `  → 🎯 ${today.critical_hits} CRITICAL HIT${today.critical_hits > 1 ? 'S' : ''}!\n`;
    }
    
    if (options.combos) {
      summary += `  → ⚡ COMBO BONUS activated!\n`;
    }
    
    // List specific quests
    if (today.quest_details && today.quest_details.length > 0) {
      summary += `  Quests: ${today.quest_details
        .map(q => `${q.completed ? '✅' : '❌'} ${q.name}${q.critical ? ' 🎯' : ''}`)
        .join(', ')}\n`;
    }
    summary += '\n';
  }
  
  // Status Effects
  if (options.statusEffects && options.statusEffects.length > 0) {
    summary += `🌟 STATUS EFFECTS APPLIED:\n`;
    for (const effect of options.statusEffects) {
      summary += `${effect.emoji || '✨'} ${effect.name}: ${effect.description}\n`;
    }
    summary += '\n';
  }
  
  // Narration Prompt
  summary += `Generate an epic, Winter Arc RPG battle narration based on this Day ${dayNumber} duel!`;
  if (onePlayerMissing) {
    summary += ` One warrior was absent - emphasize the disappointment and missed opportunity!`;
  } else {
    summary += ` Both warriors clashed - describe the epic confrontation!`;
  }
  summary += ` Use emojis, winter themes, and RPG combat language. Keep it exciting and competitive!`;
  // Use OpenAI chat completion
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a game narrator for a competitive RPG. Write in short, exciting sentences with emojis, as if narrating a battle log. Mention HP, XP, streaks, and describe successes and failures with playful moves.',
        },
        { role: 'user', content: summary },
      ],
      max_tokens: 200,
      temperature: 0.8,
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.log('OpenAI API error:', error.message);
    // Return a fallback narration if OpenAI fails
    return `🌨️ Winter Arc Battle Update!\n\n${summary}\n\nThe battle continues with fierce determination! ⚔️`;
  }
}

// Helper function to get class emoji
function getClassEmoji(playerClass) {
  const classEmojis = {
    'Warrior': '⚔️',
    'Mage': '🔮',
    'Rogue': '🗡️',
    'Monk': '🥋',
    'Archer': '🏹',
    'Paladin': '🛡️'
  };
  return classEmojis[playerClass] || '⚔️';
}

module.exports = {
  generateBattleNarration,
};