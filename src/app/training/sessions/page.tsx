import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FilterableSessionList, { type Session, type CoachMap } from './_components/FilterableSessionList'

// Compute stats from the fetched sessions
function computeStats(sessions: Session[]) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)

  const sessionsThisMonth = sessions.filter(s => s.date >= monthStart).length

  const totalPlayers = sessions.reduce(
    (sum, s) => sum + s.session_players.length,
    0
  )

  // Most active age group
  const ageCounts: Record<string, number> = {}
  sessions.forEach(s => {
    if (s.age_group) ageCounts[s.age_group] = (ageCounts[s.age_group] ?? 0) + 1
  })
  const topAgeGroup =
    Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // Average attendance rate
  let totalSlots = 0
  let totalAttended = 0
  sessions.forEach(s => {
    s.session_players.forEach(p => {
      totalSlots++
      if (p.attended) totalAttended++
    })
  })
  const avgAttendance =
    totalSlots > 0 ? Math.round((totalAttended / totalSlots) * 100) : 0

  return { sessionsThisMonth, totalPlayers, topAgeGroup, avgAttendance }
}

export default async function TrainingSessionsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  if (!orgMembership?.organisation_id) {
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', padding: '64px 32px', color: '#6B7280', textAlign: 'center' }}>
        No organisation linked to this account.
      </div>
    )
  }

  const organisationId = orgMembership.organisation_id

  // Fetch sessions (coach_ids is a uuid[] column — no join possible)
  const { data: raw } = await supabase
    .from('sessions')
    .select(`
      *,
      session_players (attended)
    `)
    .eq('organisation_id', organisationId)
    .order('date', { ascending: false })

  const sessions = (raw ?? []) as unknown as Session[]

  // Resolve all member names in a single query
  const allCoachIds = [...new Set(sessions.flatMap(s => s.coach_ids ?? []))]
  const { data: coachRows } = allCoachIds.length
    ? await supabase.from('members').select('id, name').in('id', allCoachIds)
    : { data: [] }

  const coachMap: CoachMap = Object.fromEntries(
    (coachRows ?? []).map(c => [c.id, c.name])
  )

  const { sessionsThisMonth, totalPlayers, topAgeGroup, avgAttendance } =
    computeStats(sessions)

  return (
    <div style={{
      background: '#FFFFFF', minHeight: '100vh',
      fontFamily: 'Inter, sans-serif', padding: '32px',
    }}>
      <div style={{
        maxWidth: '1200px', margin: '0 auto',
        display: 'flex', gap: '32px', alignItems: 'flex-start',
      }}>

        {/* ── Left column ── */}
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>

          {/* Page header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: '24px',
          }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111111', margin: 0 }}>
                Training Sessions
              </h1>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0 0' }}>
                All sessions for your academy
              </p>
            </div>
            <Link href="/training/sessions/new" style={{
              background: '#111111', color: '#FFFFFF',
              padding: '10px 18px', borderRadius: '8px',
              fontSize: '14px', fontWeight: 500, textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}>
              Log Session
            </Link>
          </div>

          {/* Filters + session list (client component) */}
          <FilterableSessionList sessions={sessions} coachMap={coachMap} />
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ width: '320px', flexShrink: 0, position: 'sticky', top: '24px' }}>

          {/* Stats block */}
          <div style={{
            background: '#111111', color: '#FFFFFF',
            borderRadius: '10px', padding: '24px', marginBottom: '16px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
              <Stat value={sessionsThisMonth} label="Sessions This Month" />
              <Stat value={totalPlayers} label="Total Players" />
              <Stat value={topAgeGroup} label="Top Age Group" />
              <Stat value={`${avgAttendance}%`} label="Avg Attendance" />
            </div>
          </div>

          {/* Quick Links */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #E5E7EB',
            borderRadius: '10px', padding: '24px',
          }}>
            <p style={{
              fontSize: '11px', fontWeight: 600, color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              margin: '0 0 12px 0',
            }}>
              Quick Links
            </p>
            <QuickLink href="/training/sessions/new" label="Log a session" />
            <QuickLink href="/training/exercises" label="Exercise library" last />
          </div>
        </div>

      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: '30px', fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{
        fontSize: '11px', color: '#9CA3AF', marginTop: '6px',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {label}
      </div>
    </div>
  )
}

function QuickLink({ href, label, last }: { href: string; label: string; last?: boolean }) {
  return (
    <Link href={href} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 0',
      borderBottom: last ? 'none' : '1px solid #E5E7EB',
      color: '#111111', textDecoration: 'none',
      fontSize: '14px', fontWeight: 500,
    }}>
      {label}
      <span style={{ color: '#9CA3AF', fontSize: '16px' }}>›</span>
    </Link>
  )
}
