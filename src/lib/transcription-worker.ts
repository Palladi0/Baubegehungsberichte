import 'server-only'
import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'
import { createServiceClient } from './supabase-service'
import { twilioClient } from './twilio'

const MAX_ATTEMPTS = 3
const WHISPER_COST_PER_MINUTE = 0.006
const MAX_AUDIO_SECONDS = 600  // 10 Minuten
const WARN_AUDIO_SECONDS = 300 // 5 Minuten
const UPLOAD_BASE = process.env.MEDIA_UPLOAD_PATH ?? '/var/uploads/whatsapp'

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

type TranscriptionJob = {
  id: string
  incoming_message_id: string
  attempts: number
  incoming_messages: {
    local_file_path: string | null
    sender_phone: string
    transcript_status: string
  }
}

async function sendeWhatsAppBestaetigung(phone: string, transcript: string): Promise<void> {
  const vorschau = transcript.length > 100 ? transcript.slice(0, 100) + '…' : transcript
  try {
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phone}`,
      body: `✓ Nachricht transkribiert: ${vorschau}`,
    })
  } catch (err) {
    // Bestätigung ist nicht kritisch — Fehler nur loggen
    console.error('[transcription-worker] WhatsApp-Bestätigung fehlgeschlagen:', err)
  }
}

async function sendeWhatsAppFehler(phone: string): Promise<void> {
  try {
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phone}`,
      body: 'Ihre Sprachnachricht konnte nicht verarbeitet werden. Bitte senden Sie sie erneut.',
    })
  } catch (err) {
    console.error('[transcription-worker] WhatsApp-Fehlermeldung fehlgeschlagen:', err)
  }
}

export async function runTranscriptionIteration(): Promise<{ processed: number; failed: number }> {
  const db = createServiceClient()

  const { data: jobs, error } = await db
    .from('transcription_jobs')
    .select(
      'id, incoming_message_id, attempts, incoming_messages(local_file_path, sender_phone, transcript_status)'
    )
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(5)

  if (error || !jobs) return { processed: 0, failed: 0 }

  let processed = 0
  let failed = 0

  for (const job of jobs as unknown as TranscriptionJob[]) {
    const msg = job.incoming_messages
    if (!msg?.local_file_path) continue

    // BUG-6: Atomarer Job-Pickup — UPDATE nur wenn status noch 'pending'
    // Verhindert Doppelverarbeitung bei gleichzeitigen Worker-Instanzen
    const { data: claimed } = await db
      .from('transcription_jobs')
      .update({ status: 'processing', attempts: job.attempts + 1 })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
      .single()

    if (!claimed) continue  // Anderer Worker hat diesen Job bereits übernommen

    await db
      .from('incoming_messages')
      .update({ transcript_status: 'processing' })
      .eq('id', job.incoming_message_id)

    try {
      // BUG-8: Pfad-Whitelist — nur Dateien unter UPLOAD_BASE zulassen
      const resolvedPath = path.resolve(msg.local_file_path)
      const resolvedBase = path.resolve(UPLOAD_BASE)
      if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
        throw new Error(`Ungültiger Dateipfad: ${msg.local_file_path}`)
      }

      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Audiodatei nicht gefunden: ${resolvedPath}`)
      }

      // BUG-2: Längenprüfung vor Whisper-Aufruf — OGG Opus ≈ 16 kbit/s → 2 KB/s
      const stats = fs.statSync(resolvedPath)
      const estimatedSeconds = Math.ceil(stats.size / 2048)

      if (estimatedSeconds > MAX_AUDIO_SECONDS) {
        throw new Error(
          `Audiodatei zu lang: ca. ${Math.round(estimatedSeconds / 60)} Minuten (Maximum: 10 Minuten). Bitte kürzen.`
        )
      }

      const isLong = estimatedSeconds > WARN_AUDIO_SECONDS
      if (isLong) {
        await db
          .from('transcription_jobs')
          .update({ last_error: `Warnung: Audiodatei ca. ${Math.round(estimatedSeconds / 60)} Minuten (> 5 Min.)` })
          .eq('id', job.id)
      }

      const filename = resolvedPath.split('/').pop() ?? 'audio.ogg'
      const audioBuffer = await fs.promises.readFile(resolvedPath)
      const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' })
      const audioFile = new File([audioBlob], filename, { type: 'audio/ogg' })

      const response = await getOpenAI().audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'de',
      })

      const transcript = response.text
      const costUsd = (estimatedSeconds / 60) * WHISPER_COST_PER_MINUTE

      await db
        .from('transcription_jobs')
        .update({
          status: 'done',
          duration_seconds: estimatedSeconds,
          cost_usd: costUsd,
        })
        .eq('id', job.id)

      await db
        .from('incoming_messages')
        .update({
          transcript,
          transcript_status: 'done',
          audio_duration_seconds: estimatedSeconds,
        })
        .eq('id', job.incoming_message_id)

      await sendeWhatsAppBestaetigung(msg.sender_phone, transcript)

      // Zuordnungs-Job anlegen (Transkript liegt jetzt vor)
      await db
        .from('assignment_jobs')
        .insert({ incoming_message_id: job.incoming_message_id })

      processed++
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const newAttempts = job.attempts + 1
      const finalFailure = newAttempts >= MAX_ATTEMPTS

      await db
        .from('transcription_jobs')
        .update({
          status: finalFailure ? 'failed' : 'pending',
          last_error: errorMsg,
        })
        .eq('id', job.id)

      if (finalFailure) {
        await db
          .from('incoming_messages')
          .update({ transcript_status: 'failed' })
          .eq('id', job.incoming_message_id)

        await sendeWhatsAppFehler(msg.sender_phone)
        console.error(`[transcription-worker] Endgültig fehlgeschlagen (job=${job.id}): ${errorMsg}`)
      } else {
        await db
          .from('incoming_messages')
          .update({ transcript_status: 'pending' })
          .eq('id', job.incoming_message_id)
      }

      failed++
    }
  }

  return { processed, failed }
}

