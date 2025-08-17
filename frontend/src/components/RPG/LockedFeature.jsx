import React from 'react';

export function LockedFeature({ 
  feature, 
  message, 
  progress, 
  showProgress = true, 
  size = 'normal',
  className = '' 
}) {
  const sizeClasses = {
    small: 'locked-feature-small',
    normal: 'locked-feature-normal',
    large: 'locked-feature-large'
  };

  return (
    <div className={`locked-feature ${sizeClasses[size]} ${className}`}>
      <div className="locked-overlay">
        <div className="locked-content">
          <div className="locked-icon">🔒</div>
          <div className="locked-title">Feature Locked</div>
          <div className="locked-message">{message}</div>
          
          {showProgress && progress && (
            <div className="unlock-progress">
              <div className="progress-label">
                Progress: {progress.current}/{progress.required}
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <div className="progress-text">
                {Math.round(progress.progress)}% to unlock
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LockedTabContent({ 
  tabName, 
  unlockRequirement, 
  progress, 
  onNavigateToUnlock 
}) {
  const getUnlockAction = () => {
    switch (unlockRequirement?.condition) {
      case 'hasQuests':
        return {
          text: '📜 Create Your First Quest',
          action: () => onNavigateToUnlock('/quests')
        };
      case 'hasActiveBattle':
        return {
          text: '⚔️ Accept a Battle Invitation',
          action: () => onNavigateToUnlock('/invites')
        };
      case 'battleDaysActive':
        return {
          text: '🗡️ Continue Daily Battles',
          action: () => onNavigateToUnlock('/battles')
        };
      default:
        return {
          text: '🎯 Keep Playing!',
          action: () => {}
        };
    }
  };

  const action = getUnlockAction();

  return (
    <div className="locked-tab-content">
      <div className="locked-tab-container">
        <div className="locked-tab-header">
          <h2 className="neon-text">🔒 {tabName} Locked</h2>
          <div className="locked-tab-subtitle">
            This epic feature awaits your worthy deeds!
          </div>
        </div>

        <div className="locked-tab-body">
          <div className="requirement-card">
            <div className="requirement-icon">🎯</div>
            <div className="requirement-text">
              {unlockRequirement?.message || 'Complete more challenges to unlock this feature!'}
            </div>
          </div>

          {progress && (
            <div className="unlock-progress-card">
              <h3 className="progress-title">🚀 Your Progress</h3>
              <div className="progress-details">
                <div className="progress-stats">
                  <span className="current-value">{progress.current}</span>
                  <span className="progress-separator">/</span>
                  <span className="required-value">{progress.required}</span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar large">
                    <div 
                      className="progress-fill"
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>
                  <div className="progress-percentage">
                    {Math.round(progress.progress)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="unlock-action">
            <button 
              className="rpg-button attack-button unlock-btn"
              onClick={action.action}
            >
              {action.text} 🚀
            </button>
          </div>

          <div className="unlock-tips">
            <h4 className="tips-title">💡 Unlock Tips</h4>
            <div className="tips-list">
              {getUnlockTips(unlockRequirement?.condition).map((tip, index) => (
                <div key={index} className="tip-item">
                  <span className="tip-icon">{tip.icon}</span>
                  <span className="tip-text">{tip.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getUnlockTips(condition) {
  switch (condition) {
    case 'hasQuests':
      return [
        { icon: '📝', text: 'Create daily quests like "Gym", "Read", "Sleep Early"' },
        { icon: '🎯', text: 'Set realistic targets you can achieve consistently' },
        { icon: '⚡', text: 'Mix different difficulty levels for balanced gameplay' }
      ];
      
    case 'hasActiveBattle':
      return [
        { icon: '👥', text: 'Invite friends through the Invites section' },
        { icon: '⚔️', text: 'Accept pending battle invitations' },
        { icon: '🎮', text: 'Start with someone who shares similar goals' }
      ];
      
    case 'battleDaysActive':
      return [
        { icon: '📅', text: 'Complete quests daily to maintain battle activity' },
        { icon: '💪', text: 'Consistency unlocks more powerful features' },
        { icon: '🏆', text: 'Each day of battles brings epic rewards' }
      ];
      
    default:
      return [
        { icon: '🎯', text: 'Keep completing your daily quests' },
        { icon: '⚔️', text: 'Stay active in battles' },
        { icon: '🚀', text: 'Progress unlocks amazing features' }
      ];
  }
}

export default LockedFeature;
