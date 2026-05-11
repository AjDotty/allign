'use client'

import { useState } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export type ComparePlayer = {
  playerId: string
  playerName: string
  positionGroup: string | null
  profile: {
    finisher: number
    creator: number
    progressor: number
    disruptor: number
    security: number
  } | null
  avgVei: number | null
}

const DIMENSIONS = ['Finisher', 'Creator', 'Progressor', 'Disruptor', 'Security'] as const

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#14B8A6']
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function dim(key: string, p: ComparePlayer['profile']): number {
  if (!p) return 0
  return (p as any)[key.toLowerCase()] ?? 0
}

export default function CompareModal({
  currentPlayer,
  peers,
  onClose,
}: {
  currentPlayer: ComparePlayer
  peers: ComparePlayer[]
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState<string>(peers[0]?.playerId ?? '')
  const opponent = peers.find(p => p.playerId === selectedId) ?? peers[0]

  const radarData = DIMENSIONS.map(d => ({
    dimension: d,
    [currentPlayer.playerName]: dim(d, currentPlayer.profile),
    [opponent?.playerName ?? 'Opponent']: dim(d, opponent?.profile ?? null),
  }))

  const colorA = '#111111'
  const colorB = '#3B82F6'

  const rows = [
    { label: 'VEI Index', a: currentPlayer.avgVei?.toFixed(1) ?? '—', b: opponent?.avgVei?.toFixed(1) ?? '—' },
    ...DIMENSIONS.map(d => ({
      label: d,
      a: dim(d, currentPlayer.profile).toFixed(1),
      b: dim(d, opponent?.profile ?? null).toFixed(1),
    })),
  ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '32px', width: '680px', maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', position: 'relative' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111111', margin: 0 }}>Compare Players</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#9CA3AF', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Player headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 1fr', gap: '8px', alignItems: 'center', marginBottom: '24px' }}>
          {/* Player A */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: avatarColor(currentPlayer.playerName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#FFF', flexShrink: 0 }}>
              {initials(currentPlayer.playerName)}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111111' }}>{currentPlayer.playerName}</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{currentPlayer.positionGroup ?? '—'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: '13px', color: '#9CA3AF', fontWeight: 600 }}>vs</div>
          {/* Player B selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {opponent && (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: avatarColor(opponent.playerName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#FFF', flexShrink: 0 }}>
                {initials(opponent.playerName)}
              </div>
            )}
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: '#111111', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 10px', background: '#FFFFFF', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {peers.map(p => (
                <option key={p.playerId} value={p.playerId}>{p.playerName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Radar chart */}
        <div style={{ marginBottom: '24px' }}>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#E5E7EB" gridType="polygon" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fontFamily: 'Inter, sans-serif', fill: '#6B7280', fontWeight: 500 }} />
              <Radar name={opponent?.playerName ?? 'Opponent'} dataKey={opponent?.playerName ?? 'Opponent'} stroke={colorB} fill={colorB} fillOpacity={0.1} strokeWidth={2} />
              <Radar name={currentPlayer.playerName} dataKey={currentPlayer.playerName} stroke={colorA} fill={colorA} fillOpacity={0.08} strokeWidth={2} dot={{ r: 3, fill: colorA, strokeWidth: 0 }} />
              <Legend
                formatter={(value) => <span style={{ fontSize: '12px', color: '#111111', fontFamily: 'Inter, sans-serif' }}>{value}</span>}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Stat comparison table */}
        <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attribute</div>
            <div style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 600, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
              {currentPlayer.playerName.split(' ')[0]}
            </div>
            <div style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: colorB, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
              {opponent?.playerName.split(' ')[0] ?? '—'}
            </div>
          </div>
          {rows.map((row, i) => {
            const aNum = parseFloat(row.a)
            const bNum = parseFloat(row.b)
            const aWins = !isNaN(aNum) && !isNaN(bNum) && aNum > bNum
            const bWins = !isNaN(aNum) && !isNaN(bNum) && bNum > aNum
            return (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', borderBottom: i < rows.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ padding: '11px 16px', fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>{row.label}</div>
                <div style={{ padding: '11px 12px', fontSize: '14px', fontWeight: 700, color: aWins ? '#111111' : '#9CA3AF', textAlign: 'right' }}>{row.a}</div>
                <div style={{ padding: '11px 16px', fontSize: '14px', fontWeight: 700, color: bWins ? colorB : '#9CA3AF', textAlign: 'right' }}>{row.b}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
