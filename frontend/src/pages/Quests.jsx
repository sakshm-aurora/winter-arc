import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Enhanced quest templates with RPG styling
const questTemplates = [
  // Combat Quests
  { name: 'Physical Training', emoji: '🏋️', category: 'Combat', difficulty: 'medium', quest_type: 'attack', frequency: 'daily', target: 1, comparison: 'greater_equal', description: 'Train your warrior body' },
  { name: 'Cardio Quest', emoji: '🏃', category: 'Combat', difficulty: 'medium', quest_type: 'attack', frequency: 'daily', target: 30, comparison: 'greater_equal', description: 'Run like the wind' },
  { name: 'Strength Challenge', emoji: '💪', category: 'Combat', difficulty: 'heavy', quest_type: 'attack', frequency: 'daily', target: 50, comparison: 'greater_equal', description: 'Push-ups for power' },
  
  // Magic Quests
  { name: 'Knowledge Scroll', emoji: '📚', category: 'Magic', difficulty: 'light', quest_type: 'attack', frequency: 'daily', target: 20, comparison: 'greater_equal', description: 'Read pages of wisdom' },
  { name: 'Meditation Ritual', emoji: '🧘', category: 'Magic', difficulty: 'light', quest_type: 'healing', frequency: 'daily', target: 10, comparison: 'greater_equal', description: 'Center your mind' },
  { name: 'Learning Spell', emoji: '🎓', category: 'Magic', difficulty: 'medium', quest_type: 'attack', frequency: 'daily', target: 1, comparison: 'greater_equal', description: 'Study new skills' },
  
  // Defense Quests
  { name: 'Sleep Shield', emoji: '🛏️', category: 'Defense', difficulty: 'light', quest_type: 'defense', frequency: 'daily', target: 8, comparison: 'greater_equal', description: 'Rest for 8+ hours' },
  { name: 'Nutrition Barrier', emoji: '🥗', category: 'Defense', difficulty: 'medium', quest_type: 'defense', frequency: 'daily', target: 3, comparison: 'greater_equal', description: 'Eat healthy meals' },
  { name: 'Hydration Potion', emoji: '💧', category: 'Defense', difficulty: 'light', quest_type: 'healing', frequency: 'daily', target: 8, comparison: 'greater_equal', description: 'Drink water glasses' },
  
  // Resource Quests
  { name: 'Gold Saving', emoji: '💰', category: 'Resources', difficulty: 'medium', quest_type: 'defense', frequency: 'daily', target: 500, comparison: 'greater_equal', description: 'Save money for future' },
  { name: 'Time Management', emoji: '⏰', category: 'Resources', difficulty: 'heavy', quest_type: 'attack', frequency: 'daily', target: 2, comparison: 'less_equal', description: 'Limit screen time' },
  { name: 'Energy Conservation', emoji: '⚡', category: 'Resources', difficulty: 'light', quest_type: 'defense', frequency: 'daily', target: 1, comparison: 'greater_equal', description: 'Early bedtime' },
];

const difficultyInfo = {
  light: { color: '#7bed9f', damage: '5-15', xp: '3-8', icon: '🟢' },
  medium: { color: '#feca57', damage: '10-25', xp: '8-15', icon: '🟡' },
  heavy: { color: '#ff6b6b', damage: '20-40', xp: '15-25', icon: '🔴' }
};

const questTypeInfo = {
  attack: { color: '#ff4757', icon: '⚔️', description: 'Direct damage to opponent' },
  defense: { color: '#5f27cd', icon: '🛡️', description: 'Protective effects and shields' },
  healing: { color: '#00d2d3', icon: '💚', description: 'Recovery and status benefits' }
};

export default function Quests() {
  const { api } = useAuth();
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  const [form, setForm] = useState({ 
    id: null, 
    name: '', 
    emoji: '', 
    category: '', 
    difficulty: 'medium',
    quest_type: 'attack',
    frequency: 'daily', 
    target_value: 1, 
    comparison: 'greater_equal',
    description: ''
  });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchQuests();
  }, [api]);

  const fetchQuests = async () => {
    try {
      const res = await api.get('/quests');
      setQuests(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching quests');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ 
      id: null, 
      name: '', 
      emoji: '', 
      category: '', 
      difficulty: 'medium',
      quest_type: 'attack',
      frequency: 'daily', 
      target_value: 1, 
      comparison: 'greater_equal',
      description: ''
    });
    setEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const questData = {
        name: form.name,
        emoji: form.emoji,
        category: form.category,
        difficulty: form.difficulty,
        quest_type: form.quest_type,
        frequency: form.frequency,
        target_value: parseInt(form.target_value, 10),
        comparison: form.comparison,
      };

      if (editing) {
        await api.put(`/quests/${form.id}`, questData);
      } else {
        await api.post('/quests', questData);
      }
      
      await fetchQuests();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving quest');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('🗡️ Delete this quest from your arsenal?')) return;
    try {
      await api.delete(`/quests/${id}`);
      setQuests(quests.filter((q) => q.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Error deleting quest');
    }
  };

  const handleEdit = (quest) => {
    setEditing(true);
    setForm({ 
      id: quest.id, 
      name: quest.name, 
      emoji: quest.emoji, 
      category: quest.category, 
      difficulty: quest.difficulty || 'medium',
      quest_type: quest.quest_type || 'attack',
      frequency: quest.frequency, 
      target_value: quest.target_value, 
      comparison: quest.comparison,
      description: quest.description || ''
    });
  };

  const applyTemplate = (template) => {
    setForm({ 
      id: null, 
      name: template.name, 
      emoji: template.emoji, 
      category: template.category, 
      difficulty: template.difficulty,
      quest_type: template.quest_type,
      frequency: template.frequency, 
      target_value: template.target, 
      comparison: template.comparison,
      description: template.description
    });
    setEditing(false);
    setShowTemplates(false);
  };

  if (loading) {
    return (
      <div className="rpg-container">
        <div className="aurora-bg" />
        <div className="loading-screen">
          <div className="loading-content">
            <h1 className="neon-text">📜 Loading Quest Board... ⚔️</h1>
            <div className="loading-spinner-rpg">
              <span>🌨️</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rpg-container">
      <div className="aurora-bg" />
      <div className="quest-board-container">
        
        {/* Quest Board Header */}
        <div className="quest-board-header">
          <h1 className="neon-text">📜 Quest Board ⚔️</h1>
          <div className="quest-board-subtitle">
            Forge your daily challenges in the fires of winter
          </div>
        </div>

        {error && (
          <div className="error-toast">
            <span className="error-text">⚠️ {error}</span>
            <button className="error-close" onClick={() => setError('')}>❌</button>
          </div>
        )}

        {/* Active Quests */}
        <div className="quest-section">
          <div className="section-header">
            <h2 className="neon-purple-text">⚡ Your Active Quests</h2>
            <span className="quest-count">{quests.length} quests</span>
          </div>
          
          {quests.length === 0 ? (
            <div className="empty-quests">
              <div className="empty-icon">❄️</div>
              <h3 className="neon-text">No Quests Yet!</h3>
              <p>Create your first quest to begin your winter adventure!</p>
            </div>
          ) : (
            <div className="quest-grid">
              {quests.map((quest) => (
                <div key={quest.id} className="quest-card">
                  <div className="quest-card-header">
                    <div className="quest-emoji">{quest.emoji}</div>
                    <div className="quest-info">
                      <h3 className="quest-name">{quest.name}</h3>
                      <div className="quest-meta">
                        <span className="quest-category">{quest.category}</span>
                        <span className="quest-frequency">{quest.frequency}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="quest-details">
                    <div className="quest-target">
                      <span className="target-label">Target:</span>
                      <span className="target-value">
                        {quest.comparison === 'greater_equal' ? '≥' : '≤'} {quest.target_value}
                      </span>
                    </div>
                    
                    <div className="quest-stats">
                      <div className="quest-stat">
                        <span className="stat-icon">
                          {difficultyInfo[quest.difficulty || 'medium'].icon}
                        </span>
                        <span className="stat-label">{quest.difficulty || 'medium'}</span>
                      </div>
                      <div className="quest-stat">
                        <span className="stat-icon">
                          {questTypeInfo[quest.quest_type || 'attack'].icon}
                        </span>
                        <span className="stat-label">{quest.quest_type || 'attack'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="quest-actions">
                    <button 
                      className="quest-action-btn edit-btn"
                      onClick={() => handleEdit(quest)}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="quest-action-btn delete-btn"
                      onClick={() => handleDelete(quest.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quest Creation Form */}
        <div className="quest-creation-section">
          <div className="section-header">
            <h2 className="neon-text">
              {editing ? '✏️ Edit Quest' : '⚡ Forge New Quest'}
            </h2>
            <button 
              className="rpg-button template-btn"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              📋 Templates
            </button>
          </div>

          {/* Quest Templates */}
          {showTemplates && (
            <div className="quest-templates">
              <h3 className="template-title">🎯 Quest Templates</h3>
              <div className="template-categories">
                {['Combat', 'Magic', 'Defense', 'Resources'].map(category => (
                  <div key={category} className="template-category">
                    <h4 className="category-title">{category}</h4>
                    <div className="template-grid">
                      {questTemplates
                        .filter(t => t.category === category)
                        .map((template, idx) => (
                          <div 
                            key={idx} 
                            className="template-card"
                            onClick={() => applyTemplate(template)}
                          >
                            <div className="template-header">
                              <span className="template-emoji">{template.emoji}</span>
                              <div className="template-info">
                                <div className="template-name">{template.name}</div>
                                <div className="template-meta">
                                  <span className={`difficulty-badge ${template.difficulty}`}>
                                    {difficultyInfo[template.difficulty].icon} {template.difficulty}
                                  </span>
                                  <span className={`type-badge ${template.quest_type}`}>
                                    {questTypeInfo[template.quest_type].icon}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="template-description">
                              {template.description}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quest Form */}
          <form className="quest-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Quest Name ⚔️</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  placeholder="Enter quest name"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Quest Emoji 😀</label>
                <input 
                  type="text" 
                  className="form-input emoji-input"
                  value={form.emoji} 
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })} 
                  placeholder="🏋️"
                  maxLength="2"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category 📂</label>
                <select 
                  className="form-select"
                  value={form.category} 
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  required
                >
                  <option value="">Select Category</option>
                  <option value="Combat">Combat ⚔️</option>
                  <option value="Magic">Magic 🔮</option>
                  <option value="Defense">Defense 🛡️</option>
                  <option value="Resources">Resources 💰</option>
                  <option value="Custom">Custom ⭐</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Difficulty 🎯</label>
                <select 
                  className="form-select"
                  value={form.difficulty} 
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                >
                  <option value="light">🟢 Light (5-15 dmg)</option>
                  <option value="medium">🟡 Medium (10-25 dmg)</option>
                  <option value="heavy">🔴 Heavy (20-40 dmg)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Quest Type ⚡</label>
                <select 
                  className="form-select"
                  value={form.quest_type} 
                  onChange={(e) => setForm({ ...form, quest_type: e.target.value })}
                >
                  <option value="attack">⚔️ Attack (Direct damage)</option>
                  <option value="defense">🛡️ Defense (Shields & protection)</option>
                  <option value="healing">💚 Healing (Recovery & buffs)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Frequency ⏰</label>
                <select 
                  className="form-select"
                  value={form.frequency} 
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                >
                  <option value="daily">🌅 Daily</option>
                  <option value="weekly">📅 Weekly</option>
                  <option value="monthly">🗓️ Monthly</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Value 🎯</label>
                <div className="target-input-group">
                  <select 
                    className="comparison-select"
                    value={form.comparison} 
                    onChange={(e) => setForm({ ...form, comparison: e.target.value })}
                  >
                    <option value="greater_equal">≥</option>
                    <option value="less_equal">≤</option>
                  </select>
                  <input 
                    type="number" 
                    className="form-input target-input"
                    value={form.target_value} 
                    onChange={(e) => setForm({ ...form, target_value: e.target.value })} 
                    min="0"
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="rpg-button attack-button submit-btn">
                {editing ? '💾 Save Quest' : '⚡ Create Quest'}
              </button>
              {editing && (
                <button 
                  type="button" 
                  className="rpg-button cancel-btn"
                  onClick={resetForm}
                >
                  ❌ Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}