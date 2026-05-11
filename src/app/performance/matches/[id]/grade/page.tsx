'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { computeVEI } from './actions'

// ─── Types ───────────────────────────────────────────────────────────────────

type MatchData = {
  id: string
  opponent: string
  date: string
  age_group: string | null
}

type LineupEntry = {
  player_id: string
  position_group: string
  minutes_played: number
  player: { id: string; name: string; shirt_number: number | null }
}

type MatchEvent = {
  id: string
  player_id: string
  event_type: string
  event_sub_category: string | null
  grade: number
  completed: boolean
  difficulty_weight: number | null
  attacking_third: boolean
  is_defensive_third: boolean
  is_big_chance: boolean
  is_hv_def: boolean
  is_goal: boolean
  clip_url: string | null
}

type ContextFlags = {
  attackingThird: boolean
  defensiveThird: boolean
  isBigChance: boolean
  isHvDef: boolean
  isGoal: boolean
}

type VeiResult = {
  playerName: string
  veiIndex: number
  isValid: boolean
  positionGroup: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_TYPES = ['Pass', 'Shot', 'Carry', 'Dribble', 'Defensive Action']

const SUB_CATEGORIES: Record<string, string[]> = {
  Pass: ['Safety Pass', 'Forward Pass', 'Switch', 'Cross', 'Through Ball', 'Progressive Pass', 'Line-Breaking Pass'],
  Shot: ['Blocked Shot', 'Shot Off Target', 'Header Shot', 'Shot on Target', 'Big Chance'],
  Carry: ['Holding Carry', 'Carry into Attacking Third', 'Progressive Carry', 'Carry Under Pressure'],
  Dribble: ['Dribble into Space', 'Progressive Dribble', 'Dribble Under Pressure', 'Skill Move'],
  'Defensive Action': ['Clearance', 'Aerial Duel', 'Block', 'Tackle', 'Interception', 'HV Defensive Action'],
}

const difficultyWeights: Record<string, number> = {
  'Safety Pass': 0.6,
  'Forward Pass': 0.8,
  'Switch': 1.0,
  'Cross': 1.0,
  'Through Ball': 1.2,
  'Progressive Pass': 1.3,
  'Line-Breaking Pass': 1.4,
  'Dribble into Space': 0.8,
  'Progressive Dribble': 1.1,
  'Dribble Under Pressure': 1.3,
  'Skill Move': 1.4,
  'Holding Carry': 0.7,
  'Carry into Attacking Third': 1.1,
  'Progressive Carry': 1.2,
  'Carry Under Pressure': 1.3,
  'Blocked Shot': 0.8,
  'Shot Off Target': 0.9,
  'Header Shot': 1.0,
  'Shot on Target': 1.1,
  'Big Chance': 1.3,
  'Clearance': 0.8,
  'Aerial Duel': 0.9,
  'Block': 1.0,
  'Tackle': 1.1,
  'Interception': 1.2,
  'HV Defensive Action': 1.4,
}

const GRADES = [
  { value: -1, label: '-1', color: '#EF4444' },
  { value: 0, label: '0', color: '#9CA3AF' },
  { value: 1, label: '+1', color: '#22C55E' },
  { value: 2, label: '+2', color: '#3B82F6' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function initials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const AVATAR_COLORS = [
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#EF4444',
  '#14B8A6',
]

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h)
  }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function formatEventType(t: string) {
  return t
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GradePage() {
  const router = useRouter()
  const params = useParams()
  const matchId = params.id as string

  // State
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [lineup, setLineup] = useState<LineupEntry[]>([])
  const [events, setEvents] = useState<MatchEvent[]>([])
  const [organisationId, setOrganisationId] = useState<string | null>(null)
  // Manual add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<LineupEntry | null>(null)
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null)
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null)
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [selectedOutcome, setSelectedOutcome] = useState<'completed' | 'not_completed' | null>(null)
  const [contextFlags, setContextFlags] = useState<ContextFlags>({
    attackingThird: false,
    defensiveThird: false,
    isBigChance: false,
    isHvDef: false,
    isGoal: false,
  })
  const [saving, setSaving] = useState(false)
  const [flashSuccess, setFlashSuccess] = useState(false)
  const [computing, setComputing] = useState(false)
  const [veiResults, setVeiResults] = useState<VeiResult[] | null>(null)
  const [veiError, setVeiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Selected event for left-column editor
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  // On mount
  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get member + org
      const { data: member } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (member) {
        const { data: orgMembership } = await supabase
          .from('organisation_members')
          .select('organisation_id, role')
          .eq('member_id', member.id)
          .single()

        if (orgMembership) {
          setOrganisationId(orgMembership.organisation_id)
        }
      }

      // Fetch match
      const { data: matchRow } = await supabase
        .from('matches')
        .select('id, opponent, date, age_group')
        .eq('id', matchId)
        .single()

      if (matchRow) setMatchData(matchRow)

      // Fetch lineups
      const { data: lineupRows, error: lineupError } = await supabase
        .from('match_lineups')
        .select('*, players(id, name, shirt_number, position_group)')
        .eq('match_id', matchId)

      console.log('[Grade] matchId:', matchId)
      console.log('[Grade] lineups:', lineupRows)
      console.log('[Grade] lineupError:', lineupError)

      if (lineupRows) {
        const mapped: LineupEntry[] = lineupRows.flatMap(row => {
          const playerArr = Array.isArray(row.players)
            ? row.players
            : row.players
            ? [row.players]
            : []
          const p = (playerArr[0] as any) ?? null
          if (!p) return []
          return [
            {
              player_id: row.player_id,
              position_group: row.position_group,
              minutes_played: row.minutes_played,
              player: {
                id: p.id,
                name: p.name,
                shirt_number: p.shirt_number ?? null,
              },
            },
          ]
        })
        setLineup(mapped)
      }

      // Fetch existing events
      const { data: eventRows } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false })

      if (eventRows) setEvents(eventRows)

      setLoading(false)
    }

    load()
  }, [matchId, router])

  // Derived
  const canAdd =
    selectedPlayer !== null &&
    selectedEventType !== null &&
    selectedSubCategory !== null &&
    selectedGrade !== null &&
    selectedOutcome !== null

  // HV Def validation temporarily disabled — restore once full match data is available
  const canComputeVEI = events.length > 0

  // Handlers
  async function handleAddEvent() {
    if (!canAdd || !organisationId) return
    setSaving(true)

    const supabase = createClient()

    const { data: newEvent, error } = await supabase
      .from('match_events')
      .insert({
        match_id: matchId,
        player_id: selectedPlayer!.player_id,
        organisation_id: organisationId,
        event_type: selectedEventType!.toLowerCase().replace(/\s+/g, '_'),
        event_sub_category: selectedSubCategory,
        difficulty_weight: difficultyWeights[selectedSubCategory!] ?? null,
        completed: selectedOutcome === 'completed',
        grade: selectedGrade,
        attacking_third: contextFlags.attackingThird,
        is_defensive_third: contextFlags.defensiveThird,
        is_big_chance: contextFlags.isBigChance,
        is_hv_def: contextFlags.isHvDef,
        is_goal: contextFlags.isGoal,
      })
      .select()
      .single()

    setSaving(false)

    if (!error && newEvent) {
      setEvents(prev => [newEvent, ...prev])
      setSelectedEventType(null)
      setSelectedSubCategory(null)
      setSelectedGrade(null)
      setSelectedOutcome(null)
      setContextFlags({
        attackingThird: false,
        defensiveThird: false,
        isBigChance: false,
        isHvDef: false,
        isGoal: false,
      })
      setFlashSuccess(true)
      setTimeout(() => setFlashSuccess(false), 2000)
    }
  }

  function flashSaved() {
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  async function handleUpdateGrade(id: string, grade: number) {
    const supabase = createClient()
    await supabase.from('match_events').update({ grade }).eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, grade } : e))
    flashSaved()
  }

  async function handleUpdateCompleted(id: string, completed: boolean) {
    const supabase = createClient()
    await supabase.from('match_events').update({ completed }).eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, completed } : e))
    flashSaved()
  }

  async function handleUpdateFlag(
    id: string,
    flag: 'attacking_third' | 'is_defensive_third' | 'is_big_chance' | 'is_hv_def' | 'is_goal',
    value: boolean,
  ) {
    const supabase = createClient()
    await supabase.from('match_events').update({ [flag]: value }).eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, [flag]: value } : e))
    flashSaved()
  }

  async function handleDeleteEvent(id: string) {
    const supabase = createClient()
    await supabase.from('match_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  async function handleComputeVEI() {
    setComputing(true)
    setVeiError(null)

    const result = await computeVEI(matchId)

    if (result.success) {
      setVeiResults(result.results)
    } else {
      setVeiError(result.error)
    }

    setComputing(false)
  }

  // Group events by player (in order of first appearance)
  function groupEventsByPlayer() {
    const order: string[] = []
    const map: Record<string, MatchEvent[]> = {}
    for (const ev of events) {
      if (!map[ev.player_id]) {
        order.push(ev.player_id)
        map[ev.player_id] = []
      }
      map[ev.player_id].push(ev)
    }
    return order.map(pid => ({ playerId: pid, playerEvents: map[pid] }))
  }

  function getPlayerName(playerId: string): string {
    const lp = lineup.find(l => l.player_id === playerId)
    return lp?.player.name ?? 'Unknown'
  }

  function getGradeColor(grade: number): string {
    return GRADES.find(g => g.value === grade)?.color ?? '#9CA3AF'
  }

  function getGradeLabel(grade: number): string {
    return GRADES.find(g => g.value === grade)?.label ?? String(grade)
  }

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const mutedLabel: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '10px',
  }

  const pillBase: React.CSSProperties = {
    borderRadius: '9999px',
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid #E5E7EB',
    background: '#FFFFFF',
    color: '#111111',
    transition: 'all 0.1s',
    fontFamily: 'inherit',
  }

  const pillActive: React.CSSProperties = {
    ...pillBase,
    background: '#111111',
    color: '#FFFFFF',
    border: '1px solid #111111',
  }

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif', color: '#6B7280', fontSize: '14px',
      }}>
        Loading…
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const groupedEvents = groupEventsByPlayer()
  const selectedEvent = selectedEventId ? events.find(e => e.id === selectedEventId) ?? null : null
  const selectedEventPlayerName = selectedEvent ? getPlayerName(selectedEvent.player_id) : ''

  const matchTitle = matchData
    ? matchData.age_group
      ? `${matchData.opponent} · ${matchData.age_group} — ${formatDate(matchData.date)}`
      : `${matchData.opponent} — ${formatDate(matchData.date)}`
    : '…'

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', fontFamily: 'Inter, sans-serif', padding: '32px 32px 100px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111111', margin: '0 0 4px' }}>
            {matchTitle}
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>Event Grading</p>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

          {/* ── Left column: Event editor ── */}
          <div style={{ flex: '0 0 52%', minWidth: 0, position: 'sticky', top: '24px' }}>

            {/* Editor panel */}
            {!selectedEvent && !showAddForm ? (
              /* Placeholder */
              <div style={{
                border: '1px solid #E5E7EB', borderRadius: '10px', padding: '48px 24px',
                background: '#FFFFFF', textAlign: 'center',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>←</div>
                <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>
                  Select an event from the list to review and edit
                </p>
              </div>
            ) : selectedEvent ? (
              /* Event editor */
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', background: '#FFFFFF', overflow: 'hidden' }}>

                {/* Event header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Avatar */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                    background: avatarColor(selectedEventPlayerName),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color: '#FFFFFF',
                  }}>
                    {initials(selectedEventPlayerName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111111', marginBottom: '3px' }}>
                      {selectedEventPlayerName}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{
                        background: '#111111', color: '#FFFFFF',
                        borderRadius: '9999px', padding: '1px 8px',
                        fontSize: '11px', fontWeight: 600,
                      }}>
                        {formatEventType(selectedEvent.event_type)}
                      </span>
                      {selectedEvent.event_sub_category && (
                        <span style={{ fontSize: '12px', color: '#6B7280' }}>
                          {selectedEvent.event_sub_category}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Close */}
                  <button
                    onClick={() => setSelectedEventId(null)}
                    style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9CA3AF', cursor: 'pointer', lineHeight: 1, padding: '4px' }}
                  >×</button>
                </div>

                {/* Video player */}
                {selectedEvent.clip_url && (
                  <video
                    key={selectedEvent.id}
                    src={selectedEvent.clip_url}
                    controls
                    autoPlay
                    style={{ width: '100%', maxHeight: '240px', background: '#000000', display: 'block' }}
                  />
                )}

                {/* Controls */}
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Grade */}
                  <div>
                    <div style={mutedLabel}>Grade</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {GRADES.map(g => (
                        <button
                          key={g.value}
                          onClick={() => handleUpdateGrade(selectedEvent.id, g.value)}
                          style={{
                            flex: 1, height: '48px', borderRadius: '9999px',
                            background: g.color, color: '#FFFFFF',
                            fontWeight: 700, fontSize: '16px', cursor: 'pointer',
                            border: selectedEvent.grade === g.value ? '3px solid #111111' : '3px solid transparent',
                            opacity: selectedEvent.grade === g.value ? 1 : 0.35,
                            transition: 'opacity 0.12s, border 0.12s',
                            fontFamily: 'inherit',
                          }}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Completed */}
                  <div>
                    <div style={mutedLabel}>Outcome</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleUpdateCompleted(selectedEvent.id, true)}
                        style={{
                          ...pillBase,
                          flex: 1,
                          justifyContent: 'center',
                          border: '1.5px solid #22C55E',
                          background: selectedEvent.completed ? '#22C55E' : '#FFFFFF',
                          color: selectedEvent.completed ? '#FFFFFF' : '#22C55E',
                          fontWeight: 600,
                        }}
                      >
                        Completed
                      </button>
                      <button
                        onClick={() => handleUpdateCompleted(selectedEvent.id, false)}
                        style={{
                          ...pillBase,
                          flex: 1,
                          justifyContent: 'center',
                          border: '1.5px solid #EF4444',
                          background: !selectedEvent.completed ? '#EF4444' : '#FFFFFF',
                          color: !selectedEvent.completed ? '#FFFFFF' : '#EF4444',
                          fontWeight: 600,
                        }}
                      >
                        Not Completed
                      </button>
                    </div>
                  </div>

                  {/* Context flags */}
                  <div>
                    <div style={mutedLabel}>Context Flags</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(
                        [
                          { flag: 'attacking_third' as const, label: 'Attacking Third', value: selectedEvent.attacking_third },
                          { flag: 'is_defensive_third' as const, label: 'Defensive Third', value: selectedEvent.is_defensive_third },
                          { flag: 'is_big_chance' as const, label: 'Is Big Chance', value: selectedEvent.is_big_chance },
                          { flag: 'is_hv_def' as const, label: 'Is HV Def', value: selectedEvent.is_hv_def },
                          { flag: 'is_goal' as const, label: 'Is Goal', value: selectedEvent.is_goal },
                        ]
                      ).map(({ flag, label, value }) => (
                        <button
                          key={flag}
                          onClick={() => handleUpdateFlag(selectedEvent.id, flag, !value)}
                          style={value ? { ...pillActive, fontSize: '12px', padding: '5px 12px' } : { ...pillBase, fontSize: '12px', padding: '5px 12px', color: '#6B7280' }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Saved flash + delete */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '12px', fontWeight: 600,
                      color: savedFlash ? '#16A34A' : 'transparent',
                      transition: 'color 0.2s',
                    }}>
                      ✓ Saved
                    </span>
                    <button
                      onClick={() => { handleDeleteEvent(selectedEvent.id); setSelectedEventId(null) }}
                      style={{
                        background: 'none', border: 'none', fontSize: '13px',
                        color: '#EF4444', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Delete event
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Add event manually */}
            <div style={{ marginTop: '12px' }}>
              {!showAddForm ? (
                <button
                  onClick={() => { setShowAddForm(true); setSelectedEventId(null) }}
                  style={{
                    background: 'none', border: 'none', fontSize: '13px',
                    color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit',
                    padding: '8px 0', textDecoration: 'underline',
                  }}
                >
                  + Add event manually
                </button>
              ) : (
                <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', background: '#FFFFFF', overflow: 'hidden' }}>
                  {/* Form header */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#111111' }}>Add Event</span>
                    <button
                      onClick={() => { setShowAddForm(false); setSelectedPlayer(null); setSelectedEventType(null); setSelectedSubCategory(null); setSelectedGrade(null); setSelectedOutcome(null) }}
                      style={{ background: 'none', border: 'none', fontSize: '18px', color: '#9CA3AF', cursor: 'pointer', lineHeight: 1 }}
                    >×</button>
                  </div>

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Player */}
                    <div>
                      <div style={mutedLabel}>Player</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {lineup.map(lp => (
                          <button key={lp.player_id} onClick={() => setSelectedPlayer(lp)}
                            style={selectedPlayer?.player_id === lp.player_id ? pillActive : pillBase}>
                            {lp.player.shirt_number ?? '?'} · {lp.player.name}
                          </button>
                        ))}
                        {lineup.length === 0 && <span style={{ fontSize: '13px', color: '#9CA3AF' }}>No lineup loaded.</span>}
                      </div>
                    </div>

                    {/* Event Type */}
                    {selectedPlayer && (
                      <div>
                        <div style={mutedLabel}>Event Type</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {EVENT_TYPES.map(et => (
                            <button key={et}
                              onClick={() => { setSelectedEventType(et); setSelectedSubCategory(null); setSelectedGrade(null); setSelectedOutcome(null) }}
                              style={selectedEventType === et ? pillActive : pillBase}>{et}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sub-category */}
                    {selectedEventType && (
                      <div>
                        <div style={mutedLabel}>Sub-Category</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(SUB_CATEGORIES[selectedEventType] ?? []).map(sub => (
                            <div key={sub} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <button onClick={() => setSelectedSubCategory(sub)}
                                style={selectedSubCategory === sub ? pillActive : pillBase}>{sub}</button>
                              <span style={{ fontSize: '10px', color: '#9CA3AF' }}>{difficultyWeights[sub]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Grade */}
                    {selectedSubCategory && (
                      <div>
                        <div style={mutedLabel}>Grade</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {GRADES.map(g => (
                            <button key={g.value} onClick={() => setSelectedGrade(g.value)} style={{
                              flex: 1, height: '44px', borderRadius: '9999px',
                              background: g.color, color: '#FFFFFF', fontWeight: 700, fontSize: '14px',
                              cursor: 'pointer', fontFamily: 'inherit',
                              border: selectedGrade === g.value ? '2px solid #111111' : '2px solid transparent',
                              opacity: selectedGrade === g.value ? 1 : 0.35,
                            }}>{g.label}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Outcome */}
                    {selectedSubCategory && (
                      <div>
                        <div style={mutedLabel}>Outcome</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setSelectedOutcome('completed')} style={{ ...pillBase, border: '1.5px solid #22C55E', background: selectedOutcome === 'completed' ? '#22C55E' : '#FFFFFF', color: selectedOutcome === 'completed' ? '#FFFFFF' : '#22C55E' }}>Completed</button>
                          <button onClick={() => setSelectedOutcome('not_completed')} style={{ ...pillBase, border: '1.5px solid #EF4444', background: selectedOutcome === 'not_completed' ? '#EF4444' : '#FFFFFF', color: selectedOutcome === 'not_completed' ? '#FFFFFF' : '#EF4444' }}>Not Completed</button>
                        </div>
                      </div>
                    )}

                    {/* Context flags */}
                    {selectedPlayer && (
                      <div>
                        <div style={mutedLabel}>Context Flags</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {([ { key: 'attackingThird' as keyof ContextFlags, label: 'Attacking Third' }, { key: 'defensiveThird' as keyof ContextFlags, label: 'Defensive Third' }, { key: 'isBigChance' as keyof ContextFlags, label: 'Is Big Chance' }, { key: 'isHvDef' as keyof ContextFlags, label: 'Is HV Def' }, { key: 'isGoal' as keyof ContextFlags, label: 'Is Goal' } ]).map(({ key, label }) => (
                            <button key={key} onClick={() => setContextFlags(prev => ({ ...prev, [key]: !prev[key] }))}
                              style={contextFlags[key] ? { ...pillActive, fontSize: '12px', padding: '5px 12px' } : { ...pillBase, fontSize: '12px', padding: '5px 12px', color: '#6B7280' }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Flash + Add button */}
                    {flashSuccess && (
                      <div style={{ padding: '8px 12px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', color: '#16A34A', fontSize: '13px', fontWeight: 500 }}>
                        Event added ✓
                      </div>
                    )}
                    <button
                      onClick={handleAddEvent}
                      disabled={!canAdd || saving}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '8px',
                        background: canAdd && !saving ? '#111111' : '#9CA3AF',
                        color: '#FFFFFF', fontWeight: 600, fontSize: '14px',
                        cursor: canAdd && !saving ? 'pointer' : 'not-allowed',
                        border: 'none', transition: 'background 0.15s', fontFamily: 'inherit',
                      }}
                    >
                      {saving ? 'Saving…' : 'Add Event'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: Event list ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', background: '#FFFFFF' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#111111' }}>Events</span>
                <span style={{ background: '#111111', color: '#FFFFFF', borderRadius: '9999px', padding: '2px 10px', fontSize: '12px', fontWeight: 600 }}>
                  {events.length}
                </span>
              </div>

              {/* Scrollable list */}
              <div style={{ maxHeight: '72vh', overflowY: 'auto', padding: '0 4px' }}>
                {events.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', padding: '40px 0' }}>
                    No events logged yet
                  </div>
                ) : (
                  groupedEvents.map(({ playerId, playerEvents }, groupIdx) => {
                    const name = getPlayerName(playerId)
                    const color = avatarColor(name)
                    return (
                      <div key={playerId} style={{ borderTop: groupIdx > 0 ? '1px solid #F3F4F6' : 'none', paddingTop: groupIdx > 0 ? '10px' : '0', marginTop: groupIdx > 0 ? '10px' : '0', padding: groupIdx > 0 ? '10px 16px 0' : '0 16px' }}>
                        {/* Group header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 0 6px', fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}>
                            {initials(name)}
                          </div>
                          {name}
                          <span style={{ color: '#D1D5DB' }}>·</span>
                          {playerEvents.length} event{playerEvents.length !== 1 ? 's' : ''}
                        </div>

                        {/* Event rows */}
                        {playerEvents.map(ev => {
                          const isSelected = selectedEventId === ev.id
                          return (
                            <button
                              key={ev.id}
                              onClick={() => { setSelectedEventId(ev.id); setShowAddForm(false) }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                width: '100%', padding: '8px 0', background: 'none',
                                border: 'none', borderBottom: '1px solid #F9FAFB',
                                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                                borderLeft: isSelected ? '3px solid #111111' : '3px solid transparent',
                                paddingLeft: isSelected ? '8px' : '8px',
                                marginLeft: isSelected ? '-3px' : '0',
                              }}
                            >
                              {/* Event type pill */}
                              <span style={{
                                background: isSelected ? '#111111' : '#F3F4F6',
                                color: isSelected ? '#FFFFFF' : '#374151',
                                borderRadius: '9999px', padding: '2px 8px',
                                fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                              }}>
                                {formatEventType(ev.event_type)}
                              </span>

                              {/* Sub-category */}
                              <span style={{ fontSize: '12px', color: '#6B7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ev.event_sub_category ?? '—'}
                              </span>

                              {/* Clip indicator */}
                              {ev.clip_url && (
                                <span style={{ fontSize: '10px', color: '#9CA3AF', flexShrink: 0 }}>▶</span>
                              )}

                              {/* Grade badge */}
                              <div style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: getGradeColor(ev.grade),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0,
                              }}>
                                {getGradeLabel(ev.grade)}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fixed bottom bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#FFFFFF', borderTop: '1px solid #E5E7EB',
        padding: '14px 32px', zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Link href={`/performance/matches/${matchId}`} style={{ fontSize: '14px', color: '#6B7280', textDecoration: 'none' }}>
          ← Back to Match
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '13px', color: '#6B7280' }}>
            {events.length} events across {new Set(events.map(e => e.player_id)).size} players
          </span>
          {veiError && !veiResults && (
            <span style={{ fontSize: '12px', color: '#EF4444' }}>{veiError}</span>
          )}
        </div>
        <button
          onClick={handleComputeVEI}
          disabled={!canComputeVEI || computing}
          title={!canComputeVEI ? 'Log at least one event to compute VEI' : undefined}
          style={{
            padding: '10px 20px', borderRadius: '8px',
            background: canComputeVEI && !computing ? '#111111' : '#9CA3AF',
            color: '#FFFFFF', fontWeight: 600, fontSize: '14px',
            cursor: canComputeVEI && !computing ? 'pointer' : 'not-allowed',
            border: 'none', fontFamily: 'inherit',
          }}
        >
          {computing ? 'Computing…' : 'Compute VEI'}
        </button>
      </div>

      {/* ── VEI Results Modal ── */}
      {veiResults !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setVeiResults(null) }}
        >
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '32px', maxWidth: '520px', width: '90%', position: 'relative' }}>
            <button onClick={() => setVeiResults(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '20px', color: '#9CA3AF', cursor: 'pointer', lineHeight: 1 }}>×</button>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111111', margin: '0 0 20px' }}>VEI Results</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {veiResults.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i < veiResults.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: avatarColor(r.playerName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}>
                    {initials(r.playerName)}
                  </div>
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: '#111111' }}>{r.playerName}</span>
                  <span style={{ background: '#111111', color: '#FFFFFF', borderRadius: '9999px', padding: '2px 10px', fontSize: '11px', fontWeight: 600 }}>{r.positionGroup}</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#111111', minWidth: '40px', textAlign: 'right' }}>{r.veiIndex.toFixed(1)}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: r.isValid ? '#16A34A' : '#DC2626', minWidth: '72px', textAlign: 'right' }}>{r.isValid ? '✓ Valid' : '✗ Invalid'}</span>
                </div>
              ))}
            </div>
            <Link href={`/performance/matches/${matchId}`} style={{ display: 'block', textAlign: 'center', padding: '12px', background: '#111111', color: '#FFFFFF', borderRadius: '8px', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
              View Match Results
            </Link>
            {veiError && <p style={{ marginTop: '12px', fontSize: '13px', color: '#EF4444', textAlign: 'center' }}>{veiError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
