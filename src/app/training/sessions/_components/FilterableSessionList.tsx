'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionPlayer = {
  attended: boolean
}

export type Session = {
  id: string
  date: string
  age_group: string | null
  duration_minutes: number | null
  coach_ids: string[] | null
  session_players: SessionPlayer[]
}

export type CoachMap = Record<string, string> // id → name

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    .toUpperCase()
}

type Period = 'month' | 'lastmonth' | 'all'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'lastmonth', label: 'Last month' },
  { value: 'all', label: 'All time' },
]

function getDateRange(period: Period): { from: string; to: string } | null {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1
  const thisMonthStart = `${y}-${String(m).padStart(2, '0')}-01`
  if (period === 'month') return { from: thisMonthStart, to: '9999-12-31' }
  if (period === 'lastmonth') {
    const lm = m === 1 ? 12 : m - 1
    const ly = m === 1 ? y - 1 : y
    return { from: `${ly}-${String(lm).padStart(2, '0')}-01`, to: thisMonthStart }
  }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FilterableSessionList({
  sessions,
  coachMap,
}: {
  sessions: Session[]
  coachMap: CoachMap
}) {
  const [ageGroup, setAgeGroup] = useState('All')
  const [period, setPeriod] = useState<Period>('all')

  // Derive age groups from actual data
  const ageGroupOptions = useMemo(() => {
    const groups = new Set<string>()
    sessions.forEach(s => { if (s.age_group) groups.add(s.age_group) })
    return ['All', ...Array.from(groups).sort()]
  }, [sessions])

  const filtered = useMemo(() => {
    const range = getDateRange(period)
    return sessions.filter(s => {
      if (ageGroup !== 'All' && s.age_group !== ageGroup) return false
      if (range && s.date < range.from) return false
      if (range && s.date >= range.to) return false
      return true
    })
  }, [sessions, ageGroup, period])

  // Group filtered sessions by month (sessions are already ordered desc by date)
  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; items: { session: Session; globalIndex: number }[] }[] = []
    const keyToIdx: Record<string, number> = {}
    for (const s of filtered) {
      const key = s.date.slice(0, 7)
      if (keyToIdx[key] === undefined) {
        keyToIdx[key] = groups.length
        groups.push({ key, label: monthLabel(key), items: [] })
      }
      // globalIndex = chronological session number (sessions[0] = most recent = sessions.length)
      const globalIndex = sessions.indexOf(s)
      groups[keyToIdx[key]].items.push({ session: s, globalIndex })
    }
    return groups
  }, [filtered, sessions])

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: '9999px',
    border: `1px solid ${active ? '#111111' : '#E5E7EB'}`,
    background: active ? '#111111' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#6B7280',
    fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
    outline: 'none', transition: 'all 0.1s',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <>
      {/* Filter row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Period pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {PERIODS.map(p => (
            <button key={p.value} type="button" onClick={() => setPeriod(p.value)} style={pillStyle(period === p.value)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Age group pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {ageGroupOptions.map(ag => (
            <button key={ag} type="button" onClick={() => setAgeGroup(ag)} style={pillStyle(ageGroup === ag)}>
              {ag === 'All' ? 'All groups' : ag}
            </button>
          ))}
        </div>
      </div>

      {/* Session list — grouped by month */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0 0 20px 0' }}>No sessions found</p>
          <Link href="/training/sessions/new" style={{
            background: '#111111', color: '#FFFFFF', padding: '10px 20px',
            borderRadius: '8px', fontSize: '14px', fontWeight: 500, textDecoration: 'none',
          }}>
            Log a Session
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {monthGroups.map(group => (
            <div key={group.key}>
              {/* Month header */}
              <div style={{
                fontSize: '10px', fontWeight: 500, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.12em',
                marginBottom: '10px',
              }}>
                {group.label}
              </div>

              {/* Sessions in this month */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {group.items.map(({ session: s, globalIndex }) => {
                  const sessionNum = sessions.length - globalIndex
                  const total = s.session_players.length
                  const attended = s.session_players.filter(p => p.attended).length
                  const coachNames = (s.coach_ids ?? [])
                    .map(id => coachMap[id])
                    .filter((n): n is string => Boolean(n))

                  return (
                    <Link
                      key={s.id}
                      href={`/training/sessions/${s.id}`}
                      style={{
                        display: 'block', textDecoration: 'none', color: 'inherit',
                        border: '1px solid #E5E7EB', borderRadius: '10px',
                        padding: '16px 20px', background: '#FFFFFF',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#111111' }}>
                            Session {sessionNum}
                          </span>
                          <span style={{ fontSize: '13px', color: '#6B7280' }}>
                            {formatDate(s.date)}
                          </span>
                          {s.age_group && (
                            <span style={{
                              background: '#111111', color: '#FFFFFF',
                              fontSize: '11px', fontWeight: 600,
                              padding: '2px 8px', borderRadius: '9999px',
                            }}>
                              {s.age_group}
                            </span>
                          )}
                          {s.duration_minutes != null && (
                            <span style={{ fontSize: '13px', color: '#9CA3AF' }}>
                              {s.duration_minutes} min
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                            {attended}/{total} players
                          </span>
                          {coachNames.length > 0 && (
                            <div style={{ display: 'flex' }}>
                              {coachNames.map((name, ci) => (
                                <div
                                  key={name}
                                  title={name}
                                  style={{
                                    width: '28px', height: '28px', borderRadius: '9999px',
                                    background: avatarColor(name),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '10px', fontWeight: 700, color: '#FFFFFF',
                                    flexShrink: 0, marginLeft: ci > 0 ? '-6px' : 0,
                                    border: '2px solid #FFFFFF',
                                  }}
                                >
                                  {initials(name)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
