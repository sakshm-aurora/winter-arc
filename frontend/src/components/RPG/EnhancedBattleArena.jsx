import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BattleArena } from './BattleArena';
import { BossFightPanel } from './BossFight';
import { WeeklyTournament, Leaderboard } from './Tournament';
import { StatusEffects } from './Avatar';
import { LockedTabContent } from './LockedFeature';
import { useFeatureLocks } from '../../utils/featureLocks';

export function EnhancedBattleArena({ 
  battle, 
  currentUser, 
  logs = [], 
  onSubmitCheckins,
  quests = [],
  isLoading = false,
  userStats = {},
  battleStats = {}
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('battle');
  const [battleEvents, setBattleEvents] = useState([]);
  const [floatingTexts, setFloatingTexts] = useState([]);

  // Feature locking system
  const { isUnlocked, getProgress } = useFeatureLocks(
    userStats, 
    battleStats, 
    quests.length
  );

  const tabs = [
    { id: 'battle', label: 'Battle Arena', icon: '⚔️', feature: 'BATTLES' },
    { id: 'tournament', label: 'Tournament', icon: '🏆', feature: 'TOURNAMENTS' },
    { id: 'boss', label: 'Boss Fight', icon: '🐉', feature: 'BOSS_FIGHTS' },
    { id: 'leaderboard', label: 'Leaderboard', icon: '👑', feature: 'LEADERBOARD' }
  ];

  const handleSubmitCheckins = async (checkinResults) => {
    try {
      const result = await onSubmitCheckins(checkinResults);
      
      // Show floating combat text for results
      if (result?.results) {
        showCombatResults(result.results);
      }
      
      // Handle special events
      if (result?.random_event) {
        showRandomEvent(result.random_event);
      }
      
      if (result?.weekly_tournament) {
        showTournamentAlert(result.weekly_tournament);
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  };

  const showCombatResults = (results) => {
    const { damage_dealt, xp_gained, combo_multiplier, critical_hits } = results;
    
    // Show damage
    if (damage_dealt > 0) {
      addFloatingText(`💥 ${damage_dealt} DAMAGE!`, 'damage', 400, 200);
    }
    
    // Show XP gain
    if (xp_gained > 0) {
      addFloatingText(`⭐ +${xp_gained} XP`, 'heal', 600, 220);
    }
    
    // Show combo
    if (combo_multiplier > 1.0) {
      addFloatingText(`🔥 ${combo_multiplier}x COMBO!`, 'crit', 500, 180);
    }
    
    // Show critical hits
    if (critical_hits > 0) {
      addFloatingText(`🎯 CRITICAL HIT!`, 'crit', 520, 160);
    }
  };

  const showRandomEvent = (event) => {
    addFloatingText(`${event.emoji} ${event.event_name}!`, 'special', 500, 250);
  };

  const showTournamentAlert = (tournament) => {
    addFloatingText(`🏆 ${tournament.winner} WINS TOURNAMENT!`, 'special', 500, 140);
  };

  const addFloatingText = (text, type, x, y) => {
    const id = Date.now() + Math.random();
    setFloatingTexts(prev => [...prev, { id, text, type, x, y }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
    }, 3000);
  };

  return (
    <div className="enhanced-battle-arena">
      {/* Battle Navigation Tabs */}
      <div className="battle-tabs">
        {tabs.map(tab => {
          const unlockStatus = isUnlocked(tab.feature);
          const isLocked = !unlockStatus.unlocked;
          
          return (
            <button
              key={tab.id}
              className={`battle-tab ${activeTab === tab.id ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
              onClick={() => {
                if (!isLocked) {
                  setActiveTab(tab.id);
                }
              }}
              title={isLocked ? unlockStatus.message : ''}
              disabled={isLocked}
            >
              <span className="tab-icon">
                {isLocked ? '🔒' : tab.icon}
              </span>
              <span className="tab-label">{tab.label}</span>
              {isLocked && (
                <span className="lock-indicator">🔒</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Floating Combat Text */}
      {floatingTexts.map(ft => (
        <div
          key={ft.id}
          className={`floating-text ${ft.type}`}
          style={{ 
            left: `${ft.x}px`, 
            top: `${ft.y}px`,
            position: 'absolute',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          {ft.text}
        </div>
      ))}

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'battle' && (
          <div className="battle-tab-content">
            <BattleArena
              battle={battle}
              currentUser={currentUser}
              logs={logs}
              quests={quests}
              onSubmitCheckins={handleSubmitCheckins}
              isLoading={isLoading}
            />
            
            {/* Enhanced Battle Info Panel */}
            <div className="battle-info-panel">
              <BattleStatusPanel battle={battle} currentUser={currentUser} />
            </div>
          </div>
        )}

        {activeTab === 'tournament' && (
          isUnlocked('TOURNAMENTS').unlocked ? (
            <WeeklyTournament 
              battleId={battle?.id} 
              className="tournament-tab-content"
            />
          ) : (
            <LockedTabContent
              tabName="Tournament"
              unlockRequirement={isUnlocked('TOURNAMENTS').requirement}
              progress={getProgress('TOURNAMENTS')}
              onNavigateToUnlock={(path) => navigate(path)}
            />
          )
        )}

        {activeTab === 'boss' && (
          isUnlocked('BOSS_FIGHTS').unlocked ? (
            <BossFightPanel className="boss-tab-content" />
          ) : (
            <LockedTabContent
              tabName="Boss Fight"
              unlockRequirement={isUnlocked('BOSS_FIGHTS').requirement}
              progress={getProgress('BOSS_FIGHTS')}
              onNavigateToUnlock={(path) => navigate(path)}
            />
          )
        )}

        {activeTab === 'leaderboard' && (
          isUnlocked('LEADERBOARD').unlocked ? (
            <Leaderboard className="leaderboard-tab-content" />
          ) : (
            <LockedTabContent
              tabName="Leaderboard"
              unlockRequirement={isUnlocked('LEADERBOARD').requirement}
              progress={getProgress('LEADERBOARD')}
              onNavigateToUnlock={(path) => navigate(path)}
            />
          )
        )}
      </div>
    </div>
  );
}

function BattleStatusPanel({ battle, currentUser }) {
  const isPlayer1 = battle.player1_id === currentUser.id;
  
  const myStats = {
    hp: isPlayer1 ? battle.player1_hp : battle.player2_hp,
    xp: isPlayer1 ? battle.player1_xp : battle.player2_xp,
    streak: isPlayer1 ? battle.player1_streak : battle.player2_streak,
    level: Math.floor((isPlayer1 ? battle.player1_xp : battle.player2_xp) / 100) + 1,
    statusEffects: [] // Would come from extended battle data
  };

  const opponentStats = {
    hp: isPlayer1 ? battle.player2_hp : battle.player1_hp,
    xp: isPlayer1 ? battle.player2_xp : battle.player1_xp,
    streak: isPlayer1 ? battle.player2_streak : battle.player1_streak,
    level: Math.floor((isPlayer1 ? battle.player2_xp : battle.player1_xp) / 100) + 1
  };

  return (
    <div className="battle-status-panel">
      <h4 className="neon-text">⚔️ Battle Status</h4>
      
      <div className="status-comparison">
        <div className="player-status your-status">
          <h5 className="status-title">YOU</h5>
          <div className="status-stats">
            <div className="status-stat">
              <span className="stat-icon">❤️</span>
              <span className="stat-value">{myStats.hp}</span>
              <span className="stat-label">HP</span>
            </div>
            <div className="status-stat">
              <span className="stat-icon">⭐</span>
              <span className="stat-value">{myStats.level}</span>
              <span className="stat-label">LVL</span>
            </div>
            <div className="status-stat">
              <span className="stat-icon">🔥</span>
              <span className="stat-value">{myStats.streak}</span>
              <span className="stat-label">Streak</span>
            </div>
          </div>
          {myStats.statusEffects.length > 0 && (
            <StatusEffects effects={myStats.statusEffects} />
          )}
        </div>

        <div className="vs-divider">
          <span className="vs-text">VS</span>
        </div>

        <div className="player-status opponent-status">
          <h5 className="status-title">OPPONENT</h5>
          <div className="status-stats">
            <div className="status-stat">
              <span className="stat-icon">💀</span>
              <span className="stat-value">{opponentStats.hp}</span>
              <span className="stat-label">HP</span>
            </div>
            <div className="status-stat">
              <span className="stat-icon">⭐</span>
              <span className="stat-value">{opponentStats.level}</span>
              <span className="stat-label">LVL</span>
            </div>
            <div className="status-stat">
              <span className="stat-icon">🔥</span>
              <span className="stat-value">{opponentStats.streak}</span>
              <span className="stat-label">Streak</span>
            </div>
          </div>
        </div>
      </div>

      {/* Battle Progress */}
      <div className="battle-progress">
        <div className="progress-info">
          <span className="progress-label">Battle Duration</span>
          <span className="progress-value">
            {Math.floor((Date.now() - new Date(battle.started_at).getTime()) / (1000 * 60 * 60 * 24))} days
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <div className="action-hint">
          💡 Complete quests to deal damage and gain XP!
        </div>
      </div>
    </div>
  );
}

export default EnhancedBattleArena;
