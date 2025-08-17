import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export function WeeklyTournament({ battleId, className = '' }) {
  const { api, user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(null);
  const [tournamentHistory, setTournamentHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (battleId) {
      fetchTournamentData();
    }
  }, [battleId]);

  const fetchTournamentData = async () => {
    try {
      setLoading(true);
      const [currentRes, historyRes] = await Promise.all([
        api.get(`/tournaments/current/${battleId}`),
        api.get(`/tournaments/weekly/${battleId}`)
      ]);
      
      setCurrentWeek(currentRes.data);
      setTournamentHistory(historyRes.data);
    } catch (err) {
      console.error('Error fetching tournament data:', err);
    } finally {
      setLoading(false);
    }
  };

  const processTournament = async () => {
    try {
      const res = await api.post(`/tournaments/process/${battleId}`);
      if (res.data.result) {
        await fetchTournamentData(); // Refresh data
      }
    } catch (err) {
      console.error('Error processing tournament:', err);
    }
  };

  if (loading) {
    return (
      <div className={`tournament-panel loading ${className}`}>
        <div className="loading-spinner-rpg">🏆</div>
      </div>
    );
  }

  if (!currentWeek) {
    return (
      <div className={`tournament-panel error ${className}`}>
        <p>Tournament data unavailable</p>
      </div>
    );
  }

  const weekProgress = getWeekProgress(currentWeek.week_start, currentWeek.week_end);

  return (
    <div className={`tournament-panel ${className}`}>
      {/* Tournament Header */}
      <div className="tournament-header">
        <h3 className="neon-text">🏆 Weekly Tournament</h3>
        <div className="tournament-period">
          {formatDateRange(currentWeek.week_start, currentWeek.week_end)}
        </div>
        <div className="week-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${weekProgress}%` }}
            />
          </div>
          <span className="progress-text">{weekProgress}% complete</span>
        </div>
      </div>

      {/* Current Standings */}
      <div className="current-standings">
        <h4 className="section-title">⚔️ Current Standings</h4>
        <div className="players-comparison">
          {currentWeek.players.map((player, index) => {
            const isCurrentUser = player.user_id === user.id;
            const isLeader = player.name === currentWeek.current_leader;
            
            return (
              <div 
                key={player.user_id}
                className={`player-standing ${isCurrentUser ? 'current-user' : ''} ${isLeader ? 'leader' : ''}`}
              >
                <div className="player-info">
                  <div className="player-name">
                    {player.name}
                    {isLeader && <span className="leader-crown">👑</span>}
                    {isCurrentUser && <span className="you-indicator">(YOU)</span>}
                  </div>
                  <div className="player-stats">
                    <div className="stat">❤️ {player.hp} HP</div>
                    <div className="stat">⭐ LVL {player.level}</div>
                    <div className="stat">🔥 {player.streak} streak</div>
                  </div>
                </div>
                
                <div className="weekly-performance">
                  <div className="performance-stat">
                    <span className="stat-label">Quests:</span>
                    <span className="stat-value">{player.quests_completed}</span>
                  </div>
                  <div className="performance-stat">
                    <span className="stat-label">Damage:</span>
                    <span className="stat-value">{player.total_damage_dealt}</span>
                  </div>
                  <div className="performance-stat">
                    <span className="stat-label">Crits:</span>
                    <span className="stat-value">{player.critical_hits}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tournament Result */}
      {currentWeek.tournament_completed && currentWeek.tournament_result && (
        <div className="tournament-result">
          <h4 className="section-title">🎉 Tournament Complete!</h4>
          <TournamentResult result={currentWeek.tournament_result} />
        </div>
      )}

      {/* Debug/Admin Controls */}
      {!currentWeek.tournament_completed && weekProgress >= 100 && (
        <div className="tournament-actions">
          <button 
            className="rpg-button"
            onClick={processTournament}
          >
            🏁 Process Tournament
          </button>
        </div>
      )}

      {/* Tournament History */}
      <div className="tournament-history">
        <h4 className="section-title">📜 Tournament History</h4>
        <div className="history-list">
          {tournamentHistory.slice(0, 5).map((tournament) => (
            <div key={tournament.id} className="history-item">
              <div className="tournament-info">
                <span className="tournament-date">
                  {formatDateRange(tournament.week_start, tournament.week_end)}
                </span>
                <div className="tournament-outcome">
                  <span className="winner">🏆 {tournament.winner_name}</span>
                  <span className="vs">vs</span>
                  <span className="loser">💀 {tournament.loser_name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TournamentResult({ result }) {
  return (
    <div className="tournament-result-display">
      <div className="winner-section">
        <div className="winner-announcement">
          🎉 <span className="winner-name">{result.winner_name}</span> WINS! 🏆
        </div>
        
        {result.winner_reward && (
          <div className="winner-rewards">
            <h5>🎁 Winner Rewards:</h5>
            <div className="reward-item">
              <span className="reward-icon">⭐</span>
              <span className="reward-text">+{result.winner_reward.xp_bonus} XP</span>
            </div>
            <div className="reward-item">
              <span className="reward-icon">🏆</span>
              <span className="reward-text">{result.winner_reward.trophy}</span>
            </div>
            {result.winner_reward.unlock && (
              <div className="reward-item">
                <span className="reward-icon">🔓</span>
                <span className="reward-text">Unlocked: {result.winner_reward.unlock}</span>
              </div>
            )}
            <div className="reward-description">
              {result.winner_reward.description}
            </div>
          </div>
        )}
      </div>

      <div className="loser-section">
        <div className="loser-announcement">
          💀 <span className="loser-name">{result.loser_name}</span> must face the penalty...
        </div>
        
        {result.loser_penalty && (
          <div className="loser-penalties">
            <h5>⚡ Penalty:</h5>
            <div className="penalty-item">
              <span className="penalty-text">{result.loser_penalty.penalty_description}</span>
            </div>
            {result.loser_penalty.xp_reduction > 0 && (
              <div className="penalty-item">
                <span className="penalty-icon">📉</span>
                <span className="penalty-text">-{result.loser_penalty.xp_reduction} XP</span>
              </div>
            )}
            <div className="motivation-message">
              {result.loser_penalty.motivation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Leaderboard({ className = '' }) {
  const { api } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/tournaments/leaderboard');
      setLeaderboard(res.data);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`leaderboard loading ${className}`}>
        <div className="loading-spinner-rpg">👑</div>
      </div>
    );
  }

  return (
    <div className={`leaderboard ${className}`}>
      <div className="leaderboard-header">
        <h3 className="neon-text">👑 Winter Arc Leaderboard</h3>
        <div className="leaderboard-subtitle">
          Hall of Legendary Winter Warriors
        </div>
      </div>

      <div className="leaderboard-list">
        {leaderboard.map((player, index) => {
          const rank = index + 1;
          const rankEmoji = getRankEmoji(rank);
          
          return (
            <div key={player.id} className={`leaderboard-entry rank-${rank}`}>
              <div className="rank-info">
                <span className="rank-number">{rank}</span>
                <span className="rank-emoji">{rankEmoji}</span>
              </div>
              
              <div className="player-info">
                <div className="player-name">{player.name}</div>
                <div className="player-level">Level {player.level}</div>
              </div>
              
              <div className="player-achievements">
                <div className="achievement">
                  <span className="achievement-icon">⭐</span>
                  <span className="achievement-value">{player.total_xp}</span>
                  <span className="achievement-label">Total XP</span>
                </div>
                <div className="achievement">
                  <span className="achievement-icon">🏆</span>
                  <span className="achievement-value">{player.tournament_wins}</span>
                  <span className="achievement-label">Wins</span>
                </div>
                <div className="achievement">
                  <span className="achievement-icon">🔥</span>
                  <span className="achievement-value">{player.best_streak}</span>
                  <span className="achievement-label">Best Streak</span>
                </div>
              </div>
              
              <div className="trophies">
                {(() => {
                  try {
                    const trophies = player.trophies ? JSON.parse(player.trophies) : [];
                    return trophies.slice(0, 3).map((trophy, idx) => (
                      <div key={idx} className="trophy">
                        🏆 {trophy}
                      </div>
                    ));
                  } catch (err) {
                    console.error("Invalid trophies JSON:", err);
                    return null;
                  }
                })()}
              </div>
            </div>
          );
        })}
      </div>
      
      {leaderboard.length === 0 && (
        <div className="empty-leaderboard">
          <span className="empty-icon">❄️</span>
          <p>No warriors have entered the winter battle yet!</p>
        </div>
      )}
    </div>
  );
}

// Utility functions
function getWeekProgress(weekStart, weekEnd) {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  const now = new Date();
  
  if (now >= end) return 100;
  if (now <= start) return 0;
  
  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  
  return Math.round((elapsed / total) * 100);
}

function formatDateRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  const options = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
}

function getRankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank <= 10) return '⭐';
  return '❄️';
}
