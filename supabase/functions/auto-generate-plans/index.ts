import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'no-reply@yourdomain.com';

// 計算本週週一日期（週計畫以週一為起點）
function getCurrentWeekStart(): string {
    const now = new Date();
    // 若是週日 (0)，退一週
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return monday.toISOString().split('T')[0];
}

// 產生週次標籤，例如 "2025-W08"
function getWeekRangeString(weekStart: string): string {
    const date = new Date(weekStart + 'T00:00:00');
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const weekNum = Math.ceil(
        ((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

Deno.serve(async (_req) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const currentWeekStart = getCurrentWeekStart();
        const currentWeekRange = getWeekRangeString(currentWeekStart);

        console.log(`[auto-generate-plans] Running for week: ${currentWeekRange} (${currentWeekStart})`);

        // 1. 取得所有非主管員工
        const { data: employees, error: empError } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('is_manager', false);

        if (empError) throw empError;
        if (!employees || employees.length === 0) {
            return new Response(JSON.stringify({ message: 'No employees found' }), { status: 200 });
        }

        // 2. 查出本週已有計畫的員工
        const { data: existingPlans, error: planError } = await supabase
            .from('weekly_plans')
            .select('user_id')
            .eq('week_start_date', currentWeekStart);

        if (planError) throw planError;

        const existingUserIds = new Set(existingPlans?.map((p: any) => p.user_id) || []);
        const missingEmployees = employees.filter((emp: any) => !existingUserIds.has(emp.id));

        console.log(`[auto-generate-plans] ${employees.length} employees total, ${missingEmployees.length} missing plans`);

        if (missingEmployees.length === 0) {
            return new Response(JSON.stringify({ message: 'All employees already have plans', week: currentWeekRange }), { status: 200 });
        }

        // 3. 批次建立空白草稿
        const draftPlans = missingEmployees.map((emp: any) => ({
            id: crypto.randomUUID(),
            user_id: emp.id,
            week_start_date: currentWeekStart,
            week_range_label: currentWeekRange,
            status: 'draft',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            total_hours: 0,
            key_ratio: 0,
            is_unlocked: false,
        }));

        const { error: insertError } = await supabase
            .from('weekly_plans')
            .insert(draftPlans);

        if (insertError) throw insertError;

        console.log(`[auto-generate-plans] Inserted ${draftPlans.length} draft plans`);

        // 4. 發送 Email 通知（使用 Resend）
        const emailResults = await Promise.allSettled(
            missingEmployees.map(async (emp: any) => {
                if (!emp.email) return;
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${RESEND_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: FROM_EMAIL,
                        to: emp.email,
                        subject: `[週計畫提醒] ${currentWeekRange} 請記得填寫您的週計畫`,
                        html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 24px; background: #f9faff; border-radius: 8px;">
                <h2 style="color: #1d4ed8;">📋 週計畫填寫提醒</h2>
                <p>您好，<strong>${emp.full_name}</strong>，</p>
                <p>系統已為您建立 <strong>${currentWeekRange}</strong> 的週計畫表單，請記得盡早填寫本週計畫內容。</p>
                <p>系統填寫截止時間為本週四晚間，逾時將無法自行填寫。</p>
                <a href="${Deno.env.get('APP_URL') || 'https://yourapp.com'}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
                  前往填寫週計畫
                </a>
                <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">此為系統自動發送，請勿直接回覆。</p>
              </div>
            `,
                    }),
                });
                if (!res.ok) {
                    const body = await res.text();
                    console.error(`Failed to send email to ${emp.email}: ${body}`);
                }
            })
        );

        const successCount = emailResults.filter(r => r.status === 'fulfilled').length;

        return new Response(JSON.stringify({
            message: 'Done',
            week: currentWeekRange,
            plansCreated: draftPlans.length,
            emailsSent: successCount,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[auto-generate-plans] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
