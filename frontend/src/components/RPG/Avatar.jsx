import React, { useState } from 'react';

const CLASS_DATA = {
  mage: {
    name: 'Mage',
    emoji: '🧙‍♂️',
    color: '#b26dff',
    abilities: ['Frost Bolt', 'Ice Shield', 'Blizzard'],
    description: 'Masters of elemental magic and winter spells'
  },
  warrior: {
    name: 'Warrior',
    emoji: '⚔️',
    color: '#ff4757',
    abilities: ['Sword Strike', 'Shield Bash', 'Battle Rage'],
    description: 'Fearless fighters with incredible strength'
  },
  rogue: {
    name: 'Rogue',
    emoji: '🗡️',
    color: '#2ed573',
    abilities: ['Stealth Strike', 'Poison Dart', 'Shadow Step'],
    description: 'Agile assassins who strike from the shadows'
  },
  monk: {
    name: 'Monk',
    emoji: '👊',
    color: '#ffa502',
    abilities: ['Iron Fist', 'Meditation', 'Chi Burst'],
    description: 'Disciplined fighters who harness inner energy'
  }
};

export function RPGAvatar({ 
  userId, 
  userName, 
  playerClass = 'mage', 
  level = 1, 
  size = 'large',
  showClassBadge = true,
  onClick = null,
  isActive = false
}) {
  const [imageError, setImageError] = useState(false);
  const classData = CLASS_DATA[playerClass] || CLASS_DATA.mage;
  
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-20 h-20',
    large: 'w-24 h-24',
    xlarge: 'w-32 h-32'
  };

  // Generate a consistent avatar based on userId and class
  const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}-${playerClass}&backgroundColor=${classData.color.replace('#', '')}&eyes=variant01,variant02,variant03&mouth=variant01,variant02&hair=variant01,variant02,variant03`;

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div 
      className={`avatar-container ${sizeClasses[size]} ${isActive ? 'active' : ''} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      style={{
        borderColor: isActive ? classData.color : 'var(--frost-blue)',
        boxShadow: isActive ? `0 0 20px ${classData.color}` : 'var(--neon-glow)'
      }}
    >
      {!imageError ? (
        <img 
          src={avatarUrl}
          alt={`${userName} - ${classData.name}`}
          className="avatar-image"
          onError={handleImageError}
        />
      ) : (
        <div className="avatar-fallback">
          <span style={{ fontSize: size === 'large' ? '48px' : '32px' }}>
            {classData.emoji}
          </span>
        </div>
      )}
      
      {showClassBadge && (
        <div 
          className="avatar-class-badge"
          style={{ backgroundColor: classData.color }}
        >
          {classData.name} Lv.{level}
        </div>
      )}
    </div>
  );
}

export function ClassSelector({ selectedClass, onClassChange, disabled = false }) {
  return (
    <div className="class-selector">
      <h3 className="neon-text text-center mb-4">Choose Your Class</h3>
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(CLASS_DATA).map(([key, classData]) => (
          <div
            key={key}
            className={`class-option ${selectedClass === key ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={() => !disabled && onClassChange(key)}
            style={{
              border: `2px solid ${selectedClass === key ? classData.color : 'var(--frost-blue)'}`,
              backgroundColor: selectedClass === key ? `${classData.color}20` : 'rgba(15, 20, 25, 0.8)',
              borderRadius: '12px',
              padding: '16px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: disabled ? 0.6 : 1
            }}
          >
            <div className="text-center">
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {classData.emoji}
              </div>
              <div 
                className="font-bold text-lg"
                style={{ color: classData.color }}
              >
                {classData.name}
              </div>
              <div className="text-sm text-gray-300 mt-2">
                {classData.description}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Abilities: {classData.abilities.join(', ')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusEffects({ effects = [] }) {
  const statusIcons = {
    frozen: { emoji: '🥶', name: 'Frozen', color: 'var(--frost-blue)' },
    sleepy: { emoji: '😴', name: 'Sleepy', color: 'var(--neon-purple)' },
    shielded: { emoji: '💎', name: 'Shielded', color: 'var(--frozen-silver)' },
    burning: { emoji: '🔥', name: 'Burning', color: 'var(--streak-orange)' },
    poisoned: { emoji: '☠️', name: 'Poisoned', color: 'var(--heal-green)' },
    blessed: { emoji: '✨', name: 'Blessed', color: 'var(--crit-gold)' }
  };

  if (effects.length === 0) return null;

  return (
    <div className="status-effects">
      {effects.map((effect, index) => {
        const statusData = statusIcons[effect] || { emoji: '❓', name: effect, color: 'white' };
        return (
          <div 
            key={`${effect}-${index}`}
            className={`status-icon ${effect}`}
            style={{ borderColor: statusData.color }}
            title={statusData.name}
          >
            {statusData.emoji}
          </div>
        );
      })}
    </div>
  );
}

export function PlayerCard({ 
  player, 
  isOpponent = false, 
  showDetails = true,
  className = '' 
}) {
  const { 
    id, 
    name, 
    playerClass = 'mage', 
    level = 1, 
    hp = 100, 
    maxHp = 100, 
    xp = 0, 
    maxXp = 100, 
    streak = 0,
    statusEffects = []
  } = player;

  return (
    <div className={`player-card ${isOpponent ? 'opponent' : 'ally'} ${className}`}>
      <div className="player-header">
        <RPGAvatar 
          userId={id}
          userName={name}
          playerClass={playerClass}
          level={level}
          size="large"
          showClassBadge={true}
        />
        <div className="player-info">
          <h3 className="neon-text player-name">{name}</h3>
          <StatusEffects effects={statusEffects} />
        </div>
      </div>
      
      {showDetails && (
        <div className="player-stats">
          <div className="hp-bar-container">
            <div 
              className="hp-bar"
              style={{ width: `${(hp / maxHp) * 100}%` }}
            />
            <div className="hp-text">❤️ {hp}/{maxHp} HP</div>
          </div>
          
          <div className="xp-bar-container">
            <div 
              className="xp-bar"
              style={{ width: `${(xp / maxXp) * 100}%` }}
            />
            <div className="xp-text">⭐ LVL {level} - {xp}/{maxXp} XP</div>
          </div>
          
          <div className="streak-container">
            <span className={`streak-flames level-${Math.min(4, Math.floor(streak / 5) + 1)}`}>
              🔥
            </span>
            <span className="streak-number">{streak} DAY STREAK</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { CLASS_DATA };
