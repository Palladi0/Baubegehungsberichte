import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  return NextResponse.json({
    id: auth.userId,
    email: auth.email,
    role: auth.role,
  })
}
