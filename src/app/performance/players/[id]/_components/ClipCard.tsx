'use client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Clip = {
  id: string
  event_type: string
  grade: number
  clip_url: string
  matchId: string
  matchOpponent: string
  matchDate: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeLabel(g: number): string {
  if (g >= 2) return 'Extravagant'
  if (g === 1) return 'Above'
  if (g === 0) return 'Expected'
  return 'Well Below'
}

function gradeStyle(g: number): React.CSSProperties {
  if (g >= 1) return { background: '#111111', color: '#FFFFFF' }
  if (g === 0) return { background: '#F3F4F6', color: '#6B7280' }
  return { background: '#FEE2E2', color: '#DC2626' }
}

function formatEventType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClipCard({
  clip,
  active,
  onSelect,
}: {
  clip: Clip
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '200px',
        flexShrink: 0,
        border: `2px solid ${active ? '#111111' : '#E5E7EB'}`,
        borderRadius: '10px',
        overflow: 'hidden',
        background: '#FFFFFF',
        cursor: 'pointer',
        textAlign: 'left',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'inherit',
        transition: 'border-color 0.1s',
      }}
    >
      {/* Video thumbnail — preload="metadata" loads the first frame */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        background: '#1a1a1a',
        overflow: 'hidden',
      }}>
        <video
          src={clip.clip_url}
          preload="metadata"
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Play overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.22)',
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
              <path d="M1 1L9 6L1 11V1Z" fill="#111111" />
            </svg>
          </div>
        </div>
      </div>

      {/* Card info */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700,
            padding: '2px 7px', borderRadius: '9999px',
            letterSpacing: '0.02em',
            flexShrink: 0,
            ...gradeStyle(clip.grade),
          }}>
            {gradeLabel(clip.grade)}
          </span>
          <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>
            {formatEventType(clip.event_type)}
          </span>
        </div>
        <div style={{
          fontSize: '11px', color: '#9CA3AF',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          vs {clip.matchOpponent}
        </div>
      </div>
    </button>
  )
}
