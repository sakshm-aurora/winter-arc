/**
 * Utility functions for quest locking system
 */

export async function fetchLockedQuests(api, battleId, date = null) {
  try {
    const checkDate = date || new Date().toISOString().split('T')[0];
    const response = await api.get(`/checkins/locked/${battleId}?date=${checkDate}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching locked quests:', error);
    return [];
  }
}

export function isQuestLocked(questId, lockedQuests) {
  return lockedQuests.some(locked => locked.id === questId);
}

export function getQuestLockInfo(questId, lockedQuests) {
  const lockedQuest = lockedQuests.find(locked => locked.id === questId);
  return lockedQuest ? {
    locked: true,
    reason: lockedQuest.lock_reason,
    nextAvailable: lockedQuest.next_available
  } : { locked: false };
}

export function getNextAvailableDate(frequency, currentDate = new Date()) {
  const current = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      const tomorrow = new Date(current);
      tomorrow.setDate(current.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    
    case 'weekly':
      // Next Monday
      const dayOfWeek = current.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const nextMonday = new Date(current);
      nextMonday.setDate(current.getDate() + daysUntilMonday);
      return nextMonday.toISOString().split('T')[0];
    
    case 'monthly':
      // First day of next month
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      return nextMonth.toISOString().split('T')[0];
    
    default:
      return current.toISOString().split('T')[0];
  }
}

export function formatLockReason(reason, nextAvailable) {
  if (!reason) return '';
  
  const nextDate = new Date(nextAvailable);
  const today = new Date();
  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let timeUntilNext = '';
  if (diffDays === 1) {
    timeUntilNext = 'tomorrow';
  } else if (diffDays === 0) {
    timeUntilNext = 'later today';
  } else if (diffDays > 1) {
    timeUntilNext = `in ${diffDays} days`;
  } else {
    timeUntilNext = 'soon';
  }
  
  return `${reason}. Available ${timeUntilNext}.`;
}
