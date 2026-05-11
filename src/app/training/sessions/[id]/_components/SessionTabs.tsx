'use client'

import { useState } from 'react'

// ─── Exported types (consumed by the server page) ─────────────────────────────

export type SessionPlayer = {
  attended: boolean
  absence_reason: string | null
  players: { id: string; name: string } | null
}

export type SessionExercise = {
  id: string
  duration_minutes: number | null
  notes: string | null
  order: number
  exercises: { id: string; name: string; category: string | null } | null
}

// ─── Avatar helpers ───────────────────────────────────────────────────────────

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

// ─── Tab component ────────────────────────────────────────────────────────────

type Tab = 'overview' | 'attendance' | 'exercises'

export default function SessionTabs({
  sessionPlayers,
  sessionExercises,
}: {
  sessionPlayers: SessionPlayer[]
  sessionExercises: SessionExercise[]
}) {
  const [tab, setTab] = useState<Tab>('overview')

  const totalPlayers = sessionPlayers.length
  const attended = sessionPlayers.filter(p => p.attended).length
  const absent = totalPlayers - attended
  const attendanceRate = totalPlayers > 0 ? Math.round((attended / totalPlayers) * 100) : 0
  const totalExerciseDuration = sessionExercises.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0)

  function tabBtn(t: Tab, label: string) {
    const active = tab === t
    return (
      <button
        onClick={() => setTab(t)}
        style={{
          fontSize: '14px', fontWeight: 500, background: 'none', border: 'none',
          borderBottom: active ? '2px solid #111111' : '2px solid transparent',
          color: active ? '#111111' : '#6B7280',
          padding: '8px 0', marginRight: '24px', cursor: 'pointer',
          fontFamily: 'inherit', lineHeight: 1,
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div>
      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #E5E7EB', marginBottom: '24px', display: 'flex' }}>
        {tabBtn('overview', 'Overview')}
        {tabBtn('attendance', 'Attendance')}
        {tabBtn('exercises', 'Exercises')}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
          <StatBlock value={totalPlayers} label="Total Players" />
          <StatBlock value={attended} label="Attended" />
          <StatBlock value={absent} label="Absent" />
          <StatBlock value={sessionExercises.length} label="Exercises Delivered" />
        </div>
      )}

      {/* ── Attendance ── */}
      {tab === 'attendance' && (
        <div>
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '48px', fontWeight: 700, color: '#111111', lineHeight: 1 }}>
              {attendanceRate}%
            </div>
            <div style={{
              fontSize: '11px', fontWeight: 600, color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '8px',
            }}>
              Attendance Rate
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sessionPlayers.map((sp, i) => {
              if (!sp.players) return null
              return (
                <div key={sp.players.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '9999px', flexShrink: 0,
                    background: avatarColor(sp.players.name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color: '#FFFFFF',
                  }}>
                    {initials(sp.players.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', color: '#111111' }}>{sp.players.name}</span>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '9999px', flexShrink: 0,
                        background: sp.attended ? '#10B981' : '#D1D5DB',
                      }} />
                    </div>
                    {!sp.attended && sp.absence_reason && (
                      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                        {sp.absence_reason.charAt(0).toUpperCase() + sp.absence_reason.slice(1)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Exercises ── */}
      {tab === 'exercises' && (
        <div>
          {sessionExercises.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
              No exercises logged for this session
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {sessionExercises.map(e => (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '14px 16px', border: '1px solid #E5E7EB', borderRadius: '8px',
                    }}
                  >
                    <span style={{
                      fontSize: '12px', fontWeight: 600, color: '#9CA3AF',
                      minWidth: '18px', paddingTop: '2px', flexShrink: 0,
                    }}>
                      {e.order}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#111111' }}>
                          {e.exercises?.name ?? 'Unknown exercise'}
                        </span>
                        {e.duration_minutes != null && (
                          <span style={{ fontSize: '13px', color: '#6B7280' }}>
                            {e.duration_minutes} min
                          </span>
                        )}
                      </div>
                      {e.notes && (
                        <div style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
                          {e.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {totalExerciseDuration > 0 && (
                <div style={{
                  fontSize: '13px', color: '#6B7280',
                  borderTop: '1px solid #E5E7EB', paddingTop: '14px',
                }}>
                  Total exercise time:{' '}
                  <strong style={{ color: '#111111' }}>{totalExerciseDuration} min</strong>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stat block ───────────────────────────────────────────────────────────────

function StatBlock({ value, label }: { value: number | string; label: string }) {
  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '20px' }}>
      <div style={{ fontSize: '32px', fontWeight: 700, color: '#111111', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{
        fontSize: '11px', fontWeight: 600, color: '#9CA3AF',
        textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '8px',
      }}>
        {label}
      </div>
    </div>
  )
}
