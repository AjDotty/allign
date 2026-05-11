import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ReportCharts, { type TrendPoint, type RadarPoint } from './_components/ReportCharts'
import PrintButton from './_components/PrintButton'

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
function fmt1(n: number): string { return n.toFixed(1) }
function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Descriptions = { volume: string; efficiency: string; impact: string; overall: string }

// ─── AI report generation ─────────────────────────────────────────────────────

async function callAnthropicAPI(prompt: string): Promise<Descriptions | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const text = data.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('')
    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PlayerReportPage({
  params,
}: {
  params: Promise<{ playerId: string }>
}) {
  const { playerId } = await params
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
    { data: player },
    { data: veiMatchRows },
    { data: squadVeiData },
    { data: profileData },
    { data: orgSessions },
  ] = await Promise.all([
    supabase
      .from('players')
      .select('id, name, position_group, age_group, shirt_number')
      .eq('id', playerId)
      .single(),

    supabase
      .from('player_match_vei')
      .select('vei_index, volume_score, efficiency_score, impact_score, is_valid, match_id, matches(id, date, opponent)')
      .eq('player_id', playerId)
      .eq('is_valid', true)
      .not('vei_index', 'is', null),

    supabase
      .from('player_match_vei')
      .select('player_id, vei_index, position_group')
      .eq('organisation_id', organisationId)
      .eq('is_valid', true)
      .not('vei_index', 'is', null),

    supabase
      .from('player_profiles')
      .select('finisher_percentile, creator_percentile, progressor_percentile, disruptor_percentile, security_percentile')
      .eq('player_id', playerId)
      .maybeSingle(),

    supabase
      .from('sessions')
      .select('id')
      .eq('organisation_id', organisationId),
  ])

  if (!player) redirect('/reporting')

  // Attendance
  const sessionIds = (orgSessions ?? []).map(s => s.id)
  const { data: attendanceRows } = sessionIds.length > 0
    ? await supabase
        .from('session_players')
        .select('attended')
        .eq('player_id', playerId)
        .in('session_id', sessionIds)
    : { data: [] }

  // ── Compute player stats ────────────────────────────────────────────────────

  const validVeis = veiMatchRows ?? []

  // Sort by match date ascending for trend
  const sortedByDate = [...validVeis].sort((a, b) => {
    const aDate = (Array.isArray(a.matches) ? a.matches[0] : a.matches)?.date ?? ''
    const bDate = (Array.isArray(b.matches) ? b.matches[0] : b.matches)?.date ?? ''
    return aDate.localeCompare(bDate)
  })

  const avgVei    = mean(validVeis.map(r => r.vei_index as number))
  const avgVolume = mean(validVeis.map(r => r.volume_score as number).filter(Boolean))
  const avgEfficiency = mean(validVeis.map(r => r.efficiency_score as number).filter(Boolean))
  const avgImpact = mean(validVeis.map(r => r.impact_score as number).filter(Boolean))

  const matchesPlayed = new Set(validVeis.map(r => r.match_id)).size

  const attTotal    = (attendanceRows ?? []).length
  const attAttended = (attendanceRows ?? []).filter(r => r.attended).length
  const attendanceRate = attTotal > 0 ? Math.round((attAttended / attTotal) * 100) : 0

  // Squad & position stats
  const squadVeis = squadVeiData ?? []
  const squadAllVeis = squadVeis.map(r => r.vei_index as number)
  const squadAvg = mean(squadAllVeis)

  const positionVeis = squadVeis
    .filter(r => r.position_group === player.position_group)
    .map(r => r.vei_index as number)
  const positionAvg = mean(positionVeis)

  // Per-player avg for ranking
  const playerAvgMap: Record<string, number[]> = {}
  for (const r of squadVeis) {
    if (!playerAvgMap[r.player_id]) playerAvgMap[r.player_id] = []
    playerAvgMap[r.player_id].push(r.vei_index as number)
  }
  const sorted = Object.entries(playerAvgMap)
    .map(([id, vals]) => ({ id, avg: mean(vals) }))
    .sort((a, b) => b.avg - a.avg)
  const rank = sorted.findIndex(p => p.id === playerId) + 1
  const totalPlayers = sorted.length

  // Dimensions
  const dimensions = {
    finisher:   profileData?.finisher_percentile   ?? 50,
    creator:    profileData?.creator_percentile    ?? 50,
    progressor: profileData?.progressor_percentile ?? 50,
    disruptor:  profileData?.disruptor_percentile  ?? 50,
    security:   profileData?.security_percentile   ?? 50,
  }

  // ── Chart data ──────────────────────────────────────────────────────────────

  const trendData: TrendPoint[] = sortedByDate.map(r => {
    const m = Array.isArray(r.matches) ? r.matches[0] : r.matches
    const opponent = (m as any)?.opponent ?? '?'
    const date     = (m as any)?.date ?? ''
    return {
      label: opponent.length > 8 ? opponent.slice(0, 7) + '…' : opponent,
      vei: r.vei_index as number,
      opponent,
      date: date ? formatDate(date) : '',
    }
  })

  const radarData: RadarPoint[] = [
    { subject: 'Finisher',   value: dimensions.finisher   },
    { subject: 'Creator',    value: dimensions.creator    },
    { subject: 'Progressor', value: dimensions.progressor },
    { subject: 'Disruptor',  value: dimensions.disruptor  },
    { subject: 'Security',   value: dimensions.security   },
  ]

  // ── AI report ───────────────────────────────────────────────────────────────

  const aiPrompt = `You are a youth football coach writing a performance report for a parent.
Your tone is warm, honest, and encouraging — but you give real feedback.
If the data shows weaknesses, say so clearly but constructively.
Write like a thoughtful coach who genuinely cares about the player's development.
Avoid technical jargon — the parent may know nothing about football.
If you find yourself writing only positive things, re-read the data — there is almost always something to develop.

Player: ${player.name}, ${player.position_group ?? 'Unknown position'}, ${player.age_group ?? 'Unknown age group'}
Season data across all matches:

Avg VEI: ${fmt1(avgVei)}/10
- Avg Volume: ${fmt1(avgVolume)}/10 — how active and involved they were
- Avg Efficiency: ${fmt1(avgEfficiency)}/10 — quality of their actions
- Avg Impact: ${fmt1(avgImpact)}/10 — how much they influenced the game

Squad average VEI: ${fmt1(squadAvg)}
Position group average VEI: ${fmt1(positionAvg)}
Player rank in squad: ${rank || '—'} of ${totalPlayers || '—'}
Matches played: ${matchesPlayed}
Attendance rate: ${attendanceRate}%

Dimension percentile scores vs position group:
- Finisher: ${dimensions.finisher}th percentile
- Creator: ${dimensions.creator}th percentile
- Progressor: ${dimensions.progressor}th percentile
- Disruptor: ${dimensions.disruptor}th percentile
- Security: ${dimensions.security}th percentile

Scoring guidance:
- 7-10: Genuinely positive, highlight what's working
- 4-6: Balanced — acknowledge effort, identify what needs work
- Below 4: Honest but kind — name the issue, frame as development opportunity
- Bottom half of squad ranking: acknowledge it, focus on what to work on
- Top half: celebrate genuinely without overdoing it
- End each section with one forward-looking development sentence

Return ONLY valid JSON, no markdown backticks:
{"volume":"2-3 sentences","efficiency":"2-3 sentences","impact":"2-3 sentences","overall":"3-4 sentences honest summary comparing to team"}`

  // ── Report cache (7-day TTL) ─────────────────────────────────────────────────

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: cachedReport } = await supabase
    .from('reports')
    .select('descriptions, generated_at')
    .eq('player_id', playerId)
    .eq('organisation_id', organisationId)
    .gte('generated_at', sevenDaysAgo)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let descriptions: Descriptions | null = null

  if (cachedReport) {
    descriptions = cachedReport.descriptions as Descriptions
  } else {
    descriptions = await callAnthropicAPI(aiPrompt)
    if (descriptions) {
      await supabase.from('reports').insert({
        player_id: playerId,
        organisation_id: organisationId,
        descriptions,
        generated_at: new Date().toISOString(),
      })
    }
  }

  const color = avatarColor(player.name)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`@media print { nav, aside, button, .no-print { display: none !important; } }`}</style>

      <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>

          {/* Back + Print */}
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <Link href="/reporting" style={{ fontSize: '14px', color: '#6B7280', textDecoration: 'none' }}>
              ← Reporting
            </Link>
            <PrintButton />
          </div>

          {/* Player header */}
          <div style={{
            border: '1px solid #E5E7EB', borderRadius: '10px',
            padding: '24px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: '20px',
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: color, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 700, color: '#FFFFFF',
            }}>
              {initials(player.name)}
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111111', lineHeight: 1.1 }}>
                {player.name}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                {player.position_group && (
                  <span style={{
                    background: '#111111', color: '#FFFFFF',
                    fontSize: '11px', fontWeight: 600,
                    padding: '3px 10px', borderRadius: '9999px',
                  }}>
                    {player.position_group}
                  </span>
                )}
                {player.age_group && (
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>{player.age_group}</span>
                )}
              </div>
            </div>
          </div>

          {/* Season stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px', marginBottom: '16px',
          }}>
            {[
              { value: matchesPlayed || '—', label: 'Matches Played' },
              { value: matchesPlayed > 0 ? fmt1(avgVei) : '—', label: 'Avg VEI' },
              { value: attTotal > 0 ? `${attendanceRate}%` : '—', label: 'Attendance' },
              { value: rank > 0 ? `${rank} / ${totalPlayers}` : '—', label: 'Squad Rank' },
            ].map(stat => (
              <div key={stat.label} style={{
                border: '1px solid #E5E7EB', borderRadius: '10px',
                padding: '20px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#111111', lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: '10px', color: '#9CA3AF', marginTop: '8px',
                  textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500,
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <ReportCharts trendData={trendData} radarData={radarData} avgVei={avgVei} />

          {/* AI description cards */}
          {descriptions ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                {[
                  { label: 'Involvement', text: descriptions.volume },
                  { label: 'Quality', text: descriptions.efficiency },
                  { label: 'Impact', text: descriptions.impact },
                ].map(card => (
                  <div key={card.label} style={{
                    border: '1px solid #E5E7EB', borderRadius: '10px', padding: '20px',
                  }}>
                    <div style={{
                      fontSize: '10px', fontWeight: 600, color: '#9CA3AF',
                      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
                    }}>
                      {card.label}
                    </div>
                    <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.65, margin: 0 }}>
                      {card.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Overall summary */}
              <div style={{
                background: '#F9FAFB', border: '1px solid #E5E7EB',
                borderRadius: '10px', padding: '24px',
              }}>
                <div style={{
                  fontSize: '10px', fontWeight: 600, color: '#9CA3AF',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
                }}>
                  Overall Summary
                </div>
                <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7, margin: 0 }}>
                  {descriptions.overall}
                </p>
              </div>
            </>
          ) : (
            <div style={{
              border: '1px solid #E5E7EB', borderRadius: '10px',
              padding: '32px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#111111', marginBottom: '6px' }}>
                AI summary unavailable
              </div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                Set ANTHROPIC_API_KEY to enable AI-generated reports
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
