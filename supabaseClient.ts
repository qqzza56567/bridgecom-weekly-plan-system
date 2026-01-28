import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase credentials not found in env variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
} else {
    console.log(`[Supabase] Client initialized with URL: ${supabaseUrl.substring(0, 15)}...`);
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
