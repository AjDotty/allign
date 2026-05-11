'use client'

import { useEffect, useRef } from 'react'
import { type Clip } from './ClipCard'

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function ClipPlayer({
  clip,
  currentIndex,
  total,
  onEnded,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}: {
  clip: Clip
  currentIndex: number
  total: number
  onEnded: () => void
  onNext: () => void
  onPrev: () => void
  hasNext: boolean
  hasPrev: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // When clip changes, reload the video (no autoplay — coach clicks play)
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.pause()
    el.load()
  }, [clip.clip_url])

  // Cap dots at 10 visible; show overflow count
  const maxDots = 10
  const visibleDots = Math.min(total, maxDots)
  const overflow = total > maxDots ? total - maxDots + 1 : 0
  const dotIndex = currentIndex < maxDots - (overflow > 0 ? 1 : 0) ? currentIndex : maxDots - 1

  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden', background: '#000000' }}>
      <video
        ref={videoRef}
        src={clip.clip_url}
        controls
        onEnded={onEnded}
        style={{ width: '100%', display: 'block', maxHeight: '420px', background: '#000' }}
      />

      {/* Controls bar */}
      <div style={{
        background: '#FFFFFF', borderTop: '1px solid #E5E7EB',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '16px',
      }}>
        {/* Clip info */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: '13px', fontWeight: 600, color: '#111111',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            vs {clip.matchOpponent}
          </div>
          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>
            {formatDate(clip.matchDate)}
          </div>
        </div>

        {/* Progress + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            style={{
              background: 'none', border: 'none', padding: '4px 6px',
              cursor: hasPrev ? 'pointer' : 'default',
              color: hasPrev ? '#111111' : '#D1D5DB',
              fontSize: '20px', lineHeight: 1, fontFamily: 'inherit',
            }}
          >
            ‹
          </button>

          {/* Dots */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {Array.from({ length: visibleDots }).map((_, i) => {
              const isActive = i === dotIndex
              return (
                <div
                  key={i}
                  style={{
                    width: isActive ? '8px' : '6px',
                    height: isActive ? '8px' : '6px',
                    borderRadius: '50%',
                    background: isActive ? '#111111' : '#E5E7EB',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                />
              )
            })}
            {overflow > 0 && (
              <span style={{ fontSize: '10px', color: '#9CA3AF', marginLeft: '2px' }}>+{overflow}</span>
            )}
          </div>

          <button
            onClick={onNext}
            disabled={!hasNext}
            style={{
              background: 'none', border: 'none', padding: '4px 6px',
              cursor: hasNext ? 'pointer' : 'default',
              color: hasNext ? '#111111' : '#D1D5DB',
              fontSize: '20px', lineHeight: 1, fontFamily: 'inherit',
            }}
          >
            ›
          </button>

          <span style={{ fontSize: '12px', color: '#9CA3AF', minWidth: '38px', textAlign: 'right' }}>
            {currentIndex + 1} / {total}
          </span>
        </div>
      </div>
    </div>
  )
}
