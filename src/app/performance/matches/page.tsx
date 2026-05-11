import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FilterableMatchList, { type Match } from './_components/FilterableMatchList'

export default async function MatchesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resolve member → organisation
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const { data: orgMembership } = member
    ? await supabase
        .from('organisation_members')
        .select('organisation_id, role')
        .eq('member_id', member.id)
        .single()
    : { data: null }

  if (!orgMembership?.organisation_id) redirect('/training/sessions')

  const organisationId = orgMembership.organisation_id

  // Fetch matches with lineup count and VEI graded status
  const { data: rawMatches } = await supabase
    .from('matches')
    .select('id, date, opponent, venue, home_away, age_group, format, duration_minutes, notes, match_lineups(count), player_match_vei(count)')
    .eq('organisation_id', organisationId)
    .order('date', { ascending: false })

  const matches: Match[] = (rawMatches ?? []).map(m => ({
    id: m.id,
    date: m.date,
    opponent: m.opponent,
    venue: m.venue,
    home_away: m.home_away,
    age_group: m.age_group,
    format: m.format,
    duration_minutes: m.duration_minutes,
    notes: m.notes,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player_count: (m.match_lineups as any)?.[0]?.count ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    is_graded: ((m.player_match_vei as any)?.[0]?.count ?? 0) > 0,
  }))

  // ── Sidebar stats ──────────────────────────────────────────────────────────

  const now = new Date()
  const thisYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const matchesThisMonth = matches.filter(m => m.date.startsWith(thisYearMonth)).length

  const totalPlayers = matches.reduce((sum, m) => sum + m.player_count, 0)

  const ageCounts: Record<string, number> = {}
  for (const m of matches) {
    if (m.age_group) ageCounts[m.age_group] = (ageCounts[m.age_group] ?? 0) + 1
  }
  const topAgeGroup = Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: '#FFFFFF', minHeight: '100vh',
      fontFamily: 'Inter, sans-serif', padding: '32px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

          {/* ── Left column ── */}
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>

            {/* Page header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', marginBottom: '24px',
            }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111111', margin: 0 }}>
                  Matches
                </h1>
                <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0' }}>
                  Performance data for your academy
                </p>
              </div>
              <Link href="/performance/matches/new" style={{ textDecoration: 'none' }}>
                <button type="button" style={{
                  background: '#111111', color: '#FFFFFF', border: 'none',
                  borderRadius: '8px', padding: '10px 18px',
                  fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  New Match
                </button>
              </Link>
            </div>

            <FilterableMatchList matches={matches} />
          </div>

          {/* ── Right sidebar ── */}
          <div style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '24px' }}>

            {/* Stats block */}
            <div style={{
              background: '#111111', color: '#FFFFFF',
              borderRadius: '10px', padding: '24px', marginBottom: '12px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>{matchesThisMonth}</div>
                  <div style={{
                    fontSize: '11px', color: '#9CA3AF', marginTop: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    This Month
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>{totalPlayers}</div>
                  <div style={{
                    fontSize: '11px', color: '#9CA3AF', marginTop: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    Players Logged
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1 }}>{topAgeGroup}</div>
                <div style={{
                  fontSize: '11px', color: '#9CA3AF', marginTop: '6px',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  Top Age Group
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div style={{
              border: '1px solid #E5E7EB', borderRadius: '10px',
              padding: '24px', background: '#FFFFFF',
            }}>
              <p style={{
                fontSize: '11px', fontWeight: 600, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px 0',
              }}>
                Quick Links
              </p>
              {[
                { label: 'New Match', href: '/performance/matches/new' },
                { label: 'Player Rankings', href: '/performance/players' },
              ].map(({ label, href }) => (
                <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid #F3F4F6',
                  }}>
                    <span style={{ fontSize: '14px', color: '#111111', fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: '16px', color: '#9CA3AF' }}>›</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
