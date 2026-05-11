'use client'

import { useState, useEffect, useRef } from 'react'
import ClipCard, { type Clip } from './ClipCard'
import ClipPlayer from './ClipPlayer'

export type { Clip }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClipsTab({ clips }: { clips: Clip[] }) {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const playerRef = useRef<HTMLDivElement>(null)

  // Unique matches in the order they appear
  const matches = [
    ...new Map(
      clips.map(c => [c.matchId, { id: c.matchId, opponent: c.matchOpponent, date: c.matchDate }])
    ).values(),
  ]

  // Clips filtered by selected match
  const filteredClips = selectedMatchId
    ? clips.filter(c => c.matchId === selectedMatchId)
    : clips

  // Reset player when filter changes
  useEffect(() => {
    setActiveIndex(0)
    setStarted(false)
  }, [selectedMatchId])

  function selectClip(indexInFiltered: number) {
    setActiveIndex(indexInFiltered)
    setStarted(true)
    playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function handleEnded() {
    if (activeIndex < filteredClips.length - 1) {
      setActiveIndex(i => i + 1)
    }
  }

  // Group filtered clips by event_type, sorted alphabetically
  const grouped: Record<string, { clip: Clip; indexInFiltered: number }[]> = {}
  filteredClips.forEach((clip, idx) => {
    if (!grouped[clip.event_type]) grouped[clip.event_type] = []
    grouped[clip.event_type].push({ clip, indexInFiltered: idx })
  })
  const groupKeys = Object.keys(grouped).sort()

  if (clips.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>
        No clips available — grade match events with video footage to see clips here
      </div>
    )
  }

  const activeClip = filteredClips[activeIndex] ?? null
  const selectedMatchLabel = selectedMatchId
    ? matches.find(m => m.id === selectedMatchId)?.opponent
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Match filter pills ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <MatchPill
          label="All Performances"
          count={clips.length}
          active={selectedMatchId === null}
          onClick={() => setSelectedMatchId(null)}
        />
        {matches.map(m => (
          <MatchPill
            key={m.id}
            label={`vs ${m.opponent}`}
            count={clips.filter(c => c.matchId === m.id).length}
            active={selectedMatchId === m.id}
            onClick={() => setSelectedMatchId(m.id)}
          />
        ))}
      </div>

      {/* ── Main player ── */}
      <div ref={playerRef}>
        <div style={{
          fontSize: '10px', fontWeight: 500, color: '#9CA3AF',
          textTransform: 'uppercase', letterSpacing: '0.12em',
          marginBottom: '12px',
        }}>
          {selectedMatchLabel ? `vs ${selectedMatchLabel}` : 'Full Highlight Reel'}
        </div>

        {!started ? (
          /* Click-to-start poster */
          <div
            onClick={() => { setStarted(true); setActiveIndex(0) }}
            style={{
              border: '1px solid #E5E7EB', borderRadius: '10px',
              background: '#F9FAFB', aspectRatio: '16/9',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '14px', cursor: 'pointer',
            }}
          >
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: '#111111',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
                <path d="M1 1.5L16.5 11L1 20.5V1.5Z" fill="white" />
              </svg>
            </div>
            <div style={{ fontSize: '13px', color: '#6B7280' }}>
              Play {filteredClips.length} clip{filteredClips.length !== 1 ? 's' : ''}
            </div>
          </div>
        ) : activeClip ? (
          <ClipPlayer
            clip={activeClip}
            currentIndex={activeIndex}
            total={filteredClips.length}
            onEnded={handleEnded}
            onNext={() => setActiveIndex(i => Math.min(i + 1, filteredClips.length - 1))}
            onPrev={() => setActiveIndex(i => Math.max(i - 1, 0))}
            hasNext={activeIndex < filteredClips.length - 1}
            hasPrev={activeIndex > 0}
          />
        ) : null}
      </div>

      {/* ── Grouped clip rows ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {groupKeys.map(eventType => {
          const group = grouped[eventType]
          return (
            <div key={eventType}>
              {/* Section heading */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '12px',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>
                  {formatEventType(eventType)}
                </span>
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>({group.length})</span>
              </div>

              {/* Horizontal scroll row */}
              <div style={{
                display: 'flex', gap: '12px',
                overflowX: 'auto', paddingBottom: '8px',
                // Hide scrollbar visually but keep functional
                scrollbarWidth: 'thin',
                scrollbarColor: '#E5E7EB transparent',
              }}>
                {group.map(({ clip, indexInFiltered }) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    active={started && activeIndex === indexInFiltered}
                    onSelect={() => selectClip(indexInFiltered)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

// ─── Match filter pill ────────────────────────────────────────────────────────

function MatchPill({
  label, count, active, onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: '9999px',
        border: `1px solid ${active ? '#111111' : '#E5E7EB'}`,
        fontSize: '12px', fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        background: active ? '#111111' : '#FFFFFF',
        color: active ? '#FFFFFF' : '#6B7280',
        transition: 'all 0.1s',
        display: 'flex', alignItems: 'center', gap: '5px',
      }}
    >
      {label}
      <span style={{ opacity: 0.65, fontWeight: 400 }}>{count}</span>
    </button>
  )
}
