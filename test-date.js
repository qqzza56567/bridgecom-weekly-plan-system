import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    const { data: plans } = await supabase.from('daily_plans').select('*').limit(5);
    console.log("Daily Plans Dates:", plans.map(p => p.date));
    
    const { data: wp } = await supabase.from('weekly_plans').select('id, week_start').limit(5);
    console.log("Weekly Plans Starts:", wp.map(p => p.week_start));
}
test();
