import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'no-reply@yourdomain.com';
const APP_URL = Deno.env.get('APP_URL') || 'https://yourapp.com';

interface NotifyManagerPayload {
  planId: string;
  employeeName: string;
  weekRange: string;
  managerId: string;
}

Deno.serve(async (req) => {
  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const payload: NotifyManagerPayload = await req.json();
    const { planId, employeeName, weekRange, managerId } = payload;

    if (!planId || !employeeName || !weekRange || !managerId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 查詢主管 email
    const { data: manager, error: managerError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', managerId)
      .single();

    if (managerError || !manager?.email) {
      console.error('[notify-manager] Failed to find manager:', managerError);
      return new Response(JSON.stringify({ error: 'Manager not found' }), { status: 404 });
    }

    // 發送 Email 通知
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: manager.email,
        subject: `[週計畫重新提交] ${employeeName} 已修改並重新提交 ${weekRange} 的計畫`,
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: auto; padding: 24px; background: #f9faff; border-radius: 8px;">
            <h2 style="color: #1d4ed8;">📋 週計畫重新提交通知</h2>
            <p>您好，<strong>${manager.full_name}</strong>，</p>
            <p>
              員工 <strong>${employeeName}</strong> 已針對退回的
              <strong>${weekRange}</strong> 週計畫進行修改，並重新提交，請前往審核。
            </p>
            <a href="${APP_URL}/review"
               style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
              前往審核計畫
            </a>
            <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">此為系統自動發送，請勿直接回覆。</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[notify-manager] Email send failed: ${body}`);
      return new Response(JSON.stringify({ error: 'Email failed', detail: body }), { status: 500 });
    }

    console.log(`[notify-manager] Notified ${manager.email} about plan ${planId} resubmission`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[notify-manager] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
