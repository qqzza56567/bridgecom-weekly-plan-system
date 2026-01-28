import { WeeklyPlanSubmission, WeeklyTask } from '../types';

export interface PeriodStats {
    periodLabel: string; // e.g., "Jan", "Q1", "2024"
    totalTasks: number;
    completedTasks: number; // progress == 100
    avgProgress: number;
    totalPlannedHours: number;
    totalActualHours: number;
    keyResponsibilityRate: number; // Percentage of tasks that are key responsibilities
    plansCount: number;
}

/**
 * Helper to check if a task is 'completed'
 */
const isTaskCompleted = (t: WeeklyTask) => (t.progress || 0) >= 100;

/**
 * Aggregate stats from a list of plans
 */
const aggregateStats = (plans: WeeklyPlanSubmission[], label: string): PeriodStats => {
    let totalTasks = 0;
    let completedTasks = 0;
    let totalProgressSum = 0;
    let totalPlannedHours = 0;
    let totalActualHours = 0;
    let keyTasksCount = 0;

    plans.forEach(plan => {
        plan.tasks.forEach(task => {
            totalTasks++;
            if (isTaskCompleted(task)) completedTasks++;
            totalProgressSum += (task.progress || 0);
            totalPlannedHours += (task.hours || 0);
            totalActualHours += (task.actualHours || 0);
            if (task.category === '關鍵職責') keyTasksCount++;
        });
    });

    return {
        periodLabel: label,
        totalTasks,
        completedTasks,
        avgProgress: totalTasks > 0 ? Math.round(totalProgressSum / totalTasks) : 0,
        totalPlannedHours: Number(totalPlannedHours.toFixed(1)),
        totalActualHours: Number(totalActualHours.toFixed(1)),
        keyResponsibilityRate: totalTasks > 0 ? Math.round((keyTasksCount / totalTasks) * 100) : 0,
        plansCount: plans.length
    };
};

/**
 * Get stats grouped by Month for a specific Year
 */
export const getMonthlyStatsForYear = (plans: WeeklyPlanSubmission[], year: number): PeriodStats[] => {
    const stats: PeriodStats[] = [];

    for (let month = 0; month < 12; month++) {
        const monthPlans = plans.filter(p => {
            const date = new Date(p.weekStart);
            return date.getFullYear() === year && date.getMonth() === month;
        });

        // Label: "Jan", "Feb", etc. or "1月", "2月"
        const label = `${month + 1}月`;
        stats.push(aggregateStats(monthPlans, label));
    }

    return stats;
};

/**
 * Get stats grouped by Quarter for a specific Year
 */
export const getQuarterlyStatsForYear = (plans: WeeklyPlanSubmission[], year: number): PeriodStats[] => {
    const stats: PeriodStats[] = [];

    for (let q = 1; q <= 4; q++) {
        const quarterPlans = plans.filter(p => {
            const date = new Date(p.weekStart);
            if (date.getFullYear() !== year) return false;
            const month = date.getMonth(); // 0-11
            const planQ = Math.floor(month / 3) + 1;
            return planQ === q;
        });

        stats.push(aggregateStats(quarterPlans, `Q${q}`));
    }

    return stats;
};

/**
 * Get annual stats
 */
export const getAnnualStats = (plans: WeeklyPlanSubmission[], year: number): PeriodStats => {
    const yearPlans = plans.filter(p => new Date(p.weekStart).getFullYear() === year);
    return aggregateStats(yearPlans, `${year}年`);
};

export const getAvailableYears = (plans: WeeklyPlanSubmission[]): number[] => {
    const years = new Set(plans.map(p => new Date(p.weekStart).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
};
