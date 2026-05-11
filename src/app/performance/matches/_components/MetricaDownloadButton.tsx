'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import baseTemplate from '@/lib/metrica/base-template.json'

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MetricaTemplate = Record<string, any>

type LineupPlayer = {
  position_group: string
  players: {
    id: string
    name: string
    shirt_number: number | null
  } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateMetricaTemplate(
  opponent: string,
  date: string,
  ageGroup: string,
  lineups: LineupPlayer[]
): MetricaTemplate {
  const template: MetricaTemplate = JSON.parse(JSON.stringify(baseTemplate))
  const newImportId = crypto.randomUUID()

  template.name = `${opponent} - ${date} - ${ageGroup}`
  template.import_id = newImportId
  template.import_date = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of [...template.codes, ...template.tags] as any[]) {
    if ('import_id' in item) item.import_id = newImportId
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  template.tags = (template.tags as any[]).filter((t: any) => t.group !== 'VEI Players')

  const now = Date.now()

  lineups.forEach((lu, idx) => {
    if (!lu.players) return
    const name = lu.players.name
    const shirt = lu.players.shirt_number ?? (idx + 1)
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const suffix = Math.random().toString(36).slice(2, 8)
    template.tags.push({
      name: `${shirt}\n${name}`,
      type: 'tag',
      lead: 10,
      lag: 0,
      lead_enabled: false,
      lag_enabled: false,
      x: -0.75,
      y: 0.63,
      width: 0.17,
      height: 0.06,
      rotation: 0,
      color: '#0062ad',
      opacity: 1,
      strokeColor: '#ffffff',
      strokeWidth: 0.5,
      textColor: '#ffffff',
      textOpacity: 1,
      textSize: 0.75,
      shape: 'circle',
      counterColor: '#000000',
      counterPosition: 'no',
      instance: 'element',
      sem_id: `vei_${shirt}\n${slug}_${suffix}`,
      import_id: newImportId,
      group: 'VEI Players',
      tagInsertion: 'beforeCode',
      date: now,
      shortcut: '',
    })
  })

  return template
}

function downloadJSON(data: MetricaTemplate, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MetricaDownloadButton({
  matchId,
  opponent,
  date,
  ageGroup,
}: {
  matchId: string
  opponent: string
  date: string
  ageGroup: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault()   // don't navigate to match detail
    e.stopPropagation()
    setLoading(true)
    setErr(null)

    const supabase = createClient()
    const { data: lineups, error } = await supabase
      .from('match_lineups')
      .select('position_group, players(id, name, shirt_number)')
      .eq('match_id', matchId)

    if (error || !lineups) {
      setErr('Failed to load lineup')
      setLoading(false)
      return
    }

    const template = generateMetricaTemplate(
      opponent,
      date,
      ageGroup ?? '',
      lineups as unknown as LineupPlayer[]
    )
    const safeOpponent = opponent.replace(/[^a-zA-Z0-9]/g, '_')
    downloadJSON(template, `${safeOpponent}_${date}_metrica.json`)
    setLoading(false)
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        style={{
          background: '#FFFFFF',
          border: '1px solid #111111',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 500,
          color: loading ? '#9CA3AF' : '#111111',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {loading ? 'Generating…' : 'Download Metrica Template'}
      </button>
      {err && (
        <span style={{ fontSize: '11px', color: '#EF4444', marginLeft: '8px' }}>{err}</span>
      )}
    </div>
  )
}
