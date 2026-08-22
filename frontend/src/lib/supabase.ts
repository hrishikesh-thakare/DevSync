import { createClient } from '@supabase/supabase-js';

// Get these from env variables in a real app, but for now we'll use Vite env vars.
// The user needs to add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase env vars in frontend. OAuth will not work.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder_key'
);
