import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { runWorkerIteration } from '@/lib/media-worker'

export const dynamic = 'force-dynamic'

// Manueller Trigger für eine Worker-Iteration (nützlich für Tests + Admin-UI)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request.headers.get('Authorization'))
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const result = await runWorkerIteration()
  return NextResponse.json(result)
}
