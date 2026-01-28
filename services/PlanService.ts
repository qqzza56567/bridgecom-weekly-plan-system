import { supabase } from '../supabaseClient';
import { User, WeeklyPlanSubmission, WeeklyTask, PlanStatus } from '../types';
import { DbWeeklyPlan, DbPlanTask, DbProfile } from '../db_types';

/**
 * Service to handle all interactions with Supabase relating to Plans.
 * This abstracts the DB logic from the UI components.
 */

// --- Plan Converters ---
// Convert DB row to App Type
function convertDbPlanToAppPlan(dbPlan: DbWeeklyPlan, dbTasks: DbPlanTask[] | undefined, userName: string): WeeklyPlanSubmission {
    return {
        id: dbPlan.id,
        userId: dbPlan.user_id,
        userName: userName,
        weekRange: dbPlan.week_range_label,
        weekStart: dbPlan.week_start_date,
        submittedAt: dbPlan.submitted_at || '',
        updatedAt: dbPlan.updated_at,
        status: dbPlan.status,
        reviewComment: dbPlan.review_comment || undefined,
        totalHours: Number(dbPlan.total_hours),
        keyRatio: Number(dbPlan.key_ratio),
        remark: dbPlan.remark || undefined,
        lastWeekReview: dbPlan.last_week_review || undefined,
        tasks: (dbTasks || []).map(t => ({
            id: t.id,
            name: t.name,
            category: t.category as any,
            priority: t.priority as any,
            outcome: t.outcome || '',
            hours: Number(t.estimated_hours),
            actualHours: Number(t.actual_hours || 0),
            progress: t.progress || 0,
            notDoneReason: t.not_done_reason || '',
            status: t.status as any,
            lastTouchedAt: t.last_touched_at || ''
        }))
    };
}


export const PlanService = {
    async fetchUserPlans(userId: string): Promise<WeeklyPlanSubmission[]> {
        const { data: plans, error } = await supabase
            .from('weekly_plans')
            .select(`
                *,
                profiles (full_name),
                plan_tasks (*)
            `)
            .eq('user_id', userId)
            .order('week_start_date', { ascending: false })
            .order('sort_order', { foreignTable: 'plan_tasks', ascending: true });

        if (error) throw error;
        if (!plans) return [];

        return plans.map(p => {
            const userName = (p as any).profiles?.full_name || 'Unknown';
            const tasks = (p as any).plan_tasks || [];
            return convertDbPlanToAppPlan(p as any, tasks, userName);
        });
    },

    /**
     * Create or Update a Weekly Plan
     * This performs a "Upsert" logic or explicit insert/update.
     * Since we separate Plans and Tasks tables, this is a transaction-like operation.
     */
    async savePlan(plan: WeeklyPlanSubmission, isNew: boolean): Promise<string> {
        try {
            // 0. Safety check: ensure we use the existing ID if a plan for this user/week already exists
            const { data: existingPlans, error: selectError } = await supabase
                .from('weekly_plans')
                .select('id')
                .eq('user_id', plan.userId)
                .eq('week_start_date', plan.weekStart)
                .limit(1);

            if (selectError) {
                throw selectError;
            }

            const existingPlan = existingPlans?.[0];
            const finalId = existingPlan?.id || plan.id;
            if (existingPlan && existingPlan.id !== plan.id) {
                // This case indicates a client-side ID mismatch, but we prioritize the DB's existing ID.
                // No need to warn, just proceed with the correct ID.
            }

            // 1. Upsert Plan
            const planData: Partial<DbWeeklyPlan> = {
                id: finalId,
                user_id: plan.userId,
                week_start_date: plan.weekStart,
                week_range_label: plan.weekRange,
                status: plan.status,
                submitted_at: plan.submittedAt || null,
                updated_at: new Date().toISOString(),
                review_comment: plan.reviewComment,
                total_hours: Number(plan.totalHours) || 0,
                key_ratio: Number(plan.keyRatio) || 0,
                remark: plan.remark || null,
                last_week_review: plan.lastWeekReview || null
            };

            const { error: planError } = await supabase
                .from('weekly_plans')
                .upsert(planData);

            if (planError) {
                console.error("[PlanService] Upsert Plan Error:", planError);
                console.error("[PlanService] Plan Data:", planData);
                throw new Error(`儲存計畫主檔失敗: ${planError.message}`);
            }

            // 2. Handle Tasks
            // First, delete old tasks
            const { error: deleteError } = await supabase
                .from('plan_tasks')
                .delete()
                .eq('plan_id', finalId);

            if (deleteError) {
                throw new Error(`更新計畫任務時清理舊資料失敗: ${deleteError.message}`);
            }

            // Prepare and insert new tasks
            if (plan.tasks.length > 0) {
                const tasksData = plan.tasks.map((t, index) => ({
                    id: t.id, // CRITICAL: Preserve the ID to keep references stable!
                    plan_id: finalId,
                    name: t.name || '未命名任務',
                    category: (t.category as any) || '其他事項',
                    priority: (t.priority as any) || '低',
                    outcome: t.outcome || '',
                    estimated_hours: Number(t.hours) || 0,
                    actual_hours: Number(t.actualHours) || 0,
                    progress: Math.min(100, Math.max(0, Number(t.progress) || 0)),
                    not_done_reason: t.notDoneReason || null,
                    status: t.status || 'open',
                    last_touched_at: (t.lastTouchedAt || new Date().toISOString()).split('T')[0],
                    sort_order: index
                }));

                const { error: taskError } = await supabase
                    .from('plan_tasks')
                    .insert(tasksData);

                if (taskError) {
                    throw new Error(`儲存計畫任務失敗: ${taskError.message}`);
                }
            }

            // 3. Sync Last Week Review stats back to the ORIGINAL tasks (for History View)
            if (plan.lastWeekReview && plan.lastWeekReview.tasks.length > 0) {
                console.log("[PlanService] Syncing review stats to historical tasks...");
                const reviewUpdates = plan.lastWeekReview.tasks.map(async (rTask) => {
                    // Try 1: Update by accurate ID
                    let { data, error: updateError } = await supabase
                        .from('plan_tasks')
                        .update({
                            actual_hours: Number(rTask.actualHours) || 0,
                            progress: Number(rTask.progress) || 0,
                            not_done_reason: rTask.notDoneReason || null,
                            last_touched_at: new Date().toISOString()
                        })
                        .eq('id', rTask.taskId)
                        .select();

                    if (updateError) {
                        console.error(`[PlanService] Failed to update task ${rTask.taskId}`, updateError);
                    } else if (!data || data.length === 0) {
                        console.error(`[PlanService] CRITICAL: Task ID ${rTask.taskId} lookup failed. This indicates an ID consistency issue.`);
                    } else {
                        console.log(`[PlanService] Successfully updated task ${rTask.taskId}. Progress: ${rTask.progress}%`);
                    }
                });

                await Promise.all(reviewUpdates);
            }

            return finalId;

        } catch (error) {
            console.error("[PlanService] savePlan failed:", error);
            throw error;
        }
    },

    /**
     * Update Plan during Review (Status, Comment, Last Week Review)
     * This avoids touching plan_tasks table, as requested.
     */
    async updateReviewData(planId: string, status: PlanStatus, comment: string, lastWeekReview: any): Promise<void> {
        const { error } = await supabase
            .from('weekly_plans')
            .update({
                status: status,
                review_comment: comment,
                last_week_review: lastWeekReview, // Update the JSON column
                updated_at: new Date().toISOString()
            })
            .eq('id', planId);

        if (error) throw error;
    },

    /**
     * Update Status Only (Legacy or simple use case)
     */
    async updatePlanStatus(planId: string, status: PlanStatus, comment: string): Promise<void> {
        const { error } = await supabase
            .from('weekly_plans')
            .update({
                status: status,
                review_comment: comment,
                updated_at: new Date().toISOString()
            })
            .eq('id', planId);

        if (error) throw error;
    },

    async fetchAllPlans(): Promise<WeeklyPlanSubmission[]> {
        const { data: plans, error } = await supabase
            .from('weekly_plans')
            .select(`
                *,
                profiles (full_name),
                plan_tasks (*)
            `)
            .order('week_start_date', { ascending: false })
            .order('sort_order', { foreignTable: 'plan_tasks', ascending: true });

        if (error) throw error;
        if (!plans) return [];

        return plans.map(p => {
            const userName = (p as any).profiles?.full_name || 'Unknown';
            const tasks = (p as any).plan_tasks || [];
            return convertDbPlanToAppPlan(p as any, tasks, userName);
        });
    },

    /**
     * DANGER: Clear all weekly plans and tasks.
     * Used for system reset.
     */
    async clearAllPlans(): Promise<void> {
        // Due to foreign key (if any), delete tasks first
        const { error: taskError } = await supabase.from('plan_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (taskError) throw taskError;

        const { error: planError } = await supabase.from('weekly_plans').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (planError) throw planError;
    }
};
