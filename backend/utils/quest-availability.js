/**
 * Quest Availability Logic
 * 
 * Determines when quests should be visible/available for attack based on frequency:
 * - Daily: Available every day
 * - Weekly: Only available during last 2 days of the week (Saturday-Sunday)
 * - Monthly: Only available during last 3 days of the month
 * - Sidequest: Available when generated and not expired
 */

/**
 * Check if a quest should be available for attack based on its frequency
 */
function isQuestAvailable(frequency, currentDate = null) {
  const date = currentDate ? new Date(currentDate) : new Date();
  
  switch (frequency?.toLowerCase()) {
    case 'daily':
      // Daily quests are always available
      return {
        available: true,
        reason: 'Daily quest - always available'
      };
    
    case 'weekly':
      // Weekly quests only available on Saturday (6) and Sunday (0)
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      
      return {
        available: isWeekend,
        reason: isWeekend 
          ? 'Weekly quest - available on weekends' 
          : 'Weekly quest - only available Saturday-Sunday',
        next_available: getNextWeekendDate(date)
      };
    
    case 'monthly':
      // Monthly quests only available during last 3 days of month
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const currentDay = date.getDate();
      const daysFromEnd = lastDayOfMonth - currentDay;
      const isEndOfMonth = daysFromEnd <= 2; // Last 3 days
      
      return {
        available: isEndOfMonth,
        reason: isEndOfMonth 
          ? 'Monthly quest - available during last 3 days of month'
          : `Monthly quest - available in ${daysFromEnd - 2} days (last 3 days of month)`,
        next_available: getNextMonthEndDate(date)
      };
    
    case 'sidequest':
      // Sidequests availability is handled separately via battle_events
      return {
        available: false,
        reason: 'Sidequest availability determined by battle events'
      };
    
    default:
      // Default to daily if frequency not specified
      return {
        available: true,
        reason: 'Unknown frequency - defaulting to daily availability'
      };
  }
}

/**
 * Get the next date when weekend starts (Saturday)
 */
function getNextWeekendDate(currentDate) {
  const date = new Date(currentDate);
  const dayOfWeek = date.getDay();
  
  // Days until Saturday
  const daysUntilSaturday = dayOfWeek === 0 ? 6 : (6 - dayOfWeek);
  
  date.setDate(date.getDate() + daysUntilSaturday);
  return date.toISOString().split('T')[0];
}

/**
 * Get the next date when month-end period starts (3rd last day)
 */
function getNextMonthEndDate(currentDate) {
  const date = new Date(currentDate);
  
  // Go to next month
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  
  // Get last day of next month
  const lastDayNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  
  // Set to 3rd last day (when monthly quests become available)
  nextMonth.setDate(lastDayNextMonth - 2);
  
  return nextMonth.toISOString().split('T')[0];
}

/**
 * Filter quests array by availability
 */
function filterAvailableQuests(quests, currentDate = null) {
  return quests.filter(quest => {
    const availability = isQuestAvailable(quest.frequency, currentDate);
    return availability.available;
  }).map(quest => ({
    ...quest,
    availability: isQuestAvailable(quest.frequency, currentDate)
  }));
}

/**
 * Get quest availability info for UI display
 */
function getQuestAvailabilityInfo(quest, currentDate = null) {
  const availability = isQuestAvailable(quest.frequency, currentDate);
  
  return {
    ...quest,
    available: availability.available,
    availability_reason: availability.reason,
    next_available: availability.next_available || null
  };
}

/**
 * Check if it's currently the end of week (Saturday-Sunday)
 */
function isEndOfWeek(currentDate = null) {
  const date = currentDate ? new Date(currentDate) : new Date();
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Check if it's currently the end of month (last 3 days)
 */
function isEndOfMonth(currentDate = null) {
  const date = currentDate ? new Date(currentDate) : new Date();
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const currentDay = date.getDate();
  const daysFromEnd = lastDayOfMonth - currentDay;
  return daysFromEnd <= 2;
}

module.exports = {
  isQuestAvailable,
  filterAvailableQuests,
  getQuestAvailabilityInfo,
  isEndOfWeek,
  isEndOfMonth,
  getNextWeekendDate,
  getNextMonthEndDate
};
