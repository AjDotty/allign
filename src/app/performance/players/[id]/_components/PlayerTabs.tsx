'use client'

import { useState } from 'react'
import Link from 'next/link'
import PlayerRadarChart, { type RadarDimension } from './RadarChart'
import VEITrendChart, { type ChartPoint } from './VEITrendChart'
import CompareModal, { type ComparePlayer } from './CompareModal'
import ClipsTab, { type Clip } from './ClipsTab'
import KPICards from './KPICards'
import AttributeStats from './AttributeStats'
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VeiMatchRow = {
  matchId: string
  opponent: string
  date: string
  ageGroup: string | null
  veiIndex: number | null
  volumeScore: number | null
  efficiencyScore: number | null
  impactScore: number | null
  isValid: boolean | null
  // Attacking rates
  shotvolRate: number | null
  att3Rate: number | null
  dribbleRate: number | null
  goalRate: number | null
  bigchanceRate: number | null
  // Defensive / quality grades
  hvdefRate: number | null
  hvdefGrade: number | null
  passGrade: number | null
  carryGrade: number | null
}

export type EventStat = {
  eventType: string
  attempts: number
  meanGrade: number
  completionRate: number
  goals: number
}

export type PlayerProfile = {
  finisher: number
  creator: number
  progressor: number
  disruptor: number
  security: number
  matchesIncluded: number
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt1(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(1)
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}


function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length)
}

function metricColor(value: number | null, avg: number | null): string {
  if (value === null || avg === null) return '#6B7280'
  if (value > avg) return '#16a34a'
  if (value < avg) return '#dc2626'
  return '#6B7280'
}

// ─── Radial gauge ─────────────────────────────────────────────────────────────

function VEIGauge({ value, label, max = 10 }: { value: number | null; label: string; max?: number }) {
  const pct = value !== null ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative', width: '120px', height: '80px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="90%"
            innerRadius="70%" outerRadius="100%"
            startAngle={180} endAngle={0}
            data={[{ value: pct }]}
          >
            <RadialBar
              dataKey="value"
              fill="#111111"
              cornerRadius={4}
              background={{ fill: '#F3F4F6' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center' }}>
          <span style={{ fontSize: '22px', fontWeight: 700, color: '#111111', lineHeight: 1 }}>
            {value !== null ? value.toFixed(1) : '—'}
          </span>
        </div>
      </div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlayerTabs({
  matchRows,
  eventStats,
  profile,
  orgAvgProfile,
  totalMatches,
  avgVei,
  peakVei,
  positionGroupRank,
  positionGroupTotal,
  peers,
  currentPlayer,
  clips,
  squadAvg,
}: {
  matchRows: VeiMatchRow[]
  eventStats: EventStat[]
  profile: PlayerProfile | null
  orgAvgProfile: PlayerProfile | null
  totalMatches: number
  avgVei: number | null
  peakVei: number | null
  positionGroupRank: number | null
  positionGroupTotal: number
  peers: ComparePlayer[]
  currentPlayer: ComparePlayer
  clips: Clip[]
  squadAvg: { vei: number | null; volume: number | null; efficiency: number | null; impact: number | null }
}) {
  const [tab, setTab] = useState<'overview' | 'attributes' | 'performance' | 'clips'>('overview')
  const [showCompare, setShowCompare] = useState(false)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '14px',
    fontWeight: active ? 700 : 500,
    color: active ? '#111111' : '#6B7280',
    padding: '0 0 10px 0', marginRight: '24px',
    borderBottom: active ? '2px solid #111111' : '2px solid transparent',
    outline: 'none',
    transition: 'color 0.15s, border-color 0.15s',
  })

  // Radar data
  const radarData: RadarDimension[] = [
    { dimension: 'Finisher',   value: profile?.finisher ?? 0,   avg: orgAvgProfile?.finisher ?? 50 },
    { dimension: 'Creator',    value: profile?.creator ?? 0,    avg: orgAvgProfile?.creator ?? 50 },
    { dimension: 'Progressor', value: profile?.progressor ?? 0, avg: orgAvgProfile?.progressor ?? 50 },
    { dimension: 'Disruptor',  value: profile?.disruptor ?? 0,  avg: orgAvgProfile?.disruptor ?? 50 },
    { dimension: 'Security',   value: profile?.security ?? 0,   avg: orgAvgProfile?.security ?? 50 },
  ]

  // Chart data (valid rows only, oldest first)
  const validRows = matchRows.filter(r => r.isValid && r.veiIndex !== null)
  const chartData: ChartPoint[] = validRows
    .slice()
    .reverse()
    .map(r => ({
      label: r.opponent,
      vei: r.veiIndex as number,
      opponent: r.opponent,
      date: formatDate(r.date),
    }))

  // Key event stats
  const totalGoals = eventStats.reduce((sum, e) => sum + e.goals, 0)

  // Performance tab derived values
  const validVeis = validRows.map(r => r.veiIndex as number)
  const last3Valid = validRows.slice(0, 3)
  const last3Avg = last3Valid.length > 0 ? last3Valid.reduce((s, r) => s + (r.veiIndex ?? 0), 0) / last3Valid.length : null
  const bestMatchRow = validRows.length > 0 ? validRows.reduce((b, r) => ((r.veiIndex ?? 0) > (b.veiIndex ?? 0) ? r : b), validRows[0]) : null
  const consistency = validVeis.length >= 2 ? Math.max(0, 10 - stdDev(validVeis)) : null

  let seasonArrow: { sym: string; color: string } | null = null
  if (avgVei !== null && last3Avg !== null && last3Valid.length >= 3) {
    if (last3Avg > avgVei) seasonArrow = { sym: '↑', color: '#16a34a' }
    else if (last3Avg < avgVei) seasonArrow = { sym: '↓', color: '#dc2626' }
  }

  const avgVolume = (() => {
    const vals = validRows.map(r => r.volumeScore).filter((v): v is number => v !== null)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })()
  const avgEfficiency = (() => {
    const vals = validRows.map(r => r.efficiencyScore).filter((v): v is number => v !== null)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })()
  const avgImpact = (() => {
    const vals = validRows.map(r => r.impactScore).filter((v): v is number => v !== null)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })()

  return (
    <>
      <style>{`
        @keyframes tabFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .tab-content { animation: tabFade 0.15s ease; }
        .stat-card { transition: box-shadow 0.15s; }
        .stat-card:hover { box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
      `}</style>

      {/* Tab bar + compare button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid #E5E7EB', marginBottom: '24px' }}>
        <div style={{ display: 'flex' }}>
          <button type="button" onClick={() => setTab('overview')} style={tabStyle(tab === 'overview')}>Overview</button>
          <button type="button" onClick={() => setTab('attributes')} style={tabStyle(tab === 'attributes')}>Attributes</button>
          <button type="button" onClick={() => setTab('performance')} style={tabStyle(tab === 'performance')}>
            Performance
            {totalMatches > 0 && (
              <span style={{ marginLeft: '5px', background: '#F3F4F6', color: '#6B7280', fontSize: '11px', fontWeight: 500, borderRadius: '9999px', padding: '1px 6px' }}>
                {totalMatches}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setTab('clips')} style={tabStyle(tab === 'clips')}>
            Clips
            {clips.length > 0 && (
              <span style={{ marginLeft: '5px', background: '#F3F4F6', color: '#6B7280', fontSize: '11px', fontWeight: 500, borderRadius: '9999px', padding: '1px 6px' }}>
                {clips.length}
              </span>
            )}
          </button>
        </div>
        {peers.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCompare(true)}
            style={{ marginBottom: '10px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#111111', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Compare
          </button>
        )}
      </div>

      {/* ── Tab 1: Overview ── */}
      {tab === 'overview' && (
        <div className="tab-content">
          {/* Radar chart */}
          <div style={{ marginBottom: '24px' }}>
            {profile ? (
              <>
                <PlayerRadarChart data={radarData} size={280} />
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '16px', height: '2px', background: '#111111', borderRadius: '2px' }} />
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>Player</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '16px', height: '2px', background: '#D1D5DB', borderRadius: '2px', borderTop: '2px dashed #D1D5DB' }} />
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>Position avg</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontSize: '14px' }}>
                No profile data yet — compute VEI to generate
              </div>
            )}
          </div>

          {/* KPI sparkline cards */}
          <KPICards matchRows={matchRows} />

        </div>
      )}

      {/* ── Tab 2: Attributes ── */}
      {tab === 'attributes' && (
        <div className="tab-content">
          {/* 5 dimension bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
            {!profile ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontSize: '14px' }}>
                No profile data yet — compute VEI to generate
              </div>
            ) : (
              ([
                { key: 'finisher',   label: 'Finisher',   value: profile.finisher },
                { key: 'creator',    label: 'Creator',    value: profile.creator },
                { key: 'progressor', label: 'Progressor', value: profile.progressor },
                { key: 'disruptor',  label: 'Disruptor',  value: profile.disruptor },
                { key: 'security',   label: 'Security',   value: profile.security },
              ] as { key: string; label: string; value: number }[]).map(({ label, value }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>{label}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111111' }}>{Math.round(value)}</span>
                  </div>
                  <div style={{ height: '8px', background: '#E5E7EB', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: '#111111', borderRadius: '9999px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Attacking / Defensive KPI sparklines */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '24px' }}>
            <AttributeStats matchRows={matchRows} />
          </div>
        </div>
      )}

      {/* ── Tab 3: Performance ── */}
      {tab === 'performance' && (
        <div className="tab-content">
          {/* Gauge row */}
          <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', marginBottom: '28px', padding: '24px', border: '1px solid #E5E7EB', borderRadius: '10px' }}>
            <VEIGauge value={avgVei} label="Season Avg VEI" />
            <div style={{ width: '1px', background: '#E5E7EB', alignSelf: 'stretch' }} />
            <VEIGauge value={peakVei} label="Peak VEI" />
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {/* Season VEI */}
            <div className="stat-card" style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#111111', lineHeight: 1 }}>{avgVei !== null ? avgVei.toFixed(1) : '—'}</span>
                {seasonArrow && <span style={{ fontSize: '15px', fontWeight: 700, color: seasonArrow.color, lineHeight: 1 }}>{seasonArrow.sym}</span>}
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Season VEI</div>
            </div>
            {/* Best Match */}
            <div className="stat-card" style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111111', lineHeight: 1, marginBottom: '2px' }}>{bestMatchRow ? (bestMatchRow.veiIndex ?? 0).toFixed(1) : '—'}</div>
              {bestMatchRow && <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bestMatchRow.opponent}</div>}
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best Match</div>
            </div>
            {/* Consistency */}
            <div className="stat-card" style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111111', lineHeight: 1, marginBottom: '2px' }}>{consistency !== null ? consistency.toFixed(1) : '—'}</div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}>out of 10</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Consistency</div>
            </div>
            {/* Position Rank */}
            <div className="stat-card" style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111111', lineHeight: 1, marginBottom: '2px' }}>{positionGroupRank !== null ? ordinal(positionGroupRank) : '—'}</div>
              {positionGroupTotal > 0 && <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}>of {positionGroupTotal}</div>}
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Position Rank</div>
            </div>
          </div>

          {/* VEI trend line chart */}
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111111', marginBottom: '4px' }}>VEI by Match</div>
            <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '16px' }}>Valid matches only · opponent on x-axis</div>
            <VEITrendChart data={chartData} avgVei={avgVei ?? 0} />
          </div>

          {/* Match log */}
          {matchRows.length > 0 && (
            <div style={{ marginTop: '20px', border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 75px 55px 65px 75px 60px 95px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Date', 'Opponent', 'Age Grp', 'VEI', 'Volume', 'Efficiency', 'Impact', 'Status'].map(h => (
                  <div key={h} style={{ padding: '9px 12px', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                ))}
              </div>
              {matchRows.map((row, i) => (
                <Link
                  key={row.matchId}
                  href={`/performance/matches/${row.matchId}`}
                  style={{ display: 'grid', gridTemplateColumns: '100px 1fr 75px 55px 65px 75px 60px 95px', textDecoration: 'none', borderBottom: i < matchRows.length - 1 ? '1px solid #F3F4F6' : 'none', opacity: row.isValid ? 1 : 0.5 }}
                >
                  <div style={{ padding: '11px 12px', fontSize: '12px', color: '#6B7280' }}>{formatDate(row.date)}</div>
                  <div style={{ padding: '11px 12px', fontSize: '13px', fontWeight: 500, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.opponent}</div>
                  <div style={{ padding: '11px 12px', fontSize: '12px', color: '#6B7280' }}>{row.ageGroup ?? '—'}</div>
                  <div style={{ padding: '11px 12px', fontSize: '14px', fontWeight: 700, color: '#111111' }}>{fmt1(row.veiIndex)}</div>
                  <div style={{ padding: '11px 12px', fontSize: '13px', fontWeight: 600, color: metricColor(row.volumeScore, avgVolume) }}>{fmt1(row.volumeScore)}</div>
                  <div style={{ padding: '11px 12px', fontSize: '13px', fontWeight: 600, color: metricColor(row.efficiencyScore, avgEfficiency) }}>{fmt1(row.efficiencyScore)}</div>
                  <div style={{ padding: '11px 12px', fontSize: '13px', fontWeight: 600, color: metricColor(row.impactScore, avgImpact) }}>{fmt1(row.impactScore)}</div>
                  <div style={{ padding: '11px 12px', fontSize: '12px', fontWeight: 600, color: row.isValid ? '#16a34a' : '#d97706' }}>
                    <span title="Complete means enough event data exists to calculate a reliable VEI score">
                      {row.isValid ? 'Complete' : 'Incomplete'}
                    </span>
                  </div>
                </Link>
              ))}
              {/* Squad Avg row */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 75px 55px 65px 75px 60px 95px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
                <div style={{ padding: '10px 12px', fontSize: '11px', color: '#9CA3AF' }} />
                <div style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Squad Avg</div>
                <div style={{ padding: '10px 12px' }} />
                <div style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>{squadAvg.vei !== null ? squadAvg.vei.toFixed(1) : '—'}</div>
                <div style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>{squadAvg.volume !== null ? squadAvg.volume.toFixed(1) : '—'}</div>
                <div style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>{squadAvg.efficiency !== null ? squadAvg.efficiency.toFixed(1) : '—'}</div>
                <div style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>{squadAvg.impact !== null ? squadAvg.impact.toFixed(1) : '—'}</div>
                <div style={{ padding: '10px 12px' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 4: Clips ── */}
      {tab === 'clips' && (
        <div className="tab-content">
          <ClipsTab clips={clips} />
        </div>
      )}

      {/* Compare modal */}
      {showCompare && peers.length > 0 && (
        <CompareModal
          currentPlayer={currentPlayer}
          peers={peers}
          onClose={() => setShowCompare(false)}
        />
      )}
    </>
  )
}
