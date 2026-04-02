import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';

    if (!GEMINI_API_KEY) {
      console.error('[gemini-proxy] GEMINI_API_KEY is missing');
      return new Response(JSON.stringify({ error: 'Server configuration error: GEMINI_API_KEY missing' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Since we disabled gateway JWT verification (--no-verify-jwt), we MUST verify it manually 
    // to prevent unauthorized public access to this endpoint.
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.warn('[gemini-proxy] Missing auth header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        console.error('[gemini-proxy] Invalid user token:', authError);
        return new Response(JSON.stringify({ error: 'Unauthorized', details: 'Invalid user token' }), { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.0,
        topP: 0.95,
        responseMimeType: 'application/json',
      },
    });

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
      case 'validateWeeklyTask': {
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
        console.warn(`[gemini-proxy] Unknown action: ${action}`);
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[gemini-proxy] Unhandled Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
