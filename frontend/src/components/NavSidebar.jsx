import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function NavSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const { user, api } = useAuth();
  const [userStats, setUserStats] = useState({
    level: 1,
    xp: 0,
    streak: 0,
    day: 1,
  });

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠', color: 'var(--frost-blue)' },
    { path: '/quests', label: 'Quest Board', icon: '📋', color: 'var(--neon-purple)' },
    { path: '/battles', label: 'Battle Arena', icon: '⚔️', color: 'var(--crit-gold)' },
    { path: '/invites', label: 'Challenge Hub', icon: '📤', color: 'var(--heal-green)' }
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  useEffect(() => {
    // Fetch user stats from /battles for the logged-in user
    const fetchStats = async () => {
      if (!user || !api) return;
      try {
        const res = await api.get('/battles');
        const battles = Array.isArray(res.data) ? res.data : [];
        // Find the most recent battle for the user as player1 or player2
        let userBattle = null;
        for (let b of battles) {
          if (b.player1_id === user.id || b.player2_id === user.id) {
            userBattle = b;
            break;
          }
        }
        if (!userBattle) {
          setUserStats({
            level: 1,
            xp: 0,
            streak: 0,
            day: 1,
          });
          return;
        }
        // Get stats for current user in the battle
        const isPlayer1 = userBattle.player1_id === user.id;
        const playerStats = isPlayer1
          ? {
              level: userBattle.player1_level || 1,
              xp: userBattle.player1_xp || 0,
              streak: userBattle.player1_streak || 0,
              day: userBattle.day_number || 1,
            }
          : {
              level: userBattle.player2_level || 1,
              xp: userBattle.player2_xp || 0,
              streak: userBattle.player2_streak || 0,
              day: userBattle.day_number || 1,
            };
        setUserStats(playerStats);
      } catch (err) {
        setUserStats({
          level: 1,
          xp: 0,
          streak: 0,
          day: 1,
        });
      }
    };
    fetchStats();
  }, [user, api]);

  return (
    <nav className={`nav-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="logo-section">
          {!isCollapsed && (
            <div className="app-logo">
              <span className="logo-icon">❄️</span>
              <span className="logo-text neon-text">Winter Arc</span>
            </div>
          )}
          <button 
            className="collapse-btn" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? '▶️' : '◀️'}
          </button>
        </div>
        
        {!isCollapsed && user && (
          <div className="user-info">
            <div className="user-avatar">
              <span className="avatar-icon">🗡️</span>
            </div>
            <div className="user-details">
              <div className="user-name">{user.name}</div>
              <div className="user-level">⭐ Level {userStats.level}</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <div className="sidebar-nav">
        <ul className="nav-list">
          {navItems.map((item) => (
            <li key={item.path} className="nav-item">
              <Link
                to={item.path}
                className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                title={isCollapsed ? item.label : ''}
              >
                <span 
                  className="nav-icon"
                  style={{ color: isActive(item.path) ? item.color : 'inherit' }}
                >
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="nav-label">{item.label}</span>
                )}
                {!isCollapsed && isActive(item.path) && (
                  <span className="active-indicator">🔥</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Progress Indicators */}
      {!isCollapsed && (
        <div className="sidebar-progress">
          <div className="progress-section">
            <div className="progress-title">❄️ Winter Progress</div>
            <div className="progress-stats">
              <div className="stat-item">
                <span className="stat-icon">📅</span>
                <span className="stat-label">Today</span>
                <span className="stat-value">Day {userStats.day}</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">🔥</span>
                <span className="stat-label">Streak</span>
                <span className="stat-value">{userStats.streak}</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">⭐</span>
                <span className="stat-label">XP</span>
                <span className="stat-value">{userStats.xp}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {!isCollapsed && (
        <div className="sidebar-actions">
          <Link to="/quests" className="quick-action-btn primary">
            <span className="action-icon">⚡</span>
            <span className="action-text">Quick Quest</span>
          </Link>
          <Link to="/battles" className="quick-action-btn secondary">
            <span className="action-icon">⚔️</span>
            <span className="action-text">Join Battle</span>
          </Link>
        </div>
      )}

      {/* Collapsed Mode Indicator */}
      {isCollapsed && (
        <div className="collapsed-indicator">
          <div className="progress-dot">📅</div>
          <div className="progress-dot">🔥</div>
          <div className="progress-dot">⭐</div>
        </div>
      )}
    </nav>
  );
}

export default NavSidebar;