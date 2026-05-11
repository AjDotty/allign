'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventItem = {
  id: string
  playerId: string | null
  playerName: string
  eventType: string
  subCategory: string | null
  grade: number
  completed: boolean
  clipUrl: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function gradePillStyle(g: number): React.CSSProperties {
  if (g >= 1) {
    return { background: '#111111', color: '#FFFFFF' }
  }
  if (g === 0) {
    return { background: '#F3F4F6', color: '#6B7280' }
  }
  // negative
  return { background: '#FEE2E2', color: '#DC2626' }
}

function gradeLabel(g: number) {
  return g > 0 ? `+${g}` : `${g}`
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({ ev, activeClipId, onToggleClip }: {
  ev: EventItem
  activeClipId: string | null
  onToggleClip: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const isPlaying = activeClipId === ev.id
  const pillStyle = gradePillStyle(ev.grade)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: '6px',
        background: hovered ? '#F9FAFB' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 10px', flexWrap: 'wrap',
      }}>
        {/* Grade pill */}
        <span style={{
          ...pillStyle,
          borderRadius: '9999px',
          padding: '2px 8px',
          fontSize: '11px', fontWeight: 700,
          whiteSpace: 'nowrap', flexShrink: 0,
          minWidth: '32px', textAlign: 'center',
        }}>
          {gradeLabel(ev.grade)}
        </span>

        {/* Player name */}
        <span style={{
          fontSize: '13px', fontWeight: 500, color: '#111111',
          flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ev.playerName}
        </span>

        {/* Sub-category */}
        {ev.subCategory && (
          <span style={{ fontSize: '12px', color: '#9CA3AF', flexShrink: 0 }}>
            {ev.subCategory}
          </span>
        )}

        {/* Completed */}
        <span style={{
          fontSize: '12px', flexShrink: 0,
          color: ev.completed ? '#16A34A' : '#DC2626',
        }}>
          {ev.completed ? '✓' : '✗'}
        </span>

        {/* Play button */}
        {ev.clipUrl && (
          <button
            type="button"
            onClick={() => onToggleClip(ev.id)}
            style={{
              border: '1px solid #E5E7EB', borderRadius: '8px',
              background: isPlaying ? '#111111' : '#FFFFFF',
              color: isPlaying ? '#FFFFFF' : '#6B7280',
              cursor: 'pointer', fontSize: '11px', fontWeight: 500,
              padding: '3px 8px', flexShrink: 0, fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            {isPlaying ? '■ Close' : '▶ Play'}
          </button>
        )}
      </div>

      {/* Inline video */}
      {isPlaying && ev.clipUrl && (
        <video
          src={ev.clipUrl}
          controls
          autoPlay
          style={{
            width: '100%', maxHeight: '200px', borderRadius: '8px',
            marginBottom: '8px', background: '#000000',
          }}
        />
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchEventList({ events }: { events: EventItem[] }) {
  const [activeClipId, setActiveClipId] = useState<string | null>(null)

  function toggleClip(id: string) {
    setActiveClipId(prev => prev === id ? null : id)
  }

  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#111111', marginBottom: '6px' }}>
          No events recorded
        </div>
        <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
          Import Metrica data or grade manually
        </div>
      </div>
    )
  }

  // Group by event_type, preserving order of first appearance
  const order: string[] = []
  const grouped: Record<string, EventItem[]> = {}
  for (const ev of events) {
    if (!grouped[ev.eventType]) { grouped[ev.eventType] = []; order.push(ev.eventType) }
    grouped[ev.eventType].push(ev)
  }

  return (
    <div>
      {order.map((eventType, i) => {
        const group = grouped[eventType]
        return (
          <div key={eventType}>
            {/* Section header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              marginTop: i === 0 ? '0' : '24px', marginBottom: '8px',
            }}>
              <span style={{
                fontSize: '10px', fontWeight: 500, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.12em',
              }}>
                {formatEventType(eventType)}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 600, color: '#9CA3AF',
                background: '#F3F4F6', borderRadius: '9999px',
                padding: '1px 7px',
              }}>
                {group.length}
              </span>
            </div>

            {/* Event rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {group.map(ev => (
                <EventRow
                  key={ev.id}
                  ev={ev}
                  activeClipId={activeClipId}
                  onToggleClip={toggleClip}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
