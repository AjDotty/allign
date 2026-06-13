import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PlayerTabs, {
  type VeiMatchRow,
  type EventStat,
  type PlayerProfile,
} from './_components/PlayerTabs'
import { type ComparePlayer } from './_components/CompareModal'
import { type Clip } from './_components/ClipsTab'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
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

function veiDotColor(vei: number | null, valid: boolean | null): string {
  if (!valid || vei === null) return '#D1D5DB'
  if (vei >= 6) return '#22C55E'
  if (vei >= 4) return '#F59E0B'
  return '#EF4444'
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: playerId } = await params
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
  const organisationId = orgMembership.organisation_id

  // Fetch org name
  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', organisationId)
    .single()

  // Fetch player
  const { data: player } = await supabase
    .from('players')
    .select('id, name, age_group, position_group, shirt_number')
    .eq('id', playerId)
    .single()

  if (!player) redirect('/performance/players')

  // Fetch this player's profile
  const { data: profileRow } = await supabase
    .from('player_profiles')
    .select('finisher, creator, progressor, disruptor, security, matches_included')
    .eq('player_id', playerId)
    .eq('organisation_id', organisationId)
    .single()

  // Fetch all player_match_vei rows for this player joined with matches
  const { data: veiData } = await supabase
    .from('player_match_vei')
    .select('match_id, vei_index, volume_score, efficiency_score, impact_score, is_valid, shotvol_rate, att3_rate, dribble_rate, goal_rate, bigchance_rate, hvdef_rate, hvdef_grade, pass_grade, carry_grade, matches(id, opponent, date, age_group)')
    .eq('player_id', playerId)

  // Fetch match_events for this player (include match_id for per-match deltas)
  const { data: eventsData } = await supabase
    .from('match_events')
    .select('match_id, event_type, grade, completed, is_goal')
    .eq('player_id', playerId)

  // Fetch clips for this player (events that have a clip_url)
  const { data: rawClips } = await supabase
    .from('match_events')
    .select('id, event_type, grade, clip_url, matches(id, opponent, date)')
    .eq('player_id', playerId)
    .not('clip_url', 'is', null)
    .order('created_at', { ascending: true })

  // Fetch all profiles in the org (for radar avg + leaderboard + compare)
  const { data: allProfilesData } = await supabase
    .from('player_profiles')
    .select('player_id, finisher, creator, progressor, disruptor, security, matches_included, players(id, name, position_group, shirt_number)')
    .eq('organisation_id', organisationId)

  // Fetch org-wide avg VEI per player for leaderboard (also used for position group ranking)
  const { data: orgVeiData } = await supabase
    .from('player_match_vei')
    .select('player_id, vei_index, volume_score, efficiency_score, impact_score, players(name, position_group)')
    .eq('organisation_id', organisationId)
    .eq('is_valid', true)

  // ── Process VEI rows ──────────────────────────────────────────────────────

  const matchRows: VeiMatchRow[] = (veiData ?? []).flatMap(row => {
    const matchArr = Array.isArray(row.matches) ? row.matches : row.matches ? [row.matches] : []
    const m = (matchArr[0] as any) ?? null
    if (!m) return []
    return [{
      matchId: m.id,
      opponent: m.opponent,
      date: m.date,
      ageGroup: m.age_group ?? null,
      veiIndex: row.vei_index,
      volumeScore: row.volume_score,
      efficiencyScore: row.efficiency_score,
      impactScore: row.impact_score,
      isValid: row.is_valid,
      shotvolRate: row.shotvol_rate ?? null,
      att3Rate: row.att3_rate ?? null,
      dribbleRate: row.dribble_rate ?? null,
      goalRate: row.goal_rate ?? null,
      bigchanceRate: row.bigchance_rate ?? null,
      hvdefRate: row.hvdef_rate ?? null,
      hvdefGrade: row.hvdef_grade ?? null,
      passGrade: row.pass_grade ?? null,
      carryGrade: row.carry_grade ?? null,
    }]
  }).sort((a, b) => b.date.localeCompare(a.date))

  const validRows = matchRows.filter(r => r.isValid && r.veiIndex !== null)
  const totalMatches = matchRows.length
  const avgVei = validRows.length > 0 ? mean(validRows.map(r => r.veiIndex as number)) : null
  const peakVei = validRows.length > 0 ? Math.max(...validRows.map(r => r.veiIndex as number)) : null
  const last5 = matchRows.slice(0, 5)

  // ── Profile ───────────────────────────────────────────────────────────────

  const profile: PlayerProfile | null = profileRow
    ? {
        finisher:        profileRow.finisher ?? 0,
        creator:         profileRow.creator ?? 0,
        progressor:      profileRow.progressor ?? 0,
        disruptor:       profileRow.disruptor ?? 0,
        security:        profileRow.security ?? 0,
        matchesIncluded: profileRow.matches_included ?? 0,
      }
    : null

  // ── Org avg profile (for radar comparison line) ───────────────────────────

  const orgProfiles = (allProfilesData ?? []).filter(p => {
    const arr = Array.isArray(p.players) ? p.players : p.players ? [p.players] : []
    const pl = (arr[0] as any)
    return pl?.position_group === player.position_group
  })

  const orgAvgProfile: PlayerProfile | null = orgProfiles.length > 0
    ? {
        finisher:        mean(orgProfiles.map(p => p.finisher ?? 0)),
        creator:         mean(orgProfiles.map(p => p.creator ?? 0)),
        progressor:      mean(orgProfiles.map(p => p.progressor ?? 0)),
        disruptor:       mean(orgProfiles.map(p => p.disruptor ?? 0)),
        security:        mean(orgProfiles.map(p => p.security ?? 0)),
        matchesIncluded: 0,
      }
    : null

  // ── Events ────────────────────────────────────────────────────────────────

  const eventGroups: Record<string, { grades: number[]; completed: number; total: number; goals: number }> = {}
  for (const ev of eventsData ?? []) {
    if (!eventGroups[ev.event_type]) {
      eventGroups[ev.event_type] = { grades: [], completed: 0, total: 0, goals: 0 }
    }
    eventGroups[ev.event_type].grades.push(ev.grade)
    eventGroups[ev.event_type].total++
    if (ev.completed) eventGroups[ev.event_type].completed++
    if (ev.is_goal) eventGroups[ev.event_type].goals++
  }

  const eventStats: EventStat[] = Object.entries(eventGroups)
    .map(([eventType, { grades, completed, total, goals }]) => ({
      eventType,
      attempts:       total,
      meanGrade:      mean(grades),
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      goals,
    }))
    .sort((a, b) => b.attempts - a.attempts)

  // ── Leaderboard ───────────────────────────────────────────────────────────

  const leaderAvgs: Record<string, { veis: number[]; name: string; posGroup: string | null }> = {}
  for (const row of orgVeiData ?? []) {
    const pArr = Array.isArray(row.players) ? row.players : row.players ? [row.players] : []
    const p = (pArr[0] as any)
    if (!leaderAvgs[row.player_id]) {
      leaderAvgs[row.player_id] = { veis: [], name: p?.name ?? 'Unknown', posGroup: p?.position_group ?? null }
    }
    leaderAvgs[row.player_id].veis.push(row.vei_index ?? 0)
  }

  const leaderboard = Object.entries(leaderAvgs)
    .map(([pid, { veis, name, posGroup }]) => ({ playerId: pid, playerName: name, avgVei: mean(veis), positionGroup: posGroup }))
    .sort((a, b) => b.avgVei - a.avgVei)
    .slice(0, 10)

  // ── Squad ranking (overall, by avg VEI) ──────────────────────────────────
  const squadRanked = Object.entries(leaderAvgs)
    .map(([pid, { veis }]) => ({ playerId: pid, avg: mean(veis) }))
    .sort((a, b) => b.avg - a.avg)

  const positionGroupRank = squadRanked.findIndex(r => r.playerId === playerId) + 1 || null
  const positionGroupTotal = squadRanked.length

  // ── Squad averages (for squad avg row in match table) ─────────────────────
  const squadAvg = (() => {
    const rows = orgVeiData ?? []
    const veis = rows.map(r => r.vei_index).filter((v): v is number => v !== null)
    const vols = rows.map(r => r.volume_score).filter((v): v is number => v !== null)
    const effs = rows.map(r => r.efficiency_score).filter((v): v is number => v !== null)
    const imps = rows.map(r => r.impact_score).filter((v): v is number => v !== null)
    return {
      vei:        veis.length > 0 ? veis.reduce((a, b) => a + b, 0) / veis.length : null,
      volume:     vols.length > 0 ? vols.reduce((a, b) => a + b, 0) / vols.length : null,
      efficiency: effs.length > 0 ? effs.reduce((a, b) => a + b, 0) / effs.length : null,
      impact:     imps.length > 0 ? imps.reduce((a, b) => a + b, 0) / imps.length : null,
    }
  })()

  // ── Badges ────────────────────────────────────────────────────────────────

  const badges: string[] = []

  // MOTM: check if this player had the highest VEI in any single match
  const allMatchMaxVei: Record<string, number> = {}
  for (const row of orgVeiData ?? []) {
    if (!allMatchMaxVei[row.player_id] || (row.vei_index ?? 0) > allMatchMaxVei[row.player_id]) {
      // We'd need match_id here — simplified: check if peak VEI is the top in org
    }
  }
  if (peakVei !== null && orgVeiData && orgVeiData.length > 0) {
    const orgPeak = Math.max(...(orgVeiData.map(r => r.vei_index ?? 0)))
    if (peakVei >= orgPeak * 0.98) badges.push('MOTM')
  }

  // Clinical: top shot_grade in org (use profile comparisons)
  if (profile && orgProfiles.length > 1) {
    const topFinisher = [...orgProfiles].sort((a, b) => (b.finisher ?? 0) - (a.finisher ?? 0))[0]
    const topFinisherArr = Array.isArray(topFinisher.players) ? topFinisher.players : topFinisher.players ? [topFinisher.players] : []
    if ((topFinisherArr[0] as any)?.id === playerId) badges.push('Clinical')
  }

  // Top Creator
  if (profile && orgProfiles.length > 1) {
    const topCreator = [...orgProfiles].sort((a, b) => (b.creator ?? 0) - (a.creator ?? 0))[0]
    const topCreatorArr = Array.isArray(topCreator.players) ? topCreator.players : topCreator.players ? [topCreator.players] : []
    if ((topCreatorArr[0] as any)?.id === playerId) badges.push('Top Creator')
  }

  // ── Peers (for compare modal) ─────────────────────────────────────────────

  const peers: ComparePlayer[] = (allProfilesData ?? [])
    .flatMap(p => {
      const arr = Array.isArray(p.players) ? p.players : p.players ? [p.players] : []
      const pl = (arr[0] as any)
      if (!pl || pl.id === playerId) return []
      return [{
        playerId:      pl.id,
        playerName:    pl.name,
        positionGroup: pl.position_group ?? null,
        profile: {
          finisher:   p.finisher ?? 0,
          creator:    p.creator ?? 0,
          progressor: p.progressor ?? 0,
          disruptor:  p.disruptor ?? 0,
          security:   p.security ?? 0,
        },
        avgVei: leaderAvgs[pl.id] ? mean(leaderAvgs[pl.id].veis) : null,
      }]
    })

  const currentPlayerCompare: ComparePlayer = {
    playerId,
    playerName:    player.name,
    positionGroup: player.position_group ?? null,
    profile,
    avgVei,
  }

  // ── Clips ─────────────────────────────────────────────────────────────────

  const clips: Clip[] = (rawClips ?? []).flatMap(row => {
    const mArr = Array.isArray(row.matches) ? row.matches : row.matches ? [row.matches] : []
    const m = (mArr[0] as any) ?? null
    if (!m || !row.clip_url) return []
    return [{
      id:            row.id,
      event_type:    row.event_type,
      grade:         row.grade ?? 0,
      clip_url:      row.clip_url,
      matchId:       m.id,
      matchOpponent: m.opponent,
      matchDate:     m.date,
    }]
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  const color = avatarColor(player.name)
  const orgName = org?.name ?? 'Organisation'

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Back */}
        <div style={{ marginBottom: '20px' }}>
          <Link href="/performance/matches" style={{ fontSize: '14px', color: '#6B7280', textDecoration: 'none' }}>
            ← Back to Matches
          </Link>
        </div>

        <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

          {/* ── Left column ── */}
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>

            {/* Player header card */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '24px', background: '#FFFFFF', marginBottom: '16px' }}>

              {/* Top row: avatar + info + VEI score */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '16px' }}>
                {/* Avatar with coloured ring + rank badge */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', fontWeight: 700, color: '#FFFFFF',
                    outline: avgVei === null ? 'none'
                      : avgVei >= 6 ? '4px solid #16A34A'
                      : avgVei >= 3 ? '4px solid #D97706'
                      : '4px solid #DC2626',
                    outlineOffset: '3px',
                  }}>
                    {initials(player.name)}
                  </div>
                  {positionGroupRank !== null && positionGroupRank <= 3 && (
                    <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', background: '#111111', color: '#FFFFFF', borderRadius: '9999px', fontSize: '9px', fontWeight: 700, padding: '2px 5px', letterSpacing: '0.02em' }}>
                      {ordinal(positionGroupRank)}
                    </div>
                  )}
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111111', margin: 0, lineHeight: 1.1 }}>
                      {player.name}
                    </h1>
                    {player.shirt_number != null && (
                      <span style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: 500 }}>#{player.shirt_number}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                    {orgName}{player.position_group ? ` · ${player.position_group}` : ''}
                    {player.age_group ? ` · ${player.age_group}` : ''}
                  </div>
                </div>

                {/* VEI score */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: '48px', fontWeight: 700, color: '#111111', lineHeight: 1 }}>
                    {avgVei !== null ? avgVei.toFixed(1) : '—'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '5px' }}>
                    {avgVei === null ? 'Avg VEI'
                      : avgVei >= 8 ? 'Extravagant'
                      : avgVei >= 6 ? 'Above'
                      : avgVei >= 4 ? 'Expected'
                      : 'Well Below'}
                  </div>
                </div>
              </div>

              {/* Form dots + badges row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                {/* Form */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Form</span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {Array.from({ length: 5 }).map((_, i) => {
                      const row = last5[i]
                      return (
                        <div
                          key={i}
                          title={row ? `${row.opponent}: ${row.veiIndex?.toFixed(1) ?? 'n/a'}` : 'No match'}
                          style={{ width: '10px', height: '10px', borderRadius: '50%', background: row ? veiDotColor(row.veiIndex, row.isValid) : '#F3F4F6' }}
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Badges */}
                {badges.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {badges.map(b => (
                      <span key={b} style={{ background: '#111111', color: '#FFFFFF', fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '9999px', letterSpacing: '0.02em' }}>
                        {b === 'MOTM' ? '🏆 MOTM' : b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tabs card */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '24px', background: '#FFFFFF' }}>
              <PlayerTabs
                matchRows={matchRows}
                eventStats={eventStats}
                profile={profile}
                orgAvgProfile={orgAvgProfile}
                totalMatches={totalMatches}
                avgVei={avgVei}
                peakVei={peakVei}
                positionGroupRank={positionGroupRank}
                positionGroupTotal={positionGroupTotal}
                peers={peers}
                currentPlayer={currentPlayerCompare}
                clips={clips}
                squadAvg={squadAvg}
              />
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '24px' }}>

            {/* Black stats block */}
            <div style={{ background: '#111111', color: '#FFFFFF', borderRadius: '10px', padding: '24px', marginBottom: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                {[
                  { value: leaderboard.length > 0 ? String(leaderboard.length) : '—', label: 'Players' },
                  { value: String(eventStats.reduce((sum, e) => sum + e.goals, 0)), label: 'Goals' },
                  { value: avgVei !== null ? avgVei.toFixed(1) : '—', label: 'Avg VEI' },
                  { value: peakVei !== null ? peakVei.toFixed(1) : '—', label: 'Peak VEI' },
                ].map(({ value, label }) => (
                  <div key={label}>
                    <div style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Sub-score bars */}
              {profile && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                  {[
                    { label: 'Finisher',   value: profile.finisher,   color: '#EF4444' },
                    { label: 'Creator',    value: profile.creator,    color: '#3B82F6' },
                    { label: 'Progressor', value: profile.progressor, color: '#22C55E' },
                    { label: 'Disruptor',  value: profile.disruptor,  color: '#F59E0B' },
                    { label: 'Security',   value: profile.security,   color: '#8B5CF6' },
                  ].map(({ label, value, color: barColor }) => (
                    <div key={label} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                        <span style={{ fontSize: '11px', color: '#FFFFFF', fontWeight: 600 }}>{Math.round(value)}</span>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: barColor, borderRadius: '9999px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', background: '#FFFFFF', marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>Season Rankings</span>
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Avg VEI</span>
                </div>
                {leaderboard.map((entry, i) => {
                  const isCurrent = entry.playerId === playerId
                  return (
                    <Link
                      key={entry.playerId}
                      href={`/performance/players/${entry.playerId}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 16px', textDecoration: 'none',
                        background: isCurrent ? '#F9FAFB' : '#FFFFFF',
                        borderBottom: i < leaderboard.length - 1 ? '1px solid #F9FAFB' : 'none',
                        borderLeft: isCurrent ? '3px solid #111111' : '3px solid transparent',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#9CA3AF', width: '18px', flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: avatarColor(entry.playerName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}>
                        {initials(entry.playerName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: isCurrent ? 700 : 500, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.playerName}
                        </div>
                        {entry.positionGroup && (
                          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{entry.positionGroup}</div>
                        )}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: isCurrent ? '#111111' : '#6B7280', flexShrink: 0 }}>
                        {entry.avgVei.toFixed(1)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Quick links */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '16px 20px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Quick Links</div>
              <Link href="/performance/matches" style={{ fontSize: '13px', color: '#111111', textDecoration: 'none', fontWeight: 500 }}>
                View all matches →
              </Link>
              <Link href="/training/sessions" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>
                Book a session
              </Link>
              <a href="https://allign.app" target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>
                About Allign analytics
              </a>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
