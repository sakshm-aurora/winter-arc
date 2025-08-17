import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { HPBar } from './StatBars';

export function BossFightPanel({ className = '' }) {
  const { api } = useAuth();
  const [bossData, setBossData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attacking, setAttacking] = useState(false);
  const [bossReaction, setBossReaction] = useState('');

  useEffect(() => {
    fetchBossData();
  }, []);

  const fetchBossData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/boss-fights/current');
      setBossData(res.data);
    } catch (err) {
      console.error('Error fetching boss data:', err);
    } finally {
      setLoading(false);
    }
  };

  const attackBoss = async () => {
    try {
      setAttacking(true);
      const res = await api.post('/boss-fights/attack');
      
      setBossReaction(res.data.boss_reaction);
      
      // Refresh boss data
      await fetchBossData();
      
      // Clear reaction after a few seconds
      setTimeout(() => setBossReaction(''), 5000);
    } catch (err) {
      console.error('Error attacking boss:', err);
      setBossReaction('💢 Attack failed! No damage dealt today.');
      setTimeout(() => setBossReaction(''), 3000);
    } finally {
      setAttacking(false);
    }
  };

  if (loading) {
    return (
      <div className={`boss-fight-panel loading ${className}`}>
        <div className="loading-content">
          <span className="loading-spinner-rpg">🐉</span>
          <p className="neon-text">Loading Monthly Boss...</p>
        </div>
      </div>
    );
  }

  if (!bossData) {
    return (
      <div className={`boss-fight-panel error ${className}`}>
        <p className="error-text">No boss fight available</p>
      </div>
    );
  }

  const { boss, participating_battles, progress_percentage } = bossData;
  const bossDefeated = boss.boss_hp <= 0;

  return (
    <div className={`boss-fight-panel ${className}`}>
      {/* Boss Header */}
      <div className="boss-header">
        <h2 className="neon-text boss-title">
          🌨️ Monthly Boss Fight ❄️
        </h2>
        <div className="boss-subtitle">
          Cooperative Challenge - All Heroes Unite!
        </div>
      </div>

      {/* Boss Display */}
      <div className="boss-display">
        <div className="boss-avatar">
          <div className="boss-image">
            <span className="boss-emoji">🐉</span>
            {bossDefeated && <div className="defeat-overlay">💀</div>}
          </div>
          <div className="boss-name">
            {boss.boss_name}
          </div>
        </div>

        {/* Boss HP Bar */}
        <div className="boss-hp-container">
          <HPBar 
            current={boss.boss_hp} 
            max={boss.boss_max_hp} 
            animated={true}
          />
          <div className="boss-hp-text">
            {boss.boss_hp.toLocaleString()} / {boss.boss_max_hp.toLocaleString()} HP
          </div>
          <div className="progress-text">
            {progress_percentage}% defeated
          </div>
        </div>

        {/* Boss Reaction */}
        {bossReaction && (
          <div className="boss-reaction">
            <div className="reaction-bubble">
              {bossReaction}
            </div>
          </div>
        )}
      </div>

      {/* Battle Actions */}
      {!bossDefeated && (
        <div className="boss-actions">
          <button 
            className="rpg-button attack-button boss-attack"
            onClick={attackBoss}
            disabled={attacking}
          >
            {attacking ? '⚔️ ATTACKING...' : '🚀 LAUNCH DAILY ASSAULT!'}
          </button>
          <div className="attack-description">
            Complete quests today to deal damage to the boss!
          </div>
        </div>
      )}

      {/* Boss Status */}
      {bossDefeated && (
        <div className="boss-defeated">
          <div className="victory-message">
            🎉 BOSS DEFEATED! 🎉
          </div>
          <div className="victory-description">
            The forces of winter have been vanquished by the combined might of all heroes!
          </div>
        </div>
      )}

      {/* Participating Battles */}
      <div className="participating-battles">
        <h3 className="section-title">⚔️ Allied Forces</h3>
        <div className="battles-list">
          {participating_battles.slice(0, 5).map((battle, index) => (
            <div key={battle.id} className="battle-contribution">
              <div className="battle-players">
                {battle.player1_name} vs {battle.player2_name}
              </div>
              <div className="damage-contributed">
                💥 {(battle.total_damage_contributed || 0).toLocaleString()} damage
              </div>
            </div>
          ))}
          {participating_battles.length > 5 && (
            <div className="more-battles">
              +{participating_battles.length - 5} more alliances...
            </div>
          )}
        </div>
      </div>

      {/* Boss Abilities */}
      <div className="boss-abilities">
        <h4 className="abilities-title">🔮 Boss Abilities</h4>
        <div className="abilities-list">
          {(() => {
            try {
              const abilities = boss.boss_abilities ? JSON.parse(boss.boss_abilities) : [];
              return abilities.map((ability, index) => (
                <div key={index} className="ability-item">
                  ⚡ {ability}
                </div>
              ));
            } catch (err) {
              console.error("Invalid boss abilities JSON:", err);
              return null;
            }
          })()}
        </div>
      </div>
    </div>
  );
}

export function BossHistory({ className = '' }) {
  const { api } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/boss-fights/history');
      setHistory(res.data);
    } catch (err) {
      console.error('Error fetching boss history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`boss-history loading ${className}`}>
        <div className="loading-spinner-rpg">📜</div>
      </div>
    );
  }

  return (
    <div className={`boss-history ${className}`}>
      <h3 className="neon-purple-text">📜 Hall of Victories</h3>
      <div className="history-list">
        {history.map((boss) => (
          <div key={boss.id} className="history-item">
            <div className="boss-info">
              <span className="boss-name">{boss.boss_name}</span>
              <span className="boss-month">{boss.month_year}</span>
            </div>
            <div className="defeat-info">
              <span className="defeat-date">
                Defeated: {new Date(boss.completed_at).toLocaleDateString()}
              </span>
              <span className="victory-icon">🏆</span>
            </div>
          </div>
        ))}
      </div>
      {history.length === 0 && (
        <div className="empty-history">
          <span className="empty-icon">👻</span>
          <p>No bosses defeated yet. Be the first heroes!</p>
        </div>
      )}
    </div>
  );
}
