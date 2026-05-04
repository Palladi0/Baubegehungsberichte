import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockTranscriptionsCreate = vi.fn()
vi.mock('openai', () => {
  return {
    default: class OpenAI {
      audio = {
        transcriptions: {
          create: (...args: unknown[]) => mockTranscriptionsCreate(...args),
        },
      }
    },
  }
})

const mockTwilioMessagesCreate = vi.fn()
vi.mock('@/lib/twilio', () => ({
  twilioClient: {
    messages: {
      create: (...args: unknown[]) => mockTwilioMessagesCreate(...args),
    },
  },
}))

// fs mock - hoisted so import in worker uses it
const mockFsExistsSync = vi.fn()
const mockFsStatSync = vi.fn()
const mockFsReadFile = vi.fn()

vi.mock('fs', () => ({
  default: {
    existsSync: mockFsExistsSync,
    statSync: mockFsStatSync,
    promises: {
      readFile: mockFsReadFile,
    },
  },
  existsSync: mockFsExistsSync,
  statSync: mockFsStatSync,
  promises: {
    readFile: mockFsReadFile,
  },
}))

// In-memory state for the supabase mock
type Job = {
  id: string
  incoming_message_id: string
  attempts: number
  status: 'pending' | 'processing' | 'done' | 'failed'
  duration_seconds?: number
  cost_usd?: number
  last_error?: string | null
  incoming_messages: {
    local_file_path: string | null
    sender_phone: string
    transcript_status: string
  }
}

const dbState: {
  transcription_jobs: Job[]
  incoming_messages: Record<string, { transcript?: string; transcript_status?: string; audio_duration_seconds?: number }>
  assignment_jobs: Array<{ incoming_message_id: string }>
} = {
  transcription_jobs: [],
  incoming_messages: {},
  assignment_jobs: [],
}

function makeQueryBuilder(tableName: string) {
  return {
    select: () => ({
      eq: (_col: string, _val: string) => ({
        lt: (_c: string, _v: number) => ({
          order: () => ({
            limit: () => {
              if (tableName === 'transcription_jobs') {
                return Promise.resolve({
                  data: dbState.transcription_jobs.filter(
                    (j) => j.status === 'pending' && j.attempts < 3
                  ),
                  error: null,
                })
              }
              return Promise.resolve({ data: [], error: null })
            },
          }),
        }),
      }),
    }),
    update: (patch: Record<string, unknown>) => ({
      eq: (col: string, val: string) => {
        if (tableName === 'transcription_jobs' && col === 'id') {
          const j = dbState.transcription_jobs.find((x) => x.id === val)
          if (j) Object.assign(j, patch)
        }
        if (tableName === 'incoming_messages' && col === 'id') {
          dbState.incoming_messages[val] = {
            ...(dbState.incoming_messages[val] ?? {}),
            ...patch,
          }
        }
        return Promise.resolve({ error: null })
      },
    }),
    insert: (row: { incoming_message_id: string }) => {
      if (tableName === 'assignment_jobs') {
        dbState.assignment_jobs.push(row)
      }
      return Promise.resolve({ error: null })
    },
  }
}

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from: (table: string) => makeQueryBuilder(table),
  }),
}))

// Helper to reset between tests
function resetDb() {
  dbState.transcription_jobs = []
  dbState.incoming_messages = {}
  dbState.assignment_jobs = []
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('runTranscriptionIteration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDb()
    process.env.TWILIO_WHATSAPP_NUMBER = '+12295447789'
    process.env.OPENAI_API_KEY = 'sk-test'
  })

  it('verarbeitet einen pending-Job: Whisper + DB-Update + WhatsApp-Bestätigung', async () => {
    dbState.transcription_jobs.push({
      id: 'job-1',
      incoming_message_id: 'msg-1',
      attempts: 0,
      status: 'pending',
      incoming_messages: {
        local_file_path: '/tmp/audio.ogg',
        sender_phone: '+4917612345678',
        transcript_status: 'pending',
      },
    })

    mockFsExistsSync.mockReturnValue(true)
    mockFsStatSync.mockReturnValue({ size: 4096 } as unknown as never)
    mockFsReadFile.mockResolvedValue(Buffer.from('audio-bytes'))
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Hallo Welt, dies ist ein Test.' })
    mockTwilioMessagesCreate.mockResolvedValue({ sid: 'SM-out' })

    const { runTranscriptionIteration } = await import('./transcription-worker')
    const result = await runTranscriptionIteration()

    expect(result.processed).toBe(1)
    expect(result.failed).toBe(0)
    expect(mockTranscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'whisper-1', language: 'de' })
    )
    expect(dbState.incoming_messages['msg-1']?.transcript).toBe('Hallo Welt, dies ist ein Test.')
    expect(dbState.incoming_messages['msg-1']?.transcript_status).toBe('done')
    // Bestätigung gesendet (mit "✓" und Vorschau)
    expect(mockTwilioMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'whatsapp:+12295447789',
        to: 'whatsapp:+4917612345678',
        body: expect.stringContaining('Hallo Welt'),
      })
    )
    // Assignment-Job angelegt
    expect(dbState.assignment_jobs).toHaveLength(1)
    expect(dbState.assignment_jobs[0]?.incoming_message_id).toBe('msg-1')
  })

  it('verwendet language "de" beim Whisper-Aufruf (AC-2)', async () => {
    dbState.transcription_jobs.push({
      id: 'job-de',
      incoming_message_id: 'msg-de',
      attempts: 0,
      status: 'pending',
      incoming_messages: {
        local_file_path: '/tmp/de.ogg',
        sender_phone: '+4917699999999',
        transcript_status: 'pending',
      },
    })
    mockFsExistsSync.mockReturnValue(true)
    mockFsStatSync.mockReturnValue({ size: 1024 } as unknown as never)
    mockFsReadFile.mockResolvedValue(Buffer.from('a'))
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Test' })

    const { runTranscriptionIteration } = await import('./transcription-worker')
    await runTranscriptionIteration()
    expect(mockTranscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'de' })
    )
  })

  it('berechnet Kosten via $0.006 / Minute basierend auf Dateigröße', async () => {
    dbState.transcription_jobs.push({
      id: 'job-cost',
      incoming_message_id: 'msg-cost',
      attempts: 0,
      status: 'pending',
      incoming_messages: {
        local_file_path: '/tmp/cost.ogg',
        sender_phone: '+4917611111111',
        transcript_status: 'pending',
      },
    })
    mockFsExistsSync.mockReturnValue(true)
    // 60 KB → 60*1024 / 2048 = 30 s
    mockFsStatSync.mockReturnValue({ size: 60 * 1024 } as unknown as never)
    mockFsReadFile.mockResolvedValue(Buffer.from('a'))
    mockTranscriptionsCreate.mockResolvedValue({ text: 'OK' })

    const { runTranscriptionIteration } = await import('./transcription-worker')
    await runTranscriptionIteration()

    const job = dbState.transcription_jobs.find((j) => j.id === 'job-cost')
    expect(job?.duration_seconds).toBe(30)
    // 30 s = 0.5 min × $0.006 = $0.003
    expect(job?.cost_usd).toBeCloseTo(0.003, 4)
    expect(job?.status).toBe('done')
  })

  it('Fehler-Pfad: bei fehlender Datei retry, status bleibt pending bis MAX_ATTEMPTS', async () => {
    dbState.transcription_jobs.push({
      id: 'job-missing',
      incoming_message_id: 'msg-missing',
      attempts: 0,
      status: 'pending',
      incoming_messages: {
        local_file_path: '/tmp/missing.ogg',
        sender_phone: '+4917622222222',
        transcript_status: 'pending',
      },
    })
    mockFsExistsSync.mockReturnValue(false)

    const { runTranscriptionIteration } = await import('./transcription-worker')
    const result = await runTranscriptionIteration()

    expect(result.failed).toBe(1)
    const job = dbState.transcription_jobs.find((j) => j.id === 'job-missing')
    // Nach 1 attempt status sollte zurück auf pending sein (kein endgültiger Fehler)
    expect(job?.status).toBe('pending')
    expect(job?.last_error).toContain('nicht gefunden')
    // Keine WhatsApp-Fehlermeldung gesendet (noch nicht final)
    expect(mockTwilioMessagesCreate).not.toHaveBeenCalled()
  })

  it('Endgültiger Fehler nach 3 Versuchen → WhatsApp-Fehlermeldung an Absender', async () => {
    dbState.transcription_jobs.push({
      id: 'job-final',
      incoming_message_id: 'msg-final',
      attempts: 2, // letzter Versuch
      status: 'pending',
      incoming_messages: {
        local_file_path: '/tmp/final.ogg',
        sender_phone: '+4917633333333',
        transcript_status: 'pending',
      },
    })
    mockFsExistsSync.mockReturnValue(false)
    mockTwilioMessagesCreate.mockResolvedValue({ sid: 'SM-fail' })

    const { runTranscriptionIteration } = await import('./transcription-worker')
    await runTranscriptionIteration()

    const job = dbState.transcription_jobs.find((j) => j.id === 'job-final')
    expect(job?.status).toBe('failed')
    // Fehler-WhatsApp gesendet
    expect(mockTwilioMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('konnte nicht verarbeitet werden'),
      })
    )
    expect(dbState.incoming_messages['msg-final']?.transcript_status).toBe('failed')
  })

  it('überspringt Jobs ohne local_file_path', async () => {
    dbState.transcription_jobs.push({
      id: 'job-no-path',
      incoming_message_id: 'msg-no-path',
      attempts: 0,
      status: 'pending',
      incoming_messages: {
        local_file_path: null,
        sender_phone: '+4917644444444',
        transcript_status: 'pending',
      },
    })
    mockFsExistsSync.mockReturnValue(true)

    const { runTranscriptionIteration } = await import('./transcription-worker')
    const result = await runTranscriptionIteration()

    expect(result.processed).toBe(0)
    expect(result.failed).toBe(0)
    expect(mockTranscriptionsCreate).not.toHaveBeenCalled()
  })

  it('Whisper-API-Fehler löst Retry-Mechanismus aus', async () => {
    dbState.transcription_jobs.push({
      id: 'job-api-err',
      incoming_message_id: 'msg-api-err',
      attempts: 0,
      status: 'pending',
      incoming_messages: {
        local_file_path: '/tmp/err.ogg',
        sender_phone: '+4917655555555',
        transcript_status: 'pending',
      },
    })
    mockFsExistsSync.mockReturnValue(true)
    mockFsStatSync.mockReturnValue({ size: 2048 } as unknown as never)
    mockFsReadFile.mockResolvedValue(Buffer.from('a'))
    mockTranscriptionsCreate.mockRejectedValue(new Error('OpenAI API rate limit'))

    const { runTranscriptionIteration } = await import('./transcription-worker')
    const result = await runTranscriptionIteration()

    expect(result.failed).toBe(1)
    const job = dbState.transcription_jobs.find((j) => j.id === 'job-api-err')
    expect(job?.last_error).toContain('rate limit')
    // Status zurück auf pending (noch nicht max. Versuche erreicht)
    expect(job?.status).toBe('pending')
  })

  it('Vorschau im WhatsApp-Bestätigungstext: max 100 Zeichen + Auslassungspunkte', async () => {
    const langerText = 'A'.repeat(150)
    dbState.transcription_jobs.push({
      id: 'job-long',
      incoming_message_id: 'msg-long',
      attempts: 0,
      status: 'pending',
      incoming_messages: {
        local_file_path: '/tmp/long.ogg',
        sender_phone: '+4917666666666',
        transcript_status: 'pending',
      },
    })
    mockFsExistsSync.mockReturnValue(true)
    mockFsStatSync.mockReturnValue({ size: 2048 } as unknown as never)
    mockFsReadFile.mockResolvedValue(Buffer.from('a'))
    mockTranscriptionsCreate.mockResolvedValue({ text: langerText })
    mockTwilioMessagesCreate.mockResolvedValue({ sid: 'SM' })

    const { runTranscriptionIteration } = await import('./transcription-worker')
    await runTranscriptionIteration()

    const callArgs = mockTwilioMessagesCreate.mock.calls[0]?.[0]
    expect(callArgs.body).toContain('…')
    // Body = "✓ Nachricht transkribiert: " + 100 chars + "…"
    // Total length: ~28 + 100 + 1 = ~129
    expect(callArgs.body.length).toBeLessThan(140)
  })

  it('Twilio-Bestätigungs-Fehler bricht Verarbeitung NICHT ab', async () => {
    dbState.transcription_jobs.push({
      id: 'job-twilio-err',
      incoming_message_id: 'msg-twilio-err',
      attempts: 0,
      status: 'pending',
      incoming_messages: {
        local_file_path: '/tmp/twilio.ogg',
        sender_phone: '+4917677777777',
        transcript_status: 'pending',
      },
    })
    mockFsExistsSync.mockReturnValue(true)
    mockFsStatSync.mockReturnValue({ size: 2048 } as unknown as never)
    mockFsReadFile.mockResolvedValue(Buffer.from('a'))
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Funktioniert' })
    mockTwilioMessagesCreate.mockRejectedValue(new Error('Twilio down'))

    const { runTranscriptionIteration } = await import('./transcription-worker')
    const result = await runTranscriptionIteration()

    // Trotz Twilio-Fehler: processed = 1
    expect(result.processed).toBe(1)
    // DB-Update sollte trotzdem erfolgt sein
    expect(dbState.incoming_messages['msg-twilio-err']?.transcript).toBe('Funktioniert')
  })

  it('AC-7 (Audio-Dauer Prüfung): KEINE Längenprüfung vor Whisper-Aufruf — BUG-2 dokumentiert', async () => {
    // 30 min Audio (90 KB / 2 KB/s = 45 s laut Schätzung — Schätzfehler bei langen Dateien zeigt Lücke)
    // Wir simulieren eine 12-min-Datei ≈ 720 s × 2048 = 1.474.560 bytes
    dbState.transcription_jobs.push({
      id: 'job-long-audio',
      incoming_message_id: 'msg-long-audio',
      attempts: 0,
      status: 'pending',
      incoming_messages: {
        local_file_path: '/tmp/12min.ogg',
        sender_phone: '+4917688888888',
        transcript_status: 'pending',
      },
    })
    mockFsExistsSync.mockReturnValue(true)
    mockFsStatSync.mockReturnValue({ size: 1_474_560 } as unknown as never)
    mockFsReadFile.mockResolvedValue(Buffer.from('a'))
    mockTranscriptionsCreate.mockResolvedValue({ text: 'Sehr lange Aufnahme' })

    const { runTranscriptionIteration } = await import('./transcription-worker')
    const result = await runTranscriptionIteration()

    // BUG-2: Whisper wird trotz > 10 min Audio aufgerufen
    expect(mockTranscriptionsCreate).toHaveBeenCalled()
    expect(result.processed).toBe(1)
    const job = dbState.transcription_jobs.find((j) => j.id === 'job-long-audio')
    // Geschätzte Dauer > 600 s
    expect((job?.duration_seconds ?? 0)).toBeGreaterThan(600)
    // Aber kein Abbruch oder Warnung-Flag
    expect(job?.status).toBe('done')
  })
})
