import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ShareButton from './_components/ShareButton'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
function mean(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members').select('id').eq('user_id', user.id).single()

  const { data: orgMembership } = member
    ? await supabase.from('organisation_members')
        .select('organisation_id').eq('member_id', member.id).single()
    : { data: null }

  if (!orgMembership?.organisation_id) redirect('/')
  const organisationId = orgMembership.organisation_id

  // ── Parallel fetches ────────────────────────────────────────────────────────

  const [
    { data: rawPlayers },
    { data: veiData },
  ] = await Promise.all([
    supabase
      .from('players')
      .select('id, name, position_group, age_group, shirt_number')
      .eq('home_organisation_id', organisationId)
      .order('name'),

    supabase
      .from('player_match_vei')
      .select('player_id, vei_index, match_id')
      .eq('organisation_id', organisationId)
      .eq('is_valid', true)
      .not('vei_index', 'is', null),
  ])

  const players = rawPlayers ?? []
  const playerIds = players.map(p => p.id)

  // Attendance — sequential (needs session IDs first)
  const { data: orgSessions } = playerIds.length > 0
    ? await supabase.from('sessions').select('id').eq('organisation_id', organisationId)
    : { data: [] }

  const sessionIds = (orgSessions ?? []).map(s => s.id)

  const { data: attendanceRows } = sessionIds.length > 0
    ? await supabase
        .from('session_players')
        .select('player_id, attended')
        .in('session_id', sessionIds)
        .in('player_id', playerIds)
    : { data: [] }

  // ── Aggregate per player ────────────────────────────────────────────────────

  const veiByPlayer: Record<string, { veis: number[]; matches: Set<string> }> = {}
  for (const row of veiData ?? []) {
    if (!veiByPlayer[row.player_id]) veiByPlayer[row.player_id] = { veis: [], matches: new Set() }
    veiByPlayer[row.player_id].veis.push(row.vei_index as number)
    veiByPlayer[row.player_id].matches.add(row.match_id)
  }

  const attendByPlayer: Record<string, { total: number; attended: number }> = {}
  for (const row of attendanceRows ?? []) {
    if (!attendByPlayer[row.player_id]) attendByPlayer[row.player_id] = { total: 0, attended: 0 }
    attendByPlayer[row.player_id].total++
    if (row.attended) attendByPlayer[row.player_id].attended++
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 700, color: '#111111', margin: 0 }}>Reporting</h1>
          <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '6px' }}>
            Player performance reports
          </div>
        </div>

        {players.length === 0 ? (
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#111111', marginBottom: '6px' }}>No players registered</div>
            <div style={{ fontSize: '12px', color: '#9CA3AF' }}>Add players to your organisation to generate reports</div>
          </div>
        ) : (
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 90px 90px 140px 140px',
              gap: '12px', padding: '12px 20px',
              borderBottom: '1px solid #E5E7EB',
              background: '#F9FAFB',
            }}>
              {['Player', 'Avg VEI', 'Matches', 'Attendance', '', ''].map((h, i) => (
                <div key={i} style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Player rows */}
            {players.map((player, idx) => {
              const vei = veiByPlayer[player.id]
              const avgVei = vei ? mean(vei.veis) : null
              const matchesPlayed = vei ? vei.matches.size : 0
              const att = attendByPlayer[player.id]
              const attendanceRate = att && att.total > 0
                ? Math.round((att.attended / att.total) * 100)
                : null
              const color = avatarColor(player.name)

              return (
                <div
                  key={player.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 90px 90px 140px 140px',
                    gap: '12px', padding: '16px 20px',
                    alignItems: 'center',
                    borderBottom: idx < players.length - 1 ? '1px solid #E5E7EB' : 'none',
                  }}
                >
                  {/* Player info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: color, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700, color: '#FFFFFF',
                    }}>
                      {initials(player.name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px', fontWeight: 600, color: '#111111',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {player.name}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                        {player.position_group && (
                          <span style={{
                            background: '#111111', color: '#FFFFFF',
                            fontSize: '10px', fontWeight: 600,
                            padding: '1px 7px', borderRadius: '9999px',
                          }}>
                            {player.position_group}
                          </span>
                        )}
                        {player.age_group && (
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{player.age_group}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Avg VEI */}
                  <div>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#111111' }}>
                      {avgVei !== null ? avgVei.toFixed(1) : '—'}
                    </span>
                  </div>

                  {/* Matches */}
                  <div style={{ fontSize: '14px', color: '#111111', fontWeight: 500 }}>
                    {matchesPlayed > 0 ? matchesPlayed : '—'}
                  </div>

                  {/* Attendance */}
                  <div style={{ fontSize: '14px', color: '#111111', fontWeight: 500 }}>
                    {attendanceRate !== null ? `${attendanceRate}%` : '—'}
                  </div>

                  {/* View Report */}
                  <div>
                    <Link href={`/reporting/${player.id}`} style={{ textDecoration: 'none' }}>
                      <button type="button" style={{
                        background: '#111111', color: '#FFFFFF',
                        border: 'none', borderRadius: '8px',
                        padding: '8px 14px', fontSize: '13px', fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                        whiteSpace: 'nowrap',
                      }}>
                        View Report
                      </button>
                    </Link>
                  </div>

                  {/* Share */}
                  <div>
                    <ShareButton playerId={player.id} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
