export interface DbProfile {
    id: string; // UUID
    email: string;
    full_name: string;
    is_manager: boolean;
    is_admin: boolean;
}

export interface DbWeeklyPlan {
    id: string; // UUID
    user_id: string; // FK -> profiles.id
    week_start_date: string; // YYYY-MM-DD
    week_range_label: string;
    status: 'draft' | 'pending' | 'approved' | 'rejected';
    submitted_at: string | null;
    updated_at: string;
    review_comment: string | null;
    total_hours: number;
    key_ratio: number;
    remark: string | null;
    last_week_review: any; // JSONB
}

export interface DbPlanTask {
    id: string; // UUID
    plan_id: string; // FK -> weekly_plans.id
    name: string;
    category: '關鍵職責' | '其他事項';
    priority: '高' | '中' | '低';
    outcome: string | null;
    estimated_hours: number;
    actual_hours: number;
    progress: number;
    not_done_reason: string | null;
    status: 'open' | 'in_progress' | 'on_hand' | 'done';
    last_touched_at: string | null;
    sort_order: number;
}
