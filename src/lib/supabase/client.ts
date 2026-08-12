// ============================================================
// SUPABASE CLIENT LAYER
// ============================================================
// In production, replace the local DB calls with Supabase client calls.
// This file provides the abstraction layer.
//
// SETUP INSTRUCTIONS:
// 1. Create a Supabase project at https://supabase.com
// 2. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env
// 3. Run the migration SQL in supabase/migrations/ in the Supabase SQL editor
// 4. The application will automatically use Supabase when credentials are available
// ============================================================

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const hasSupabaseConfig = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// NOTE: In production deployment, import and use @supabase/supabase-js here:
// import { createClient } from '@supabase/supabase-js';
// export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
//
// Then replace db.* calls with supabase.from('table').* calls in the API routes.
