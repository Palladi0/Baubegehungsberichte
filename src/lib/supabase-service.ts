import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Service role client — bypasses RLS. Server-side only. Never expose to the browser.
 * Used exclusively in admin API routes.
 */
export function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
