/**
 * Shared Supabase environment variables.
 *
 * This module is safe to import from both client and server code.
 * - Browser client lives in `./supabase-browser.ts`
 * - Server client (uses `next/headers`) lives in `./supabase-server.ts`
 * - Service-role client (server-only) lives in `./supabase-service.ts`
 * - Middleware client lives in `./supabase-middleware.ts`
 *
 * Keeping these in separate files prevents `next/headers` from leaking into
 * the client bundle, which would otherwise cause a build error.
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Re-export the browser client so existing client components keep working.
export { createBrowserClient } from './supabase-browser'
