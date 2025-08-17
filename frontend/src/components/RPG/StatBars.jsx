import React, { useState, useEffect } from 'react';

export function HPBar({ current, max, animated = false }) {
  const [displayHP, setDisplayHP] = useState(current);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (animated && displayHP !== current) {
      setIsAnimating(true);
      const duration = 800;
      const steps = 30;
      const stepValue = (current - displayHP) / steps;
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep++;
        setDisplayHP(prev => {
          const newValue = prev + stepValue;
          if (currentStep >= steps) {
            clearInterval(timer);
            setIsAnimating(false);
            return current;
          }
          return newValue;
        });
      }, duration / steps);

      return () => clearInterval(timer);
    } else {
      setDisplayHP(current);
    }
  }, [current, animated, displayHP]);

  const percentage = Math.max(0, Math.min(100, (displayHP / max) * 100));
  const hpColor = percentage > 50 ? 'var(--hp-red)' : percentage > 25 ? '#ff6b35' : '#ff073a';

  return (
    <div className="hp-bar-container">
      <div 
        className={`hp-bar ${isAnimating ? 'animating' : ''}`}
        style={{ 
          width: `${percentage}%`,
          background: `linear-gradient(90deg, ${hpColor} 0%, var(--hp-red-glow) 100%)`
        }}
      />
      <div className="hp-text">
        ❤️ {Math.round(displayHP)}/{max} HP
      </div>
    </div>
  );
}

export function XPBar({ current, max, level = 1 }) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  
  return (
    <div className="xp-bar-container">
      <div 
        className="xp-bar"
        style={{ width: `${percentage}%` }}
      />
      <div className="xp-text">
        ⭐ LVL {level} - {current}/{max} XP
      </div>
    </div>
  );
}

export function StreakMeter({ streak }) {
  const getStreakLevel = (streak) => {
    if (streak >= 20) return 4;
    if (streak >= 10) return 3;
    if (streak >= 5) return 2;
    if (streak >= 1) return 1;
    return 0;
  };

  const getFireEmojis = (level) => {
    switch (level) {
      case 4: return '🔥🔥🔥🔥';
      case 3: return '🔥🔥🔥';
      case 2: return '🔥🔥';
      case 1: return '🔥';
      default: return '💨';
    }
  };

  const level = getStreakLevel(streak);
  
  return (
    <div className="streak-container">
      <span className={`streak-flames level-${level}`}>
        {getFireEmojis(level)}
      </span>
      <span className="streak-number">
        {streak} DAY STREAK
      </span>
    </div>
  );
}

export function CombatStats({ hp, maxHp, xp, maxXp, level, streak, className = '' }) {
  return (
    <div className={`combat-stats ${className}`}>
      <HPBar current={hp} max={maxHp} animated />
      <XPBar current={xp} max={maxXp} level={level} />
      <StreakMeter streak={streak} />
    </div>
  );
}
