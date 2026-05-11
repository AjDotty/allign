'use client'

import { useState } from 'react'
import Link from 'next/link'
import MatchEventList, { type EventItem } from './MatchEventList'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VeiRow = {
  player_id: string
  playerName: string
  shirtNumber: number | null
  positionGroup: string | null
  volumeScore: number | null
  efficiencyScore: number | null
  impactScore: number | null
  veiIndex: number | null
  isValid: boolean | null
  invalidReason: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
function fmt1dp(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(1)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchTabs({
  matchId,
  veiRows,
  events,
}: {
  matchId: string
  veiRows: VeiRow[]
  events: EventItem[]
}) {
  const [tab, setTab] = useState<'rankings' | 'events'>('rankings')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '14px', fontWeight: 600,
    color: active ? '#111111' : '#6B7280',
    padding: '0 0 10px 0', marginRight: '24px',
    borderBottom: active ? '2px solid #111111' : '2px solid transparent',
  })

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', marginBottom: '20px' }}>
        <button type="button" onClick={() => setTab('rankings')} style={tabStyle(tab === 'rankings')}>
          Rankings
        </button>
        <button type="button" onClick={() => setTab('events')} style={tabStyle(tab === 'events')}>
          Events
          {events.length > 0 && (
            <span style={{
              marginLeft: '6px', background: '#F3F4F6', color: '#6B7280',
              fontSize: '11px', fontWeight: 500, borderRadius: '9999px',
              padding: '1px 6px',
            }}>
              {events.length}
            </span>
          )}
        </button>
      </div>

      {/* Rankings tab */}
      {tab === 'rankings' && (
        veiRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#111111', marginBottom: '6px' }}>
              No graded players yet
            </div>
            <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '20px' }}>
              <Link href={`/performance/matches/${matchId}/grade`} style={{
                color: '#9CA3AF', textDecoration: 'underline', textUnderlineOffset: '2px',
              }}>
                Grade this match
              </Link>
              {' '}to see rankings
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {veiRows.map((row, idx) => {
              const rank = idx + 1
              const color = avatarColor(row.playerName)
              const muted = row.isValid === false

              const isHovered = hoveredId === row.player_id

              return (
                <Link
                  key={row.player_id}
                  href={`/performance/players/${row.player_id}`}
                  style={{ textDecoration: 'none' }}
                  onMouseEnter={() => setHoveredId(row.player_id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                <div
                  style={{
                    border: '1px solid #E5E7EB', borderRadius: '10px',
                    padding: '16px 20px',
                    background: isHovered ? '#F9FAFB' : '#FFFFFF',
                    opacity: muted ? 0.55 : 1,
                    display: 'flex', alignItems: 'center', gap: '16px',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                >
                  {/* Rank */}
                  <div style={{
                    fontSize: '13px', fontWeight: 600, color: '#9CA3AF',
                    width: '28px', flexShrink: 0, textAlign: 'right',
                  }}>
                    {ordinal(rank)}
                  </div>

                  {/* Avatar */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '9999px', flexShrink: 0,
                    background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color: '#FFFFFF',
                  }}>
                    {initials(row.playerName)}
                  </div>

                  {/* Name + sub-scores */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px', fontWeight: 600, color: '#111111',
                      marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {row.shirtNumber != null ? `${row.shirtNumber} · ` : ''}{row.playerName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', display: 'flex', gap: '10px' }}>
                      <span>Vol {fmt1dp(row.volumeScore)}</span>
                      <span>Eff {fmt1dp(row.efficiencyScore)}</span>
                      <span>Imp {fmt1dp(row.impactScore)}</span>
                    </div>
                  </div>

                  {/* Position pill */}
                  {row.positionGroup && (
                    <span style={{
                      background: '#111111', color: '#FFFFFF',
                      fontSize: '10px', fontWeight: 600,
                      padding: '2px 7px', borderRadius: '9999px',
                      flexShrink: 0, letterSpacing: '0.03em',
                    }}>
                      {row.positionGroup}
                    </span>
                  )}

                  {/* VEI Index */}
                  <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '48px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#111111', lineHeight: 1 }}>
                      {fmt1dp(row.veiIndex)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      VEI
                    </div>
                  </div>

                  {/* Valid badge */}
                  <div style={{ flexShrink: 0 }}>
                    {row.isValid ? (
                      <span style={{ fontSize: '12px', color: '#22C55E', fontWeight: 600 }}>✓ Valid</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#EF4444', fontWeight: 600 }}>✗ Invalid</span>
                    )}
                  </div>
                </div>
                </Link>
              )
            })}
          </div>
        )
      )}

      {/* Events tab */}
      {tab === 'events' && (
        <MatchEventList events={events} />
      )}
    </div>
  )
}
