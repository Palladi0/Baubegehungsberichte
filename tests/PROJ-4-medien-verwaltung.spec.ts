import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// PROJ-4 — Medien-Verwaltung E2E Tests
//
// Tests run against the live dev server. Authenticated flows mock API responses
// via page.route() and skip if auth session is not available (no real Supabase
// session). Unauthenticated redirect tests always run.
// ─────────────────────────────────────────────────────────────────────────────

const PROJEKT_ID = 'proj-test-e2e'
const MEDIEN_URL = `/projekte/${PROJEKT_ID}/medien`

const MOCK_USER = { id: 'user-e2e', email: 'qa@ppb.de', role: 'mitarbeiter' }

const MOCK_FOTOS = [
  {
    id: 'foto-1',
    projekt_id: PROJEKT_ID,
    begehung_id: null,
    uploader_id: 'user-e2e',
    original_dateiname: 'IMG_001.jpg',
    datei_endung: 'jpg',
    dateigroesse_original: 1024000,
    bildunterschrift: 'Rohbau Ostseite',
    erstellt_am: '2026-04-23T10:00:00Z',
    aktualisiert_am: '2026-04-23T10:00:00Z',
    uploader: { id: 'user-e2e', vorname: 'Max', nachname: 'Muster', email: 'qa@ppb.de' },
    begehung: null,
  },
  {
    id: 'foto-2',
    projekt_id: PROJEKT_ID,
    begehung_id: 'beg-1',
    uploader_id: 'user-e2e',
    original_dateiname: 'IMG_002.jpg',
    datei_endung: 'jpg',
    dateigroesse_original: 2048000,
    bildunterschrift: null,
    erstellt_am: '2026-04-22T09:00:00Z',
    aktualisiert_am: '2026-04-22T09:00:00Z',
    uploader: { id: 'user-e2e', vorname: 'Max', nachname: 'Muster', email: 'qa@ppb.de' },
    begehung: { id: 'beg-1', datum: '2026-04-22', uhrzeit: '09:00:00' },
  },
]

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=',
  'base64'
)

async function setupApiMocks(
  page: import('@playwright/test').Page,
  fotos = MOCK_FOTOS
) {
  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  )
  await page.route(/\/api\/media\?/, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fotos) })
  )
  await page.route(/\/api\/begehungen\?/, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'beg-1', datum: '2026-04-22', uhrzeit: '09:00:00' }]) })
  )
  await page.route(/\/api\/media\/file\//, (r) =>
    r.fulfill({ status: 200, contentType: 'image/jpeg', body: TINY_JPEG })
  )
}

// ─── Unauthenticated redirect ──────────────────────────────────────────────

test('AC: Galerie-Seite ohne Session → Redirect zu /login', async ({ page }) => {
  await page.goto(MEDIEN_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Galerie-Ansicht ───────────────────────────────────────────────────────

test('AC: Galerie zeigt alle Fotos in Rasteransicht mit Metadaten', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('Rohbau Ostseite')).toBeVisible()
  await expect(page.getByText('Keine Bildunterschrift')).toBeVisible()
  await expect(page.getByText('2 Fotos')).toBeVisible()
})

test('AC: Galerie zeigt Uploader-Name und Upload-Datum pro Kachel', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('Max Muster').first()).toBeVisible()
  await expect(page.getByText('23.04.2026').first()).toBeVisible()
})

test('AC: Leerer Zustand zeigt Aufforderung zum ersten Upload', async ({ page }) => {
  await setupApiMocks(page, [])
  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('Noch keine Fotos hochgeladen.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Erstes Foto hochladen/i })).toBeVisible()
})

// ─── Upload-Funktionalität ─────────────────────────────────────────────────

test('AC: Upload-Sheet öffnet sich beim Klick auf "Fotos hochladen"', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /Fotos hochladen/i }).click()
  await expect(page.getByText(/hier ablegen oder klicken/i)).toBeVisible()
  await expect(page.getByText(/max\. 25 MB/i)).toBeVisible()
})

test('AC: Upload zeigt Fehlermeldung für nicht unterstütztes Format (GIF)', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /Fotos hochladen/i }).click()
  await expect(page.getByRole('button', { name: /Hochladen/i })).toBeVisible()

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'test.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('GIF89a'),
  })

  await expect(page.getByText(/JPEG, PNG, HEIC und WebP werden unterstützt/i)).toBeVisible()
})

test('AC: Upload zeigt Fehlermeldung für Datei über 25 MB', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /Fotos hochladen/i }).click()

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'gross.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(26 * 1024 * 1024),
  })

  await expect(page.getByText(/25 MB/i)).toBeVisible()
})

// ─── Sortierung ────────────────────────────────────────────────────────────

test('AC: Sortier-Dropdown enthält Upload-Datum und Begehungsdatum', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  const combobox = page.getByRole('combobox')
  await expect(combobox).toBeVisible()
  await combobox.click()

  await expect(page.getByRole('option', { name: /Upload-Datum/i })).toBeVisible()
  await expect(page.getByRole('option', { name: /Begehungsdatum/i })).toBeVisible()
})

// ─── FotoDetailDialog ──────────────────────────────────────────────────────

test('AC: Bearbeiten-Button öffnet Detail-Dialog mit Bildunterschrift-Feld', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  const firstTile = page.locator('.group').first()
  await firstTile.hover()
  await firstTile.getByRole('button', { name: /Foto bearbeiten/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('textarea')).toHaveValue('Rohbau Ostseite')
  await expect(page.getByRole('button', { name: /KI-Bildunterschrift generieren/i })).toBeVisible()
})

// ─── Löschen-Dialog ────────────────────────────────────────────────────────

test('AC: Löschen-Button zeigt Bestätigungs-Dialog mit Warnung', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  const firstTile = page.locator('.group').first()
  await firstTile.hover()
  await firstTile.getByRole('button', { name: /Foto löschen/i }).click()

  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expect(page.getByText(/Bereits generierte PDFs bleiben unverändert/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /Endgültig löschen/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Abbrechen/i })).toBeVisible()
})

// ─── Responsive ─────────────────────────────────────────────────────────────

test('AC: Galerie auf Mobile (375px) — Header und Upload-Button sichtbar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await setupApiMocks(page)
  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByRole('heading', { name: 'Medien' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Fotos hochladen/i })).toBeVisible()
})

test('AC: Galerie auf Desktop (1440px) — Rasteransicht sichtbar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await setupApiMocks(page)
  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('Rohbau Ostseite')).toBeVisible()
})

// ─── Fehlerbehandlung ─────────────────────────────────────────────────────

test('AC: Galerie zeigt Fehler-Alert mit Retry-Button wenn API 403 zurückgibt', async ({ page }) => {
  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  )
  await page.route(/\/api\/media\?/, (r) =>
    r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Kein Zugriff auf dieses Projekt.' }) })
  )
  await page.route(/\/api\/begehungen\?/, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  await page.goto(MEDIEN_URL)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText(/Kein Zugriff/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /Erneut versuchen/i })).toBeVisible()
})

// ─── Security API Tests (run without auth session) ────────────────────────
// Note: Middleware may redirect to /login (302) instead of returning 401 directly.
// We accept both as valid "unauthenticated" responses — key check is no data leaks (no 200).

const TEST_ID = '550e8400-e29b-41d4-a716-446655440000'

async function secureGet(page: import('@playwright/test').Page, url: string) {
  return page.context().request.fetch(url, { maxRedirects: 0 })
}
async function secureFetch(page: import('@playwright/test').Page, url: string, method: string, data?: unknown) {
  return page.context().request.fetch(url, {
    method,
    maxRedirects: 0,
    headers: { 'Content-Type': 'application/json' },
    data: data ? JSON.stringify(data) : undefined,
  })
}

test('Security: GET /api/media ohne Auth → kein Datenzugriff (401 oder 302)', async ({ page }) => {
  const res = await secureGet(page, '/api/media?projektId=test')
  expect(res.status()).not.toBe(200)
})

test('Security: POST /api/media/upload ohne Auth → kein Upload (401 oder 302)', async ({ page }) => {
  const res = await secureFetch(page, '/api/media/upload', 'POST', {})
  expect(res.status()).not.toBe(200)
})

test('Security: DELETE /api/media/[id] ohne Auth → kein Löschen (401 oder 302)', async ({ page }) => {
  const res = await secureFetch(page, `/api/media/${TEST_ID}`, 'DELETE')
  expect(res.status()).not.toBe(200)
})

test('Security: PATCH /api/media/[id] ohne Auth → keine Änderung (401 oder 302)', async ({ page }) => {
  const res = await secureFetch(page, `/api/media/${TEST_ID}`, 'PATCH', { bildunterschrift: 'hack' })
  expect(res.status()).not.toBe(200)
})

test('Security: POST /api/media/[id]/caption ohne Auth → kein KI-Zugriff (401 oder 302)', async ({ page }) => {
  const res = await secureFetch(page, `/api/media/${TEST_ID}/caption`, 'POST')
  expect(res.status()).not.toBe(200)
})

test('Security: GET /api/media/file/[id] ohne Auth → kein Dateizugriff (401 oder 302)', async ({ page }) => {
  const res = await secureGet(page, `/api/media/file/${TEST_ID}?v=thumb`)
  expect(res.status()).not.toBe(200)
})

test('Security: Path-Traversal-ID → zurückgewiesen (nicht 200)', async ({ page }) => {
  const res = await secureGet(page, '/api/media/file/../../../etc/passwd?v=thumb')
  expect(res.status()).not.toBe(200)
})
