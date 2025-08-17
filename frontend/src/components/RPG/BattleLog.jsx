import React, { useState, useEffect, useRef } from 'react';

export function BattleLog({ logs = [], title = "Battle Log", className = "", allowMultipleToday = true }) {
  const [visibleLogs, setVisibleLogs] = useState([]);
  const [expandedDays, setExpandedDays] = useState(new Set());
  const logEndRef = useRef(null);
  const [newLogIds, setNewLogIds] = useState(new Set());

  // Group logs by date for better organization
  const groupedLogs = React.useMemo(() => {
    const groups = {};
    logs.forEach(log => {
      const date = log.date ? new Date(log.date).toDateString() : 'Today';
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(log);
    });
    
    // Sort dates (most recent first)
    const sortedDates = Object.keys(groups).sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      return new Date(b) - new Date(a);
    });
    
    return sortedDates.map(date => ({
      date,
      logs: groups[date].sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date)),
      isToday: date === 'Today' || new Date(date).toDateString() === new Date().toDateString()
    }));
  }, [logs]);

  useEffect(() => {
    // Auto-expand today's logs and recent days
    const today = new Date().toDateString();
    const newExpanded = new Set([today, 'Today']);
    
    // Also expand the most recent 2 days
    groupedLogs.slice(0, 2).forEach(group => {
      newExpanded.add(group.date);
    });
    
    setExpandedDays(newExpanded);
  }, [groupedLogs]);

  useEffect(() => {
    // Animate new logs
    const currentLogIds = new Set(logs.map(log => log.id));
    const previousLogIds = new Set(visibleLogs.map(log => log.id));
    
    const newIds = [...currentLogIds].filter(id => !previousLogIds.has(id));
    
    if (newIds.length > 0) {
      setNewLogIds(new Set(newIds));
      
      // Remove the "new" class after animation
      setTimeout(() => {
        setNewLogIds(new Set());
      }, 1000);
    }
    
    setVisibleLogs(logs);
    
    // Auto-scroll to bottom for new logs
    if (logs.length > visibleLogs.length) {
      setTimeout(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [logs]);

  const toggleDayExpansion = (date) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const getLogClass = (logText) => {
    const text = logText.toLowerCase();
    if (text.includes('critical') || text.includes('crit') || text.includes('💥')) {
      return 'crit';
    }
    if (text.includes('combo') || text.includes('streak')) {
      return 'combo';
    }
    if (text.includes('damage') || text.includes('attack') || text.includes('⚔️')) {
      return 'damage';
    }
    if (text.includes('heal') || text.includes('recover') || text.includes('💚') || text.includes('shield')) {
      return 'heal';
    }
    if (text.includes('defeat') || text.includes('victory') || text.includes('winner')) {
      return 'victory';
    }
    return 'normal';
  };

  const formatLogText = (text) => {
    // Enhanced text formatting with proper line breaks and structure
    let formattedText = text
      // Add line breaks after major sections
      .replace(/🌨️ Winter Arc/g, '\n🌨️ Winter Arc')
      .replace(/🔥 The arena/g, '\n\n🔥 The arena')
      .replace(/📜 Round/g, '\n\n📜 Round')
      .replace(/🎓 On the flip side/g, '\n\n🎓 On the flip side')
      .replace(/🧘 (\w+) attempts/g, '\n\n🧘 $1 attempts')
      .replace(/😬 Oh no/g, '\n😬 Oh no')
      .replace(/💥 Bingo/g, '\n💥 Bingo')
      .replace(/⚡ CRITICAL/g, '\n⚡ CRITICAL')
      .replace(/🎯 CRITICAL/g, '\n🎯 CRITICAL')
      .replace(/⭐ Skarface gains/g, '\n⭐ Skarface gains')
      .replace(/⭐ zupz gains/g, '\n⭐ zupz gains')
      .replace(/❤️ HP holds/g, '\n❤️ HP holds')
      .replace(/But wait\.\.\./g, '\n\nBut wait...')
      
      // Enhanced emoji formatting for better visual impact
      .replace(/(\d+)\s*HP/gi, '❤️ $1 HP')
      .replace(/(\d+)\s*XP/gi, '⭐ $1 XP')
      .replace(/(\d+)\s*damage/gi, '💥 $1 damage')
      .replace(/critical/gi, '🎯 CRITICAL')
      .replace(/combo/gi, '⚡ COMBO')
      .replace(/streak/gi, '🔥 STREAK')
      .replace(/frozen/gi, '🥶 FROZEN')
      .replace(/burning/gi, '🔥 BURNING')
      .replace(/poisoned/gi, '☠️ POISONED')
      .replace(/blessed/gi, '✨ BLESSED')
      .replace(/shielded/gi, '💎 SHIELDED')
      .replace(/victory/gi, '🏆 VICTORY')
      .replace(/defeat/gi, '💀 DEFEAT');

    // Clean up any double line breaks and ensure proper spacing
    formattedText = formattedText
      .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive line breaks
      .replace(/^\n+/, '')         // Remove leading line breaks
      .trim();

    return formattedText;
  };

  const getTimeFromLog = (log) => {
    if (!log.created_at && !log.date) return '';
    const date = new Date(log.created_at || log.date);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDayNumber = (date, logText = '') => {
    if (date === 'Today') {
      // Try to extract day number from log text for today's entries
      const dayMatch = logText.match(/Winter Arc[^–]*–[^D]*Day\s*(\d+)/i);
      return dayMatch ? parseInt(dayMatch[1]) : 1;
    }
    
    // For past dates, try to extract from any log in that day's group
    const dayGroup = groupedLogs.find(group => group.date === date);
    if (dayGroup && dayGroup.logs.length > 0) {
      for (const log of dayGroup.logs) {
        const dayMatch = log.log_text.match(/Winter Arc[^–]*–[^D]*Day\s*(\d+)/i);
        if (dayMatch) {
          return parseInt(dayMatch[1]);
        }
      }
    }
    
    return null;
  };

  return (
    <div className={`battle-log-v2 ${className}`}>
      <div className="battle-log-header">
        <h3 className="neon-text">{title}</h3>
        <div className="log-subtitle">
          <span className="subtitle-text">🌨️ Winter Arc Battle Chronicle</span>
          <span className="log-count">{logs.length} entries</span>
        </div>
      </div>
      
      <div className="battle-log-content">
        {groupedLogs.length === 0 ? (
          <div className="empty-log-state">
            <div className="empty-icon">⚔️</div>
            <div className="empty-title">Battle Awaits!</div>
            <div className="empty-subtitle">
              Complete your quests to begin the winter battle chronicles
            </div>
          </div>
        ) : (
          groupedLogs.map((dayGroup) => {
            const isExpanded = expandedDays.has(dayGroup.date);
            // Get day number from the first log in the group
            const firstLogText = dayGroup.logs[0]?.log_text || '';
            const dayNumber = getDayNumber(dayGroup.date, firstLogText);
            
            return (
              <div key={dayGroup.date} className={`day-group ${dayGroup.isToday ? 'today' : ''}`}>
                <div 
                  className="day-header"
                  onClick={() => toggleDayExpansion(dayGroup.date)}
                >
                  <div className="day-info">
                    <span className="day-title">
                      {dayGroup.isToday ? (
                        <>❄️ Today - Day {dayNumber || '1'}</>
                      ) : (
                        <>🗓️ {dayGroup.date} {dayNumber && `- Day ${dayNumber}`}</>
                      )}
                    </span>
                    <span className="day-count">
                      {dayGroup.logs.length} {dayGroup.logs.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                  <div className="expand-indicator">
                    {isExpanded ? '🔽' : '▶️'}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="day-logs">
                    {dayGroup.logs.map((log, index) => (
                      <div 
                        key={log.id || `${dayGroup.date}-${index}`}
                        className={`log-entry ${getLogClass(log.log_text)} ${
                          newLogIds.has(log.id) ? 'new-entry' : ''
                        }`}
                      >
                        <div className="log-header">
                          <span className="log-time">
                            {getTimeFromLog(log)}
                          </span>
                          <span className="log-sequence">
                            #{index + 1}
                          </span>
                        </div>
                        <div className="log-content">
                          <pre className="battle-narrative">{formatLogText(log.log_text)}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
      
      {/* Quick stats summary */}
      {logs.length > 0 && (
        <div className="battle-log-summary">
          <div className="summary-item">
            <span className="summary-label">Total Battles</span>
            <span className="summary-value">{logs.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Battle Days</span>
            <span className="summary-value">{groupedLogs.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function LiveBattleFeed({ onNewAction, className = "" }) {
  const [recentActions, setRecentActions] = useState([]);
  const [actionQueue, setActionQueue] = useState([]);

  useEffect(() => {
    if (onNewAction) {
      onNewAction((action) => {
        setActionQueue(prev => [...prev, { 
          ...action, 
          id: Date.now() + Math.random(),
          timestamp: new Date()
        }]);
      });
    }
  }, [onNewAction]);

  useEffect(() => {
    if (actionQueue.length > 0) {
      const timer = setTimeout(() => {
        const [nextAction, ...remaining] = actionQueue;
        setActionQueue(remaining);
        
        setRecentActions(prev => {
          const updated = [nextAction, ...prev.slice(0, 4)]; // Keep last 5 actions
          return updated;
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          setRecentActions(prev => prev.filter(a => a.id !== nextAction.id));
        }, 5000);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [actionQueue]);

  return (
    <div className={`live-battle-feed ${className}`}>
      <div className="feed-header">
        <span className="feed-title">⚡ Live Feed</span>
        <span className="feed-indicator">🔴</span>
      </div>
      
      <div className="feed-content">
        {recentActions.map((action) => (
          <div 
            key={action.id}
            className={`feed-action ${action.type}`}
          >
            <div className="action-icon">
              {getActionIcon(action.type)}
            </div>
            <div className="action-details">
              <div className="action-text">{action.text}</div>
              <div className="action-time">
                {action.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
        ))}
        
        {recentActions.length === 0 && (
          <div className="feed-empty">
            <span>Waiting for battle actions...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getActionIcon(type) {
  switch (type) {
    case 'quest_complete': return '✅';
    case 'quest_fail': return '❌';
    case 'damage': return '💥';
    case 'heal': return '💚';
    case 'crit': return '🎯';
    case 'combo': return '⚡';
    case 'victory': return '🏆';
    case 'defeat': return '💀';
    default: return '⚔️';
  }
}

export function BattleHeader({ dayCount = 1, season = "Winter Arc", battleName = "" }) {
  return (
    <div className="battle-header-v2">
      <div className="season-badge">
        <span className="season-emoji">🌨️</span>
        <span className="season-text">{season}</span>
      </div>
      
      <div className="battle-title">
        <h1 className="neon-text">
          Day {dayCount} Battle
        </h1>
        {battleName && (
          <div className="battle-name">
            {battleName}
          </div>
        )}
      </div>
      
      <div className="battle-motivation">
        <span>❄️ May your resolve burn bright against the winter storm! ⚔️</span>
      </div>
    </div>
  );
}

export function CombatFloatingText({ 
  text, 
  type = 'damage', 
  x = 0, 
  y = 0, 
  onComplete = () => {} 
}) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const getClass = () => {
    switch (type) {
      case 'damage': return 'floating-text damage-popup';
      case 'heal': return 'floating-text heal-popup';
      case 'crit': return 'floating-text crit-popup';
      case 'xp': return 'floating-text xp-popup';
      default: return 'floating-text damage-popup';
    }
  };

  const getFormattedText = () => {
    switch (type) {
      case 'damage': return `💥 -${text}`;
      case 'heal': return `💚 +${text}`;
      case 'crit': return `🎯 CRIT! -${text}`;
      case 'xp': return `⭐ +${text} XP`;
      default: return text;
    }
  };

  return (
    <div 
      className={getClass()}
      style={{ 
        left: `${x}px`, 
        top: `${y}px`,
        position: 'absolute',
        zIndex: 1000,
        pointerEvents: 'none',
        animation: 'floatUp 2.5s ease-out forwards'
      }}
    >
      {getFormattedText()}
    </div>
  );
}

export default BattleLog;