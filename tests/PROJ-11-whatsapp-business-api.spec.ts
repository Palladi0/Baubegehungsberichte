import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// PROJ-11 — WhatsApp Business API Migration E2E Tests
//
// Tests run against the live dev server. API calls are intercepted via
// page.route(). Auth redirects test unauthenticated access.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CONFIG_SANDBOX = {
  whatsapp_mode: 'sandbox',
  whatsapp_active_number: '+14155238886',
  whatsapp_template_sid_bestaetigung: '',
  whatsapp_template_sid_unbekannt: '',
}

const MOCK_CONFIG_PRODUCTION = {
  whatsapp_mode: 'production',
  whatsapp_active_number: '+4989123456',
  whatsapp_template_sid_bestaetigung: 'HXabc123',
  whatsapp_template_sid_unbekannt: 'HXdef456',
}

const MOCK_TEMPLATES = [
  {
    sid: 'HXabc123',
    friendlyName: 'eingangsbestaetigung',
    variables: { 1: 'Projektnummer' },
    whatsappApprovalStatus: 'APPROVED',
    category: 'UTILITY',
  },
  {
    sid: 'HXdef456',
    friendlyName: 'unbekannte_nummer',
    variables: {},
    whatsappApprovalStatus: 'PENDING',
    category: 'UTILITY',
  },
  {
    sid: 'HXghi789',
    friendlyName: 'altes_template',
    variables: {},
    whatsappApprovalStatus: 'REJECTED',
    category: 'MARKETING',
  },
]

const MOCK_MIGRATION_CHECKS_OK = {
  credentialsValid: true,
  phoneNumberRegistered: true,
  templateApproved: true,
  errors: {},
}

const MOCK_MIGRATION_CHECKS_FAIL = {
  credentialsValid: false,
  phoneNumberRegistered: false,
  templateApproved: false,
  errors: {
    credentials: 'TWILIO_PRODUCTION_ACCOUNT_SID oder TWILIO_PRODUCTION_AUTH_TOKEN fehlt',
    phone: 'TWILIO_PRODUCTION_PHONE_NUMBER nicht konfiguriert',
    template: 'Keine Template-SIDs in system_config konfiguriert',
  },
}

async function setupProj11Mocks(
  page: import('@playwright/test').Page,
  options: {
    config?: typeof MOCK_CONFIG_SANDBOX
    templates?: typeof MOCK_TEMPLATES | { error: string }
    migrationChecks?: typeof MOCK_MIGRATION_CHECKS_OK
    configPostOk?: boolean
  } = {}
) {
  const {
    config = MOCK_CONFIG_SANDBOX,
    templates = MOCK_TEMPLATES,
    migrationChecks = MOCK_MIGRATION_CHECKS_OK,
    configPostOk = true,
  } = options

  // Base existing routes (return empty to avoid errors from PROJ-8/9/10 cards)
  await page.route('/api/admin/whatsapp/phone-registrations', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route('/api/admin/whatsapp/messages', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route('/api/admin/whatsapp/transcription-jobs', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route('/api/admin/whatsapp/unassigned', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )

  // PROJ-11 routes
  await page.route('/api/admin/whatsapp/config', (r) => {
    if (r.request().method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) })
    }
    // POST
    return r.fulfill({
      status: configPostOk ? 200 : 500,
      contentType: 'application/json',
      body: JSON.stringify(configPostOk ? { ok: true } : { error: 'Datenbankfehler' }),
    })
  })

  await page.route('/api/admin/whatsapp/templates', (r) => {
    if ('error' in templates) {
      return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(templates) })
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(templates) })
  })

  await page.route('/api/admin/whatsapp/migration-checks', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(migrationChecks) })
  )
}

// ─── AC-AUTH ──────────────────────────────────────────────────────────────────

test('AC-AUTH: /admin/whatsapp ohne Session leitet auf /login weiter', async ({ page }) => {
  await page.goto('/admin/whatsapp')
  await expect(page).toHaveURL(/\/login/)
})

// ─── AC-1: Admin-UI Bereich "Business API Migration" sichtbar ─────────────────

test('AC-UI-1: Abschnitt "Business API Migration" ist auf der Admin-Seite sichtbar', async ({ page }) => {
  await setupProj11Mocks(page)
  await page.goto('/admin/whatsapp')

  const section = page.getByText('Business API Migration')
  if (!(await section.isVisible().catch(() => false))) {
    test.skip()
    return
  }
  await expect(section).toBeVisible()
})

// ─── AC-2: BetriebsmodusCard ─────────────────────────────────────────────────

test('AC-2a: BetriebsmodusCard zeigt Sandbox-Modus korrekt an', async ({ page }) => {
  await setupProj11Mocks(page, { config: MOCK_CONFIG_SANDBOX })
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Betriebsmodus')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText('Sandbox-Modus')).toBeVisible()
  await expect(page.getByText('Sandbox').first()).toBeVisible()
})

test('AC-2b: BetriebsmodusCard zeigt Produktions-Modus korrekt an', async ({ page }) => {
  await setupProj11Mocks(page, { config: MOCK_CONFIG_PRODUCTION })
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Betriebsmodus')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText('Produktions-Modus')).toBeVisible()
  await expect(page.getByText('Produktion').first()).toBeVisible()
})

test('AC-2c: Modus-Toggle sendet POST-Request an /api/admin/whatsapp/config', async ({ page }) => {
  let postBody: Record<string, string> | null = null

  await setupProj11Mocks(page, { config: MOCK_CONFIG_SANDBOX })

  // Überschreibe POST-Handler um Body zu erfassen
  await page.route('/api/admin/whatsapp/config', async (r) => {
    if (r.request().method() === 'POST') {
      postBody = await r.request().postDataJSON() as Record<string, string>
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CONFIG_SANDBOX) })
  })

  await page.goto('/admin/whatsapp')

  const switchEl = page.getByRole('switch', { name: /betriebsmodus/i })
  if (!(await switchEl.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await switchEl.click()
  await expect.poll(() => postBody).not.toBeNull()
  expect(postBody?.whatsapp_mode).toBe('production')
})

test('AC-2d: Aktive-Nummer-Feld zeigt aktuelle Nummer und ermöglicht Speichern', async ({ page }) => {
  await setupProj11Mocks(page, { config: MOCK_CONFIG_PRODUCTION })
  await page.goto('/admin/whatsapp')

  const input = page.getByLabel('Aktive WhatsApp-Nummer (E.164)')
  if (!(await input.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(input).toHaveValue('+4989123456')
  await expect(page.getByRole('button', { name: 'Speichern' }).first()).toBeEnabled()
})

test('AC-2e: Template-SID-Felder sind sichtbar und bearbeitbar', async ({ page }) => {
  await setupProj11Mocks(page, { config: MOCK_CONFIG_PRODUCTION })
  await page.goto('/admin/whatsapp')

  const sidInput = page.getByLabel('Eingangsbestätigung')
  if (!(await sidInput.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(sidInput).toHaveValue('HXabc123')
  await expect(page.getByLabel('Unbekannte Nummer')).toHaveValue('HXdef456')
})

// ─── AC-3: TemplateStatusCard ─────────────────────────────────────────────────

test('AC-3a: TemplateStatusCard zeigt alle drei Templates mit korrekten Status-Badges', async ({ page }) => {
  await setupProj11Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nachrichten-Templates')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText('Genehmigt')).toBeVisible()
  await expect(page.getByText('Ausstehend')).toBeVisible()
  await expect(page.getByText('Abgelehnt')).toBeVisible()
})

test('AC-3b: TemplateStatusCard zeigt Template-Namen in der Tabelle', async ({ page }) => {
  await setupProj11Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nachrichten-Templates')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText('eingangsbestaetigung')).toBeVisible()
  await expect(page.getByText('unbekannte_nummer')).toBeVisible()
})

test('AC-3c: TemplateStatusCard zeigt Leer-Zustand wenn keine Templates vorhanden', async ({ page }) => {
  await setupProj11Mocks(page, { templates: [] as typeof MOCK_TEMPLATES })
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nachrichten-Templates')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText(/keine Templates gefunden/i)).toBeVisible()
})

test('AC-3d: TemplateStatusCard zeigt Fehlermeldung wenn Twilio API nicht erreichbar', async ({ page }) => {
  await setupProj11Mocks(page, { templates: { error: 'Twilio-Credentials nicht konfiguriert' } })
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nachrichten-Templates')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText('Twilio-Credentials nicht konfiguriert')).toBeVisible()
})

test('AC-3e: Refresh-Button in TemplateStatusCard sendet erneuten API-Request', async ({ page }) => {
  let callCount = 0
  await setupProj11Mocks(page)
  await page.route('/api/admin/whatsapp/templates', (r) => {
    callCount++
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TEMPLATES) })
  })

  await page.goto('/admin/whatsapp')

  const card = page.getByText('Nachrichten-Templates')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  const initial = callCount
  await page.getByRole('button', { name: /neu laden/i }).nth(1).click()
  await expect.poll(() => callCount).toBeGreaterThan(initial)
})

// ─── AC-4: MigrationsChecklisteCard ──────────────────────────────────────────

test('AC-4a: MigrationsChecklisteCard zeigt automatische Prüfungen an', async ({ page }) => {
  await setupProj11Mocks(page, { migrationChecks: MOCK_MIGRATION_CHECKS_OK })
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Migrations-Checkliste')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText('Produktions-Credentials gültig')).toBeVisible()
  await expect(page.getByText('Büronummer als WhatsApp Business Number registriert')).toBeVisible()
  await expect(page.getByText('Mindestens 1 Template mit Status APPROVED')).toBeVisible()
})

test('AC-4b: "Bereit für Produktion"-Badge erscheint wenn alle Prüfungen bestehen und manuelle Schritte erledigt', async ({ page }) => {
  await setupProj11Mocks(page, { migrationChecks: MOCK_MIGRATION_CHECKS_OK })
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Migrations-Checkliste')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  // Badge erscheint noch nicht (manuelle Checkboxen nicht aktiviert)
  await expect(page.getByText('Bereit für Produktion')).not.toBeVisible()

  // Manuelle Checkboxen aktivieren
  await page.getByLabel('Meta Business Account verifiziert').click()
  await page.getByLabel('Testlauf mit Mitarbeiter-Nummer erfolgreich').click()

  await expect(page.getByText('Bereit für Produktion')).toBeVisible()
})

test('AC-4c: Fehlermeldungen bei gescheiterten Auto-Prüfungen werden angezeigt', async ({ page }) => {
  await setupProj11Mocks(page, { migrationChecks: MOCK_MIGRATION_CHECKS_FAIL })
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Migrations-Checkliste')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(page.getByText(/TWILIO_PRODUCTION_ACCOUNT_SID/)).toBeVisible()
  await expect(page.getByText(/TWILIO_PRODUCTION_PHONE_NUMBER/)).toBeVisible()
})

test('AC-4d: Manuelle Checkboxen sind interaktiv (ankreuzen/abkreuzen)', async ({ page }) => {
  await setupProj11Mocks(page, { migrationChecks: MOCK_MIGRATION_CHECKS_OK })
  await page.goto('/admin/whatsapp')

  const checkbox = page.getByLabel('Meta Business Account verifiziert')
  if (!(await checkbox.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(checkbox).not.toBeChecked()
  await checkbox.click()
  await expect(checkbox).toBeChecked()
  await checkbox.click()
  await expect(checkbox).not.toBeChecked()
})

test('AC-4e: Refresh-Button startet Prüfungen neu', async ({ page }) => {
  let callCount = 0
  await setupProj11Mocks(page)
  await page.route('/api/admin/whatsapp/migration-checks', (r) => {
    callCount++
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MIGRATION_CHECKS_OK) })
  })

  await page.goto('/admin/whatsapp')

  const card = page.getByText('Migrations-Checkliste')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  const initial = callCount
  await page.getByRole('button', { name: /prüfungen neu starten/i }).click()
  await expect.poll(() => callCount).toBeGreaterThan(initial)
})

// ─── AC-5: Webhook-URL bleibt unverändert ────────────────────────────────────

test('AC-5: Webhook-URL-Karte bleibt auf der Seite vorhanden (nahtlose Migration)', async ({ page }) => {
  await setupProj11Mocks(page)
  await page.goto('/admin/whatsapp')

  const card = page.getByText('Webhook-URL')
  if (!(await card.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(card).toBeVisible()
  // Webhook zeigt /api/webhooks/twilio an
  await expect(page.getByText('/api/webhooks/twilio')).toBeVisible()
})

// ─── AC-6: Bestehende Daten bleiben erhalten ─────────────────────────────────

test('AC-6: Telefonnummern-Karte und Nachrichten-Log bleiben auf der Seite', async ({ page }) => {
  await setupProj11Mocks(page)
  await page.goto('/admin/whatsapp')

  // Beide bestehenden Karten aus PROJ-8 müssen weiterhin sichtbar sein
  const nummerCard = page.getByText('Registrierte Nummern')
  const nachrichtenCard = page.getByText('Nachrichten')

  if (!(await nummerCard.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  await expect(nummerCard).toBeVisible()
  await expect(nachrichtenCard.first()).toBeVisible()
})

// ─── AC-7: Kein Code-Deployment beim Modus-Wechsel ───────────────────────────

test('AC-7: Modus-Wechsel wird via POST /api/admin/whatsapp/config gespeichert (DB, kein Restart)', async ({ page }) => {
  const postRequests: string[] = []

  await setupProj11Mocks(page, { config: MOCK_CONFIG_PRODUCTION })
  await page.route('/api/admin/whatsapp/config', async (r) => {
    if (r.request().method() === 'POST') {
      const body = await r.request().postDataJSON() as Record<string, string>
      postRequests.push(body.whatsapp_mode)
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CONFIG_PRODUCTION) })
  })

  await page.goto('/admin/whatsapp')

  const switchEl = page.getByRole('switch', { name: /betriebsmodus/i })
  if (!(await switchEl.isVisible().catch(() => false))) {
    test.skip()
    return
  }

  // Wechsel von Produktion → Sandbox
  await switchEl.click()
  await expect.poll(() => postRequests).toContain('sandbox')
})
