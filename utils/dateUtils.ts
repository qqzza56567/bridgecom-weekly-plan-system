/**
 * Formats a Date object to YYYY-MM-DD string using Local Time.
 * Avoids UTC shifts caused by toISOString().
 */
export const toLocalISOString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parses a YYYY-MM-DD string back to a Date object (Local Time 00:00:00).
 */
export const parseLocalString = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Adds (or subtracts) days to a date string YYYY-MM-DD.
 * Returns new YYYY-MM-DD string.
 */
export const addDays = (dateStr: string, days: number): string => {
  const d = parseLocalString(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalISOString(d);
};

/**
 * Calculates the difference in days between two YYYY-MM-DD strings.
 * Returns (date2 - date1) in days.
 */
export const daysBetweenLocal = (dateStr1: string, dateStr2: string): number => {
  const d1 = parseLocalString(dateStr1);
  const d2 = parseLocalString(dateStr2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Gets the "Current" Week Start (Wednesday).
 * If today is Wednesday, returns today.
 * If today is Thu-Tue, returns the most recent Wednesday.
 */
export const getCurrentWeekStart = (baseDate: Date = new Date()): string => {
  const d = new Date(baseDate);
  const currentDay = d.getDay(); // 0=Sun, 1=Mon, ..., 3=Wed, 4=Thu, 5=Fri

  // Logic Update (2026/01/13):
  // Wednesday(3) & Thursday(4): Current Week points to THIS Wednesday.
  // Friday(5) -> Tuesday(2): Current Week points to NEXT Wednesday.

  const targetDate = new Date(d);

  if (currentDay === 3 || currentDay === 4) {
    // Return this week's Wednesday
    const daysToSubtract = currentDay - 3;
    targetDate.setDate(d.getDate() - daysToSubtract);
  } else {
    // Return next Wednesday
    const daysToAdd = (3 - currentDay + 7) % 7;
    targetDate.setDate(d.getDate() + daysToAdd);
  }

  return toLocalISOString(targetDate);
};

/**
 * Calculates the start date (Wednesday) of the planning week.
 * Original Logic: Returns the "Next Wednesday" relative to baseDate (mostly for future planning).
 * Kept for compatibility, but `getCurrentWeekStart` + 7 days is usually safer for "Next Week".
 */
export const getPlanningWeekStart = (baseDate: Date = new Date()): string => {
  const d = new Date(baseDate);
  const currentDay = d.getDay(); // 0=Sun, 1=Mon, ..., 3=Wed

  const daysToAdd = (3 + 7 - currentDay) % 7 || 7;

  d.setDate(d.getDate() + daysToAdd);
  return toLocalISOString(d);
};

/**
 * Returns the Wednesday date string that is 7 days prior to the given date.
 */
export const getPreviousWeekStart = (currentWeekStartStr: string): string => {
  return addDays(currentWeekStartStr, -7);
};

/**
 * Generates the display range string (e.g., "1月8日 - 1月14日")
 * Range is WeekStart (Wed) to WeekStart + 6 days (Tue).
 */
export const getWeekRangeString = (weekStartStr: string): string => {
  const start = parseLocalString(weekStartStr);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
};