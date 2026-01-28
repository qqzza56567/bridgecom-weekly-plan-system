import { supabase } from '../supabaseClient';
import { DailyPlanSubmission } from '../types';

export interface DbDailyPlan {
    id: string;
    user_id: string;
    date: string;
    goals: any; // JSONB
    status: 'Valid' | 'Invalid';
    incomplete_reason?: string;
    created_at: string;
}

export const DailyPlanService = {
    async fetchAllDailyPlans(): Promise<DailyPlanSubmission[]> {
        const { data: plans, error } = await supabase
            .from('daily_plans')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;
        if (!plans) return [];

        const { data: profiles } = await supabase.from('profiles').select('id, full_name');

        return plans.map(p => ({
            id: p.id,
            userId: p.user_id,
            userName: profiles?.find(u => u.id === p.user_id)?.full_name || 'Unknown',
            date: p.date,
            goals: p.goals || [],
            status: p.status,
            incompleteReason: p.incomplete_reason
        }));
    },

    async fetchDailyPlansByUser(userId: string): Promise<DailyPlanSubmission[]> {
        const { data: plans, error } = await supabase
            .from('daily_plans')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });

        if (error) throw error;
        if (!plans) return [];

        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();

        return plans.map(p => ({
            id: p.id,
            userId: p.user_id,
            userName: profile?.full_name || 'Unknown',
            date: p.date,
            goals: p.goals || [],
            status: p.status,
            incompleteReason: p.incomplete_reason
        }));
    },

    async fetchDailyPlanByDate(userId: string, date: string): Promise<DailyPlanSubmission | null> {
        const { data, error } = await supabase
            .from('daily_plans')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
            id: data.id,
            userId: data.user_id,
            userName: '',
            date: data.date,
            goals: data.goals || [],
            status: data.status,
            incompleteReason: data.incomplete_reason
        };
    },

    async saveDailyPlan(plan: DailyPlanSubmission): Promise<void> {
        // Use upsert to handle "one per user per day"
        // Note: Requires a unique constraint on (user_id, date) in Postgres
        const { error } = await supabase
            .from('daily_plans')
            .upsert({
                id: plan.id,
                user_id: plan.userId,
                date: plan.date,
                goals: plan.goals,
                status: plan.status,
                incomplete_reason: plan.incompleteReason
            }, { onConflict: 'user_id, date' });

        if (error) throw error;
    },

    async deleteDailyPlan(id: string): Promise<void> {
        const { error } = await supabase
            .from('daily_plans')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * DANGER: Clear all daily plans.
     */
    async clearAllDailyPlans(): Promise<void> {
        const { error } = await supabase.from('daily_plans').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
    }
};
