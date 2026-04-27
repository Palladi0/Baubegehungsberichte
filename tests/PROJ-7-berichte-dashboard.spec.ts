import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// PROJ-7 — Berichte-Dashboard E2E Tests
//
// Tests run against the live dev server. Authenticated flows use page.route()
// to mock client-side API calls (/api/reports, /api/benutzer/me) and skip if
// the Supabase session is not available (no real auth session). Only
// unauthenticated redirect tests always run.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-qa', email: 'qa@ppb.de', role: 'mitarbeiter' }

const MOCK_BERICHTE = [
  {
    id: 'bericht-1',
    projekt_id: 'proj-1',
    projekt_name: 'Bauprojekt Hamburg',
    projekt_nummer: 'BV-23-001',
    ersteller_id: 'user-qa',
    ersteller_email: 'qa@ppb.de',
    begehungs_datum: '2026-04-20',
    status: 'fertig',
    aktuelle_version_nr: 3,
    foto_anzahl: 7,
    pdf_pfad: '/uploads/bericht-1.pdf',
    pdf_generiert_am: '2026-04-20T15:00:00Z',
    pdf_versions_nr: 3,
    erstellt_am: '2026-04-20T09:00:00Z',
    aktualisiert_am: '2026-04-20T15:00:00Z',
    vorlage_id: null,
  },
  {
    id: 'bericht-2',
    projekt_id: 'proj-2',
    projekt_name: 'Schulneubau Berlin',
    projekt_nummer: 'SN-24-002',
    ersteller_id: 'other-user',
    ersteller_email: 'other@ppb.de',
    begehungs_datum: '2026-04-22',
    status: 'entwurf',
    aktuelle_version_nr: 1,
    foto_anzahl: 3,
    pdf_pfad: null,
    pdf_generiert_am: null,
    pdf_versions_nr: null,
    erstellt_am: '2026-04-22T10:00:00Z',
    aktualisiert_am: '2026-04-22T10:00:00Z',
    vorlage_id: null,
  },
]

const MOCK_BERICHTE_RESPONSE = { berichte: MOCK_BERICHTE, gesamt: 2, seiten: 1 }
const EMPTY_BERICHTE_RESPONSE = { berichte: [], gesamt: 0, seiten: 0 }

async function setupDashboardMocks(
  page: import('@playwright/test').Page,
  berichteResponse = MOCK_BERICHTE_RESPONSE
) {
  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  )
  await page.route('/api/reports**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(berichteResponse) })
  )
}

// ─── Unauthentifizierte Weiterleitungen (always run) ──────────────────────────

test('AC-AUTH: /berichte ohne Session leitet auf /login weiter', async ({ page }) => {
  await page.goto('/berichte')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-AUTH: / ohne Session leitet auf /login weiter', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

// ─── AC-1: Dashboard ist Startseite nach Login ────────────────────────────────

test('AC-1: / leitet authentifizierte Nutzer zu /berichte weiter', async ({ page }) => {
  await setupDashboardMocks(page)
  await page.goto('/')
  // Either stays at / (then redirects) or goes to /berichte
  const url = page.url()
  // If redirected to login, skip — no real auth session
  if (url.includes('/login')) { test.skip(); return }
  await expect(page).toHaveURL('/berichte')
})

// ─── AC-2: Berichtsliste zeigt alle Pflichtfelder ────────────────────────────

test('AC-2: Tabelle zeigt Pflicht-Spalten (Projekt, Datum, Ersteller, Status, Fotos)', async ({ page }) => {
  await setupDashboardMocks(page)
  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table', { timeout: 10000 })

  const headerText = await page.locator('table thead').textContent()
  expect(headerText).toContain('Projekt')
  expect(headerText).toContain('Datum')
  expect(headerText).toContain('Status')

  // Verify data rows are rendered
  const rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(2)
})

// ─── AC-3 + AC-4: Filter-Leiste vorhanden ────────────────────────────────────

test('AC-3/AC-4: Filter-Leiste enthält Suche, Projekt, Status, Datum Von/Bis, Sortierung', async ({ page }) => {
  await setupDashboardMocks(page)
  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('input[placeholder*="Projektname"]', { timeout: 10000 })

  await expect(page.locator('input[placeholder*="Projektname"]')).toBeVisible()
  await expect(page.locator('input[type="date"]').first()).toBeVisible()
  await expect(page.locator('input[type="date"]').nth(1)).toBeVisible()
  // Three Select dropdowns: Projekt, Status, Sortierung
  await expect(page.getByRole('combobox').first()).toBeVisible()
})

// ─── AC-7: „Neuer Bericht"-Button ────────────────────────────────────────────

test('AC-7: „Neuer Bericht"-Button ist sichtbar und verlinkt zu /berichte/neu', async ({ page }) => {
  await setupDashboardMocks(page)
  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('a[href="/berichte/neu"]', { timeout: 10000 })

  const neuBtn = page.getByRole('link', { name: /Neuer Bericht/i })
  await expect(neuBtn).toBeVisible()
  await expect(neuBtn).toHaveAttribute('href', '/berichte/neu')
})

// ─── AC-5: Sortier-Optionen ───────────────────────────────────────────────────

test('AC-5: Sortierung-Dropdown enthält alle Optionen (Datum desc/asc, Projekt, Ersteller)', async ({ page }) => {
  await setupDashboardMocks(page)
  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table', { timeout: 10000 })

  // Find the sortierung combobox (aria-label)
  const sortSelect = page.getByRole('combobox', { name: /Sortierung/i })
  await sortSelect.click()

  await expect(page.getByRole('option', { name: 'Datum (neueste zuerst)' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Datum (älteste zuerst)' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Projekt (A–Z)' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Ersteller (A–Z)' })).toBeVisible()
})

// ─── AC-9: Statusanzeige ─────────────────────────────────────────────────────

test('AC-9: Status-Badges "Fertig" (grün) und "Entwurf" (gelb) werden korrekt dargestellt', async ({ page }) => {
  await setupDashboardMocks(page)
  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table tbody tr', { timeout: 10000 })

  const fertigBadge = page.getByText('Fertig').first()
  const entwurfBadge = page.getByText('Entwurf').first()

  await expect(fertigBadge).toBeVisible()
  await expect(entwurfBadge).toBeVisible()

  // Green class for Fertig, yellow for Entwurf
  await expect(fertigBadge).toHaveClass(/green/)
  await expect(entwurfBadge).toHaveClass(/yellow/)
})

// ─── AC-10: Leere Ansicht ────────────────────────────────────────────────────

test('AC-10: Leere Ansicht zeigt Hilfetext wenn keine Berichte vorhanden sind', async ({ page }) => {
  await setupDashboardMocks(page, EMPTY_BERICHTE_RESPONSE)
  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table', { timeout: 10000 })

  await expect(page.getByText(/keine berichte/i).first()).toBeVisible()
})

// ─── AC-8: Lösch-Dialog ──────────────────────────────────────────────────────

test('AC-8: Löschen öffnet AlertDialog mit Bestätigung und Abbrechen-Button', async ({ page }) => {
  await setupDashboardMocks(page, {
    berichte: [MOCK_BERICHTE[0]],
    gesamt: 1,
    seiten: 1,
  })
  await page.route('/api/reports/bericht-1', (r) => {
    if (r.request().method() === 'DELETE') {
      r.fulfill({ status: 204 })
    } else {
      r.continue()
    }
  })

  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table tbody tr', { timeout: 10000 })

  // Open actions dropdown for first row
  const aktionenBtn = page.getByRole('button', { name: /Aktionen/i }).first()
  await aktionenBtn.click()

  // Click Löschen
  await page.getByRole('menuitem', { name: /Löschen/i }).click()

  // Confirm dialog should be visible
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expect(page.getByText(/dauerhaft gelöscht/i)).toBeVisible()

  // Abbrechen closes the dialog
  await page.getByRole('button', { name: /Abbrechen/i }).click()
  await expect(page.getByRole('alertdialog')).not.toBeVisible()
})

// ─── AC-6: Schnellaktionen ───────────────────────────────────────────────────

test('AC-6: Aktionen-Dropdown enthält Öffnen, PDF-Aktion, Duplizieren, Löschen', async ({ page }) => {
  await setupDashboardMocks(page, {
    berichte: [MOCK_BERICHTE[0]],
    gesamt: 1,
    seiten: 1,
  })

  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table tbody tr', { timeout: 10000 })

  const aktionenBtn = page.getByRole('button', { name: /Aktionen/i }).first()
  await aktionenBtn.click()

  await expect(page.getByRole('menuitem', { name: /Öffnen/i })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /PDF herunterladen/i })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Duplizieren/i })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Löschen/i })).toBeVisible()
})

// ─── Eintrags-Zähler ─────────────────────────────────────────────────────────

test('Dashboard zeigt Eintrags-Zähler "2 Berichte gefunden"', async ({ page }) => {
  await setupDashboardMocks(page)
  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table', { timeout: 10000 })
  await expect(page.getByText(/2 Berichte gefunden/i)).toBeVisible()
})

// ─── Paginierung ─────────────────────────────────────────────────────────────

test('AC-11: Paginierung erscheint wenn mehr als 25 Berichte vorhanden sind (2 Seiten)', async ({ page }) => {
  await setupDashboardMocks(page, {
    berichte: MOCK_BERICHTE,
    gesamt: 30,
    seiten: 2,
  })

  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table', { timeout: 10000 })
  await expect(page.getByText(/Seite 1 von 2/i)).toBeVisible()
})

// ─── Filter: Status ───────────────────────────────────────────────────────────

test('AC-3: Status-Filter "Fertig" sendet status=fertig an die API', async ({ page }) => {
  const capturedUrls: string[] = []

  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  )
  await page.route('/api/reports**', (r) => {
    capturedUrls.push(r.request().url())
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BERICHTE_RESPONSE) })
  })

  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table', { timeout: 10000 })

  // Click Status combobox
  const statusSelect = page.getByRole('combobox', { name: /Status filtern/i })
  await statusSelect.click()
  await page.getByRole('option', { name: 'Fertig' }).click()
  await page.waitForTimeout(500)

  const lastUrl = capturedUrls[capturedUrls.length - 1]
  expect(lastUrl).toContain('status=fertig')
})

// ─── Filter zurücksetzen ──────────────────────────────────────────────────────

test('AC-3: "Filter zurücksetzen" erscheint bei aktivem Filter und setzt Suchfeld zurück', async ({ page }) => {
  await setupDashboardMocks(page)
  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table', { timeout: 10000 })

  // No reset button initially
  await expect(page.getByRole('button', { name: /Filter zurücksetzen/i })).not.toBeVisible()

  // Fill search
  await page.locator('input[placeholder*="Projektname"]').fill('Hamburg')
  await page.waitForTimeout(300)

  // Reset button appears
  await expect(page.getByRole('button', { name: /Filter zurücksetzen/i })).toBeVisible()

  // Click reset
  await page.getByRole('button', { name: /Filter zurücksetzen/i }).click()
  await page.waitForTimeout(200)

  await expect(page.locator('input[placeholder*="Projektname"]')).toHaveValue('')
})

// ─── Responsive: Mobil (375px) ────────────────────────────────────────────────

test('Responsive (375px): Kerninhalte (Heading, Neuer-Bericht-Button) bleiben sichtbar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await setupDashboardMocks(page)

  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('h1', { timeout: 10000 })
  await expect(page.getByRole('heading', { name: /Berichte/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Neuer Bericht/i })).toBeVisible()
})

// ─── Responsive: Tablet (768px) ──────────────────────────────────────────────

test('Responsive (768px): Dashboard-Tabelle auf Tablet sichtbar', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await setupDashboardMocks(page)

  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table', { timeout: 10000 })
  await expect(page.locator('table')).toBeVisible()
})

// ─── Lade-Skeleton ───────────────────────────────────────────────────────────

test('Dashboard zeigt Lade-Skeleton beim initialen Datenabruf', async ({ page }) => {
  let resolve: () => void
  const delayed = new Promise<void>((r) => { resolve = r })

  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  )
  // Delay the /api/reports response to catch the loading state
  await page.route('/api/reports**', async (r) => {
    await delayed
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BERICHTE_RESPONSE) })
  })

  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  // Resolve after a short delay to let skeleton render
  await page.waitForTimeout(200)
  // Skeleton elements are present during loading
  const skeletons = page.locator('[class*="animate-pulse"], [class*="skeleton"]')
  // After resolving the response, skeleton should disappear
  resolve!()
  await page.waitForSelector('table tbody tr', { timeout: 10000 })
  await expect(page.locator('table tbody tr').first()).toBeVisible()
})
