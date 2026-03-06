import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'no-reply@yourdomain.com';

// 取得台灣時間（UTC+8）
function getTaiwanNow(): Date {
    return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

// 計算當前週計畫起始日（週三）
// 規則：
//   - 週三（3）、週四（4）→ 本週週三
//   - 週五（5）、週六（6）、週日（0）、週一（1）、週二（2）→ 下週週三
function getCurrentWeekStart(): string {
    const now = getTaiwanNow();
    const day = now.getUTCDay(); // 0=週日, 1=週一, ..., 3=週三, 4=週四 ...
    let daysToAdd: number;
    if (day === 3 || day === 4) {
        // 本週週三
        daysToAdd = 3 - day; // e.g. 週四時為 -1
    } else {
        // 下週週三
        daysToAdd = (3 - day + 7) % 7;
        if (daysToAdd === 0) daysToAdd = 7;
    }
    const wednesday = new Date(now);
    wednesday.setUTCDate(now.getUTCDate() + daysToAdd);
    // 回傳 YYYY-MM-DD（台灣日期）
    const y = wednesday.getUTCFullYear();
    const m = String(wednesday.getUTCMonth() + 1).padStart(2, '0');
    const d = String(wednesday.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 產生週次標籤，例如 "3月5日 - 3月11日"（週三到下週二，共7天）
function getWeekRangeString(weekStart: string): string {
    const [y, m, d] = weekStart.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
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

        // 2. 查出本週已有計畫的員工（含狀態）
        const { data: existingPlans, error: planError } = await supabase
            .from('weekly_plans')
            .select('user_id, status')
            .eq('week_start_date', currentWeekStart);

        if (planError) throw planError;

        // 將員工分為三組：
        // - noPlans：完全沒有計畫 → 建立草稿 + 寄提醒信
        // - draftOnly：有草稿但尚未提交 → 只寄提醒信（不建立新計畫）
        // - submitted：已提交（pending/approved/rejected）→ 完全略過
        const planMap = new Map((existingPlans || []).map((p: any) => [p.user_id, p.status]));

        const noPlans = employees.filter((emp: any) => !planMap.has(emp.id));
        const draftOnly = employees.filter((emp: any) => planMap.get(emp.id) === 'draft');
        const needEmail = [...noPlans, ...draftOnly];

        console.log(`[auto-generate-plans] ${employees.length} employees total | no plan: ${noPlans.length} | draft: ${draftOnly.length} | submitted: ${employees.length - noPlans.length - draftOnly.length}`);

        // 3. 批次建立空白草稿（只針對完全沒有計畫的員工）
        if (noPlans.length > 0) {
            const draftPlans = noPlans.map((emp: any) => ({
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
        }

        // 4. 發送 Email 通知（沒有計畫 + 有草稿但未提交的員工）
        if (needEmail.length === 0) {
            return new Response(JSON.stringify({
                message: 'All employees have submitted plans, no action needed',
                week: currentWeekRange,
            }), { status: 200 });
        }

        const emailResults = await Promise.allSettled(
            needEmail.map(async (emp: any) => {
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
                <p>請於下班前完成。</p>
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
            plansCreated: noPlans.length,
            draftReminders: draftOnly.length,
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
