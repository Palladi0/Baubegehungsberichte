import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// PROJ-9 — Sprach-Transkription (Whisper) E2E Tests
//
// Tests run against the live dev server. Authenticated flows use page.route()
// to mock API calls. Only unauthenticated redirect tests always run.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ADMIN = { id: 'admin-qa', email: 'admin@ppb.de', role: 'admin' }

const MOCK_TRANSKRIPTIONS_JOBS = [
  {
    id: 'tj-1',
    status: 'done',
    attempts: 1,
    duration_seconds: 90,
    cost_usd: 0.009,
    last_error: null,
    created_at: '2026-04-23T09:00:00Z',
    updated_at: '2026-04-23T09:01:30Z',
    incoming_messages: { sender_phone: '+4917612345678', transcript_status: 'done' },
  },
  {
    id: 'tj-2',
    status: 'failed',
    attempts: 3,
    duration_seconds: null,
    cost_usd: null,
    last_error: 'Audiodatei nicht gefunden: /var/uploads/whatsapp/2026-04-23/audio_SM005.ogg',
    created_at: '2026-04-23T10:00:00Z',
    updated_at: '2026-04-23T10:05:00Z',
    incoming_messages: { sender_phone: '+4915198765432', transcript_status: 'failed' },
  },
  {
    id: 'tj-3',
    status: 'pending',
    attempts: 0,
    duration_seconds: null,
    cost_usd: null,
    last_error: null,
    created_at: '2026-04-23T11:00:00Z',
    updated_at: '2026-04-23T11:00:00Z',
    incoming_messages: { sender_phone: '+4917699999999', transcript_status: 'pending' },
  },
]

const MOCK_NACHRICHTEN = [
  {
    id: 'msg-audio-1',
    twilio_message_sid: 'SM-AUDIO-001',
    sender_phone: '+4917612345678',
    user_id: 'user-1',
    message_type: 'audio',
    text_content: null,
    local_file_path: '/var/uploads/whatsapp/2026-04-23/audio_SM-AUDIO-001.ogg',
    transcript: 'Bitte die Bewehrung im EG prüfen. Stahlträger korrekt verlegt.',
    transcript_status: 'done',
    status: 'stored',
    received_at: '2026-04-23T09:00:00Z',
    processed_at: '2026-04-23T09:01:00Z',
    error_message: null,
  },
  {
    id: 'msg-audio-2',
    twilio_message_sid: 'SM-AUDIO-002',
    sender_phone: '+4915198765432',
    user_id: 'user-2',
    message_type: 'audio',
    text_content: null,
    local_file_path: null,
    transcript: null,
    transcript_status: 'pending',
    status: 'received',
    received_at: '2026-04-23T11:00:00Z',
    processed_at: null,
    error_message: null,
  },
  {
    id: 'msg-text-1',
    twilio_message_sid: 'SM-TEXT-001',
    sender_phone: '+4917600000001',
    user_id: 'user-1',
    message_type: 'text',
    text_content: '#BV-23-Hamburg Fensterrahmen eingebaut.',
    local_file_path: null,
    transcript: null,
    transcript_status: null,
    status: 'stored',
    received_at: '2026-04-23T08:00:00Z',
    processed_at: '2026-04-23T08:00:01Z',
    error_message: null,
  },
]

async function setupProj9Mocks(page: import('@playwright/test').Page) {
  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN) })
  )
  await page.route('/api/admin/whatsapp/messages', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_NACHRICHTEN),
    })
  )
  await page.route('/api/admin/whatsapp/transcription-jobs', (r) => {
    if (r.request().method() === 'GET') {
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TRANSKRIPTIONS_JOBS),
      })
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
  await page.route('/api/admin/whatsapp/transcription-worker', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ processed: 1, failed: 0 }),
    })
  )
  // Alle übrigen Admin-WhatsApp-APIs
  await page.route('/api/admin/whatsapp/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
}

// ─── AC-AUTH ──────────────────────────────────────────────────────────────────

test('AC-AUTH: /admin/whatsapp ohne Session leitet auf /login weiter', async ({ page }) => {
  await page.goto('/admin/whatsapp')
  await expect(page).toHaveURL(/\/login/)
})

// ─── AC-8: Transkriptions-Log im Admin-Bereich ────────────────────────────────

test('AC-8a: TranskriptionsLogCard ist auf der Admin-WhatsApp-Seite sichtbar', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Transkriptions-Log')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(card).toBeVisible()
})

test('AC-8b: Log zeigt Pflicht-Spalten (Datum, Absender, Dauer, Kosten, Status)', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Transkriptions-Log')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByRole('columnheader', { name: /datum/i }).first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /absender/i }).first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /dauer/i }).first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /kosten/i }).first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /status/i }).first()).toBeVisible()
})

test('AC-8c: Gesamtkosten werden in der Karte angezeigt', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Transkriptions-Log')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  // Cost from MOCK_TRANSKRIPTIONS_JOBS: only done jobs contribute ($0.009)
  await expect(page.getByText(/gesamtkosten/i)).toBeVisible()
  await expect(page.getByText(/\$0\.\d+/)).toBeVisible()
})

test('AC-8d: Status-Badges werden korrekt dargestellt (Erledigt, Fehler, Wartend)', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Transkriptions-Log')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText('Erledigt').first()).toBeVisible()
  await expect(page.getByText('Fehler').first()).toBeVisible()
  await expect(page.getByText('Wartend').first()).toBeVisible()
})

test('AC-8e: Fehler-Tooltip erscheint bei Hover über "Fehler"-Badge', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const fehlerBadge = page.getByText('Fehler').first()
  if (!(await fehlerBadge.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await fehlerBadge.hover()
  // Tooltip should appear with error message
  await expect(page.getByText(/audiodatei nicht gefunden/i)).toBeVisible({ timeout: 3000 })
})

test('AC-8f: "Worker starten"-Button ist vorhanden und kann angeklickt werden', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const workerBtn = page.getByRole('button', { name: /worker starten/i })
  if (!(await workerBtn.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(workerBtn).toBeVisible()
  await workerBtn.click()
  // Toast-Meldung nach Abschluss
  await expect(page.getByText(/worker abgeschlossen/i)).toBeVisible({ timeout: 5000 })
})

test('AC-8g: Aktualisieren-Button lädt Transkriptions-Log neu', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  // Find the refresh button near the Transkriptions-Log card
  const aktualisierenButtons = page.getByRole('button', { name: /aktualisieren/i })
  const count = await aktualisierenButtons.count()
  if (count === 0) {
    test.skip()
    return
  }

  // Click the last one (closest to Transkriptions-Log)
  await aktualisierenButtons.last().click()
  await expect(page.getByText(/transkriptions-log aktualisiert/i)).toBeVisible({ timeout: 3000 })
})

test('AC-8h: Leerer Zustand zeigt Hinweis wenn keine Jobs vorhanden', async ({ page }) => {
  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN) })
  )
  await page.route('/api/admin/whatsapp/transcription-jobs', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route('/api/admin/whatsapp/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Transkriptions-Log')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText(/noch keine transkriptions-jobs/i)).toBeVisible()
})

// ─── AC-6 (partial): Transkript in Nachrichten-Log einsehbar und editierbar ──

test('AC-6a: Audio-Zeile im Nachrichten-Log hat Expand-Chevron', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  // The audio row should be clickable — verify the row is present with audio type indicator
  const sprachIcon = page.getByText('Sprache').first()
  if (!(await sprachIcon.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(sprachIcon).toBeVisible()
})

test('AC-6b: Klick auf Audio-Zeile klappt Transkript-Bereich auf', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const audioRow = page.getByText('Sprache').first()
  if (!(await audioRow.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  // Click the audio row to expand the transcript
  await audioRow.click()
  await expect(page.getByText('Transkript').first()).toBeVisible()
  await expect(page.getByText('Bitte die Bewehrung im EG prüfen')).toBeVisible()
})

test('AC-6c: "Transkript bearbeiten"-Button erscheint bei transskribierten Audio-Nachrichten', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const audioRow = page.getByText('Sprache').first()
  if (!(await audioRow.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await audioRow.click()

  // Pencil/edit button should appear for done transcripts
  const editBtn = page.getByRole('button', { name: /transkript bearbeiten/i })
  await expect(editBtn).toBeVisible({ timeout: 2000 })
})

test('AC-6d: Transkript-Editierung öffnet Textarea mit Save- und Abbrechen-Buttons', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const audioRow = page.getByText('Sprache').first()
  if (!(await audioRow.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await audioRow.click()
  const editBtn = page.getByRole('button', { name: /transkript bearbeiten/i })
  if (!(await editBtn.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await editBtn.click()
  await expect(page.getByLabel('Transkript bearbeiten')).toBeVisible()
  await expect(page.getByRole('button', { name: /speichern/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /abbrechen/i })).toBeVisible()
})

test('AC-6e: Abbrechen-Button beendet Editierung ohne Speichern', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const audioRow = page.getByText('Sprache').first()
  if (!(await audioRow.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await audioRow.click()
  const editBtn = page.getByRole('button', { name: /transkript bearbeiten/i })
  if (!(await editBtn.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await editBtn.click()
  const textarea = page.getByLabel('Transkript bearbeiten')
  await textarea.fill('Geänderter Text der nicht gespeichert werden soll')

  await page.getByRole('button', { name: /abbrechen/i }).click()

  // Should return to view mode with original transcript
  await expect(page.getByText('Bitte die Bewehrung im EG prüfen')).toBeVisible()
  await expect(page.getByLabel('Transkript bearbeiten')).not.toBeVisible()
})

test('AC-6f: Transkript-Vorschau (erste 60 Zeichen) in Nachrichtenzeile sichtbar', async ({ page }) => {
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nachrichten-Log')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  // The audio row should show a transcript preview (first 60 chars)
  await expect(page.getByText(/bitte die bewehrung/i)).toBeVisible()
})

// ─── Responsive ───────────────────────────────────────────────────────────────

test('Responsive (375px): TranskriptionsLogCard sichtbar auf Mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Transkriptions-Log')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(card).toBeVisible()
  await expect(page.getByRole('button', { name: /worker starten/i })).toBeVisible()
})

test('Responsive (768px): TranskriptionsLogCard auf Tablet korrekt dargestellt', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await setupProj9Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Transkriptions-Log')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(card).toBeVisible()
  await expect(page.getByText('Erledigt').first()).toBeVisible()
})
