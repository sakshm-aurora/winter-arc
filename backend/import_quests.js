const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'sakshamaurora',
  host: 'localhost',
  database: 'winter_arc_db',
  port: 5432,
});

// User mappings
const userMappings = {
  'sakshamvihar@gmail.com': { id: 1, name: 'skarface' }, // Mage
  'utsav.mishra1998@gmail.com': { id: 2, name: 'zupz' }  // Warrior
};

// Difficulty mapping based on quest characteristics
function getDifficulty(questType, targetValue, frequency) {
  if (frequency === 'monthly') return 'hard';
  if (frequency === 'weekly') return 'medium';
  
  if (questType === 'numeric') {
    const value = parseInt(targetValue) || 1;
    if (value >= 3) return 'hard';
    if (value >= 2) return 'medium';
    return 'easy';
  }
  
  return 'easy'; // Default for boolean quests
}

// Category mapping
function mapCategory(category) {
  const categoryMap = {
    'health': 'health',
    'skill': 'productivity', 
    'self_control': 'wellness',
    'finance': 'financial',
    'lifestyle': 'wellness'
  };
  return categoryMap[category] || 'other';
}

// Import function
async function importQuests() {
  try {
    console.log('🎯 Starting quest import...');
    
    const questsToImport = [];
    
    // Read and parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream('./Quest_export.csv')
        .pipe(csv())
        .on('data', (row) => {
          const userEmail = row.created_by;
          const userMapping = userMappings[userEmail];
          
          if (!userMapping) {
            return; // Skip users not in our mapping
          }
          
          const quest = {
            user_id: userMapping.id,
            user_name: userMapping.name,
            name: row.title.replace(/"/g, ''), // Remove quotes
            category: mapCategory(row.category),
            difficulty: getDifficulty(row.quest_type, row.target_value, row.frequency),
            frequency: row.frequency, // daily, weekly, monthly
            quest_type: row.quest_type === 'numeric' ? 'number' : 'attack',
            target_value: row.quest_type === 'numeric' ? parseInt(row.target_value) || 1 : 1,
            emoji: row.emoji || '⭐',
            comparison: 'gte', // greater than or equal
            base_damage: getDifficulty(row.quest_type, row.target_value, row.frequency) === 'hard' ? 15 : 
                        getDifficulty(row.quest_type, row.target_value, row.frequency) === 'medium' ? 12 : 10,
            base_xp: getDifficulty(row.quest_type, row.target_value, row.frequency) === 'hard' ? 8 : 
                     getDifficulty(row.quest_type, row.target_value, row.frequency) === 'medium' ? 6 : 5
          };
          
          questsToImport.push(quest);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📊 Found ${questsToImport.length} quests to import`);
    
    // Group by user
    const skarfaceQuests = questsToImport.filter(q => q.user_name === 'skarface');
    const zupzQuests = questsToImport.filter(q => q.user_name === 'zupz');
    
    console.log(`🧙 skarface quests: ${skarfaceQuests.length}`);
    console.log(`⚔️ zupz quests: ${zupzQuests.length}`);
    
    // Insert quests into database
    for (const quest of questsToImport) {
      await pool.query(`
        INSERT INTO quests (
          user_id, name, category, difficulty, 
          frequency, quest_type, target_value, emoji, comparison, base_damage, base_xp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        quest.user_id,
        quest.name,
        quest.category,
        quest.difficulty,
        quest.frequency,
        quest.quest_type,
        quest.target_value,
        quest.emoji,
        quest.comparison,
        quest.base_damage,
        quest.base_xp
      ]);
    }
    
    console.log('✅ All quests imported successfully!');
    
    // Show summary
    const summary = await pool.query(`
      SELECT 
        u.name, 
        u.player_class,
        COUNT(q.id) as quest_count,
        COUNT(CASE WHEN q.frequency = 'daily' THEN 1 END) as daily_quests,
        COUNT(CASE WHEN q.frequency = 'weekly' THEN 1 END) as weekly_quests,
        COUNT(CASE WHEN q.frequency = 'monthly' THEN 1 END) as monthly_quests
      FROM users u
      LEFT JOIN quests q ON u.id = q.user_id
      GROUP BY u.id, u.name, u.player_class
      ORDER BY u.id
    `);
    
    console.log('\n📋 QUEST IMPORT SUMMARY:');
    summary.rows.forEach(row => {
      console.log(`${row.player_class === 'mage' ? '🧙' : '⚔️'} ${row.name} (${row.player_class}):`);
      console.log(`   Total: ${row.quest_count} quests`);
      console.log(`   Daily: ${row.daily_quests}, Weekly: ${row.weekly_quests}, Monthly: ${row.monthly_quests}`);
    });
    
    // Show sample quests
    console.log('\n🎯 SAMPLE QUESTS:');
    const sampleQuests = await pool.query(`
      SELECT u.name, q.name, q.category, q.difficulty, q.frequency, q.emoji
      FROM quests q
      JOIN users u ON q.user_id = u.id
      ORDER BY u.name, q.frequency, q.name
      LIMIT 10
    `);
    
    sampleQuests.rows.forEach(quest => {
      console.log(`   ${quest.emoji} ${quest.name} (${quest.frequency}, ${quest.difficulty}) - ${quest.name}`);
    });
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error importing quests:', error.message);
    process.exit(1);
  }
}

// Run the import
importQuests();
