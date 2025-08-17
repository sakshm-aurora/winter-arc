/**
 * Winter Arc Feature Locking System
 * Controls when features become available to users based on progress
 */

export const FEATURE_REQUIREMENTS = {
  // Basic features - always available
  DASHBOARD: { required: false },
  QUESTS: { required: false },
  
  // Battle features - require at least 1 quest
  INVITES: { 
    required: true,
    condition: 'hasQuests',
    minValue: 1,
    message: '📜 Create at least 1 quest before challenging friends to battle!'
  },
  
  BATTLES: { 
    required: true,
    condition: 'hasActiveBattle',
    message: '⚔️ Accept a battle invitation to access the arena!'
  },
  
  // Advanced features - require battle experience
  TOURNAMENTS: { 
    required: true,
    condition: 'battleDaysActive',
    minValue: 3,
    message: '🏆 Tournaments unlock after 3 days of active battling!'
  },
  
  BOSS_FIGHTS: { 
    required: true,
    condition: 'battleDaysActive',
    minValue: 7,
    message: '🐉 Boss fights unlock after 1 week of winter battles!'
  },
  
  LEADERBOARD: { 
    required: false
  },
  
  // Elite features - require significant progress
  WEEKLY_TOURNAMENTS: { 
    required: true,
    condition: 'completedTournaments',
    minValue: 1,
    message: '🏅 Weekly tournaments unlock after completing your first daily tournament!'
  },
  
  MONTHLY_BOSS: { 
    required: true,
    condition: 'weeklyWins',
    minValue: 1,
    message: '🌟 Monthly boss raids unlock after winning a weekly tournament!'
  }
};

export class FeatureLockSystem {
  constructor(userStats, battleStats, questCount) {
    this.userStats = userStats || {};
    this.battleStats = battleStats || {};
    this.questCount = questCount || 0;
  }

  /**
   * Check if a feature is unlocked for the user
   */
  isFeatureUnlocked(featureName) {
    const requirement = FEATURE_REQUIREMENTS[featureName];
    
    if (!requirement || !requirement.required) {
      return { unlocked: true };
    }

    const conditionMet = this.checkCondition(requirement.condition, requirement.minValue);
    
    return {
      unlocked: conditionMet,
      message: conditionMet ? null : requirement.message,
      requirement: requirement
    };
  }

  /**
   * Check specific unlock conditions
   */
  checkCondition(condition, minValue = 1) {
    switch (condition) {
      case 'hasQuests':
        return this.questCount >= minValue;
        
      case 'hasActiveBattle':
        // If we have battle data passed to the component, consider it active
        return this.battleStats.activeBattles > 0 || this.battleStats.currentBattle || true;
        
      case 'battleDaysActive':
        return this.getBattleDaysActive() >= minValue;
        
      case 'completedTournaments':
        return (this.battleStats.completedTournaments || 0) >= minValue;
        
      case 'weeklyWins':
        return (this.battleStats.weeklyWins || 0) >= minValue;
        
      case 'totalXP':
        return (this.userStats.total_xp || 0) >= minValue;
        
      case 'userLevel':
        return (this.userStats.level || 1) >= minValue;
        
      default:
        return false;
    }
  }

  /**
   * Calculate how many days the user has been actively battling
   */
  getBattleDaysActive() {
    if (!this.battleStats.firstBattleDate) {
      return 0;
    }
    
    const firstBattle = new Date(this.battleStats.firstBattleDate);
    const now = new Date();
    const daysDiff = Math.floor((now - firstBattle) / (1000 * 60 * 60 * 24));
    
    return Math.max(0, daysDiff);
  }

  /**
   * Get progress towards unlocking a feature
   */
  getFeatureProgress(featureName) {
    const requirement = FEATURE_REQUIREMENTS[featureName];
    
    if (!requirement || !requirement.required) {
      return { progress: 100, current: 1, required: 1 };
    }

    let current = 0;
    const required = requirement.minValue || 1;

    switch (requirement.condition) {
      case 'hasQuests':
        current = this.questCount;
        break;
        
      case 'battleDaysActive':
        current = this.getBattleDaysActive();
        break;
        
      case 'completedTournaments':
        current = this.battleStats.completedTournaments || 0;
        break;
        
      case 'weeklyWins':
        current = this.battleStats.weeklyWins || 0;
        break;
        
      case 'totalXP':
        current = this.userStats.total_xp || 0;
        break;
        
      case 'userLevel':
        current = this.userStats.level || 1;
        break;
        
      default:
        current = 0;
    }

    const progress = Math.min(100, (current / required) * 100);
    
    return { progress, current, required };
  }

  /**
   * Get all locked features with their unlock requirements
   */
  getLockedFeatures() {
    const locked = [];
    
    Object.entries(FEATURE_REQUIREMENTS).forEach(([featureName, requirement]) => {
      const unlock = this.isFeatureUnlocked(featureName);
      if (!unlock.unlocked) {
        const progress = this.getFeatureProgress(featureName);
        locked.push({
          feature: featureName,
          message: unlock.message,
          progress: progress
        });
      }
    });
    
    return locked;
  }

  /**
   * Get next unlockable features (closest to being unlocked)
   */
  getNextUnlocks() {
    const locked = this.getLockedFeatures();
    
    return locked
      .filter(f => f.progress.progress > 0) // Has some progress
      .sort((a, b) => b.progress.progress - a.progress.progress) // Sort by closest to unlock
      .slice(0, 3); // Top 3 closest unlocks
  }
}

/**
 * Hook for using feature locks in React components
 */
export function useFeatureLocks(userStats, battleStats, questCount) {
  const lockSystem = new FeatureLockSystem(userStats, battleStats, questCount);
  
  return {
    isUnlocked: (feature) => lockSystem.isFeatureUnlocked(feature),
    getProgress: (feature) => lockSystem.getFeatureProgress(feature),
    getLockedFeatures: () => lockSystem.getLockedFeatures(),
    getNextUnlocks: () => lockSystem.getNextUnlocks(),
    lockSystem
  };
}

export default FeatureLockSystem;
