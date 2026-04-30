import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// PROJ-1 — Benutzer-Authentifizierung E2E Tests
//
// Unauthentifizierte Redirect-Tests laufen immer. Authentifizierte Flows
// verwenden page.route() um API-Aufrufe zu mocken und werden übersprungen,
// wenn keine echte Supabase-Session vorhanden ist.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ADMIN = { id: 'admin-uuid', email: 'admin@ppb.de', role: 'admin' }

const MOCK_NUTZER_LISTE = [
  {
    id: 'user-1',
    email: 'mitarbeiter@ppb.de',
    rolle: 'mitarbeiter',
    aktiv: true,
    fehlgeschlagene_versuche: 0,
    gesperrt_bis: null,
    zuletzt_eingeloggt_am: '2026-04-24T08:00:00Z',
  },
  {
    id: 'admin-uuid',
    email: 'admin@ppb.de',
    rolle: 'admin',
    aktiv: true,
    fehlgeschlagene_versuche: 0,
    gesperrt_bis: null,
    zuletzt_eingeloggt_am: '2026-04-24T09:00:00Z',
  },
]

async function setupAdminMocks(page: import('@playwright/test').Page) {
  await page.route('/api/admin/benutzer', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_NUTZER_LISTE),
    })
  )
}

// ─── AC-8: Unauthentifizierte Weiterleitungen (always run) ───────────────────

test('AC-8: / ohne Session leitet zu /login weiter', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-8: /admin/benutzer ohne Session leitet zu /login weiter', async ({ page }) => {
  await page.goto('/admin/benutzer')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-8: /profil ohne Session leitet zu /login weiter', async ({ page }) => {
  await page.goto('/profil')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-8: /berichte ohne Session leitet zu /login weiter', async ({ page }) => {
  await page.goto('/berichte')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-8: /projekte ohne Session leitet zu /login weiter', async ({ page }) => {
  await page.goto('/projekte')
  await expect(page).toHaveURL(/\/login/)
})

// ─── AC-1: Login-Formular ─────────────────────────────────────────────────────

test('AC-1: Login-Seite zeigt E-Mail- und Passwort-Felder', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()
})

test('AC-1: Formularvalidierung — ungültige E-Mail zeigt Fehlermeldung', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[type="email"], input[name="email"]', 'kein-email')
  await page.fill('input[type="password"]', 'passwort123')
  await page.click('button[type="submit"]')
  await expect(page.locator('[role="alert"], [data-slot="form-message"]').first()).toBeVisible()
})

test('AC-1: Formularvalidierung — Passwort unter 8 Zeichen zeigt Fehlermeldung', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[type="email"], input[name="email"]', 'test@test.de')
  await page.fill('input[type="password"]', 'kurz')
  await page.click('button[type="submit"]')
  await expect(page.locator('[role="alert"], [data-slot="form-message"]').first()).toBeVisible()
})

// ─── AC-2: Generische Fehlermeldung ──────────────────────────────────────────

test('AC-2: Fehlerhafter Login zeigt generische Fehlermeldung (kein Hinweis auf E-Mail/Passwort)', async ({ page }) => {
  await page.route('/api/auth/login', (r) =>
    r.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'E-Mail oder Passwort ungültig.' }),
    })
  )

  await page.goto('/login')
  await page.fill('input[type="email"], input[name="email"]', 'test@test.de')
  await page.fill('input[type="password"]', 'wrongpassword')
  await page.click('button[type="submit"]')

  const errorEl = page.locator('[role="alert"]:not([aria-live="assertive"])')
  await expect(errorEl).toBeVisible()
  const text = await errorEl.textContent()
  expect(text).toContain('E-Mail oder Passwort ungültig.')
  // Must NOT reveal which field was wrong
  expect(text).not.toContain('E-Mail nicht gefunden')
  expect(text).not.toContain('Passwort falsch')
})

// ─── AC-3: Account-Sperre ─────────────────────────────────────────────────────

test('AC-3: Gesperrter Account zeigt Sperrungsmeldung mit Countdown', async ({ page }) => {
  await page.route('/api/auth/login', (r) =>
    r.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Account vorübergehend gesperrt. Bitte in ca. 14 Minute(n) erneut versuchen.' }),
    })
  )

  await page.goto('/login')
  await page.fill('input[type="email"], input[name="email"]', 'gesperrt@test.de')
  await page.fill('input[type="password"]', 'passwort123')
  await page.click('button[type="submit"]')

  const errorEl = page.locator('[role="alert"]:not([aria-live="assertive"])')
  await expect(errorEl).toBeVisible()
  await expect(errorEl).toContainText('gesperrt')
})

// ─── AC-7: Logout-Button ──────────────────────────────────────────────────────

test('AC-7: Logout-Button ist auf allen Seiten sichtbar (mit Session)', async ({ page }) => {
  await setupAdminMocks(page)
  await page.goto('/admin/benutzer')
  if (page.url().includes('/login')) { test.skip(); return }

  // Logout button visible in nav
  const logoutBtn = page.locator('button', { hasText: /abmelden|logout/i })
  await expect(logoutBtn).toBeVisible()
})

// ─── AC-5: Admin-Bereich — Nutzerverwaltung ───────────────────────────────────

test('AC-5: Admin-Bereich zeigt Nutzerliste mit E-Mail, Rolle, Status', async ({ page }) => {
  await setupAdminMocks(page)
  await page.goto('/admin/benutzer')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table', { timeout: 10000 })
  await expect(page.locator('table')).toBeVisible()

  // Should show both test users
  await expect(page.getByText('mitarbeiter@ppb.de')).toBeVisible()
  await expect(page.getByText('admin@ppb.de')).toBeVisible()
})

test('AC-5: Admin-Bereich — "Neuen Nutzer anlegen"-Dialog öffnet sich', async ({ page }) => {
  await setupAdminMocks(page)
  await page.goto('/admin/benutzer')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.waitForSelector('table', { timeout: 10000 })
  const addBtn = page.locator('button', { hasText: /nutzer|anlegen|hinzufügen/i }).first()
  await addBtn.click()

  // Dialog should appear
  await expect(page.locator('[role="dialog"]')).toBeVisible()
  await expect(page.locator('[role="dialog"] input[type="email"], [role="dialog"] input[name="email"]')).toBeVisible()
})

// ─── AC-4: Rollenvergabe nur durch Admin ──────────────────────────────────────

test('AC-4: /admin/benutzer ohne Session leitet zu /login weiter (Middleware-Guard)', async ({ page }) => {
  // Without a session, the middleware always redirects /admin/* to /login.
  // This covers the first layer of the admin-only guard.
  await page.goto('/admin/benutzer')
  await expect(page).toHaveURL(/\/login/)
})

// ─── AC-9: Passwort ändern ────────────────────────────────────────────────────

test('AC-9: Profil-Seite zeigt Passwort-Änderungs-Formular', async ({ page }) => {
  await page.goto('/profil')
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible()
  await expect(page.locator('input[autocomplete="new-password"]').first()).toBeVisible()
})

test('AC-9: Passwort-Änderung — Validierung wenn Passwörter nicht übereinstimmen', async ({ page }) => {
  await page.goto('/profil')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.fill('input[autocomplete="current-password"]', 'AltesPasswort1')
  const newPasswordFields = page.locator('input[autocomplete="new-password"]')
  await newPasswordFields.first().fill('NeuesPasswort1')
  await newPasswordFields.nth(1).fill('AnderesPasswort1')
  await page.locator('button[type="submit"]').click()

  await expect(page.locator('[data-slot="form-message"]').first()).toBeVisible()
})

// ─── Responsive: Login-Seite ──────────────────────────────────────────────────

test('RESP: Login-Seite ist auf Mobile (375px) nutzbar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()
})

test('RESP: Login-Seite ist auf Tablet (768px) nutzbar', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/login')
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()
})
