'use client'

import Link from 'next/link'
import { useState } from 'react'

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
]

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

type Props = {
  id: string
  name: string
  position_group: string | null
  shirt_number: number | null
}

export default function PlayerCard({ id, name, position_group, shirt_number }: Props) {
  const [hovered, setHovered] = useState(false)
  const color = avatarColor(name)

  return (
    <Link href={`/performance/players/${id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          border: `1px solid ${hovered ? '#D1D5DB' : '#E5E7EB'}`,
          borderRadius: '10px',
          padding: '20px 16px',
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          boxShadow: hovered ? '0 2px 10px rgba(0,0,0,0.07)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Avatar + shirt number */}
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '54px', height: '54px', borderRadius: '50%',
            background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 700, color: '#FFFFFF',
            letterSpacing: '-0.01em',
          }}>
            {initials(name)}
          </div>
          {shirt_number != null && (
            <div style={{
              position: 'absolute', bottom: '-3px', right: '-6px',
              background: '#111111', color: '#FFFFFF',
              fontSize: '9px', fontWeight: 700,
              borderRadius: '9999px', padding: '2px 5px',
              letterSpacing: '0.02em', lineHeight: 1.4,
            }}>
              {shirt_number}
            </div>
          )}
        </div>

        {/* Name */}
        <div style={{
          fontSize: '14px', fontWeight: 600, color: '#111111',
          textAlign: 'center', width: '100%',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </div>

        {/* Position pill */}
        {position_group ? (
          <span style={{
            background: '#111111', color: '#FFFFFF',
            fontSize: '11px', fontWeight: 600,
            padding: '3px 10px', borderRadius: '9999px',
            letterSpacing: '0.02em',
          }}>
            {position_group}
          </span>
        ) : (
          <span style={{
            background: '#F3F4F6', color: '#9CA3AF',
            fontSize: '11px', fontWeight: 500,
            padding: '3px 10px', borderRadius: '9999px',
          }}>
            No position
          </span>
        )}
      </div>
    </Link>
  )
}
