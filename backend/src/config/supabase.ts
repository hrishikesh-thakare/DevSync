import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Supabase URL or Service Role Key is missing. Storage/OAuth features will not work.');
}

// We use the Service Role Key in the backend to bypass RLS since our Express app handles authorization.
export const supabase = createClient(
  env.SUPABASE_URL || 'https://placeholder.supabase.co',
  env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
