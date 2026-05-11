import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function monthStart(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Get member + org ──────────────────────────────────────────────────────

  const { data: member } = await supabase
    .from('members').select('id, name').eq('user_id', user.id).single()

  const { data: orgMembership } = member
    ? await supabase.from('organisation_members')
        .select('organisation_id').eq('member_id', member.id).single()
    : { data: null }

  if (!orgMembership?.organisation_id) redirect('/login')
  const organisationId = orgMembership.organisation_id

  const ms = monthStart()

  // ── Parallel fetches ──────────────────────────────────────────────────────

  const [
    { data: allSessions },
    { data: allMatches },
    { data: players },
    { data: veiRows },
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, date, age_group, session_exercises(count), session_players(attended)')
      .eq('organisation_id', organisationId)
      .order('date', { ascending: false }),

    supabase
      .from('matches')
      .select('id, opponent, date, age_group, home_away, player_match_vei(vei_index, is_valid)')
      .eq('organisation_id', organisationId)
      .order('date', { ascending: false }),

    supabase
      .from('players')
      .select('id')
      .eq('home_organisation_id', organisationId),

    supabase
      .from('player_match_vei')
      .select('player_id, vei_index, players(id, name, position_group)')
      .eq('organisation_id', organisationId)
      .eq('is_valid', true),
  ])

  // ── Derive stats ──────────────────────────────────────────────────────────

  const sessions = allSessions ?? []
  const matches = allMatches ?? []
  const activePlayers = (players ?? []).length

  const sessionsThisMonth = sessions.filter(s => s.date >= ms).length
  const matchesThisMonth = matches.filter(m => m.date >= ms).length

  const recentSessions = sessions.slice(0, 3)
  const recentMatches = matches.slice(0, 3)

  // Top 3 players by avg VEI
  const veiByPlayer: Record<string, { name: string; posGroup: string | null; veis: number[] }> = {}
  for (const row of veiRows ?? []) {
    if (row.vei_index === null) continue
    const pArr = Array.isArray(row.players) ? row.players : row.players ? [row.players] : []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (pArr[0] as any)
    if (!veiByPlayer[row.player_id]) {
      veiByPlayer[row.player_id] = { name: p?.name ?? 'Unknown', posGroup: p?.position_group ?? null, veis: [] }
    }
    veiByPlayer[row.player_id].veis.push(row.vei_index)
  }
  const topPlayers = Object.entries(veiByPlayer)
    .map(([id, { name, posGroup, veis }]) => ({ id, name, posGroup, avgVei: mean(veis) }))
    .sort((a, b) => b.avgVei - a.avgVei)
    .slice(0, 3)

  const memberName = member?.name ?? user.email?.split('@')[0] ?? 'Coach'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 700, color: '#111111', margin: 0, lineHeight: 1.1 }}>
            Dashboard
          </h1>
          <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '6px' }}>
            Welcome back, {memberName}
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {([
            { label: 'Sessions This Month', value: sessionsThisMonth, href: '/training/sessions',   accent: '#111111' },
            { label: 'Matches This Month',  value: matchesThisMonth,  href: '/performance/matches', accent: '#6B7280' },
            { label: 'Active Players',      value: activePlayers,     href: '/performance/players', accent: '#D1D5DB' },
          ] as const).map(card => (
            <Link key={card.label} href={card.href} style={{ textDecoration: 'none' }}>
              <div style={{
                border: '1px solid #E5E7EB',
                borderLeft: `4px solid ${card.accent}`,
                borderRadius: '10px', padding: '24px',
                background: '#FFFFFF', cursor: 'pointer',
              }}>
                <div style={{ fontSize: '48px', fontWeight: 700, color: '#111111', lineHeight: 1 }}>
                  {card.value}
                </div>
                <div style={{
                  fontSize: '10px', color: '#9CA3AF', marginTop: '10px',
                  fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  {card.label}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Two-column: Recent Sessions + Recent Matches ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>

          {/* Recent Sessions */}
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#111111' }}>Recent Sessions</span>
              <Link href="/training/sessions" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>View all →</Link>
            </div>
            {recentSessions.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: '13px', color: '#9CA3AF' }}>
                No sessions yet
              </div>
            ) : (
              recentSessions.map((s, i) => {
                const sp = (s as any).session_players as Array<{ attended: boolean }> ?? []
                const attended = sp.filter((p: { attended: boolean }) => p.attended).length
                const total = sp.length
                const sessionNum = sessions.length - i
                return (
                  <Link
                    key={s.id}
                    href={`/training/sessions/${s.id}`}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: '14px 20px', textDecoration: 'none',
                      borderBottom: i < recentSessions.length - 1 ? '1px solid #F3F4F6' : 'none',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#111111' }}>
                        Session {sessionNum}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                        {formatDate(s.date)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {total > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>{attended}/{total}</div>
                          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>attended</div>
                        </div>
                      )}
                      {s.age_group && (
                        <span style={{
                          background: '#111111', color: '#FFFFFF',
                          fontSize: '10px', fontWeight: 600,
                          padding: '2px 7px', borderRadius: '9999px',
                        }}>
                          {s.age_group}
                        </span>
                      )}
                      <span style={{ fontSize: '16px', color: '#D1D5DB' }}>›</span>
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          {/* Recent Matches */}
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#111111' }}>Recent Matches</span>
              <Link href="/performance/matches" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>View all →</Link>
            </div>
            {recentMatches.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: '13px', color: '#9CA3AF' }}>
                No matches yet
              </div>
            ) : (
              recentMatches.map((m, i) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const matchVei = (m as any).player_match_vei as Array<{ vei_index: number | null; is_valid: boolean }> ?? []
                const validVeis = matchVei.filter(r => r.is_valid && r.vei_index !== null).map(r => r.vei_index as number)
                const avgVei = validVeis.length > 0 ? mean(validVeis) : null
                const isGraded = validVeis.length > 0

                return (
                  <Link
                    key={m.id}
                    href={`/performance/matches/${m.id}`}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: '14px 20px', textDecoration: 'none',
                      borderBottom: i < recentMatches.length - 1 ? '1px solid #F3F4F6' : 'none',
                      gap: '10px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#111111' }}>
                          vs {m.opponent}
                        </span>
                        {m.home_away && (
                          <span style={{
                            fontSize: '10px', fontWeight: 600,
                            padding: '2px 7px', borderRadius: '9999px',
                            background: '#111111', color: '#FFFFFF',
                            textTransform: 'capitalize' as const, letterSpacing: '0.03em',
                          }}>
                            {m.home_away}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                        {formatDate(m.date)}{m.age_group ? ` · ${m.age_group}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {isGraded ? (
                        <>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#111111' }}>
                            {avgVei!.toFixed(1)}
                          </div>
                          <div style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            avg vei
                          </div>
                        </>
                      ) : (
                        <span style={{
                          fontSize: '11px', fontWeight: 500,
                          background: '#F3F4F6', color: '#6B7280',
                          padding: '2px 8px', borderRadius: '9999px',
                        }}>
                          Not graded
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '16px', color: '#D1D5DB', flexShrink: 0 }}>›</span>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* ── Top Players leaderboard ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111111', margin: 0 }}>Top Players</h2>
            <Link href="/performance/players" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>View all →</Link>
          </div>

          {topPlayers.length === 0 ? (
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
                No VEI data yet — grade a match to see top players
              </div>
            </div>
          ) : (
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
              {topPlayers.map((p, i) => {
                const color = avatarColor(p.name)
                return (
                  <Link key={p.id} href={`/performance/players/${p.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '16px 20px',
                      borderBottom: i < topPlayers.length - 1 ? '1px solid #E5E7EB' : 'none',
                      background: '#FFFFFF',
                    }}>
                      {/* Rank circle */}
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: '#F3F4F6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 600, color: '#6B7280',
                        flexShrink: 0,
                      }}>
                        {i + 1}
                      </div>

                      {/* Avatar */}
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: color, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: 700, color: '#FFFFFF',
                      }}>
                        {initials(p.name)}
                      </div>

                      {/* Name + position */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '14px', fontWeight: 600, color: '#111111',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {p.name}
                        </div>
                        {p.posGroup && (
                          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '1px' }}>{p.posGroup}</div>
                        )}
                      </div>

                      {/* VEI */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#111111', lineHeight: 1 }}>
                          {p.avgVei.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                          VEI
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
