import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    temperature: 0.0,
    topP: 0.95,
    responseMimeType: 'application/json',
  },
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // Verify the caller is an authenticated Supabase user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    let result: unknown;

    switch (action) {
      case 'validateSmartGoals': {
        const prompt = params.prompt as string;
        const response = await model.generateContent(prompt);
        result = JSON.parse(response.response.text());
        break;
      }
      case 'validatePlanContent': {
        const prompt = params.prompt as string;
        const response = await model.generateContent(prompt);
        result = JSON.parse(response.response.text());
        break;
      }
      case 'generateWeeklyReport': {
        const prompt = params.prompt as string;
        const response = await model.generateContent(prompt);
        result = JSON.parse(response.response.text());
        break;
      }
      case 'generateMonthlyReport': {
        const prompt = params.prompt as string;
        const response = await model.generateContent(prompt);
        result = JSON.parse(response.response.text());
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400 });
    }

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[gemini-proxy] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
