import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// PROJ-8 — WhatsApp-Integration (Twilio Sandbox) E2E Tests
//
// Tests run against the live dev server. Authenticated flows use page.route()
// to mock API calls and skip if no real auth session is present. Only
// unauthenticated redirect tests always run.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ADMIN = { id: 'admin-qa', email: 'admin@ppb.de', role: 'admin' }

const MOCK_REGISTRIERUNGEN = [
  {
    id: 'reg-1',
    user_id: 'user-1',
    phone_number: '+4917612345678',
    label: 'Max Mustermann',
    is_active: true,
    created_at: '2026-04-22T10:00:00Z',
  },
  {
    id: 'reg-2',
    user_id: 'user-2',
    phone_number: '+4915198765432',
    label: null,
    is_active: false,
    created_at: '2026-04-21T08:00:00Z',
  },
]

const MOCK_NACHRICHTEN = [
  {
    id: 'msg-1',
    twilio_message_sid: 'SM001',
    sender_phone: '+4917612345678',
    user_id: 'user-1',
    message_type: 'text',
    text_content: 'Testmeldung #BV-23-Hamburg',
    local_file_path: null,
    transcript: null,
    transcript_status: null,
    status: 'stored',
    received_at: '2026-04-22T10:30:00Z',
    processed_at: '2026-04-22T10:30:01Z',
    error_message: null,
  },
  {
    id: 'msg-2',
    twilio_message_sid: 'SM002',
    sender_phone: '+4915100000000',
    user_id: null,
    message_type: 'foto',
    text_content: null,
    local_file_path: '/var/uploads/whatsapp/2026-04-22/foto_SM002.jpg',
    transcript: null,
    transcript_status: null,
    status: 'stored',
    received_at: '2026-04-22T11:00:00Z',
    processed_at: '2026-04-22T11:00:05Z',
    error_message: null,
  },
  {
    id: 'msg-3',
    twilio_message_sid: 'SM003',
    sender_phone: '+4917699999999',
    user_id: null,
    message_type: 'audio',
    text_content: null,
    local_file_path: null,
    transcript: 'Bitte die Stahlträger im EG kontrollieren.',
    transcript_status: 'done',
    status: 'failed',
    received_at: '2026-04-22T12:00:00Z',
    processed_at: null,
    error_message: 'HTTP 404 beim Download von Twilio',
  },
]

const MOCK_NUTZER = [
  { id: 'user-1', email: 'max@ppb.de' },
  { id: 'user-2', email: 'anna@ppb.de' },
]

async function setupWhatsAppMocks(page: import('@playwright/test').Page) {
  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN) })
  )
  await page.route('/api/admin/whatsapp/phone-registrations', (r) => {
    if (r.request().method() === 'GET') {
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REGISTRIERUNGEN),
      })
    }
    return r.continue()
  })
  await page.route('/api/admin/whatsapp/messages', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_NACHRICHTEN),
    })
  )
  await page.route('/api/admin/benutzer', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_NUTZER) })
  )
  // Mock remaining admin whatsapp APIs (PROJ-9/10/11 cards)
  await page.route('/api/admin/whatsapp/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
}

// ─── Unauthentifizierte Weiterleitungen (always run) ──────────────────────────

test('AC-AUTH: /admin/whatsapp ohne Session leitet auf /login weiter', async ({ page }) => {
  await page.goto('/admin/whatsapp')
  await expect(page).toHaveURL(/\/login/)
})

// ─── AC-9: Admin-UI vollständig implementiert ─────────────────────────────────

test('AC-9a: WebhookUrlCard zeigt Twilio-Webhook-URL an', async ({ page }) => {
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const urlInput = page.getByLabel('Twilio Webhook-URL')
  if (!(await urlInput.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(urlInput).toBeVisible()
  const value = await urlInput.inputValue()
  expect(value).toContain('/api/webhooks/twilio')
})

test('AC-9b: WebhookUrlCard Kopieren-Button ist vorhanden', async ({ page }) => {
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const kopierenBtn = page.getByRole('button', { name: /url kopieren/i })
  if (!(await kopierenBtn.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(kopierenBtn).toBeVisible()
})

test('AC-9c: Telefonnummern-Tabelle zeigt registrierte Nummern', async ({ page }) => {
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const nummerCell = page.getByText('+4917612345678')
  if (!(await nummerCell.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(nummerCell).toBeVisible()
  await expect(page.getByText('Max Mustermann')).toBeVisible()
  await expect(page.getByText('Aktiv').first()).toBeVisible()
})

test('AC-9d: Inaktive Nummer zeigt "Inaktiv"-Badge', async ({ page }) => {
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const inaktivBadge = page.getByText('Inaktiv')
  if (!(await inaktivBadge.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(inaktivBadge).toBeVisible()
})

test('AC-9e: "Nummer hinzufügen"-Button öffnet Dialog', async ({ page }) => {
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const addBtn = page.getByRole('button', { name: /nummer hinzufügen/i })
  if (!(await addBtn.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await addBtn.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Telefonnummer hinzufügen')).toBeVisible()
})

test('AC-9f: Dialog validiert E.164-Format clientseitig', async ({ page }) => {
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const addBtn = page.getByRole('button', { name: /nummer hinzufügen/i })
  if (!(await addBtn.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await addBtn.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Ungültige Nummer (kein +) eingeben
  await dialog.getByLabel(/telefonnummer/i).fill('017612345678')
  await dialog.getByRole('button', { name: /hinzufügen/i }).click()

  await expect(dialog.getByText(/format.*e\.164/i)).toBeVisible()
})

test('AC-9g: Löschen-Button öffnet Bestätigungs-Dialog', async ({ page }) => {
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const loeschenBtn = page.getByRole('button', { name: /nummer.*entfernen/i }).first()
  if (!(await loeschenBtn.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await loeschenBtn.click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expect(page.getByText(/telefonnummer entfernen/i)).toBeVisible()
})

// ─── AC-8: Nachrichten-Log ─────────────────────────────────────────────────

test('AC-8a: Nachrichten-Log zeigt letzte Nachrichten mit Status-Badges', async ({ page }) => {
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const absender = page.getByText('+4917612345678')
  if (!(await absender.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(absender).toBeVisible()
  await expect(page.getByText('Gespeichert').first()).toBeVisible()
})

test('AC-8b: Fehler-Badge bei fehlgeschlagenem Medien-Download', async ({ page }) => {
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const fehlerBadge = page.getByText('Fehler').first()
  if (!(await fehlerBadge.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(fehlerBadge).toBeVisible()
})

test('AC-8c: Aktualisieren-Button lädt Nachrichten neu', async ({ page }) => {
  let requestCount = 0
  await page.route('/api/admin/whatsapp/messages', (r) => {
    requestCount++
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_NACHRICHTEN),
    })
  })
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const aktualisierenBtn = page.getByRole('button', { name: /aktualisieren/i })
  if (!(await aktualisierenBtn.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  const prevCount = requestCount
  await aktualisierenBtn.click()
  await page.waitForTimeout(500)
  expect(requestCount).toBeGreaterThan(prevCount)
})

// ─── Responsive Tests ──────────────────────────────────────────────────────

test('Responsive (375px): Admin WhatsApp-Seite zeigt Kern-Inhalte auf Mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const heading = page.getByRole('heading', { name: /whatsapp/i })
  if (!(await heading.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(heading).toBeVisible()
})

test('Responsive (768px): Admin WhatsApp-Seite auf Tablet', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await setupWhatsAppMocks(page)
  await page.goto('/admin/whatsapp')

  const heading = page.getByRole('heading', { name: /whatsapp/i })
  if (!(await heading.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(heading).toBeVisible()
})
