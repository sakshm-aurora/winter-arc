import React, { useState, useEffect } from 'react';

export function DailyResultsTracker({ 
  battleId, 
  currentUser, 
  onResultsUpdate = () => {} 
}) {
  const [dailyResults, setDailyResults] = useState([]);
  const [weeklyResults, setWeeklyResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('week'); // 'day', 'week', 'month'

  useEffect(() => {
    if (battleId) {
      fetchResults();
    }
  }, [battleId, selectedTimeframe]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/battle-results/${battleId}?timeframe=${selectedTimeframe}`);
      const data = await response.json();
      
      if (selectedTimeframe === 'day') {
        setDailyResults(data.results || []);
      } else if (selectedTimeframe === 'week') {
        setWeeklyResults(data.results || []);
      }
      
      onResultsUpdate(data);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getResultIcon = (outcome) => {
    switch (outcome) {
      case 'victory': return '🏆';
      case 'defeat': return '💀';
      case 'draw': return '🤝';
      default: return '⚔️';
    }
  };

  const getResultColor = (outcome) => {
    switch (outcome) {
      case 'victory': return 'var(--crit-gold)';
      case 'defeat': return 'var(--damage-red)';
      case 'draw': return 'var(--frozen-silver)';
      default: return 'var(--frost-blue)';
    }
  };

  if (loading) {
    return (
      <div className="results-tracker loading">
        <div className="loading-spinner">
          <span className="loading-text">📊 Loading battle analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="results-tracker">
      <div className="tracker-header">
        <h3 className="neon-text">📈 Battle Analytics</h3>
        <div className="timeframe-selector">
          {['day', 'week', 'month'].map(timeframe => (
            <button
              key={timeframe}
              className={`timeframe-btn ${selectedTimeframe === timeframe ? 'active' : ''}`}
              onClick={() => setSelectedTimeframe(timeframe)}
            >
              {timeframe === 'day' ? '📅 Daily' : 
               timeframe === 'week' ? '📊 Weekly' : 
               '📆 Monthly'}
            </button>
          ))}
        </div>
      </div>

      <div className="results-content">
        {selectedTimeframe === 'day' && (
          <DailyView results={dailyResults} currentUser={currentUser} />
        )}
        
        {selectedTimeframe === 'week' && (
          <WeeklyView results={weeklyResults} currentUser={currentUser} />
        )}
        
        {selectedTimeframe === 'month' && (
          <MonthlyView battleId={battleId} currentUser={currentUser} />
        )}
      </div>
    </div>
  );
}

function DailyView({ results, currentUser }) {
  const last7Days = results.slice(-7);
  
  return (
    <div className="daily-view">
      <div className="daily-grid">
        {last7Days.map((day, index) => {
          const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
          const userResult = day.participants?.find(p => p.user_id === currentUser.id);
          const opponentResult = day.participants?.find(p => p.user_id !== currentUser.id);
          
          return (
            <div key={day.date} className="daily-card">
              <div className="day-header">
                <span className="day-name">{dayName}</span>
                <span className="day-number">Day {day.battle_day}</span>
              </div>
              
              <div className="day-results">
                {userResult && (
                  <div className="player-result user">
                    <div className="result-icon">
                      {getResultIcon(userResult.outcome)}
                    </div>
                    <div className="result-stats">
                      <div className="stat">
                        <span className="label">DMG</span>
                        <span className="value">{userResult.damage_dealt}</span>
                      </div>
                      <div className="stat">
                        <span className="label">XP</span>
                        <span className="value">{userResult.xp_gained}</span>
                      </div>
                      <div className="stat">
                        <span className="label">QST</span>
                        <span className="value">{userResult.quests_completed}/{userResult.total_quests}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="vs-indicator">VS</div>
                
                {opponentResult && (
                  <div className="player-result opponent">
                    <div className="result-icon">
                      {getResultIcon(opponentResult.outcome)}
                    </div>
                    <div className="result-stats">
                      <div className="stat">
                        <span className="label">DMG</span>
                        <span className="value">{opponentResult.damage_dealt}</span>
                      </div>
                      <div className="stat">
                        <span className="label">XP</span>
                        <span className="value">{opponentResult.xp_gained}</span>
                      </div>
                      <div className="stat">
                        <span className="label">QST</span>
                        <span className="value">{opponentResult.quests_completed}/{opponentResult.total_quests}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {day.special_events && day.special_events.length > 0 && (
                <div className="special-events">
                  {day.special_events.slice(0, 2).map((event, idx) => (
                    <span key={idx} className="event-badge">
                      {event.emoji} {event.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyView({ results, currentUser }) {
  const weeklyStats = results.map(week => {
    const userStats = week.participants?.find(p => p.user_id === currentUser.id) || {};
    const opponentStats = week.participants?.find(p => p.user_id !== currentUser.id) || {};
    
    return {
      ...week,
      userStats,
      opponentStats,
      winner: userStats.total_damage > opponentStats.total_damage ? 'user' : 
              opponentStats.total_damage > userStats.total_damage ? 'opponent' : 'draw'
    };
  });

  return (
    <div className="weekly-view">
      <div className="weekly-summary">
        <div className="summary-card">
          <h4 className="summary-title">🏆 Weekly Performance</h4>
          <div className="summary-stats">
            <div className="summary-stat">
              <span className="stat-label">Wins</span>
              <span className="stat-value win">
                {weeklyStats.filter(w => w.winner === 'user').length}
              </span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Losses</span>
              <span className="stat-value loss">
                {weeklyStats.filter(w => w.winner === 'opponent').length}
              </span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Draws</span>
              <span className="stat-value draw">
                {weeklyStats.filter(w => w.winner === 'draw').length}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="weekly-history">
        {weeklyStats.slice(-4).map((week, index) => (
          <div key={week.week_start} className={`weekly-card ${week.winner}`}>
            <div className="week-header">
              <span className="week-label">Week {week.week_number}</span>
              <span className="week-outcome">
                {week.winner === 'user' ? '🏆 Victory' : 
                 week.winner === 'opponent' ? '💀 Defeat' : 
                 '🤝 Draw'}
              </span>
            </div>
            
            <div className="week-stats">
              <div className="player-week-stats user">
                <div className="player-name">You</div>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-icon">⚔️</span>
                    <span className="stat-number">{week.userStats.total_damage || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">⭐</span>
                    <span className="stat-number">{week.userStats.total_xp || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">🎯</span>
                    <span className="stat-number">{week.userStats.quests_completed || 0}</span>
                  </div>
                </div>
              </div>
              
              <div className="vs-divider">VS</div>
              
              <div className="player-week-stats opponent">
                <div className="player-name">Opponent</div>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-icon">⚔️</span>
                    <span className="stat-number">{week.opponentStats.total_damage || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">⭐</span>
                    <span className="stat-number">{week.opponentStats.total_xp || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">🎯</span>
                    <span className="stat-number">{week.opponentStats.quests_completed || 0}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {week.tournament_reward && (
              <div className="tournament-reward">
                <span className="reward-icon">{week.tournament_reward.emoji}</span>
                <span className="reward-text">{week.tournament_reward.description}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyView({ battleId, currentUser }) {
  const [monthlyData, setMonthlyData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonthlyData();
  }, [battleId]);

  const fetchMonthlyData = async () => {
    try {
      const response = await fetch(`/api/battle-results/${battleId}/monthly`);
      const data = await response.json();
      setMonthlyData(data);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-monthly">Loading monthly data...</div>;
  }

  if (!monthlyData) {
    return <div className="no-monthly-data">No monthly data available</div>;
  }

  return (
    <div className="monthly-view">
      <div className="month-header">
        <h4 className="month-title">🌨️ {monthlyData.month_name} Arc Summary</h4>
        <div className="month-progress">
          <span>Day {monthlyData.current_day} of {monthlyData.total_days}</span>
        </div>
      </div>
      
      <div className="monthly-stats">
        <div className="overall-performance">
          <div className="performance-card">
            <h5>📊 Your Performance</h5>
            <div className="perf-grid">
              <div className="perf-item">
                <span className="perf-label">Total Damage</span>
                <span className="perf-value">{monthlyData.user_stats?.total_damage || 0}</span>
              </div>
              <div className="perf-item">
                <span className="perf-label">Total XP</span>
                <span className="perf-value">{monthlyData.user_stats?.total_xp || 0}</span>
              </div>
              <div className="perf-item">
                <span className="perf-label">Best Streak</span>
                <span className="perf-value">{monthlyData.user_stats?.best_streak || 0}</span>
              </div>
              <div className="perf-item">
                <span className="perf-label">Completion Rate</span>
                <span className="perf-value">
                  {Math.round((monthlyData.user_stats?.completion_rate || 0) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {monthlyData.boss_fight && (
          <div className="boss-fight-summary">
            <h5>🐉 Boss Fight Status</h5>
            <div className="boss-info">
              <div className="boss-details">
                <span className="boss-name">{monthlyData.boss_fight.boss_name}</span>
                <div className="boss-hp-bar">
                  <div 
                    className="boss-hp-fill"
                    style={{ 
                      width: `${(monthlyData.boss_fight.current_hp / monthlyData.boss_fight.max_hp) * 100}%` 
                    }}
                  />
                  <span className="boss-hp-text">
                    {monthlyData.boss_fight.current_hp} / {monthlyData.boss_fight.max_hp} HP
                  </span>
                </div>
              </div>
              <div className="boss-status">
                {monthlyData.boss_fight.status === 'defeated' ? '🏆 Defeated!' :
                 monthlyData.boss_fight.status === 'escaped' ? '💨 Escaped' :
                 '⚔️ In Progress'}
              </div>
            </div>
            
            {monthlyData.boss_fight.rewards && (
              <div className="boss-rewards">
                <span className="rewards-label">Rewards:</span>
                {monthlyData.boss_fight.rewards.map((reward, idx) => (
                  <span key={idx} className="reward-item">
                    {reward.emoji} {reward.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="achievements-summary">
          <h5>🏅 Monthly Achievements</h5>
          <div className="achievements-grid">
            {monthlyData.achievements?.map((achievement, idx) => (
              <div key={idx} className="achievement-item">
                <span className="achievement-icon">{achievement.emoji}</span>
                <span className="achievement-name">{achievement.name}</span>
              </div>
            )) || <span className="no-achievements">No achievements yet this month</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DailyResultsTracker;
