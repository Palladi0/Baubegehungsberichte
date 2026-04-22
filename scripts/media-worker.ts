#!/usr/bin/env tsx
/**
 * Hintergrund-Worker: Lädt Medien-Dateien von Twilio herunter.
 * Starten: npx tsx scripts/media-worker.ts
 * Für Produktion: per systemd-Service oder Docker-Restart-Policy am Laufen halten.
 */

import { runWorkerIteration } from '../src/lib/media-worker'

const POLL_INTERVAL_MS = 30_000

async function loop() {
  console.log('[media-worker] Gestartet — Polling alle 30 Sekunden')

  while (true) {
    try {
      const { processed, failed } = await runWorkerIteration()
      if (processed > 0 || failed > 0) {
        console.log(`[media-worker] Iteration: ${processed} verarbeitet, ${failed} fehlgeschlagen`)
      }
    } catch (err) {
      console.error('[media-worker] Unerwarteter Fehler:', err)
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

loop()
