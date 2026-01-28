/**
 * Taiwan Holidays for 2026 (Simplified for demonstration)
 * In a production app, this should ideally come from an API or a more comprehensive library.
 */

export interface Holiday {
    date: string; // YYYY-MM-DD
    name: string;
}

const TAIWAN_HOLIDAYS_2026: Record<string, string> = {
    '2026-01-01': '元旦',
    '2026-02-13': '補假 (春節)', // Example
    '2026-02-16': '農曆除夕',
    '2026-02-17': '初一',
    '2026-02-18': '初二',
    '2026-02-19': '初三',
    '2026-02-20': '初四',
    '2026-02-21': '初五',
    '2026-02-22': '初六',
    '2026-02-28': '和平紀念日',
    '2026-04-03': '兒童節',
    '2026-04-04': '清明節',
    '2026-06-19': '端午節',
    '2026-09-25': '中秋節',
    '2026-10-10': '國慶日',
};

// Also include weekends as "Rest Days"
export const isHolidayOrWeekend = (dateStr: string): { isRestDay: boolean, label?: string } => {
    const holidayName = TAIWAN_HOLIDAYS_2026[dateStr];
    if (holidayName) {
        return { isRestDay: true, label: holidayName };
    }

    const date = new Date(dateStr);
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) {
        return { isRestDay: true, label: day === 0 ? '週日' : '週六' };
    }

    return { isRestDay: false };
};
