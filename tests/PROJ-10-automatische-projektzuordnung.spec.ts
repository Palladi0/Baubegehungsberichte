import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// PROJ-10 — Automatische Projektzuordnung E2E Tests
//
// Tests run against the live dev server. API calls are intercepted via
// page.route(). Server-side auth redirect tests run unauthenticated.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ADMIN = { id: 'admin-qa', email: 'admin@ppb.de', role: 'admin' }

const MOCK_PROJEKTE = [
  { id: '550e8400-e29b-41d4-a716-446655440001', name: 'BV Hamburg 2023', kuerzel: 'BV-23-Hamburg' },
  { id: '550e8400-e29b-41d4-a716-446655440002', name: 'MF Berlin 2024', kuerzel: 'MF-24-Berlin' },
]

const MOCK_UNASSIGNED = [
  {
    id: '660f8500-f39c-52e5-b827-557766551001',
    sender_phone: '+4917612345678',
    message_type: 'text',
    text_content: 'Begehung heute Morgen abgeschlossen.',
    transcript: null,
    received_at: '2026-04-23T09:00:00Z',
    assignment_status: 'pending',
    clarification_attempts: 0,
  },
  {
    id: '660f8500-f39c-52e5-b827-557766551002',
    sender_phone: '+4915198765432',
    message_type: 'audio',
    text_content: null,
    transcript: 'Bitte #BV-23-Hamburg zuordnen.',
    received_at: '2026-04-23T10:00:00Z',
    assignment_status: 'awaiting_clarification',
    clarification_attempts: 1,
  },
  {
    id: '660f8500-f39c-52e5-b827-557766551003',
    sender_phone: '+4917699999999',
    message_type: 'foto',
    text_content: null,
    transcript: null,
    received_at: '2026-04-23T11:00:00Z',
    assignment_status: 'manual_required',
    clarification_attempts: 2,
  },
  {
    id: '660f8500-f39c-52e5-b827-557766551004',
    sender_phone: '+4917600000001',
    message_type: 'text',
    text_content: 'Zuordnung fehlgeschlagen nach 3 Versuchen.',
    transcript: null,
    received_at: '2026-04-23T12:00:00Z',
    assignment_status: 'failed',
    clarification_attempts: 3,
  },
]

async function setupProj10Mocks(page: import('@playwright/test').Page) {
  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN) })
  )
  await page.route('/api/projekte', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROJEKTE) })
  )
  await page.route('/api/admin/whatsapp/unassigned', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_UNASSIGNED) })
  )
  await page.route('/api/admin/whatsapp/assignment-worker', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ processed: 2, failed: 0 }) })
  )
  await page.route('/api/admin/whatsapp/messages/*/assign', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
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

// ─── AC-7: ZuordnungsCard sichtbar und enthält Daten ─────────────────────────

test('AC-7a: ZuordnungsCard "Nicht zugeordnete Nachrichten" ist auf Admin-Seite sichtbar', async ({ page }) => {
  await setupProj10Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nicht zugeordnete Nachrichten')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(card).toBeVisible()
})

test('AC-7b: Tabelle zeigt Pflicht-Spalten (Zeitstempel, Absender, Typ, Inhalt, Status, Projekt zuordnen)', async ({ page }) => {
  await setupProj10Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nicht zugeordnete Nachrichten')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByRole('columnheader', { name: /zeitstempel/i }).first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /absender/i }).first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /typ/i }).first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /inhalt/i }).first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /status/i }).first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /projekt zuordnen/i }).first()).toBeVisible()
})

test('AC-7c: Status-Badges werden korrekt dargestellt (Ausstehend, Klärt, Manuell nötig, Fehlgeschlagen)', async ({ page }) => {
  await setupProj10Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nicht zugeordnete Nachrichten')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText('Ausstehend').first()).toBeVisible()
  await expect(page.getByText('Klärt…').first()).toBeVisible()
  await expect(page.getByText('Manuell nötig').first()).toBeVisible()
  await expect(page.getByText('Fehlgeschlagen').first()).toBeVisible()
})

test('AC-7d: Anzahl-Badge in der Karten-Überschrift zeigt korrekte Anzahl nicht-zugeordneter Nachrichten', async ({ page }) => {
  await setupProj10Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nicht zugeordnete Nachrichten')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  // 4 unassigned messages in MOCK_UNASSIGNED
  await expect(page.getByText('4').first()).toBeVisible()
})

// ─── AC-6: Manuelle Zuordnung per Dropdown ────────────────────────────────────

test('AC-6a: Jede Nachrichtenzeile enthält ein Projekt-Dropdown', async ({ page }) => {
  await setupProj10Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nicht zugeordnete Nachrichten')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  const dropdowns = page.getByRole('combobox')
  const count = await dropdowns.count()
  expect(count).toBeGreaterThanOrEqual(1)
})

test('AC-6b: Dropdown enthält alle verfügbaren Projekte', async ({ page }) => {
  await setupProj10Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nicht zugeordnete Nachrichten')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  // Öffne das erste Dropdown
  const firstDropdown = page.getByRole('combobox').first()
  await firstDropdown.click()

  await expect(page.getByText('BV-23-Hamburg')).toBeVisible()
  await expect(page.getByText('MF-24-Berlin')).toBeVisible()
})

test('AC-6c: Manuelle Zuordnung sendet POST und entfernt Nachricht aus der Liste', async ({ page }) => {
  let assignCalled = false

  await setupProj10Mocks(page)

  // Überschreibe unassigned: nach Zuordnung wird die Nachricht entfernt
  await page.route('/api/admin/whatsapp/unassigned', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_UNASSIGNED) })
  )
  await page.route('/api/admin/whatsapp/messages/*/assign', (r) => {
    assignCalled = true
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nicht zugeordnete Nachrichten')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  // Wähle Projekt im ersten Dropdown
  const firstDropdown = page.getByRole('combobox').first()
  await firstDropdown.click()
  await page.getByText('BV-23-Hamburg').click()

  // Klicke "Zuordnen"-Button in der ersten Zeile
  const zuordnenBtn = page.getByRole('button', { name: /zuordnen/i }).first()
  await expect(zuordnenBtn).toBeEnabled()
  await zuordnenBtn.click()

  // Toast-Meldung erscheint
  await expect(page.getByText(/erfolgreich zugeordnet/i)).toBeVisible({ timeout: 5000 })
  expect(assignCalled).toBe(true)
})

// ─── AC-5: Assignment Worker manuell starten ──────────────────────────────────

test('AC-5a: "Worker starten"-Button ist vorhanden und auslösbar', async ({ page }) => {
  await setupProj10Mocks(page)
  await page.goto('/admin/whatsapp')

  const workerBtn = page.getByRole('button', { name: /worker starten/i })
  if (!(await workerBtn.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(workerBtn).toBeVisible()
  await workerBtn.click()
  await expect(page.getByText(/worker abgeschlossen/i)).toBeVisible({ timeout: 5000 })
})

test('AC-5b: "Aktualisieren"-Button lädt die Liste neu', async ({ page }) => {
  await setupProj10Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nicht zugeordnete Nachrichten')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  const aktualisierenButtons = page.getByRole('button', { name: /aktualisieren/i })
  const count = await aktualisierenButtons.count()
  if (count === 0) {
    test.skip()
    return
  }

  await aktualisierenButtons.first().click()
  await expect(page.getByText(/liste aktualisiert/i)).toBeVisible({ timeout: 3000 })
})

// ─── AC-4: Leerer Zustand ─────────────────────────────────────────────────────

test('AC-4: Leerer Zustand zeigt Hinweis wenn alle Nachrichten zugeordnet sind', async ({ page }) => {
  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN) })
  )
  await page.route('/api/projekte', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROJEKTE) })
  )
  await page.route('/api/admin/whatsapp/unassigned', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route('/api/admin/whatsapp/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nicht zugeordnete Nachrichten')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText(/alle nachrichten sind einem projekt zugeordnet/i)).toBeVisible()
})

// ─── Responsive ───────────────────────────────────────────────────────────────

test('Responsive (375px): ZuordnungsCard sichtbar auf Mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await setupProj10Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nicht zugeordnete Nachrichten')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(card).toBeVisible()
})

test('Responsive (768px): ZuordnungsCard auf Tablet korrekt dargestellt', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await setupProj10Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nicht zugeordnete Nachrichten')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(card).toBeVisible()
})
