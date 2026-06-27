'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import baseTemplate from '@/lib/metrica/base-template.json'

// ─── Constants ────────────────────────────────────────────────────────────────

const AGE_GROUPS = ['U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'Senior']
const VENUE_TYPES = ['Home', 'Away', 'Neutral']
const POSITIONS = ['GK', 'DEF', 'MID', 'ATT']

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
]

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = {
  id: string
  name: string
  age_group: string | null
  position_group: string | null
  shirt_number: number | null
}

type SquadPlayer = {
  player: Player
  position_group: string  // editable, defaults to DB value or 'DEF'
  included: boolean
}

// ─── Metrica template generation ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MetricaTemplate = Record<string, any>

function generateMetricaTemplate(
  opponent: string,
  date: string,
  ageGroup: string,
  squad: SquadPlayer[]
): MetricaTemplate {
  const template: MetricaTemplate = JSON.parse(JSON.stringify(baseTemplate))
  const newImportId = crypto.randomUUID()

  template.name = `${opponent} - ${date} - ${ageGroup}`
  template.import_id = newImportId
  template.import_date = new Date().toISOString()

  // Propagate new import_id to every code and tag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of [...template.codes, ...template.tags] as any[]) {
    if ('import_id' in item) item.import_id = newImportId
  }

  // Replace VEI Players group with this squad
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  template.tags = (template.tags as any[]).filter((t: any) => t.group !== 'VEI Players')

  const included = squad.filter(s => s.included)
  const now = Date.now()

  included.forEach((s, idx) => {
    const name = s.player.name
    const shirt = s.player.shirt_number ?? (idx + 1)
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

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  border: '1px solid #E5E7EB', borderRadius: '10px',
  padding: '24px', marginBottom: '16px', background: '#FFFFFF',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#9CA3AF',
  textTransform: 'uppercase', letterSpacing: '0.07em',
  margin: '0 0 14px 0',
}

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 500,
  color: '#111111', marginBottom: '6px',
}

const input: React.CSSProperties = {
  border: '1px solid #E5E7EB', borderRadius: '8px',
  padding: '10px 14px', fontSize: '14px', color: '#111111',
  background: '#FFFFFF', outline: 'none', fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box',
}

function pill(active: boolean): React.CSSProperties {
  return {
    padding: '5px 14px', borderRadius: '9999px', fontSize: '13px',
    fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid #E5E7EB',
    background: active ? '#111111' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#111111',
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewMatchPage() {
  const router = useRouter()
  const supabase = createClient()

  // Identity
  const [organisationId, setOrganisationId] = useState<string | null>(null)

  // All players (fetched once on mount)
  const [allPlayers, setAllPlayers] = useState<Player[]>([])

  // Form
  const [date, setDate] = useState(todayISO())
  const [opponent, setOpponent] = useState('')
  const [venue, setVenue] = useState('')
  const [venueType, setVenueType] = useState('Home')
  const [ageGroup, setAgeGroup] = useState('')
  const [format, setFormat] = useState('9v9')
  const [duration, setDuration] = useState('50')
  const [notes, setNotes] = useState('')

  // Squad
  const [squad, setSquad] = useState<SquadPlayer[]>([])

  // UI
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── On mount ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[NewMatch] session:', session?.user?.id)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: member } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!member) return

      const { data: orgMembership } = await supabase
        .from('organisation_members')
        .select('organisation_id, role')
        .eq('member_id', member.id)
        .single()

      if (!orgMembership?.organisation_id) return
      const orgId = orgMembership.organisation_id
      console.log('[NewMatch] organisationId:', orgId)
      setOrganisationId(orgId)

      // Fetch all players for this organisation
      const { data: players, error: pErr } = await supabase
        .from('players')
        .select('id, name, age_group, position_group, shirt_number')
        .eq('home_organisation_id', orgId)

      console.log('[NewMatch] players fetched:', { count: players?.length, error: pErr })
      setAllPlayers(players ?? [])
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Filter squad when age group changes ──────────────────────────────────────

  const playersForAge = useMemo(
    () => allPlayers.filter(p => p.age_group === ageGroup),
    [allPlayers, ageGroup]
  )

  useEffect(() => {
    setSquad(
      playersForAge.map(p => ({
        player: p,
        position_group: p.position_group ?? 'DEF',
        included: true,
      }))
    )
  }, [playersForAge])

  // ── Squad handlers ────────────────────────────────────────────────────────────

  function toggleIncluded(i: number) {
    setSquad(prev => prev.map((s, idx) => idx === i ? { ...s, included: !s.included } : s))
  }

  function setPosition(i: number, pos: string) {
    setSquad(prev => prev.map((s, idx) => idx === i ? { ...s, position_group: pos } : s))
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!organisationId || !opponent.trim()) {
      setError('Opponent name is required')
      return
    }
    setSaving(true)
    setError(null)

    // 1. Insert match
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .insert({
        organisation_id: organisationId,
        date,
        opponent: opponent.trim(),
        venue: venue.trim() || null,
        home_away: venueType.toLowerCase(),
        age_group: ageGroup || null,
        format: format.trim() || null,
        duration_minutes: duration ? parseInt(duration) : null,
        notes: notes.trim() || null,
        spec_version: 'v2',
      })
      .select('id')
      .single()

    if (matchErr || !match) {
      setError(matchErr?.message ?? 'Failed to save match')
      setSaving(false)
      return
    }

    // 2. Insert lineups for included players
    const included = squad.filter(s => s.included)
    if (included.length > 0) {
      const { error: lineupErr } = await supabase.from('match_lineups').insert(
        included.map(s => ({
          match_id: match.id,
          player_id: s.player.id,
          position_group: s.position_group,
          minutes_played: 0,
        }))
      )
      if (lineupErr) {
        setError(lineupErr.message)
        setSaving(false)
        return
      }
    }

    // 3. Generate and download Metrica template
    const template = generateMetricaTemplate(opponent.trim(), date, ageGroup, squad)
    const safeOpponent = opponent.trim().replace(/[^a-zA-Z0-9]/g, '_')
    downloadJSON(template, `${safeOpponent}_${date}_metrica.json`)

    // 4. Redirect
    router.push('/performance/matches')
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111111', margin: 0 }}>
            New Match
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0' }}>
            Set up a match and generate your Metrica coding template
          </p>
        </div>

        {/* ── Section 1: Match Details ── */}
        <div style={card}>
          <p style={sectionLabel}>Match Details</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={fieldLabel}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />
            </div>
            <div>
              <label style={fieldLabel}>Opponent</label>
              <input
                type="text" value={opponent}
                onChange={e => setOpponent(e.target.value)}
                placeholder="Opponent team" style={input}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={fieldLabel}>Venue</label>
            <input
              type="text" value={venue}
              onChange={e => setVenue(e.target.value)}
              placeholder="Ground name" style={input}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={fieldLabel}>Location</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {VENUE_TYPES.map(v => (
                <button key={v} type="button" onClick={() => setVenueType(v)} style={pill(venueType === v)}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={fieldLabel}>Age Group</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {AGE_GROUPS.map(ag => (
                <button key={ag} type="button" onClick={() => setAgeGroup(ag)} style={pill(ageGroup === ag)}>
                  {ag}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={fieldLabel}>Format</label>
              <input
                type="text" value={format}
                onChange={e => setFormat(e.target.value)}
                placeholder="9v9" style={input}
              />
            </div>
            <div>
              <label style={fieldLabel}>Duration (min)</label>
              <input
                type="number" value={duration} min={0}
                onChange={e => setDuration(e.target.value)}
                placeholder="50" style={input}
              />
            </div>
          </div>

          <div>
            <label style={fieldLabel}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any match notes…"
              rows={3}
              style={{ ...input, resize: 'vertical' }}
            />
          </div>
        </div>

        {/* ── Section 2: Squad Selection ── */}
        <div style={card}>
          <p style={sectionLabel}>Squad Selection</p>
          {!ageGroup ? (
            <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
              Select an age group to load players
            </p>
          ) : squad.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
              No players found for {ageGroup}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {squad.map((s, i) => (
                <div key={s.player.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  opacity: s.included ? 1 : 0.4,
                }}>
                  {/* Shirt number */}
                  <span style={{
                    fontSize: '12px', color: '#9CA3AF', fontWeight: 500,
                    width: '20px', textAlign: 'right', flexShrink: 0,
                  }}>
                    {s.player.shirt_number ?? '—'}
                  </span>

                  {/* Avatar */}
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '9999px', flexShrink: 0,
                    background: avatarColor(s.player.name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color: '#FFFFFF',
                  }}>
                    {initials(s.player.name)}
                  </div>

                  {/* Name */}
                  <span style={{ fontSize: '14px', color: '#111111', flex: 1, minWidth: 0 }}>
                    {s.player.name}
                  </span>

                  {/* Position pills */}
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {POSITIONS.map(pos => (
                      <button
                        key={pos} type="button"
                        onClick={() => setPosition(i, pos)}
                        style={{
                          padding: '3px 10px', borderRadius: '9999px',
                          fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                          fontFamily: 'inherit', border: '1px solid #E5E7EB',
                          background: s.position_group === pos ? '#111111' : '#FFFFFF',
                          color: s.position_group === pos ? '#FFFFFF' : '#111111',
                        }}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>

                  {/* Include checkbox */}
                  <input
                    type="checkbox"
                    checked={s.included}
                    onChange={() => toggleIncluded(i)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#111111', flexShrink: 0 }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 3: Metrica Template ── */}
        <div style={card}>
          <p style={sectionLabel}>Metrica Template</p>
          <div style={{
            background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px',
          }}>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
              After saving, a Metrica coding template will be generated with your squad pre-loaded.
              Import it into <strong style={{ color: '#111111' }}>Metrica Sport</strong> before coding the match.
              Each player's shirt number from their profile is used. Players without a shirt number fall back to their squad order.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p style={{ fontSize: '13px', color: '#EF4444', margin: '0 0 16px' }}>{error}</p>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', paddingBottom: '48px' }}>
          <Link href="/performance/matches" style={{ fontSize: '14px', color: '#6B7280', textDecoration: 'none' }}>
            Cancel
          </Link>
          <button
            type="button" onClick={handleSave} disabled={saving}
            style={{
              background: saving ? '#555555' : '#111111',
              color: '#FFFFFF', border: 'none', borderRadius: '8px',
              padding: '11px 24px', fontSize: '14px', fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving…' : 'Save & Generate Template'}
          </button>
        </div>

      </div>
    </div>
  )
}
