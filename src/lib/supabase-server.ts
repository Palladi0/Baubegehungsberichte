import 'server-only'
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Server client for Server Components, Server Actions, and Route Handlers.
 * Reads the session from HTTP-only cookies.
 */
export async function createServerActionClient() {
  const cookieStore = await cookies()
  return _createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // `setAll` was called from a Server Component.
          // Safe to ignore if middleware refreshes the session.
        }
      },
    },
  })
}
