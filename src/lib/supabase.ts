import { createClient } from '@supabase/supabase-js';

// For server-side (API routes)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!, // Service key for admin access
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// For client-side (React components)
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);