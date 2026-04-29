import 'server-only'
import { createServiceClient } from './supabase-service'
import { twilioClient } from './twilio'

const MAX_CLARIFICATION_ATTEMPTS = 3
const MAX_JOB_ATTEMPTS = 3
const HASHTAG_REGEX = /#([A-Za-z0-9\-]+)/g

type Projekt = {
  id: string
  kuerzel: string
  name: string
  archived_at: string | null
}

type AssignmentJob = {
  id: string
  incoming_message_id: string
  attempts: number
  incoming_messages: {
    text_content: string | null
    transcript: string | null
    sender_phone: string
    user_id: string | null
    clarification_attempts: number
  }
}

export function extractHashtags(text: string): string[] {
  const matches: string[] = []
  let match: RegExpExecArray | null
  const regex = new RegExp(HASHTAG_REGEX.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1])
  }
  return matches
}

async function findProjectsByHashtags(slugs: string[]): Promise<Projekt[]> {
  if (slugs.length === 0) return []
  const db = createServiceClient()
  const results: Projekt[] = []
  for (const slug of slugs) {
    const { data } = await db
      .from('projekte')
      .select('id, kuerzel, name, archived_at')
      .ilike('kuerzel', slug)
      .maybeSingle()
    if (data) results.push(data as Projekt)
  }
  return results
}

async function checkSenderUniqueProject(userId: string): Promise<Projekt | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('projekt_mitarbeiter')
    .select('projekt_id, projekte!inner(id, kuerzel, name, archived_at)')
    .eq('nutzer_id', userId)
    .is('projekte.archived_at', null)
  if (!data || data.length !== 1) return null
  const projekt = (data[0] as unknown as { projekte: Projekt }).projekte
  return projekt ?? null
}

async function sendWhatsApp(phone: string, body: string): Promise<void> {
  try {
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phone}`,
      body,
    })
  } catch (err) {
    console.error('[assignment-worker] WhatsApp-Versand fehlgeschlagen:', err)
  }
}

async function assignMessage(
  messageId: string,
  projektId: string,
  method: string,
  phone: string,
  kuerzel: string
): Promise<void> {
  const db = createServiceClient()
  await db
    .from('incoming_messages')
    .update({
      project_id: projektId,
      assignment_status: 'assigned',
      assignment_method: method,
      assigned_at: new Date().toISOString(),
    })
    .eq('id', messageId)
  await sendWhatsApp(phone, `✓ Zugeordnet zu Projekt ${kuerzel}`)
}

async function sendClarificationRequest(
  messageId: string,
  phone: string,
  optionen: Projekt[],
  attempts: number
): Promise<void> {
  const db = createServiceClient()

  let text: string
  if (optionen.length > 1) {
    const liste = optionen.map((p, i) => `${i + 1}. ${p.kuerzel}`).join(' oder ')
    text = `Für welches Projekt ist diese Nachricht? Bitte antworten Sie mit: ${liste}`
  } else {
    text = 'Für welches Projekt ist diese Nachricht? Bitte antworten Sie mit dem Projektkürzel (z. B. BV-23-Hamburg).'
  }

  await sendWhatsApp(phone, text)

  await db
    .from('incoming_messages')
    .update({
      assignment_status: 'awaiting_clarification',
      clarification_attempts: attempts + 1,
      clarification_sent_at: new Date().toISOString(),
    })
    .eq('id', messageId)
}

async function processAssignmentJob(job: AssignmentJob): Promise<void> {
  const db = createServiceClient()
  const msg = job.incoming_messages
  const messageId = job.incoming_message_id

  await db
    .from('assignment_jobs')
    .update({ status: 'processing', attempts: job.attempts + 1 })
    .eq('id', job.id)

  try {
    // Schritt 2: Hashtags aus text_content
    if (msg.text_content) {
      const slugs = extractHashtags(msg.text_content)
      if (slugs.length > 0) {
        const projekte = await findProjectsByHashtags(slugs)
        const aktive = projekte.filter((p) => !p.archived_at)
        const archiviert = projekte.filter((p) => p.archived_at)

        if (aktive.length === 1) {
          await assignMessage(messageId, aktive[0].id, 'hashtag_text', msg.sender_phone, aktive[0].kuerzel)
          await db.from('assignment_jobs').update({ status: 'done' }).eq('id', job.id)
          return
        }
        if (aktive.length > 1) {
          await sendClarificationRequest(messageId, msg.sender_phone, aktive, msg.clarification_attempts)
          await db.from('assignment_jobs').update({ status: 'done' }).eq('id', job.id)
          return
        }
        if (archiviert.length > 0) {
          // Hashtag trifft nur archivierte Projekte
          const kuerzelListe = archiviert.map((p) => p.kuerzel).join(', ')
          await sendWhatsApp(msg.sender_phone, `Projekt ${kuerzelListe} ist archiviert. Bitte wählen Sie ein aktives Projekt und antworten Sie mit dem Projektkürzel.`)
          await sendClarificationRequest(messageId, msg.sender_phone, [], msg.clarification_attempts)
          await db.from('assignment_jobs').update({ status: 'done' }).eq('id', job.id)
          return
        }
        // Kein Match — Kürzel unbekannt
        await sendClarificationRequest(messageId, msg.sender_phone, [], msg.clarification_attempts)
        await db.from('assignment_jobs').update({ status: 'done' }).eq('id', job.id)
        return
      }
    }

    // Schritt 3: Hashtags aus Transkript (nur Audio)
    if (msg.transcript) {
      const slugs = extractHashtags(msg.transcript)
      if (slugs.length > 0) {
        const projekte = await findProjectsByHashtags(slugs)
        const aktive = projekte.filter((p) => !p.archived_at)
        const archiviert = projekte.filter((p) => p.archived_at)

        if (aktive.length === 1) {
          await assignMessage(messageId, aktive[0].id, 'hashtag_transcript', msg.sender_phone, aktive[0].kuerzel)
          await db.from('assignment_jobs').update({ status: 'done' }).eq('id', job.id)
          return
        }
        if (aktive.length > 1) {
          await sendClarificationRequest(messageId, msg.sender_phone, aktive, msg.clarification_attempts)
          await db.from('assignment_jobs').update({ status: 'done' }).eq('id', job.id)
          return
        }
        if (archiviert.length > 0) {
          const kuerzelListe = archiviert.map((p) => p.kuerzel).join(', ')
          await sendWhatsApp(msg.sender_phone, `Projekt ${kuerzelListe} ist archiviert. Bitte wählen Sie ein aktives Projekt und antworten Sie mit dem Projektkürzel.`)
          await sendClarificationRequest(messageId, msg.sender_phone, [], msg.clarification_attempts)
          await db.from('assignment_jobs').update({ status: 'done' }).eq('id', job.id)
          return
        }
      }
    }

    // Schritt 4: Absender-Eindeutigkeit
    if (msg.user_id) {
      const projekt = await checkSenderUniqueProject(msg.user_id)
      if (projekt) {
        await assignMessage(messageId, projekt.id, 'sender_unique', msg.sender_phone, projekt.kuerzel)
        await db.from('assignment_jobs').update({ status: 'done' }).eq('id', job.id)
        return
      }
    }

    // Schritt 5: Klärungsverfahren
    const attempts = msg.clarification_attempts
    if (attempts >= MAX_CLARIFICATION_ATTEMPTS) {
      await db
        .from('incoming_messages')
        .update({ assignment_status: 'failed' })
        .eq('id', messageId)
      await db.from('assignment_jobs').update({ status: 'done' }).eq('id', job.id)
      return
    }

    await sendClarificationRequest(messageId, msg.sender_phone, [], attempts)
    await db.from('assignment_jobs').update({ status: 'done' }).eq('id', job.id)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const newAttempts = job.attempts + 1
    const finalFailure = newAttempts >= MAX_JOB_ATTEMPTS

    await db
      .from('assignment_jobs')
      .update({
        status: finalFailure ? 'failed' : 'pending',
        last_error: errorMsg,
      })
      .eq('id', job.id)

    if (finalFailure) {
      await db
        .from('incoming_messages')
        .update({ assignment_status: 'manual_required' })
        .eq('id', messageId)
      console.error(`[assignment-worker] Endgültig fehlgeschlagen (job=${job.id}): ${errorMsg}`)
    }
  }
}

export async function resolveWithClarification(
  senderPhone: string,
  antwortText: string
): Promise<boolean> {
  const db = createServiceClient()

  // Offene Klärung für diesen Absender (< 30 Min) suchen
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: messages } = await db
    .from('incoming_messages')
    .select('id, clarification_attempts')
    .eq('sender_phone', senderPhone)
    .eq('assignment_status', 'awaiting_clarification')
    .gte('clarification_sent_at', cutoff)
    .order('clarification_sent_at', { ascending: false })
    .limit(1)

  if (!messages || messages.length === 0) return false

  const origMsg = messages[0] as { id: string; clarification_attempts: number }
  const slug = antwortText.replace(/^#/, '').trim()

  const { data: projekt } = await db
    .from('projekte')
    .select('id, kuerzel, name, archived_at')
    .ilike('kuerzel', slug)
    .maybeSingle()

  if (!projekt) {
    const attempts = origMsg.clarification_attempts
    if (attempts >= MAX_CLARIFICATION_ATTEMPTS) {
      await db
        .from('incoming_messages')
        .update({ assignment_status: 'failed' })
        .eq('id', origMsg.id)
      await sendWhatsApp(senderPhone, 'Zu viele Fehlversuche. Die Nachricht wird manuell vom Administrator zugeordnet.')
    } else {
      await db
        .from('incoming_messages')
        .update({
          clarification_attempts: attempts + 1,
          clarification_sent_at: new Date().toISOString(),
        })
        .eq('id', origMsg.id)
      await sendWhatsApp(senderPhone, `Kürzel nicht gefunden. Bitte antworten Sie erneut mit dem gültigen Projektkürzel (z. B. BV-23-Hamburg).`)
    }
    return true
  }

  if (projekt.archived_at) {
    await sendWhatsApp(senderPhone, `Projekt ${projekt.kuerzel} ist archiviert. Bitte wählen Sie ein aktives Projekt.`)
    return true
  }

  await db
    .from('incoming_messages')
    .update({
      project_id: projekt.id,
      assignment_status: 'assigned',
      assignment_method: 'clarification_reply',
      assigned_at: new Date().toISOString(),
    })
    .eq('id', origMsg.id)
  await sendWhatsApp(senderPhone, `✓ Zugeordnet zu Projekt ${projekt.kuerzel}`)
  return true
}

export async function hasPendingClarification(senderPhone: string): Promise<boolean> {
  const db = createServiceClient()
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data } = await db
    .from('incoming_messages')
    .select('id')
    .eq('sender_phone', senderPhone)
    .eq('assignment_status', 'awaiting_clarification')
    .gte('clarification_sent_at', cutoff)
    .limit(1)
  return (data?.length ?? 0) > 0
}

export async function runAssignmentWorker(): Promise<{ processed: number; failed: number }> {
  const db = createServiceClient()

  const { data: jobs, error } = await db
    .from('assignment_jobs')
    .select(
      'id, incoming_message_id, attempts, incoming_messages(text_content, transcript, sender_phone, user_id, clarification_attempts)'
    )
    .eq('status', 'pending')
    .lt('attempts', MAX_JOB_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(10)

  if (error || !jobs) return { processed: 0, failed: 0 }

  let processed = 0
  let failed = 0

  for (const job of jobs as unknown as AssignmentJob[]) {
    if (!job.incoming_messages) continue
    await processAssignmentJob(job)
    processed++
  }

  return { processed, failed }
}
