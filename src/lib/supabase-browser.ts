import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Browser client — use in Client Components only.
 * Automatically reads/writes session cookies.
 */
export function createBrowserClient() {
  return _createBrowserClient(supabaseUrl, supabaseAnonKey)
}
