// utils/supabase/admin.ts
//
// Service-role Supabase client. Server-only: never import this from a client
// component. It bypasses RLS, so every query must filter by the signed-in
// user's id.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}
