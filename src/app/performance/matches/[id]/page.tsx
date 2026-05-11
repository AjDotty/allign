import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MatchTabs, { type VeiRow } from './_components/MatchTabs'
import { type EventItem } from './_components/MatchEventList'
import MetricaDownloadButton from '../_components/MetricaDownloadButton'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: matchId } = await params
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members').select('id').eq('user_id', user.id).single()

  const { data: orgMembership } = member
    ? await supabase.from('organisation_members')
        .select('organisation_id').eq('member_id', member.id).single()
    : { data: null }

  if (!orgMembership?.organisation_id) redirect('/performance/matches')

  // Fetch match
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, opponent, date, age_group, venue, home_away, format, duration_minutes, organisation_id')
    .eq('id', matchId)
    .single()

  console.log('[match-detail] matchId:', matchId)
  console.log('[match-detail] match:', match)
  console.log('[match-detail] matchError:', matchError)
  console.log('[match-detail] orgId:', orgMembership.organisation_id)
  console.log('[match-detail] match.organisation_id:', match?.organisation_id)

  if (!match) redirect('/performance/matches')
  if (match.organisation_id !== orgMembership.organisation_id) redirect('/performance/matches')

  // Fetch VEI rows joined with players
  const { data: veiData } = await supabase
    .from('player_match_vei')
    .select('player_id, position_group, volume_score, efficiency_score, impact_score, vei_index, is_valid, invalid_reason, players(id, name, shirt_number)')
    .eq('match_id', matchId)
    .order('vei_index', { ascending: false })

  // Fetch lineups for squad count
  const { count: squadCount } = await supabase
    .from('match_lineups')
    .select('*', { count: 'exact', head: true })
    .eq('match_id', matchId)

  // Fetch events joined with players
  const { data: eventsData } = await supabase
    .from('match_events')
    .select('id, player_id, event_type, event_sub_category, grade, completed, clip_url, players(id, name, shirt_number)')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })

  // ── Process VEI rows ───────────────────────────────────────────────────────

  const veiRows: VeiRow[] = (veiData ?? []).map(row => {
    const arr = Array.isArray(row.players) ? row.players : row.players ? [row.players] : []
    const p = (arr[0] as any) ?? null
    return {
      player_id: row.player_id,
      playerName: p?.name ?? 'Unknown',
      shirtNumber: p?.shirt_number ?? null,
      positionGroup: row.position_group,
      volumeScore: row.volume_score,
      efficiencyScore: row.efficiency_score,
      impactScore: row.impact_score,
      veiIndex: row.vei_index,
      isValid: row.is_valid,
      invalidReason: row.invalid_reason,
    }
  })

  // ── Process events ─────────────────────────────────────────────────────────

  const events: EventItem[] = (eventsData ?? []).map(row => {
    const arr = Array.isArray(row.players) ? row.players : row.players ? [row.players] : []
    const p = (arr[0] as any) ?? null
    return {
      id: row.id,
      playerId: row.player_id,
      playerName: p?.name ?? 'Unknown',
      eventType: row.event_type,
      subCategory: row.event_sub_category,
      grade: row.grade,
      completed: row.completed,
      clipUrl: row.clip_url,
    }
  })

  // ── Sidebar stats ──────────────────────────────────────────────────────────

  const totalGraded = veiRows.length
  const validRows = veiRows.filter(r => r.isValid && r.veiIndex !== null)
  const avgVei = validRows.length > 0
    ? mean(validRows.map(r => r.veiIndex as number)).toFixed(1)
    : '—'
  const highestVei = validRows.length > 0
    ? (validRows[0].veiIndex as number).toFixed(1)
    : '—'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: '#FFFFFF', minHeight: '100vh',
      fontFamily: 'Inter, sans-serif', padding: '32px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Back link */}
        <div style={{ marginBottom: '20px' }}>
          <Link href="/performance/matches" style={{
            fontSize: '14px', color: '#6B7280', textDecoration: 'none',
          }}>
            ← All Matches
          </Link>
        </div>

        <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

          {/* ── Left column ── */}
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>

            {/* Match header card */}
            <div style={{
              border: '1px solid #E5E7EB', borderRadius: '10px',
              padding: '24px', background: '#FFFFFF', marginBottom: '16px',
            }}>
              {/* Title row */}
              <div style={{
                borderBottom: '1px solid #E5E7EB',
                paddingBottom: '24px', marginBottom: '24px',
              }}>
                <div style={{ fontSize: '30px', fontWeight: 700, color: '#111111', lineHeight: 1.1 }}>
                  {match.opponent}
                </div>
              </div>

              {/* Date + competition */}
              <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px' }}>
                {formatDate(match.date)}
                {match.age_group && <> · {match.age_group}</>}
              </div>

              {/* Meta pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                {match.home_away && (
                  <span style={{
                    background: '#111111', color: '#FFFFFF',
                    fontSize: '11px', fontWeight: 500,
                    padding: '3px 8px', borderRadius: '9999px',
                  }}>
                    {match.home_away.charAt(0).toUpperCase() + match.home_away.slice(1)}
                  </span>
                )}
                {match.format && (
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>{match.format}</span>
                )}
                {match.duration_minutes && (
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>
                    {match.duration_minutes} min
                  </span>
                )}
                {match.venue && (
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>{match.venue}</span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div style={{
              border: '1px solid #E5E7EB', borderRadius: '10px',
              padding: '24px', background: '#FFFFFF',
            }}>
              <MatchTabs matchId={matchId} veiRows={veiRows} events={events} />
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '24px' }}>

            {/* Stats block */}
            <div style={{
              background: '#111111', color: '#FFFFFF',
              borderRadius: '10px', padding: '24px', marginBottom: '12px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>
                    {totalGraded}
                  </div>
                  <div style={{
                    fontSize: '11px', color: '#9CA3AF', marginTop: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    Players Graded
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>
                    {squadCount ?? 0}
                  </div>
                  <div style={{
                    fontSize: '11px', color: '#9CA3AF', marginTop: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    Squad Size
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1 }}>{avgVei}</div>
                  <div style={{
                    fontSize: '11px', color: '#9CA3AF', marginTop: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    Avg VEI
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1 }}>{highestVei}</div>
                  <div style={{
                    fontSize: '11px', color: '#9CA3AF', marginTop: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    Top VEI
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{
              border: '1px solid #E5E7EB', borderRadius: '10px',
              padding: '20px', background: '#FFFFFF',
              display: 'flex', flexDirection: 'column', gap: '10px',
            }}>
              <Link href={`/performance/matches/${matchId}/grade`} style={{ textDecoration: 'none' }}>
                <button type="button" style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  background: '#111111', color: '#FFFFFF', border: 'none',
                  borderRadius: '8px', padding: '11px',
                  fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Grade Events
                </button>
              </Link>

              <Link href={`/performance/matches/${matchId}/import`} style={{ textDecoration: 'none' }}>
                <button type="button" style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  background: '#FFFFFF', color: '#111111',
                  border: '1px solid #E5E7EB', borderRadius: '8px', padding: '11px',
                  fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Import Events
                </button>
              </Link>

              <MetricaDownloadButton
                matchId={matchId}
                opponent={match.opponent}
                date={match.date}
                ageGroup={match.age_group}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
