'use client'

import { useState } from 'react'
import { AreaChart, Area, Tooltip } from 'recharts'
import type { TooltipProps } from 'recharts'
import type { VeiMatchRow } from './PlayerTabs'

type SparkPoint = { value: number; opponent: string }

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function SparkTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const { value, opponent } = payload[0].payload as SparkPoint
  return (
    <div
      style={{
        background: '#111111',
        color: '#FFFFFF',
        fontSize: '12px',
        padding: '6px 8px',
        borderRadius: '6px',
        border: 'none',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ color: '#9CA3AF' }}>vs {opponent}</div>
      <div style={{ fontWeight: 700 }}>{value.toFixed(2)}</div>
    </div>
  )
}

function StatCard({
  label,
  recentValue,
  avg,
  sparkData,
}: {
  label: string
  recentValue: number | null
  avg: number | null
  sparkData: SparkPoint[]
}) {
  const fillId = `attr-fill-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div
      className="stat-card"
      style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '16px' }}
    >
      <div
        style={{
          fontSize: '10px',
          fontWeight: 600,
          color: '#9CA3AF',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '8px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '30px',
          fontWeight: 700,
          color: '#111111',
          lineHeight: 1,
          marginBottom: '4px',
        }}
      >
        {recentValue !== null ? recentValue.toFixed(2) : '—'}
      </div>
      <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
        Avg {avg !== null ? avg.toFixed(2) : '—'}
      </div>
      {sparkData.length > 1 && (
        <AreaChart width={120} height={60} data={sparkData}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111111" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#111111" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            content={<SparkTooltip />}
            cursor={{ stroke: '#E5E7EB', strokeWidth: 1 }}
            position={{ y: -52 }}
            allowEscapeViewBox={{ x: false, y: true }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#111111"
            strokeWidth={2.5}
            fill={`url(#${fillId})`}
            dot={false}
            activeDot={{ r: 3, fill: '#111111' }}
            isAnimationActive={false}
          />
        </AreaChart>
      )}
    </div>
  )
}

type MetricDef = {
  label: string
  key: keyof VeiMatchRow
}

const ATTACKING: MetricDef[] = [
  { label: 'Shots',              key: 'shotvolRate' },
  { label: 'Att. Third Entries', key: 'att3Rate' },
  { label: 'Dribbles',           key: 'dribbleRate' },
  { label: 'Goals',              key: 'goalRate' },
  { label: 'Big Chances',        key: 'bigchanceRate' },
]

const DEFENSIVE: MetricDef[] = [
  { label: 'Def. Actions',     key: 'hvdefRate' },
  { label: 'HV Def. Actions',  key: 'hvdefGrade' },
  { label: 'Pass Grade',       key: 'passGrade' },
  { label: 'Carry Grade',      key: 'carryGrade' },
]

export default function AttributeStats({ matchRows }: { matchRows: VeiMatchRow[] }) {
  const [activeTab, setActiveTab] = useState<'attacking' | 'defensive'>('attacking')

  // Valid rows oldest → newest for sparklines; matchRows is newest-first
  const validRows = matchRows.filter((r) => r.isValid).slice().reverse()
  // Most recent valid match
  const recent = matchRows.find((r) => r.isValid) ?? null

  const metrics = activeTab === 'attacking' ? ATTACKING : DEFENSIVE

  function pillStyle(active: boolean): React.CSSProperties {
    return active
      ? {
          background: '#111111',
          color: '#FFFFFF',
          fontSize: '12px',
          fontWeight: 500,
          padding: '4px 12px',
          borderRadius: '9999px',
          border: '1px solid #111111',
          cursor: 'pointer',
          fontFamily: 'inherit',
          outline: 'none',
        }
      : {
          background: 'transparent',
          color: '#6B7280',
          fontSize: '12px',
          fontWeight: 500,
          padding: '4px 12px',
          borderRadius: '9999px',
          border: '1px solid #E5E7EB',
          cursor: 'pointer',
          fontFamily: 'inherit',
          outline: 'none',
        }
  }

  return (
    <div>
      {/* Pill tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          style={pillStyle(activeTab === 'attacking')}
          onClick={() => setActiveTab('attacking')}
        >
          Attacking
        </button>
        <button
          type="button"
          style={pillStyle(activeTab === 'defensive')}
          onClick={() => setActiveTab('defensive')}
        >
          Defensive
        </button>
      </div>

      {/* KPI card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
        }}
      >
        {metrics.map(({ label, key }) => {
          const sparkData: SparkPoint[] = validRows.flatMap((r) => {
            const v = r[key]
            return typeof v === 'number' ? [{ value: v, opponent: r.opponent }] : []
          })
          const vals = sparkData.map((p) => p.value)
          const avg = vals.length > 0 ? mean(vals) : null
          const recentValue =
            recent && typeof recent[key] === 'number' ? (recent[key] as number) : null

          return (
            <StatCard
              key={label}
              label={label}
              recentValue={recentValue}
              avg={avg}
              sparkData={sparkData}
            />
          )
        })}
      </div>
    </div>
  )
}
