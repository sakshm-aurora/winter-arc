import React, { useState, useEffect } from 'react';
import { CombatStats } from './StatBars';
import { RPGAvatar, PlayerCard, StatusEffects } from './Avatar';
import { BattleLog, BattleHeader, CombatFloatingText } from './BattleLog';
import { fetchLockedQuests, isQuestLocked, getQuestLockInfo, formatLockReason } from '../../utils/questLocking';
import { useAuth } from '../../context/AuthContext';

export function BattleArena({ 
  battle, 
  currentUser, 
  logs = [], 
  onSubmitCheckins,
  quests = [],
  isLoading = false 
}) {
  const { api } = useAuth();
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [checkinData, setCheckinData] = useState({});
  const [showCheckinPanel, setShowCheckinPanel] = useState(false);
  const [lockedQuests, setLockedQuests] = useState([]);

  const isPlayer1 = battle.player1_id === currentUser.id;
  
  const player1 = {
    id: battle.player1_id,
    name: battle.player1_name,
    hp: battle.player1_hp || 100,
    maxHp: 100,
    xp: battle.player1_xp || 0,
    maxXp: 200,
    streak: battle.player1_streak || 0,
    level: Math.floor((battle.player1_xp || 0) / 50) + 1,
    playerClass: 'mage', // This could come from user preferences
    statusEffects: []
  };

  const player2 = {
    id: battle.player2_id,
    name: battle.player2_name,
    hp: battle.player2_hp || 100,
    maxHp: 100,
    xp: battle.player2_xp || 0,
    maxXp: 200,
    streak: battle.player2_streak || 0,
    level: Math.floor((battle.player2_xp || 0) / 50) + 1,
    playerClass: 'warrior', // This could come from user preferences
    statusEffects: []
  };

  const currentPlayer = isPlayer1 ? player1 : player2;
  const opponent = isPlayer1 ? player2 : player1;

  useEffect(() => {
    // Initialize checkin data
    const init = {};
    quests.forEach((q) => {
      init[q.id] = { completed: false, value: '' };
    });
    setCheckinData(init);
    
    // Fetch locked quests
    if (battle?.id) {
      fetchLockedQuests(api, battle.id).then(setLockedQuests);
    }
  }, [quests, battle?.id, api]);

  const handleCheckinChange = (questId, field, value) => {
    setCheckinData({
      ...checkinData,
      [questId]: {
        ...checkinData[questId],
        [field]: value,
      },
    });
  };

  const handleSubmitCheckins = async () => {
    // Filter out locked quests and only include selected ones
    const results = Object.entries(checkinData)
      .filter(([qid, data]) => 
        data.completed && 
        !isQuestLocked(parseInt(qid, 10), lockedQuests)
      )
      .map(([qid, data]) => ({
        quest_id: parseInt(qid, 10),
        completed: data.completed,
        value: data.value === '' ? null : parseInt(data.value, 10),
      }));
    
    if (results.length === 0) {
      const hasLockedSelected = Object.entries(checkinData).some(([qid, data]) => 
        data.completed && 
        isQuestLocked(parseInt(qid, 10), lockedQuests)
      );
      
      if (hasLockedSelected) {
        addFloatingText('🔒 Some selected quests are locked!', 'damage', 400, 200);
        return;
      } else {
        addFloatingText('⚠️ Select at least one quest!', 'damage', 400, 200);
        return;
      }
    }
    
    try {
      const result = await onSubmitCheckins(results);
      
      // Reset only non-locked quest data
      const resetData = { ...checkinData };
      Object.keys(checkinData).forEach(qid => {
        if (!isQuestLocked(parseInt(qid, 10), lockedQuests)) {
          resetData[qid] = { completed: false, value: '' };
        }
      });
      setCheckinData(resetData);
      
      setShowCheckinPanel(false);
      
      // Refresh locked quests after submission
      if (battle?.id) {
        fetchLockedQuests(api, battle.id).then(setLockedQuests);
      }
      
      // Show floating text effect
      addFloatingText('Quest Complete! 🎯', 'heal', 400, 300);
      
      // Handle submission result
      if (result?.locked_quests?.length > 0) {
        setTimeout(() => {
          addFloatingText(`🔒 ${result.locked_quests.length} quest(s) locked`, 'damage', 400, 250);
        }, 500);
      }
    } catch (error) {
      console.error('Checkin submission error:', error);
      addFloatingText('❌ Submission failed!', 'damage', 400, 200);
    }
  };

  const addFloatingText = (text, type, x, y) => {
    const id = Date.now();
    setFloatingTexts(prev => [...prev, { id, text, type, x, y }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
    }, 2500);
  };

  const dayCount = Math.floor((Date.now() - new Date(battle.started_at).getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (isLoading) {
    return (
      <div className="battle-arena loading">
        <div className="loading-spinner">
          <span className="neon-text">❄️ Loading Battle Arena... ⚔️</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rpg-container">
      {/* Aurora Background Effect */}
      <div className="aurora-bg" />
      <div className="battlefield-overlay" />

      {/* Floating Combat Text */}
      {floatingTexts.map(ft => (
        <CombatFloatingText
          key={ft.id}
          text={ft.text}
          type={ft.type}
          x={ft.x}
          y={ft.y}
          onComplete={() => setFloatingTexts(prev => prev.filter(f => f.id !== ft.id))}
        />
      ))}

      <div className="battle-arena">
        {/* Left Player Side */}
        <div className="player-side left">
          <div className="player-info">
            <h2 className="neon-text text-center mb-4">YOU</h2>
            <RPGAvatar 
              userId={currentPlayer.id}
              userName={currentPlayer.name}
              playerClass={currentPlayer.playerClass}
              level={currentPlayer.level}
              size="xlarge"
              showClassBadge={true}
              isActive={true}
            />
            <StatusEffects effects={currentPlayer.statusEffects} />
          </div>
          
          <div className="player-stats-container">
            <CombatStats
              hp={currentPlayer.hp}
              maxHp={currentPlayer.maxHp}
              xp={currentPlayer.xp}
              maxXp={currentPlayer.maxXp}
              level={currentPlayer.level}
              streak={currentPlayer.streak}
            />
          </div>

          <div className="player-actions">
            <button 
              className="rpg-button attack-button"
              onClick={() => setShowCheckinPanel(!showCheckinPanel)}
            >
              ⚔️ DAILY ATTACK
            </button>
          </div>
        </div>

        {/* Center Battle Log */}
        <div className="battle-center">
          <BattleHeader dayCount={dayCount} season="Winter Arc" />
          <BattleLog 
            logs={logs} 
            title="Battle Chronicle"
            className="main-battle-log"
          />
        </div>

        {/* Right Opponent Side */}
        <div className="player-side right">
          <div className="player-info">
            <h2 className="neon-purple-text text-center mb-4">OPPONENT</h2>
            <RPGAvatar 
              userId={opponent.id}
              userName={opponent.name}
              playerClass={opponent.playerClass}
              level={opponent.level}
              size="xlarge"
              showClassBadge={true}
            />
            <StatusEffects effects={opponent.statusEffects} />
          </div>
          
          <div className="player-stats-container">
            <CombatStats
              hp={opponent.hp}
              maxHp={opponent.maxHp}
              xp={opponent.xp}
              maxXp={opponent.maxXp}
              level={opponent.level}
              streak={opponent.streak}
            />
          </div>

          <div className="opponent-status">
            <div className="neon-purple-text text-center">
              {opponent.name}'s Turn...
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Checkin Panel */}
      {showCheckinPanel && (
        <div className="checkin-overlay">
          <div className="checkin-panel">
            <div className="checkin-header">
              <h3 className="neon-text">⚔️ Available Quests Attack</h3>
              <div className="quest-availability-info">
                <small className="availability-note">
                  Only showing quests available right now. Weekly quests appear on weekends, monthly quests during last 3 days of month.
                </small>
              </div>
              <button 
                className="close-button"
                onClick={() => setShowCheckinPanel(false)}
              >
                ❌
              </button>
            </div>
            
            <div className="checkin-content">
              {quests.length === 0 ? (
                <div className="no-quests-available">
                  <div className="empty-quest-state">
                    <span style={{ fontSize: '48px' }}>🕒</span>
                    <h4 className="neon-purple-text">No Quests Available</h4>
                    <p className="text-gray-300">
                      Weekly quests appear on weekends (Sat-Sun)<br/>
                      Monthly quests appear during last 3 days of month<br/>
                      Daily quests are always available
                    </p>
                    <p className="text-gray-400">
                      <small>Go to Quests page to create daily quests</small>
                    </p>
                  </div>
                </div>
              ) : (
                quests.map((quest) => {
                  const locked = isQuestLocked(quest.id, lockedQuests);
                  const lockInfo = getQuestLockInfo(quest.id, lockedQuests);
                  
                  return (
                  <div 
                    key={quest.id} 
                    className={`quest-checkin ${locked ? 'quest-locked' : ''}`}
                    title={locked ? formatLockReason(lockInfo.reason, lockInfo.nextAvailable) : ''}
                  >
                    <div className="quest-info">
                      <span className="quest-emoji">{quest.emoji}</span>
                      <span className="quest-name">
                        {quest.name}
                        {locked && <span className="lock-icon">🔒</span>}
                      </span>
                      <span className="quest-target">
                        Target: {quest.comparison === 'greater_equal' ? '≥' : '≤'} {quest.target_value}
                      </span>
                      <span className="quest-frequency">{quest.frequency}</span>
                    </div>
                    
                    {locked ? (
                      <div className="quest-locked-info">
                        <span className="lock-message">
                          {formatLockReason(lockInfo.reason, lockInfo.nextAvailable)}
                        </span>
                      </div>
                    ) : (
                      <div className="quest-inputs">
                        <label className="quest-checkbox">
                          <input 
                            type="checkbox" 
                            checked={checkinData[quest.id]?.completed || false}
                            onChange={(e) => handleCheckinChange(quest.id, 'completed', e.target.checked)}
                          />
                          <span className="checkmark">✅</span>
                          Completed
                        </label>
                        
                        <input 
                          type="number" 
                          placeholder="Value"
                          className="quest-value-input"
                          value={checkinData[quest.id]?.value || ''}
                          onChange={(e) => handleCheckinChange(quest.id, 'value', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  );
                })
              )}
              
              {quests.length > 0 && (
                <button 
                  className="rpg-button attack-button submit-attack"
                  onClick={handleSubmitCheckins}
                  disabled={!Object.values(checkinData).some(data => data.completed)}
                >
                  🚀 LAUNCH ATTACK!
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BattleSelector({ battles, currentUser, onSelectBattle, selectedBattleId }) {
  return (
    <div className="battle-selector">
      <h2 className="neon-text text-center mb-6">⚔️ Active Battles ❄️</h2>
      
      {battles.length === 0 ? (
        <div className="no-battles">
          <div className="empty-state">
            <span style={{ fontSize: '64px' }}>❄️</span>
            <h3 className="neon-purple-text">No Active Battles</h3>
            <p className="text-gray-300">
              Challenge friends to epic winter battles!<br />
              Go to Invites to start your first battle.
            </p>
          </div>
        </div>
      ) : (
        <div className="battle-list">
          {battles.map((battle) => {
            const isPlayer1 = battle.player1_id === currentUser.id;
            const opponent = isPlayer1 ? battle.player2_name : battle.player1_name;
            const myHp = isPlayer1 ? battle.player1_hp : battle.player2_hp;
            const oppHp = isPlayer1 ? battle.player2_hp : battle.player1_hp;
            const myXp = isPlayer1 ? battle.player1_xp : battle.player2_xp;
            const myStreak = isPlayer1 ? battle.player1_streak : battle.player2_streak;
            
            return (
              <div 
                key={battle.id}
                className={`battle-card ${selectedBattleId === battle.id ? 'selected' : ''}`}
                onClick={() => onSelectBattle(battle)}
              >
                <div className="battle-card-header">
                  <h4 className="battle-title">
                    ⚔️ Battle #{battle.id}
                  </h4>
                  <div className="battle-opponent">
                    vs {opponent} ❄️
                  </div>
                </div>
                
                <div className="battle-card-stats">
                  <div className="stat-row">
                    <span>❤️ Your HP: {myHp}/100</span>
                    <span>💀 Opponent: {oppHp}/100</span>
                  </div>
                  <div className="stat-row">
                    <span>⭐ Your XP: {myXp}</span>
                    <span>🔥 Streak: {myStreak}</span>
                  </div>
                </div>
                
                <div className="battle-card-footer">
                  <span className="battle-status">
                    {battle.status === 'active' ? '🟢 Active' : '⏸️ Paused'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
