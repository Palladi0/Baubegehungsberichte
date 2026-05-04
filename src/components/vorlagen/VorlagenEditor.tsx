'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, AlertTriangle, Loader2, Save } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import type { VorlageConfig } from '@/types/berichte'

interface VorlagenEditorProps {
  initialValues?: Partial<VorlageConfig>
  vorlageId?: string
}

const DEFAULTS = {
  name: '',
  firmenname: '',
  primaerfarbe: '#1a1a1a',
  sekundaerfarbe: '#374151',
  kopfzeilen_text: 'Baustellenbegehungsbericht',
  fusszeilen_text: '',
  schriftgroesse: 'mittel' as const,
  ist_standard: false,
  logo_url: null as string | null,
}

// WCAG 2.1 relativer Luminanzwert für einen HEX-Farbwert
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

function kontrastVerhältnis(hex: string): number {
  const L = relativeLuminance(hex)
  const white = 1.0
  return (white + 0.05) / (L + 0.05)
}

function isValidHex(s: string) { return /^#[0-9a-fA-F]{6}$/.test(s) }

export function VorlagenEditor({ initialValues, vorlageId }: VorlagenEditorProps) {
  const router = useRouter()
  const isEdit = !!vorlageId

  const [name, setName] = useState(initialValues?.name ?? DEFAULTS.name)
  const [firmenname, setFirmenname] = useState(initialValues?.firmenname ?? DEFAULTS.firmenname)
  const [primaerfarbe, setPrimaerfarbe] = useState(initialValues?.primaerfarbe ?? DEFAULTS.primaerfarbe)
  const [sekundaerfarbe, setSekundaerfarbe] = useState(initialValues?.sekundaerfarbe ?? DEFAULTS.sekundaerfarbe)
  const [kopfzeilenText, setKopfzeilenText] = useState(initialValues?.kopfzeilen_text ?? DEFAULTS.kopfzeilen_text)
  const [fusszeileText, setFusszeileText] = useState(initialValues?.fusszeilen_text ?? DEFAULTS.fusszeilen_text)
  const [schriftgroesse, setSchriftgroesse] = useState<'klein' | 'mittel' | 'gross'>(
    initialValues?.schriftgroesse ?? DEFAULTS.schriftgroesse
  )
  const [istStandard, setIstStandard] = useState(initialValues?.ist_standard ?? DEFAULTS.ist_standard)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(initialValues?.logo_url ?? null)
  const [neueLogodatei, setNeueLogodatei] = useState<File | null>(null)

  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const logoInputRef = useRef<HTMLInputElement>(null)

  // Vorschau-iframe aktualisieren bei Formularänderungen
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const schriftMap: Record<string, string> = { klein: '10pt', mittel: '11pt', gross: '13pt' }
  const primaerGueltig = isValidHex(primaerfarbe)
  const sekundaerGueltig = isValidHex(sekundaerfarbe)
  const primaerKontrast = primaerGueltig ? kontrastVerhältnis(primaerfarbe) : 99
  const schlechtKontrast = primaerKontrast < 4.5

  function generatePreviewHtml() {
    const schriftBasis = schriftMap[schriftgroesse] ?? '11pt'
    const logoHtml = logoPreviewUrl
      ? `<img src="${logoPreviewUrl}" alt="Logo" style="max-height:40px;max-width:140px;object-fit:contain;" />`
      : firmenname
        ? `<div style="font-size:13pt;font-weight:700;color:${primaerfarbe};">${firmenname}</div>`
        : `<div style="font-size:13pt;font-weight:700;color:${primaerfarbe};">Architekturbüro</div>`
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  :root{--farbe-primaer:${primaerfarbe};--farbe-sekundaer:${sekundaerfarbe};--schrift-basis:${schriftBasis};}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:var(--schrift-basis);background:#fff;color:#1a1a1a;padding:24px;}
  .kopfzeile{font-size:8pt;color:var(--farbe-sekundaer);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;}
  .titel{font-size:20pt;font-weight:700;color:var(--farbe-primaer);margin-top:16px;line-height:1.2;}
  .subtitel{font-size:10pt;color:#666;margin-top:4px;}
  .divider{border:none;border-top:2px solid var(--farbe-primaer);margin:16px 0;}
  .meta-row{display:flex;gap:12px;font-size:9.5pt;padding:4px 0;border-bottom:1px solid #e5e7eb;}
  .meta-label{font-weight:600;color:var(--farbe-primaer);width:40%;}
  .section-title{font-size:12pt;font-weight:700;border-bottom:2px solid var(--farbe-primaer);padding-bottom:4px;color:var(--farbe-primaer);margin:16px 0 8px;}
  .body-text{font-size:9.5pt;line-height:1.6;color:#333;}
  .fusszeile{margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:7.5pt;color:var(--farbe-sekundaer);text-align:center;}
</style></head><body>
  ${kopfzeilenText ? `<div class="kopfzeile">${kopfzeilenText}</div>` : ''}
  ${logoHtml}
  <div class="titel">Baustellenbegehung –<br/>Musterstraße 1, Hamburg</div>
  <div class="subtitel">Projektnummer: BV-24-HH</div>
  <hr class="divider"/>
  <div class="meta-row"><span class="meta-label">Datum</span><span>12. April 2026</span></div>
  <div class="meta-row"><span class="meta-label">Uhrzeit</span><span>10:00 Uhr</span></div>
  <div class="meta-row"><span class="meta-label">Erstellt von</span><span>M. Mustermann</span></div>
  <div class="section-title">Dacharbeiten</div>
  <div class="body-text">Dachdeckungsarbeiten wurden besichtigt. Dämmung vollständig verlegt, Abdichtung läuft planmäßig. Keine Mängel festgestellt.</div>
  ${fusszeileText ? `<div class="fusszeile">${fusszeileText}</div>` : ''}
</body></html>`
  }

  useEffect(() => {
    if (!iframeRef.current) return
    const doc = iframeRef.current.contentDocument
    if (doc) {
      doc.open()
      doc.write(generatePreviewHtml())
      doc.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaerfarbe, sekundaerfarbe, schriftgroesse, kopfzeilenText, fusszeileText, firmenname, logoPreviewUrl])

  function handleLogodateiAusgewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setFehler('Logo zu groß (max. 2 MB)')
      return
    }
    setNeueLogodatei(file)
    setLogoPreviewUrl(URL.createObjectURL(file))
    setFehler(null)
  }

  function handleLogoEntfernen() {
    setNeueLogodatei(null)
    setLogoPreviewUrl(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  async function handleSpeichern() {
    if (!name.trim()) {
      setFehler('Name ist erforderlich.')
      return
    }
    if (!primaerGueltig || !sekundaerGueltig) {
      setFehler('Ungültige HEX-Farbwerte.')
      return
    }

    setSpeichert(true)
    setFehler(null)

    try {
      const body = {
        name: name.trim(),
        firmenname: firmenname.trim(),
        primaerfarbe,
        sekundaerfarbe,
        kopfzeilen_text: kopfzeilenText.trim(),
        fusszeilen_text: fusszeileText.trim(),
        schriftgroesse,
        ist_standard: istStandard,
      }

      let savedId = vorlageId

      if (isEdit) {
        const res = await fetch(`/api/templates/${vorlageId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error ?? 'Speichern fehlgeschlagen.')
        }
      } else {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error ?? 'Speichern fehlgeschlagen.')
        }
        const data = await res.json() as { id: string }
        savedId = data.id
      }

      // Logo hochladen wenn neue Datei ausgewählt
      if (neueLogodatei && savedId) {
        const fd = new FormData()
        fd.append('logo', neueLogodatei)
        const logoRes = await fetch(`/api/templates/${savedId}/logo`, {
          method: 'POST',
          body: fd,
        })
        if (!logoRes.ok) {
          const json = await logoRes.json().catch(() => ({}))
          throw new Error(json.error ?? 'Logo-Upload fehlgeschlagen.')
        }
      } else if (!logoPreviewUrl && isEdit) {
        // Logo wurde entfernt
        await fetch(`/api/templates/${vorlageId}/logo`, { method: 'DELETE' })
      }

      router.push('/admin/vorlagen')
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Linke Spalte: Formular */}
      <div className="space-y-6">
        {fehler && (
          <Alert variant="destructive">
            <AlertDescription>{fehler}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Allgemein</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vorlage-name">Name *</Label>
              <Input
                id="vorlage-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Professionell"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firmenname">Firmenname (Fallback ohne Logo)</Label>
              <Input
                id="firmenname"
                value={firmenname}
                onChange={(e) => setFirmenname(e.target.value)}
                placeholder="z. B. Architekturbüro Müller"
              />
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Switch
                id="ist-standard"
                checked={istStandard}
                onCheckedChange={setIstStandard}
              />
              <div>
                <Label htmlFor="ist-standard" className="cursor-pointer text-sm font-medium">
                  Als Standard-Template verwenden
                </Label>
                <p className="text-xs text-muted-foreground">
                  Wird für alle neuen Berichte automatisch ausgewählt.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {logoPreviewUrl ? (
              <div className="flex items-start gap-3">
                <img
                  src={logoPreviewUrl}
                  alt="Logo-Vorschau"
                  className="h-12 max-w-[150px] object-contain rounded border border-border"
                />
                <Button variant="ghost" size="sm" onClick={handleLogoEntfernen}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Entfernen
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
              >
                <Upload className="h-5 w-5" />
                <span>PNG, SVG, JPEG oder WEBP — max. 2 MB</span>
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              className="hidden"
              onChange={handleLogodateiAusgewaehlt}
            />
            {!logoPreviewUrl && (
              <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Logo hochladen
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Farben</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primaerfarbe">Primärfarbe (HEX)</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaerGueltig ? primaerfarbe : '#1a1a1a'}
                  onChange={(e) => setPrimaerfarbe(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-input p-1"
                  aria-label="Primärfarbe wählen"
                />
                <Input
                  id="primaerfarbe"
                  value={primaerfarbe}
                  onChange={(e) => setPrimaerfarbe(e.target.value)}
                  placeholder="#1a1a1a"
                  className="font-mono"
                  maxLength={7}
                />
              </div>
              {schlechtKontrast && primaerGueltig && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  Dieser Farbwert könnte die Lesbarkeit beeinträchtigen (Kontrast {primaerKontrast.toFixed(1)}:1, Empfehlung ≥ 4.5:1).
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sekundaerfarbe">Sekundärfarbe (HEX)</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={sekundaerGueltig ? sekundaerfarbe : '#374151'}
                  onChange={(e) => setSekundaerfarbe(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-input p-1"
                  aria-label="Sekundärfarbe wählen"
                />
                <Input
                  id="sekundaerfarbe"
                  value={sekundaerfarbe}
                  onChange={(e) => setSekundaerfarbe(e.target.value)}
                  placeholder="#374151"
                  className="font-mono"
                  maxLength={7}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Texte & Schrift</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kopfzeilen-text">Kopfzeilen-Text</Label>
              <Input
                id="kopfzeilen-text"
                value={kopfzeilenText}
                onChange={(e) => setKopfzeilenText(e.target.value)}
                placeholder="z. B. Baustellenbegehungsbericht"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fusszeile-text">Fußzeilen-Text</Label>
              <Input
                id="fusszeile-text"
                value={fusszeileText}
                onChange={(e) => setFusszeileText(e.target.value)}
                placeholder="z. B. Vertraulich – nur für internen Gebrauch"
                maxLength={200}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Schriftgröße</Label>
              <RadioGroup
                value={schriftgroesse}
                onValueChange={(v) => setSchriftgroesse(v as 'klein' | 'mittel' | 'gross')}
                className="flex gap-4"
              >
                {([['klein', 'Klein (10pt)'], ['mittel', 'Mittel (11pt)'], ['gross', 'Groß (13pt)']] as const).map(([val, label]) => (
                  <div key={val} className="flex items-center gap-2">
                    <RadioGroupItem value={val} id={`schrift-${val}`} />
                    <Label htmlFor={`schrift-${val}`} className="cursor-pointer font-normal">{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={handleSpeichern} disabled={speichert}>
            {speichert ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Speichert…</>
            ) : (
              <><Save className="mr-1.5 h-4 w-4" />{isEdit ? 'Änderungen speichern' : 'Vorlage erstellen'}</>
            )}
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/vorlagen')} disabled={speichert}>
            Abbrechen
          </Button>
        </div>
      </div>

      {/* Rechte Spalte: Live-Vorschau */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Live-Vorschau</p>
          <span className="text-xs text-muted-foreground">— wird live aktualisiert</span>
        </div>
        <div className="overflow-hidden rounded-lg border shadow-sm">
          <iframe
            ref={iframeRef}
            title="Vorlage-Vorschau"
            className="h-[700px] w-full bg-white"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  )
}
