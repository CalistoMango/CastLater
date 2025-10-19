import { createClient } from '@supabase/supabase-js';
import { env } from '~/lib/env.server';

// For server-side (API routes)
export const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY, // Service key for admin access
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
