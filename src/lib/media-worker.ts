import fs from 'fs'
import path from 'path'
import https from 'https'
import twilio from 'twilio'
import { createServiceClient } from './supabase-service'

const UPLOAD_BASE = process.env.MEDIA_UPLOAD_PATH ?? '/var/uploads/whatsapp'
const MAX_ATTEMPTS = 3

type MediaJob = {
  id: string
  incoming_message_id: string
  attempts: number
  incoming_messages: {
    twilio_message_sid: string
    twilio_media_url: string
    message_type: string
    sender_phone: string
  }
}

function fileExtension(messageType: string): string {
  if (messageType === 'foto') return 'jpg'
  if (messageType === 'audio') return 'ogg'
  return 'bin'
}

function downloadFile(url: string, destPath: string): Promise<void> {
  const authHeader =
    'Basic ' +
    Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64')

  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Authorization: authHeader } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} beim Download von Twilio`))
        return
      }
      const file = fs.createWriteStream(destPath)
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', reject)
    })
    req.on('error', reject)
  })
}

export async function runWorkerIteration(): Promise<{ processed: number; failed: number }> {
  const db = createServiceClient()

  // Offene Jobs laden und direkt auf "processing" setzen (atomares Update)
  const { data: jobs, error } = await db
    .from('media_jobs')
    .select(
      'id, incoming_message_id, attempts, incoming_messages(twilio_message_sid, twilio_media_url, message_type, sender_phone)'
    )
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(10)

  if (error || !jobs) return { processed: 0, failed: 0 }

  let processed = 0
  let failed = 0

  for (const job of jobs as unknown as MediaJob[]) {
    const msg = job.incoming_messages
    if (!msg?.twilio_media_url) continue

    // Job als "in Bearbeitung" markieren
    await db
      .from('media_jobs')
      .update({ status: 'processing', attempts: job.attempts + 1 })
      .eq('id', job.id)

    try {
      const dateDir = new Date().toISOString().slice(0, 10)
      const dir = path.join(UPLOAD_BASE, dateDir)
      fs.mkdirSync(dir, { recursive: true })

      const ext = fileExtension(msg.message_type)
      const filename = `${msg.message_type}_${msg.twilio_message_sid}.${ext}`
      const destPath = path.join(dir, filename)

      await downloadFile(msg.twilio_media_url, destPath)

      // Erfolgreich gespeichert
      await db
        .from('media_jobs')
        .update({ status: 'done' })
        .eq('id', job.id)

      await db
        .from('incoming_messages')
        .update({ local_file_path: destPath, status: 'stored', processed_at: new Date().toISOString() })
        .eq('id', job.incoming_message_id)

      // Transkriptions-Job anlegen wenn es sich um eine Sprachnachricht handelt
      if (msg.message_type === 'audio') {
        await db
          .from('transcription_jobs')
          .insert({ incoming_message_id: job.incoming_message_id })
      } else {
        // Text/Foto: direkt Zuordnungs-Job anlegen (kein Transkript nötig)
        await db
          .from('assignment_jobs')
          .insert({ incoming_message_id: job.incoming_message_id })
      }

      processed++
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const newAttempts = job.attempts + 1
      const finalFailure = newAttempts >= MAX_ATTEMPTS

      await db
        .from('media_jobs')
        .update({
          status: finalFailure ? 'failed' : 'pending',
          last_error: errorMsg,
        })
        .eq('id', job.id)

      if (finalFailure) {
        await db
          .from('incoming_messages')
          .update({ status: 'failed', error_message: errorMsg })
          .eq('id', job.incoming_message_id)

        console.error(`[media-worker] Endgültig fehlgeschlagen (job=${job.id}): ${errorMsg}`)

        // Disk-voll: WhatsApp-Antwort an Absender senden
        const isDiskFull = (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOSPC')
        if (isDiskFull && msg.sender_phone) {
          try {
            const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
            const from = process.env.TWILIO_PHONE_NUMBER ?? process.env.TWILIO_PRODUCTION_PHONE_NUMBER
            if (from) {
              await client.messages.create({
                from: `whatsapp:${from}`,
                to: `whatsapp:${msg.sender_phone}`,
                body: 'System temporär nicht verfügbar. Bitte versuchen Sie es später erneut.',
              })
            }
          } catch (twilioErr) {
            console.error(`[media-worker] WhatsApp-Disk-Full-Reply fehlgeschlagen:`, twilioErr)
          }
        }
      }

      failed++
    }
  }

  return { processed, failed }
}
