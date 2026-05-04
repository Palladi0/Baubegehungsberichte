import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  user_id: z.string().uuid('Ungültige Nutzer-ID'),
  phone_number: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, 'Telefonnummer muss im E.164-Format sein (z. B. +4917612345678)'),
  label: z.string().max(100).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request.headers.get('Authorization'))
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('phone_registrations')
    .select('id, user_id, phone_number, label, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request.headers.get('Authorization'))
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ungültige Eingabe', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('phone_registrations')
    .insert(parsed.data)
    .select('id, user_id, phone_number, label, is_active, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Diese Telefonnummer ist bereits registriert' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
