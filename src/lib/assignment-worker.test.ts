import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (via vi.hoisted um TDZ-Probleme mit vi.mock-Factories zu vermeiden) ---

const { mockFrom, mockTwilioCreate } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockTwilioCreate: vi.fn().mockResolvedValue({}),
}))

vi.mock('./supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('./twilio', () => ({
  twilioClient: {
    messages: { create: mockTwilioCreate },
  },
}))

import { extractHashtags, hasPendingClarification, resolveWithClarification } from './assignment-worker'

// --- Hilfsfunktionen ---

function chainSelect(returnData: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: returnData })
  const ilike = vi.fn(() => ({ maybeSingle }))
  const gte = vi.fn(() => ({ order: () => ({ limit: () => ({ then: undefined }), maybeSingle }), limit: () => ({ then: undefined }) }))
  const order = vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: returnData }) }))
  const limit = vi.fn().mockResolvedValue({ data: returnData })
  const eq2 = vi.fn(() => ({ eq: vi.fn(() => ({ gte, maybeSingle, limit, order })), gte, maybeSingle, limit, order }))
  const eq1 = vi.fn(() => ({ eq: eq2, gte, maybeSingle, ilike }))
  return {
    select: vi.fn(() => ({ eq: eq1, ilike })),
  }
}

describe('extractHashtags', () => {
  it('extrahiert einen einzelnen Hashtag', () => {
    expect(extractHashtags('Bitte #BV-23-Hamburg dokumentieren')).toEqual(['BV-23-Hamburg'])
  })

  it('extrahiert mehrere Hashtags', () => {
    expect(extractHashtags('#BV-23 und #MF-24-Berlin')).toEqual(['BV-23', 'MF-24-Berlin'])
  })

  it('gibt leeres Array zurück ohne Hashtag', () => {
    expect(extractHashtags('Keine Hashtags hier')).toEqual([])
  })

  it('gibt leeres Array für leeren String zurück', () => {
    expect(extractHashtags('')).toEqual([])
  })

  it('extrahiert Hashtag am Anfang', () => {
    expect(extractHashtags('#BV-23-Hamburg Begehung heute')).toEqual(['BV-23-Hamburg'])
  })

  it('extrahiert duplikate Hashtags', () => {
    expect(extractHashtags('#BV-23 #BV-23')).toEqual(['BV-23', 'BV-23'])
  })

  it('ignoriert Zahlen-Hashtags (z. B. #123)', () => {
    expect(extractHashtags('#123')).toEqual(['123'])
  })

  it('erkennt Kleinbuchstaben-Hashtag', () => {
    expect(extractHashtags('#bv-23-hamburg')).toEqual(['bv-23-hamburg'])
  })

  it('extrahiert keinen Hashtag aus leerem #', () => {
    expect(extractHashtags('# kein kuerzel')).toEqual([])
  })
})

describe('hasPendingClarification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt true zurück wenn offene Klärung vorhanden', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({
              limit: vi.fn().mockResolvedValue({ data: [{ id: 'msg-1' }] }),
            }),
          }),
        }),
      }),
    })
    const result = await hasPendingClarification('+4917612345678')
    expect(result).toBe(true)
  })

  it('gibt false zurück wenn keine Klärung vorhanden', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
      }),
    })
    const result = await hasPendingClarification('+4917612345678')
    expect(result).toBe(false)
  })

  it('gibt false zurück bei DB-Fehler (data null)', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({
              limit: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      }),
    })
    const result = await hasPendingClarification('+4917612345678')
    expect(result).toBe(false)
  })
})

describe('resolveWithClarification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTwilioCreate.mockResolvedValue({})
  })

  it('gibt false zurück wenn keine offene Klärung existiert', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({
              order: () => ({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        }),
      }),
    })
    const result = await resolveWithClarification('+4917612345678', 'BV-23-Hamburg')
    expect(result).toBe(false)
  })

  it('ordnet Nachricht zu wenn gültiges Kürzel gegeben', async () => {
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) })

    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'incoming_messages') {
        callCount++
        if (callCount === 1) {
          // Erste Abfrage: offene Klärung suchen
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  gte: () => ({
                    order: () => ({
                      limit: vi.fn().mockResolvedValue({
                        data: [{ id: 'msg-1', clarification_attempts: 1 }],
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        // Zweite Abfrage: Update
        return { update: mockUpdate }
      }
      if (table === 'projekte') {
        return {
          select: () => ({
            ilike: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'proj-1', kuerzel: 'BV-23-Hamburg', name: 'Projekt A', archived_at: null },
              }),
            }),
          }),
        }
      }
      return {}
    })

    const result = await resolveWithClarification('+4917612345678', 'BV-23-Hamburg')
    expect(result).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ assignment_status: 'assigned', assignment_method: 'clarification_reply' })
    )
    expect(mockTwilioCreate).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('BV-23-Hamburg') })
    )
  })

  it('sendet Fehlermeldung bei archiviertem Projekt', async () => {
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'incoming_messages') {
        callCount++
        if (callCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  gte: () => ({
                    order: () => ({
                      limit: vi.fn().mockResolvedValue({
                        data: [{ id: 'msg-1', clarification_attempts: 0 }],
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }
      }
      if (table === 'projekte') {
        return {
          select: () => ({
            ilike: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'proj-archived', kuerzel: 'ALT-19', name: 'Alt-Projekt', archived_at: '2025-01-01T00:00:00Z' },
              }),
            }),
          }),
        }
      }
      return {}
    })

    const result = await resolveWithClarification('+4917612345678', 'ALT-19')
    expect(result).toBe(true)
    expect(mockTwilioCreate).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('archiviert') })
    )
  })

  it('erhöht Versuche bei unbekanntem Kürzel und sendet erneute Anfrage', async () => {
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) })

    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'incoming_messages') {
        callCount++
        if (callCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  gte: () => ({
                    order: () => ({
                      limit: vi.fn().mockResolvedValue({
                        data: [{ id: 'msg-1', clarification_attempts: 1 }],
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return { update: mockUpdate }
      }
      if (table === 'projekte') {
        return {
          select: () => ({
            ilike: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }
      }
      return {}
    })

    const result = await resolveWithClarification('+4917612345678', 'UNBEKANNT-99')
    expect(result).toBe(true)
    expect(mockTwilioCreate).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('nicht gefunden') })
    )
  })

  it('setzt Status auf failed nach 3 Fehlversuchen', async () => {
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) })

    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'incoming_messages') {
        callCount++
        if (callCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  gte: () => ({
                    order: () => ({
                      limit: vi.fn().mockResolvedValue({
                        data: [{ id: 'msg-1', clarification_attempts: 3 }],
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return { update: mockUpdate }
      }
      if (table === 'projekte') {
        return {
          select: () => ({
            ilike: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }
      }
      return {}
    })

    const result = await resolveWithClarification('+4917612345678', 'FALSCH-99')
    expect(result).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ assignment_status: 'failed' })
    )
    expect(mockTwilioCreate).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('manuell') })
    )
  })
})
