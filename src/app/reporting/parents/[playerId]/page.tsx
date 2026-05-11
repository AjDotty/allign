import { createServiceClient } from '@/lib/supabase/service'

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
function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function veiDotColor(vei: number): string {
  if (vei >= 6) return '#16A34A'
  if (vei >= 3) return '#D97706'
  return '#DC2626'
}

// ─── AI ───────────────────────────────────────────────────────────────────────

async function getOverallSummary(prompt: string): Promise<string | null> {
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
        max_tokens: 400,
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
    const parsed = JSON.parse(clean)
    return parsed.overall ?? null
  } catch {
    return null
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ParentsReportPage({
  params,
}: {
  params: Promise<{ playerId: string }>
}) {
  const { playerId } = await params
  const supabase = createServiceClient()

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const [
    { data: player },
    { data: veiRows },
  ] = await Promise.all([
    supabase
      .from('players')
      .select('id, name, position_group, age_group, home_organisation_id')
      .eq('id', playerId)
      .single(),

    supabase
      .from('player_match_vei')
      .select('vei_index, is_valid, match_id, matches(id, date, opponent)')
      .eq('player_id', playerId)
      .eq('is_valid', true)
      .not('vei_index', 'is', null),
  ])

  // This month attendance
  const now = new Date()
  const thisMonthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`

  let attendanceRate: number | null = null
  if (player?.home_organisation_id) {
    const { data: thisMonthSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('organisation_id', player.home_organisation_id)
      .gte('date', thisMonthStart)

    const thisMonthIds = (thisMonthSessions ?? []).map(s => s.id)

    if (thisMonthIds.length > 0) {
      const { data: attRows } = await supabase
        .from('session_players')
        .select('attended')
        .eq('player_id', playerId)
        .in('session_id', thisMonthIds)

      const total = (attRows ?? []).length
      const attended = (attRows ?? []).filter(r => r.attended).length
      attendanceRate = total > 0 ? Math.round((attended / total) * 100) : null
    }
  }

  // ── Derive stats ────────────────────────────────────────────────────────────

  // Sort all VEI rows by match date
  const sortedVei = [...(veiRows ?? [])].sort((a, b) => {
    const aDate = ((Array.isArray(a.matches) ? a.matches[0] : a.matches) as any)?.date ?? ''
    const bDate = ((Array.isArray(b.matches) ? b.matches[0] : b.matches) as any)?.date ?? ''
    return bDate.localeCompare(aDate) // desc — most recent first
  })

  const last5 = sortedVei.slice(0, 5)
  const last3 = sortedVei.slice(0, 3)
  const avgVei = sortedVei.length > 0 ? mean(sortedVei.map(r => r.vei_index as number)) : null

  // Form dots — always 5, padded
  const formDots = Array.from({ length: 5 }).map((_, i) => last5[i] ?? null)

  // ── AI summary ──────────────────────────────────────────────────────────────

  // ── Report cache (7-day TTL) ────────────────────────────────────────────────

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let overall: string | null = null

  if (player) {
    const { data: cachedReport } = await supabase
      .from('reports')
      .select('descriptions')
      .eq('player_id', playerId)
      .gte('generated_at', sevenDaysAgo)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const cachedOverall = (cachedReport?.descriptions as any)?.overall ?? null

    if (cachedOverall) {
      overall = cachedOverall
    } else {
      const aiPrompt = `You are a youth football coach writing a brief performance note for a parent.
Tone: warm, honest, and encouraging. Give real feedback — not just praise.
Parent may have no football knowledge.

Player: ${player.name}, ${player.position_group ?? 'Unknown position'}, ${player.age_group ?? 'Unknown'}
Recent matches: ${sortedVei.length}
Avg VEI: ${avgVei !== null ? avgVei.toFixed(1) : '0'}/10
Attendance this month: ${attendanceRate !== null ? `${attendanceRate}%` : 'no data'}

Return ONLY valid JSON, no markdown:
{"overall":"3-4 sentence honest summary of the player's recent form and one thing to focus on"}`

      const generated = await getOverallSummary(aiPrompt)
      if (generated) {
        overall = generated
        await supabase.from('reports').insert({
          player_id: playerId,
          organisation_id: player.home_organisation_id,
          descriptions: { overall: generated },
          generated_at: new Date().toISOString(),
        })
      }
    }
  }

  const color = player ? avatarColor(player.name) : '#6B7280'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 16px 64px' }}>

        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#111111', lineHeight: 1 }}>Allign</div>
          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>by Dottedline</div>
        </div>

        {!player ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#111111', marginBottom: '8px' }}>
              Report not found
            </div>
            <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
              This link may be invalid or the player may have been removed.
            </div>
          </div>
        ) : (
          <>
            {/* Player header */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: color, margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', fontWeight: 700, color: '#FFFFFF',
              }}>
                {initials(player.name)}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111111', marginBottom: '6px' }}>
                {player.name}
              </div>
              <div style={{ fontSize: '14px', color: '#6B7280' }}>
                {[player.position_group, player.age_group].filter(Boolean).join(' · ')}
              </div>
            </div>

            {/* Form dots */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{
                fontSize: '10px', fontWeight: 500, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.12em',
                textAlign: 'center', marginBottom: '10px',
              }}>
                Recent Form
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                {formDots.map((dot, i) => (
                  <div
                    key={i}
                    title={dot ? `${(dot.vei_index as number).toFixed(1)} VEI` : 'No data'}
                    style={{
                      width: '14px', height: '14px', borderRadius: '50%',
                      background: dot ? veiDotColor(dot.vei_index as number) : 'transparent',
                      border: dot ? 'none' : '1.5px solid #D1D5DB',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Last 3 matches */}
            {last3.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <div style={{
                  fontSize: '10px', fontWeight: 500, color: '#9CA3AF',
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  marginBottom: '10px',
                }}>
                  Last {last3.length} Match{last3.length !== 1 ? 'es' : ''}
                </div>
                <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
                  {last3.map((row, i) => {
                    const m = (Array.isArray(row.matches) ? row.matches[0] : row.matches) as any
                    const vei = row.vei_index as number
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '14px 16px',
                          borderBottom: i < last3.length - 1 ? '1px solid #E5E7EB' : 'none',
                        }}
                      >
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: veiDotColor(vei), flexShrink: 0,
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: '#111111' }}>
                            vs {m?.opponent ?? '—'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '1px' }}>
                            {m?.date ? formatDate(m.date) : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#111111', lineHeight: 1 }}>
                            {vei.toFixed(1)}
                          </div>
                          <div style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>VEI</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Attendance this month */}
            {attendanceRate !== null && (
              <div style={{
                border: '1px solid #E5E7EB', borderRadius: '10px',
                padding: '20px', marginBottom: '32px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ fontSize: '13px', color: '#6B7280' }}>Attendance this month</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#111111' }}>{attendanceRate}%</div>
              </div>
            )}

            {/* AI overall summary */}
            <div style={{
              background: '#F9FAFB', border: '1px solid #E5E7EB',
              borderRadius: '10px', padding: '24px', marginBottom: '48px',
            }}>
              <div style={{
                fontSize: '10px', fontWeight: 500, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '12px',
              }}>
                Coach's Assessment
              </div>
              <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7, margin: 0 }}>
                {overall ?? 'Assessment unavailable — check back after the next match.'}
              </p>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '13px', color: '#9CA3AF' }}>
              Questions?{' '}
              <a
                href="mailto:coach@example.com"
                style={{ color: '#6B7280', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              >
                Contact your coach
              </a>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
