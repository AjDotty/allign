'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Constants ────────────────────────────────────────────────────────────────

const AGE_GROUPS = ['U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16']
const ABSENCE_REASONS = ['injury', 'illness', 'school', 'uncontacted']
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

type Coach = { id: string; name: string }
type Exercise = { id: string; name: string }
type Player = { id: string; name: string }

type AttendanceRow = {
  player: Player
  attended: boolean
  absence_reason: string
}

type SessionExercise = {
  exercise: Exercise
  duration_minutes: string
  notes: string
  order: number
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

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  return (
    <div style={{
      width: '32px', height: '32px', borderRadius: '9999px',
      background: avatarColor(name), flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', fontWeight: 700, color: '#FFFFFF',
    }}>
      {initials(name)}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewSessionPage() {
  const router = useRouter()
  const supabase = createClient()

  // Identity
  const [organisationId, setOrganisationId] = useState<string | null>(null)
  const [myMemberId, setMyMemberId] = useState<string | null>(null)

  // Library data
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [allExercises, setAllExercises] = useState<Exercise[]>([])

  // Form state
  const [date, setDate] = useState(todayISO())
  const [ageGroup, setAgeGroup] = useState('')
  const [duration, setDuration] = useState('')
  const [location, setLocation] = useState('')
  const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [sessionNotes, setSessionNotes] = useState('')

  // UI state
  const [playersLoading, setPlayersLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Drag-to-reorder
  const dragIdx = useRef<number | null>(null)

  // ── On mount: resolve user → member → organisation, load members + exercises ─
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[NewSession] session:', session?.user?.id)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Resolve member → organisation
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
      console.log('[NewSession] mount — organisationId:', orgId)
      setOrganisationId(orgId)
      setMyMemberId(member.id)
      setSelectedCoachIds([member.id])

      // Load all members of the organisation + available exercises
      const [{ data: orgMemberRows }, { data: exerciseList }] = await Promise.all([
        supabase
          .from('organisation_members')
          .select('role, members(id, name)')
          .eq('organisation_id', orgId),
        supabase
          .from('exercises')
          .select('id, name')
          .or(`organisation_id.eq.${orgId},is_global.eq.true`)
          .order('name'),
      ])

      type OrgMemberRow = { members: { id: string; name: string } | { id: string; name: string }[] | null }
      const memberList = (orgMemberRows as OrgMemberRow[] ?? [])
        .flatMap(r => (Array.isArray(r.members) ? r.members : r.members ? [r.members] : []))
        .filter((m): m is { id: string; name: string } => Boolean(m?.id))
        .sort((a, b) => a.name.localeCompare(b.name))

      setCoaches(memberList)
      setAllExercises(exerciseList ?? [])
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load players when age group changes ──────────────────────────────────────
  useEffect(() => {
    if (!ageGroup || !organisationId) return
    setPlayersLoading(true)
    setAttendance([])
    console.log('[NewSession] fetching players for:', { organisationId, selectedAgeGroup: ageGroup })
    supabase
      .from('players')
      .select('id, name, age_group, position_group')
      .eq('home_organisation_id', organisationId)
      .eq('age_group', ageGroup)
      .then(({ data, error }) => {
        console.log('[NewSession] players result:', { players: data, error })
        setAttendance((data ?? []).map(p => ({ player: p, attended: true, absence_reason: '' })))
        setPlayersLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageGroup, organisationId])

  // ── Exercise search results ───────────────────────────────────────────────────
  const addedIds = new Set(exercises.map(e => e.exercise.id))
  const searchResults = exerciseSearch.trim()
    ? allExercises
        .filter(e => !addedIds.has(e.id) && e.name.toLowerCase().includes(exerciseSearch.toLowerCase()))
        .slice(0, 8)
    : []

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function addExercise(ex: Exercise) {
    setExercises(prev => [
      ...prev,
      { exercise: ex, duration_minutes: '', notes: '', order: prev.length + 1 },
    ])
    setExerciseSearch('')
  }

  function removeExercise(i: number) {
    setExercises(prev =>
      prev.filter((_, idx) => idx !== i).map((e, idx) => ({ ...e, order: idx + 1 }))
    )
  }

  function updateExercise(i: number, field: 'duration_minutes' | 'notes', value: string) {
    setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  function handleDrop(toIndex: number) {
    if (dragIdx.current === null || dragIdx.current === toIndex) return
    setExercises(prev => {
      const next = [...prev]
      const [item] = next.splice(dragIdx.current!, 1)
      next.splice(toIndex, 0, item)
      return next.map((e, idx) => ({ ...e, order: idx + 1 }))
    })
    dragIdx.current = null
  }

  function toggleCoach(id: string) {
    setSelectedCoachIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  function toggleAttendance(i: number) {
    setAttendance(prev =>
      prev.map((a, idx) => idx === i ? { ...a, attended: !a.attended, absence_reason: '' } : a)
    )
  }

  function setAbsenceReason(i: number, reason: string) {
    setAttendance(prev =>
      prev.map((a, idx) => idx === i ? { ...a, absence_reason: reason } : a)
    )
  }

  async function handleSave() {
    if (!organisationId) return
    setSaving(true)
    setError(null)

    // 1. Insert session
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .insert({
        organisation_id: organisationId,
        date,
        age_group: ageGroup || null,
        duration_minutes: duration ? parseInt(duration) : null,
        location: location || null,
        coach_ids: selectedCoachIds,
        notes: sessionNotes || null,
      })
      .select('id')
      .single()

    if (sessionErr || !session) {
      setError(sessionErr?.message ?? 'Failed to save session')
      setSaving(false)
      return
    }

    // 2. Attendance rows
    if (attendance.length > 0) {
      const { error: apErr } = await supabase.from('session_players').insert(
        attendance.map(a => ({
          session_id: session.id,
          player_id: a.player.id,
          attended: a.attended,
          // absence_reason is optional — null is valid when attended = false
          absence_reason: a.attended ? null : (a.absence_reason || null),
        }))
      )
      if (apErr) { setError(apErr.message); setSaving(false); return }
    }

    // 3. Session exercises
    // Note: `order` is a SQL reserved word — PostgREST quotes it automatically on insert.
    // In .select() strings, always use '"order"' explicitly per CLAUDE.md.
    if (exercises.length > 0) {
      const { error: exErr } = await supabase.from('session_exercises').insert(
        exercises.map((e, i) => ({
          session_id: session.id,
          exercise_id: e.exercise.id,
          order: i + 1,
          duration_minutes: e.duration_minutes ? parseInt(e.duration_minutes) : null,
          notes: e.notes || null,
        }))
      )
      if (exErr) { setError(exErr.message); setSaving(false); return }
    }

    router.push('/training/sessions')
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111111', margin: 0 }}>
            Log a Session
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0' }}>
            Record a new training session
          </p>
        </div>

        {/* ── Section 1: Session Details ── */}
        <div style={card}>
          <p style={sectionLabel}>Session Details</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={fieldLabel}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />
            </div>
            <div>
              <label style={fieldLabel}>Duration (min)</label>
              <input
                type="number" value={duration} min={0}
                onChange={e => setDuration(e.target.value)}
                placeholder="60" style={input}
              />
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={fieldLabel}>Location</label>
            <input
              type="text" value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Training ground" style={input}
            />
          </div>
          <div>
            <label style={fieldLabel}>Age Group</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {AGE_GROUPS.map(ag => (
                <button
                  key={ag} type="button" onClick={() => setAgeGroup(ag)}
                  style={{
                    padding: '6px 14px', borderRadius: '9999px',
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'none',
                    border: '1px solid #E5E7EB',
                    background: ageGroup === ag ? '#111111' : '#FFFFFF',
                    color: ageGroup === ag ? '#FFFFFF' : '#111111',
                  }}
                >
                  {ag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section 2: Coaches Present ── */}
        <div style={card}>
          <p style={sectionLabel}>Coaches Present</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {coaches.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar name={c.name} />
                  <span style={{ fontSize: '14px', color: '#111111' }}>{c.name}</span>
                  {c.id === myMemberId && (
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>(you)</span>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={selectedCoachIds.includes(c.id)}
                  onChange={() => toggleCoach(c.id)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#111111' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 3: Attendance ── */}
        <div style={card}>
          <p style={sectionLabel}>Attendance</p>
          {!ageGroup ? (
            <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
              Select an age group to load players
            </p>
          ) : playersLoading ? (
            <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>Loading players…</p>
          ) : attendance.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
              No players found for {ageGroup}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {attendance.map((a, i) => (
                <div key={a.player.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar name={a.player.name} />
                      <span style={{ fontSize: '14px', color: '#111111' }}>{a.player.name}</span>
                    </div>
                    <button
                      type="button" onClick={() => toggleAttendance(i)}
                      style={{
                        padding: '5px 14px', borderRadius: '9999px',
                        fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                        fontFamily: 'inherit', border: '1px solid #E5E7EB',
                        background: a.attended ? '#111111' : '#FFFFFF',
                        color: a.attended ? '#FFFFFF' : '#111111',
                      }}
                    >
                      {a.attended ? 'Attended' : 'Absent'}
                    </button>
                  </div>
                  {!a.attended && (
                    <div style={{ marginTop: '8px', marginLeft: '42px' }}>
                      <select
                        value={a.absence_reason}
                        onChange={e => setAbsenceReason(i, e.target.value)}
                        style={{ ...input, width: 'auto', color: a.absence_reason ? '#111111' : '#9CA3AF' }}
                      >
                        <option value="">Reason (optional)</option>
                        {ABSENCE_REASONS.map(r => (
                          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 4: Exercises ── */}
        <div style={card}>
          <p style={sectionLabel}>Exercises</p>

          {/* Search with dropdown */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <input
              type="text" value={exerciseSearch}
              onChange={e => setExerciseSearch(e.target.value)}
              placeholder="Search exercise library…" style={input}
            />
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px',
                marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', overflow: 'hidden',
              }}>
                {searchResults.map((ex, idx) => (
                  <button
                    key={ex.id} type="button" onClick={() => addExercise(ex)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 14px', fontSize: '14px', color: '#111111',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit',
                      borderBottom: idx < searchResults.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Added exercises list */}
          {exercises.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>No exercises added yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {exercises.map((e, i) => (
                <div
                  key={e.exercise.id}
                  draggable
                  onDragStart={() => { dragIdx.current = i }}
                  onDragOver={ev => ev.preventDefault()}
                  onDrop={() => handleDrop(i)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px',
                    background: '#FAFAFA', cursor: 'grab',
                  }}
                >
                  {/* Drag handle + order number */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '3px', flexShrink: 0 }}>
                    <span style={{ fontSize: '14px', color: '#D1D5DB', userSelect: 'none', letterSpacing: '-1px' }}>⠿</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#9CA3AF', minWidth: '14px' }}>{i + 1}</span>
                  </div>

                  {/* Name + inputs */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#111111', marginBottom: '8px' }}>
                      {e.exercise.name}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="number" min={0}
                        value={e.duration_minutes}
                        onChange={ev => updateExercise(i, 'duration_minutes', ev.target.value)}
                        placeholder="Duration (min)"
                        style={{ ...input, width: '140px', flexShrink: 0 }}
                      />
                      <input
                        type="text"
                        value={e.notes}
                        onChange={ev => updateExercise(i, 'notes', ev.target.value)}
                        placeholder="Notes"
                        style={input}
                      />
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    type="button" onClick={() => removeExercise(i)}
                    title="Remove"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '18px', color: '#9CA3AF', padding: '0 2px',
                      lineHeight: 1, flexShrink: 0, paddingTop: '2px',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 5: Notes ── */}
        <div style={card}>
          <p style={sectionLabel}>Notes</p>
          <textarea
            value={sessionNotes}
            onChange={e => setSessionNotes(e.target.value)}
            placeholder="Add any session notes…"
            rows={4}
            style={{ ...input, resize: 'vertical' }}
          />
        </div>

        {/* Error */}
        {error && (
          <p style={{ fontSize: '13px', color: '#EF4444', margin: '0 0 16px' }}>{error}</p>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', paddingBottom: '48px' }}>
          <Link href="/training/sessions" style={{ fontSize: '14px', color: '#6B7280', textDecoration: 'none' }}>
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
            {saving ? 'Saving…' : 'Save Session'}
          </button>
        </div>

      </div>
    </div>
  )
}
