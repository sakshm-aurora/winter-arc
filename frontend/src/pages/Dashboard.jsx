import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PlayerCard } from '../components/RPG/Avatar';
import { CombatStats } from '../components/RPG/StatBars';

export default function Dashboard() {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userStats, setUserStats] = useState({
    totalBattles: 0,
    activeBattles: 0,
    totalXP: 0,
    totalStreak: 0,
    level: 1
  });

  useEffect(() => {
    fetchDashboardData();
  }, [api]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/battles');
      setBattles(res.data);
      
      // Calculate user stats
      const activeBattles = res.data.filter(b => b.status === 'active').length;
      let totalXP = 0;
      let maxStreak = 0;
      
      res.data.forEach(battle => {
        const isPlayer1 = battle.player1_id === user.id;
        const myXP = isPlayer1 ? battle.player1_xp || 0 : battle.player2_xp || 0;
        const myStreak = isPlayer1 ? battle.player1_streak || 0 : battle.player2_streak || 0;
        
        totalXP += myXP;
        maxStreak = Math.max(maxStreak, myStreak);
      });
      
      setUserStats({
        totalBattles: res.data.length,
        activeBattles,
        totalXP,
        totalStreak: maxStreak,
        level: Math.floor(totalXP / 100) + 1
      });
      
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 6) return 'Night';
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
  };

  const getSeasonalGreeting = () => {
    const timeOfDay = getTimeOfDay();
    const greetings = {
      'Morning': `Good morning, ${user.name}! ❄️ The winter dawn brings new challenges!`,
      'Afternoon': `Good afternoon, ${user.name}! ☀️ The arctic sun shines upon your battles!`,
      'Evening': `Good evening, ${user.name}! 🌙 Night falls on the winter battleground!`,
      'Night': `Greetings, night warrior ${user.name}! 🌌 The northern lights guide your path!`
    };
    return greetings[timeOfDay];
  };

  const getBattleRecommendation = () => {
    if (battles.length === 0) {
      return {
        icon: '⚔️',
        title: 'Start Your First Battle!',
        description: 'Challenge friends to epic winter combat. Visit Invites to begin your journey.',
        action: 'Go to Invites',
        onClick: () => navigate('/invites')
      };
    }
    
    if (userStats.activeBattles === 0) {
      return {
        icon: '🔥',
        title: 'Rekindle the Fire!',
        description: 'All your battles are complete. Start new challenges to continue your arc.',
        action: 'Find New Battles',
        onClick: () => navigate('/invites')
      };
    }
    
    return {
      icon: '⚡',
      title: 'Continue Your Quest!',
      description: `You have ${userStats.activeBattles} active battle${userStats.activeBattles > 1 ? 's' : ''}. Complete your daily objectives!`,
      action: 'Enter Battle Arena',
      onClick: () => navigate('/battles')
    };
  };

  const recommendation = getBattleRecommendation();

  if (loading) {
    return (
      <div className="rpg-container">
        <div className="aurora-bg" />
        <div className="loading-screen">
          <div className="loading-content">
            <h1 className="neon-text">❄️ Loading Winter Command Center... 🏰</h1>
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
      <div className="battlefield-overlay" />
      
      <div className="dashboard-container">
        {/* Welcome Header */}
        <div className="dashboard-header">
          <div className="welcome-section">
            <h1 className="neon-text welcome-title">
              🏰 Winter Arc Command Center ❄️
            </h1>
            <p className="welcome-message">
              {getSeasonalGreeting()}
            </p>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="dashboard-grid">
          {/* Player Profile Card */}
          <div className="dashboard-card player-profile">
            <div className="card-header">
              <h2 className="neon-purple-text">⚔️ Warrior Profile</h2>
            </div>
            <div className="card-content">
              <PlayerCard
                player={{
                  id: user.id,
                  name: user.name,
                  playerClass: 'mage', // Could be user preference
                  level: userStats.level,
                  hp: 100, // Full health on dashboard
                  maxHp: 100,
                  xp: userStats.totalXP % 100,
                  maxXp: 100,
                  streak: userStats.totalStreak,
                  statusEffects: []
                }}
                showDetails={true}
                className="dashboard-player-card"
              />
            </div>
          </div>

          {/* Stats Overview */}
          <div className="dashboard-card stats-overview">
            <div className="card-header">
              <h2 className="neon-text">📊 Winter Statistics</h2>
            </div>
            <div className="card-content">
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-value">{userStats.level}</div>
                  <div className="stat-label">Level</div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">⭐</div>
                  <div className="stat-value">{userStats.totalXP}</div>
                  <div className="stat-label">Total XP</div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">🔥</div>
                  <div className="stat-value">{userStats.totalStreak}</div>
                  <div className="stat-label">Best Streak</div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">⚔️</div>
                  <div className="stat-value">{userStats.activeBattles}</div>
                  <div className="stat-label">Active Battles</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendation Card */}
          <div className="dashboard-card recommendation">
            <div className="card-header">
              <h2 className="neon-text">🎯 Next Action</h2>
            </div>
            <div className="card-content">
              <div className="recommendation-content">
                <div className="recommendation-icon">
                  {recommendation.icon}
                </div>
                <h3 className="recommendation-title">
                  {recommendation.title}
                </h3>
                <p className="recommendation-description">
                  {recommendation.description}
                </p>
                <button 
                  className="rpg-button attack-button recommendation-button"
                  onClick={recommendation.onClick}
                >
                  {recommendation.action} 🚀
                </button>
              </div>
            </div>
          </div>

          {/* Active Battles List */}
          <div className="dashboard-card active-battles">
            <div className="card-header">
              <h2 className="neon-purple-text">⚔️ Active Battles</h2>
            </div>
            <div className="card-content">
              {battles.length === 0 ? (
                <div className="empty-battles">
                  <div className="empty-icon">❄️</div>
                  <p className="empty-text">
                    No battles yet! Challenge friends to begin your winter arc.
                  </p>
                  <button 
                    className="rpg-button"
                    onClick={() => navigate('/invites')}
                  >
                    🎯 Start First Battle
                  </button>
                </div>
              ) : (
                <div className="battles-list">
                  {battles.slice(0, 3).map((battle) => {
                    const isPlayer1 = battle.player1_id === user.id;
                    const opponent = isPlayer1 ? battle.player2_name : battle.player1_name;
                    const myHp = isPlayer1 ? battle.player1_hp || 100 : battle.player2_hp || 100;
                    const oppHp = isPlayer1 ? battle.player2_hp || 100 : battle.player1_hp || 100;
                    const myXp = isPlayer1 ? battle.player1_xp || 0 : battle.player2_xp || 0;
                    
                    return (
                      <div 
                        key={battle.id}
                        className="battle-summary"
                        onClick={() => navigate('/battles')}
                      >
                        <div className="battle-summary-header">
                          <span className="battle-title">
                            ⚔️ vs {opponent}
                          </span>
                          <span className="battle-status">
                            {battle.status === 'active' ? '🟢' : '⏸️'}
                          </span>
                        </div>
                        <div className="battle-summary-stats">
                          <div className="battle-stat">
                            <span className="stat-label">Your HP:</span>
                            <span className="stat-value">❤️ {myHp}/100</span>
                          </div>
                          <div className="battle-stat">
                            <span className="stat-label">Opponent HP:</span>
                            <span className="stat-value">💀 {oppHp}/100</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {battles.length > 3 && (
                    <button 
                      className="rpg-button view-all-button"
                      onClick={() => navigate('/battles')}
                    >
                      View All {battles.length} Battles 📋
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Toast */}
        {error && (
          <div className="error-toast">
            <span className="error-text">⚠️ {error}</span>
            <button 
              className="error-close"
              onClick={() => setError('')}
            >
              ❌
            </button>
          </div>
        )}
      </div>
    </div>
  );
}