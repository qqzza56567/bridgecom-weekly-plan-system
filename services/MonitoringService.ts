import { User, WeeklyPlanSubmission, DailyPlanSubmission } from '../types';
import { PlanService } from './PlanService';
import { DailyPlanService } from './DailyPlanService';
import { UserService } from './UserService';

export interface UserStatus {
    user: User;
    weeklyPlanStatus: 'submitted' | 'pending' | 'missing';
    dailyPlanStatus: 'submitted' | 'missing';
    lastLogin?: string; // Potential future enhancement
}

export const MonitoringService = {
    /**
     * Aggregates all users and their submission status for a specific week and date.
     */
    async getMonitoringData(targetWeekStart: string, targetDate: string): Promise<UserStatus[]> {
        const [users, allWeeklyPlans, allDailyPlans] = await Promise.all([
            UserService.fetchAllUsers(),
            PlanService.fetchAllPlans(),
            DailyPlanService.fetchAllDailyPlans()
        ]);

        return users.map(user => {
            // Check Weekly Plan
            const weeklyPlan = allWeeklyPlans.find(p => p.userId === user.id && p.weekStart === targetWeekStart);
            let wStatus: 'submitted' | 'pending' | 'missing' = 'missing';

            if (weeklyPlan) {
                if (weeklyPlan.status === 'approved') wStatus = 'submitted'; // Treated as done
                else if (weeklyPlan.status === 'pending' || weeklyPlan.status === 'rejected') wStatus = 'pending'; // Needs attention
                else if (weeklyPlan.status === 'draft') wStatus = 'missing'; // Draft is effectively missing submission
            }

            // Check Daily Plan
            const dailyPlan = allDailyPlans.find(p => p.userId === user.id && p.date === targetDate);
            const dStatus: 'submitted' | 'missing' = dailyPlan ? 'submitted' : 'missing';

            return {
                user,
                weeklyPlanStatus: wStatus,
                dailyPlanStatus: dStatus
            };
        });
    },

    /**
     * Get list of users who haven't submitted weekly plan for the given week
     */
    async getMissingWeeklyReporters(targetWeekStart: string): Promise<User[]> {
        const statuses = await this.getMonitoringData(targetWeekStart, new Date().toISOString().split('T')[0]);
        return statuses.filter(s => s.weeklyPlanStatus === 'missing').map(s => s.user);
    },

    /**
     * Get list of users who haven't submitted daily plan for the given date
     */
    async getMissingDailyReporters(targetDate: string): Promise<User[]> {
        // We can pass any weekStart here since we only care about daily status
        const statuses = await this.getMonitoringData("2020-01-01", targetDate);
        return statuses.filter(s => s.dailyPlanStatus === 'missing').map(s => s.user);
    }
};
