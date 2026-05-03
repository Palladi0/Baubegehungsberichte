import { describe, it, expect, beforeAll } from 'vitest'

// PROJ-8: Unit-Tests für Twilio-Hilfsmodul (Signatur-Validierung + TwiML-Helper)
// WICHTIG: TWILIO_AUTH_TOKEN und TWILIO_ACCOUNT_SID müssen gesetzt sein, BEVOR
// `./twilio` importiert wird, da `twilio.ts` den Auth-Token bei Modul-Ladezeit
// in eine Konstante einliest. ESM-Imports werden gehoistet — daher setzen wir
// die Variablen direkt vor dem dynamischen Import in `beforeAll`.
process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'test-auth-token-12345'
process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'ACtest1234567890abcdef1234567890ab'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let validateTwilioSignature: (sig: string, url: string, params: Record<string, string>) => boolean
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let twimlResponse: (message: string) => string

beforeAll(async () => {
  const mod = await import('./twilio')
  validateTwilioSignature = mod.validateTwilioSignature
  twimlResponse = mod.twimlResponse
})

describe('twimlResponse', () => {
  it('erzeugt valides TwiML-XML mit Nachricht', () => {
    const result = twimlResponse('Hallo Welt')
    expect(result).toContain('<Response>')
    expect(result).toContain('<Message>Hallo Welt</Message>')
    expect(result).toContain('</Response>')
  })

  it('escaped XML-Sonderzeichen in Nachrichten', () => {
    const result = twimlResponse('<script>alert(1)</script>')
    // Twilio SDK escaped < > & korrekt
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
  })

  it('akzeptiert leere Nachricht', () => {
    const result = twimlResponse('')
    expect(result).toContain('<Response>')
    expect(result).toContain('</Response>')
  })
})

describe('validateTwilioSignature', () => {
  it('lehnt fehlerhafte Signatur ab', () => {
    const result = validateTwilioSignature(
      'invalid-signature',
      'https://example.com/api/webhooks/twilio',
      { MessageSid: 'SM123', From: 'whatsapp:+491700000000' }
    )
    expect(result).toBe(false)
  })

  it('lehnt leere Signatur ab', () => {
    const result = validateTwilioSignature(
      '',
      'https://example.com/api/webhooks/twilio',
      { MessageSid: 'SM123' }
    )
    expect(result).toBe(false)
  })

  it('lehnt Signatur mit falscher URL ab', () => {
    // Auch eine plausibel aussehende Base64-Signatur muss abgelehnt werden,
    // wenn URL/Token/Params nicht zusammenpassen.
    const result = validateTwilioSignature(
      'aGVsbG8gd29ybGQgdGhpcyBpcyBub3QgYSByZWFsIHNpZw==',
      'https://example.com/api/webhooks/twilio',
      { MessageSid: 'SM123', From: 'whatsapp:+491700000000' }
    )
    expect(result).toBe(false)
  })
})
