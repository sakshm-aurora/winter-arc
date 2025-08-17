import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RPGAvatar } from './RPG/Avatar';

export default function Header() {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  return (
    <header className="rpg-header">
      <div className="header-left">
        <div className="logo-section">
          <h1 className="neon-text logo-title">
            ❄️ Winter Arc RPG ⚔️
          </h1>
          <div className="logo-subtitle">
            🌨️ Forge Your Legend in the Frozen Realm 🌨️
          </div>
        </div>
      </div>

      <div className="header-right">
        {user && (
          <div className="user-section">
            <div className="user-info">
              <span className="user-greeting">
                Welcome back, <span className="neon-purple-text">{user.name}</span>! ❄️
              </span>
              <div className="user-level">
                <span className="level-text">⭐ Winter Warrior</span>
              </div>
            </div>
            
            <div className="user-avatar-container" onClick={() => setShowUserMenu(!showUserMenu)}>
              <RPGAvatar 
                userId={user.id}
                userName={user.name}
                playerClass="mage"
                level={1}
                size="medium"
                showClassBadge={false}
                onClick={() => setShowUserMenu(!showUserMenu)}
              />
              
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <span className="user-name">{user.name}</span>
                    <span className="user-title">🧙‍♂️ Frost Mage</span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-items">
                    <button className="dropdown-item">
                      ⚙️ Settings
                    </button>
                    <button className="dropdown-item">
                      🎨 Change Class
                    </button>
                    <button className="dropdown-item">
                      📊 View Stats
                    </button>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item logout-item" onClick={handleLogout}>
                      🚪 Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Close dropdown when clicking outside */}
      {showUserMenu && (
        <div 
          className="dropdown-overlay"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  );
}