'use client'

import { useState } from 'react'
import Link from 'next/link'
import PlayerRadarChart, { type RadarDimension } from './RadarChart'
import VEITrendChart, { type ChartPoint } from './VEITrendChart'
import CompareModal, { type ComparePlayer } from './CompareModal'
import ClipsTab, { type Clip } from './ClipsTab'
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

function formatEventType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function gradeColor(g: number): string {
  if (g > 0) return '#16A34A'
  if (g < 0) return '#DC2626'
  return '#9CA3AF'
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
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
  const shotStat = eventStats.find(e => e.eventType === 'shot')
  const passStat = eventStats.find(e => e.eventType === 'pass')
  const defStat  = eventStats.find(e => e.eventType === 'defensive_action')
  const totalGoals = eventStats.reduce((sum, e) => sum + e.goals, 0)

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

          {/* 4 key stats */}
          {(() => {
            // Derive the two most recent valid matches from matchRows (already newest-first)
            const recentTwo = matchRows
              .filter(r => r.isValid && r.veiIndex !== null)
              .slice(0, 2)
            const cur = recentTwo[0] ?? null
            const prv = recentTwo[1] ?? null
            const hasDelta = !!(cur && prv)

            // matchRows carries VEI sub-scores but not raw event counts.
            // Per-match goals/shots/tackles/pass% aren't available here,
            // so those deltas stay null and render as —.
            const deltas = {
              goals:   null as number | null,
              shots:   null as number | null,
              tackles: null as number | null,
              passPct: hasDelta && cur!.efficiencyScore !== null && prv!.efficiencyScore !== null
                ? Math.round((cur!.efficiencyScore - prv!.efficiencyScore) * 10)
                : null,
            }

            function DeltaBadge({ delta }: { delta: number | null }) {
              if (delta === null) return <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>—</span>
              if (delta === 0)    return <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>0</span>
              const positive = delta > 0
              return (
                <span style={{
                  fontSize: '11px', fontWeight: 600,
                  color: positive ? '#16A34A' : '#DC2626',
                }}>
                  {positive ? '+' : ''}{delta}
                </span>
              )
            }

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                  { value: String(totalGoals), label: 'Goals', sub: 'all matches', delta: deltas.goals,
                    extra: positionGroupRank !== null
                      ? <div style={{ marginTop: '4px', fontSize: '10px', background: '#F3F4F6', borderRadius: '9999px', padding: '1px 6px', display: 'inline-block', color: '#6B7280' }}>{ordinal(positionGroupRank)} of {positionGroupTotal}</div>
                      : null },
                  { value: String(shotStat?.attempts ?? 0), label: 'Shots', sub: `${Math.round(shotStat?.completionRate ?? 0)}% on target`, delta: deltas.shots, extra: null },
                  { value: String(defStat?.attempts ?? 0),  label: 'Tackles', sub: `${Math.round(defStat?.completionRate ?? 0)}% won`, delta: deltas.tackles, extra: null },
                  { value: passStat ? `${Math.round(passStat.completionRate)}%` : '—', label: 'Pass %', sub: `${passStat?.attempts ?? 0} attempts`, delta: deltas.passPct, extra: null },
                ].map(({ value, label, sub, delta, extra }) => (
                  <div key={label} className="stat-card" style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#111111', lineHeight: 1, marginBottom: '4px' }}>{value}</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{sub}</div>
                    <div style={{ marginTop: '6px' }}>
                      <DeltaBadge delta={delta} />
                    </div>
                    {extra}
                  </div>
                ))}
              </div>
            )
          })()}

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

          {/* Match statistics grid */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
              Match Statistics
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { label: 'Shots', value: shotStat?.attempts ?? 0 },
                { label: 'On Target', value: shotStat ? Math.round((shotStat.completionRate / 100) * shotStat.attempts) : 0 },
                { label: 'Shot Acc.', value: shotStat ? `${Math.round(shotStat.completionRate)}%` : '—' },
                { label: 'Key Passes', value: passStat ? Math.round((passStat.completionRate / 100) * passStat.attempts) : 0 },
                { label: 'Dribbles', value: eventStats.find(e => e.eventType === 'dribble')?.attempts ?? 0 },
                { label: 'Duels Won', value: defStat ? Math.round((defStat.completionRate / 100) * defStat.attempts) : 0 },
              ].map(({ label, value }) => (
                <div key={label} style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#111111', lineHeight: 1, marginBottom: '4px' }}>{value}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Event quality table */}
          {eventStats.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                Event Grades
              </div>
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 90px 100px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['Event Type', 'Attempts', 'Mean Grade', 'Completion'].map(h => (
                    <div key={h} style={{ padding: '8px 14px', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                  ))}
                </div>
                {eventStats.map((es, i) => (
                  <div key={es.eventType} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 90px 100px', borderBottom: i < eventStats.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <div style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 500, color: '#111111' }}>{formatEventType(es.eventType)}</div>
                    <div style={{ padding: '10px 14px', fontSize: '13px', color: '#6B7280' }}>{es.attempts}</div>
                    <div style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: gradeColor(es.meanGrade) }}>
                      {es.meanGrade > 0 ? '+' : ''}{es.meanGrade.toFixed(2)}
                    </div>
                    <div style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1, height: '4px', background: '#F3F4F6', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ width: `${es.completionRate}%`, height: '100%', background: '#111111', borderRadius: '9999px' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: '#6B7280', minWidth: '28px' }}>{Math.round(es.completionRate)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            {[
              { value: String(totalMatches), label: 'Played' },
              { value: String(validRows.length), label: 'Valid' },
              { value: String(totalGoals), label: 'Goals' },
              { value: String(eventStats.find(e => e.eventType === 'shot')?.attempts ?? 0), label: 'Shots' },
            ].map(({ value, label }) => (
              <div key={label} style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#111111', lineHeight: 1, marginBottom: '4px' }}>{value}</div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              </div>
            ))}
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
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 70px 70px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Date', 'Opponent', 'Age Grp', 'VEI', 'Valid'].map(h => (
                  <div key={h} style={{ padding: '9px 12px', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                ))}
              </div>
              {matchRows.map((row, i) => (
                <Link
                  key={row.matchId}
                  href={`/performance/matches/${row.matchId}`}
                  style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 70px 70px', textDecoration: 'none', borderBottom: i < matchRows.length - 1 ? '1px solid #F3F4F6' : 'none', opacity: row.isValid ? 1 : 0.5 }}
                >
                  <div style={{ padding: '11px 12px', fontSize: '12px', color: '#6B7280' }}>{formatDate(row.date)}</div>
                  <div style={{ padding: '11px 12px', fontSize: '13px', fontWeight: 500, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.opponent}</div>
                  <div style={{ padding: '11px 12px', fontSize: '12px', color: '#6B7280' }}>{row.ageGroup ?? '—'}</div>
                  <div style={{ padding: '11px 12px', fontSize: '14px', fontWeight: 700, color: '#111111' }}>{fmt1(row.veiIndex)}</div>
                  <div style={{ padding: '11px 12px', fontSize: '12px', fontWeight: 600, color: row.isValid ? '#16A34A' : '#EF4444' }}>
                    {row.isValid ? '✓' : '✗'}
                  </div>
                </Link>
              ))}
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
