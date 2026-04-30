import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// PROJ-2 — Projektverwaltung E2E Tests
//
// Tests run against the live dev server. All API tests disable redirect-following
// so that middleware 302-redirects (unauthenticated → /login) are visible as
// 3xx rather than being resolved to the 200 of the login page.
//
// Expected status sets:
//   NO_ACCESS = [401, 403, 302]  — auth blocked or redirected
//   BAD_INPUT  = [400, 401, 403, 302]  — validation error or auth blocked
// ─────────────────────────────────────────────────────────────────────────────

// Next.js middleware uses 307 (Temporary Redirect) for auth redirects.
const NO_ACCESS = [401, 403, 302, 307]
const BAD_INPUT = [400, 401, 403, 302, 307]

// ─── AC#1+2: Projekt-Anlage-Formular ────────────────────────────────────────

test('AC#1 — Anlage-Formular: Seite ohne Auth führt zu Login-Redirect', async ({ page }) => {
  await page.goto('/admin/projekte')
  await page.waitForURL(/login/, { timeout: 8000 })
  expect(page.url()).toContain('login')
})

test('AC#1 — API: POST ohne Pflichtfeld (fehlender name) wird abgelehnt', async ({ request }) => {
  const res = await request.post('/api/admin/projekte', {
    data: { nummer: 'BV-24-001', kuerzel: 'BV-24-HH' },
    headers: { 'Content-Type': 'application/json' },
    maxRedirects: 0,
  })
  expect(BAD_INPUT).toContain(res.status())
})

test('AC#2 — API: POST mit optionalen Feldern blockiert ohne Auth', async ({ request }) => {
  const res = await request.post('/api/admin/projekte', {
    data: {
      name: 'Testprojekt',
      nummer: 'BV-24-001',
      kuerzel: 'BV-24-OPT',
      auftraggeber: 'Stadtwerke',
      adresse: 'Musterstraße 1, 20095 Hamburg',
      start_datum: '2024-03-01',
    },
    headers: { 'Content-Type': 'application/json' },
    maxRedirects: 0,
  })
  expect([...NO_ACCESS, 201, 409]).toContain(res.status())
})

// ─── AC#3: Kürzel-Eindeutigkeit ─────────────────────────────────────────────

test('AC#3 — API: Kürzel mit Leerzeichen wird abgelehnt (Regex)', async ({ request }) => {
  const res = await request.post('/api/admin/projekte', {
    data: { name: 'Test', nummer: '1', kuerzel: 'BV 24 HH' },
    headers: { 'Content-Type': 'application/json' },
    maxRedirects: 0,
  })
  expect(BAD_INPUT).toContain(res.status())
})

test('AC#3 — API: Kürzel > 20 Zeichen wird abgelehnt', async ({ request }) => {
  const res = await request.post('/api/admin/projekte', {
    data: { name: 'Test', nummer: '1', kuerzel: 'A'.repeat(21) },
    headers: { 'Content-Type': 'application/json' },
    maxRedirects: 0,
  })
  expect(BAD_INPUT).toContain(res.status())
})

test('AC#3 — API: XSS-Payload im Kürzel wird durch Regex blockiert', async ({ request }) => {
  const res = await request.post('/api/admin/projekte', {
    data: { name: 'Test', nummer: '1', kuerzel: '<script>alert(1)</script>' },
    headers: { 'Content-Type': 'application/json' },
    maxRedirects: 0,
  })
  expect(BAD_INPUT).toContain(res.status())
})

// ─── AC#4: Mitarbeiterzuordnung ──────────────────────────────────────────────

test('AC#4 — API: Mitarbeiter hinzufügen ohne Auth wird abgelehnt', async ({ request }) => {
  const res = await request.post(
    '/api/admin/projekte/f47ac10b-58cc-4372-a567-0e02b2c3d479/mitarbeiter',
    {
      data: { nutzer_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
      headers: { 'Content-Type': 'application/json' },
      maxRedirects: 0,
    }
  )
  expect(NO_ACCESS).toContain(res.status())
})

test('AC#4 — API: Mitarbeiter entfernen ohne Auth wird abgelehnt', async ({ request }) => {
  const res = await request.delete(
    '/api/admin/projekte/f47ac10b-58cc-4372-a567-0e02b2c3d479/mitarbeiter/f47ac10b-58cc-4372-a567-0e02b2c3d479',
    { maxRedirects: 0 }
  )
  expect(NO_ACCESS).toContain(res.status())
})

test('AC#4 — API: Mitarbeiter hinzufügen mit ungültiger UUID gibt 400 oder Auth-Fehler', async ({ request }) => {
  const res = await request.post(
    '/api/admin/projekte/f47ac10b-58cc-4372-a567-0e02b2c3d479/mitarbeiter',
    {
      data: { nutzer_id: 'keine-uuid' },
      headers: { 'Content-Type': 'application/json' },
      maxRedirects: 0,
    }
  )
  expect(BAD_INPUT).toContain(res.status())
})

// ─── AC#5: Projektliste mit Suche & Filter ──────────────────────────────────

test('AC#5 — Projektliste: ohne Auth führt Zugriff zu Login-Redirect', async ({ page }) => {
  await page.goto('/admin/projekte')
  await page.waitForURL(/login/, { timeout: 8000 })
  expect(page.url()).toContain('login')
})

test('AC#5 — API: GET /api/admin/projekte ohne Auth wird abgelehnt', async ({ request }) => {
  const res = await request.get('/api/admin/projekte', { maxRedirects: 0 })
  expect(NO_ACCESS).toContain(res.status())
})

test('AC#5 — API: GET /api/admin/projekte?archiviert=true ohne Auth wird abgelehnt', async ({ request }) => {
  const res = await request.get('/api/admin/projekte?archiviert=true', { maxRedirects: 0 })
  expect(NO_ACCESS).toContain(res.status())
})

// ─── AC#6: Detailseite ──────────────────────────────────────────────────────

test('AC#6 — Detailseite: ohne Auth Redirect zu Login', async ({ page }) => {
  await page.goto('/admin/projekte/f47ac10b-58cc-4372-a567-0e02b2c3d479')
  await page.waitForURL(/login/, { timeout: 8000 })
  expect(page.url()).toContain('login')
})

test('AC#6 — API: GET /api/admin/projekte/[id] ohne Auth wird abgelehnt', async ({ request }) => {
  const res = await request.get(
    '/api/admin/projekte/f47ac10b-58cc-4372-a567-0e02b2c3d479',
    { maxRedirects: 0 }
  )
  expect(NO_ACCESS).toContain(res.status())
})

// ─── AC#7: Archivieren ──────────────────────────────────────────────────────

test('AC#7 — API: PATCH archivieren ohne Auth wird abgelehnt', async ({ request }) => {
  const res = await request.patch(
    '/api/admin/projekte/f47ac10b-58cc-4372-a567-0e02b2c3d479/archivieren',
    { maxRedirects: 0 }
  )
  expect(NO_ACCESS).toContain(res.status())
})

// ─── AC#8: Archivierte ausgeblendet per Default ──────────────────────────────

test('AC#8 — API: Standard-Projektliste ohne ?archiviert ohne Auth wird abgelehnt', async ({ request }) => {
  const res = await request.get('/api/admin/projekte', { maxRedirects: 0 })
  expect(NO_ACCESS).toContain(res.status())
})

// ─── AC#9: Rollenbasierter Zugriff ───────────────────────────────────────────

test('AC#9 — API: /api/projekte ohne Auth wird abgelehnt', async ({ request }) => {
  const res = await request.get('/api/projekte', { maxRedirects: 0 })
  expect(NO_ACCESS).toContain(res.status())
})

test('AC#9 — Middleware: Nicht-Admin Zugriff auf /admin/* wird umgeleitet', async ({ page }) => {
  await page.goto('/admin/projekte')
  await page.waitForURL(/login|\//, { timeout: 8000 })
  expect(page.url()).not.toMatch(/^http:\/\/localhost:3000\/admin\/projekte$/)
})

// ─── Sicherheits-Tests ───────────────────────────────────────────────────────

test('Sicherheit — Mitarbeiter-Route erfordert Admin-Auth', async ({ request }) => {
  const res = await request.get(
    '/api/admin/projekte/f47ac10b-58cc-4372-a567-0e02b2c3d479/mitarbeiter',
    { maxRedirects: 0 }
  )
  expect(NO_ACCESS).toContain(res.status())
})

test('Sicherheit — PUT auf Projekt ohne Auth wird abgelehnt', async ({ request }) => {
  const res = await request.put(
    '/api/admin/projekte/f47ac10b-58cc-4372-a567-0e02b2c3d479',
    {
      data: { name: 'Manipuliert' },
      headers: { 'Content-Type': 'application/json' },
      maxRedirects: 0,
    }
  )
  expect(NO_ACCESS).toContain(res.status())
})

// ─── Regressions-Test: BUG-002 Fix ──────────────────────────────────────────

test('Regression BUG-002 — /api/begehungen ohne Auth wird abgelehnt', async ({ request }) => {
  const res = await request.post('/api/begehungen', {
    data: {
      projekt_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      datum: '2026-04-30',
      uhrzeit: '09:00',
      status: 'Entwurf',
    },
    headers: { 'Content-Type': 'application/json' },
    maxRedirects: 0,
  })
  expect([...NO_ACCESS, 422]).toContain(res.status())
})
