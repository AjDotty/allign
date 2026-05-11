'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Match = {
  id: string
  date: string
  opponent: string
  venue: string | null
  home_away: string | null
  age_group: string | null
  format: string | null
  duration_minutes: number | null
  notes: string | null
  player_count: number
  is_graded: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGE_GROUPS = ['All', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16']
const HOME_AWAY_OPTIONS = ['All', 'Home', 'Away', 'Neutral']

type Period = 'month' | '3months' | 'all'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: '3months', label: 'Last 3 months' },
  { value: 'all', label: 'All time' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function pill(label: string): React.CSSProperties {
  return {
    display: 'inline-block',
    background: '#111111', color: '#FFFFFF',
    fontSize: '11px', fontWeight: 500,
    padding: '3px 8px', borderRadius: '9999px',
    whiteSpace: 'nowrap' as const,
  }
}

const selectStyle: React.CSSProperties = {
  border: '1px solid #E5E7EB', borderRadius: '8px',
  padding: '8px 12px', fontSize: '13px', color: '#111111',
  background: '#FFFFFF', outline: 'none', fontFamily: 'inherit',
  cursor: 'pointer',
}

function periodCutoff(period: Period): string | null {
  const now = new Date()
  if (period === 'month') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }
  if (period === '3months') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().slice(0, 10)
  }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FilterableMatchList({ matches }: { matches: Match[] }) {
  const [ageGroup, setAgeGroup] = useState('All')
  const [homeAway, setHomeAway] = useState('All')
  const [period, setPeriod] = useState<Period>('all')

  const filtered = useMemo(() => {
    const cutoff = periodCutoff(period)
    return matches.filter(m => {
      if (ageGroup !== 'All' && m.age_group !== ageGroup) return false
      if (homeAway !== 'All' && m.home_away?.toLowerCase() !== homeAway.toLowerCase()) return false
      if (cutoff && m.date < cutoff) return false
      return true
    })
  }, [matches, ageGroup, homeAway, period])

  return (
    <div>
      {/* Filter row */}
      <div style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap',
        marginBottom: '20px', alignItems: 'center',
      }}>
        {/* Period pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              style={{
                padding: '6px 14px', borderRadius: '9999px',
                border: `1px solid ${period === p.value ? '#111111' : '#E5E7EB'}`,
                background: period === p.value ? '#111111' : '#FFFFFF',
                color: period === p.value ? '#FFFFFF' : '#6B7280',
                fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                outline: 'none', transition: 'all 0.1s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)} style={selectStyle}>
          {AGE_GROUPS.map(ag => <option key={ag} value={ag}>{ag === 'All' ? 'All ages' : ag}</option>)}
        </select>

        <select value={homeAway} onChange={e => setHomeAway(e.target.value)} style={selectStyle}>
          {HOME_AWAY_OPTIONS.map(h => <option key={h} value={h}>{h === 'All' ? 'Home / Away' : h}</option>)}
        </select>
      </div>

      {/* Match list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0 0 20px 0' }}>No matches found</p>
          <Link href="/performance/matches/new" style={{ textDecoration: 'none' }}>
            <button type="button" style={{
              background: '#111111', color: '#FFFFFF', border: 'none',
              borderRadius: '8px', padding: '10px 20px',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              New Match
            </button>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(m => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ match: m }: { match: Match }) {
  return (
    <Link href={`/performance/matches/${m.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        border: '1px solid #E5E7EB', borderRadius: '10px',
        padding: '20px', background: '#FFFFFF',
        transition: 'background 0.1s', cursor: 'pointer',
      }}>
        {/* Top row: date + pills + graded badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>
            {formatDate(m.date)}
          </span>
          {m.home_away && (
            <span style={pill(m.home_away)}>
              {m.home_away.charAt(0).toUpperCase() + m.home_away.slice(1)}
            </span>
          )}
          {m.age_group && (
            <span style={pill(m.age_group)}>{m.age_group}</span>
          )}
          {/* Graded badge — pushed to right */}
          <span style={{ marginLeft: 'auto' }}>
            {m.is_graded ? (
              <span style={{
                background: '#F0FDF4', color: '#16A34A',
                fontSize: '11px', fontWeight: 500,
                padding: '2px 8px', borderRadius: '9999px',
              }}>
                Graded
              </span>
            ) : (
              <span style={{
                background: '#F3F4F6', color: '#6B7280',
                fontSize: '11px', fontWeight: 500,
                padding: '2px 8px', borderRadius: '9999px',
              }}>
                Not graded
              </span>
            )}
          </span>
        </div>

        {/* Opponent */}
        <div style={{
          fontSize: '18px', fontWeight: 700, color: '#111111',
          marginBottom: '8px', lineHeight: 1.2,
        }}>
          {m.opponent}
        </div>

        {/* Meta row */}
        <div style={{
          display: 'flex', gap: '16px', alignItems: 'center',
          fontSize: '13px', color: '#6B7280', flexWrap: 'wrap',
        }}>
          {m.format && <span>{m.format}</span>}
          {m.duration_minutes && <span>{m.duration_minutes} min</span>}
          <span>{m.player_count} {m.player_count === 1 ? 'player' : 'players'}</span>
        </div>
      </div>
    </Link>
  )
}
