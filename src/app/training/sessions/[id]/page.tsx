import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SessionTabs, { type SessionPlayer, type SessionExercise } from './_components/SessionTabs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
]

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  if (!orgMembership?.organisation_id) redirect('/training/sessions')

  const organisationId = orgMembership.organisation_id

  // Fetch session with players and footage
  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, date, age_group, duration_minutes, location, notes, organisation_id, coach_ids,
      session_players (
        attended,
        absence_reason,
        players (id, name)
      ),
      session_footage (veo_url)
    `)
    .eq('id', id)
    .single()

  if (!session || session.organisation_id !== organisationId) {
    redirect('/training/sessions')
  }

  // Fetch exercises ordered by "order" (reserved word — always quoted)
  const { data: rawExercises } = await supabase
    .from('session_exercises')
    .select(`
      id, duration_minutes, notes, "order",
      exercises (id, name, category)
    `)
    .eq('session_id', id)
    .order('"order"', { ascending: true })

  // Fetch member names by coach_ids array
  const coachIds = (session.coach_ids as string[] | null) ?? []
  const { data: coaches } = coachIds.length
    ? await supabase.from('members').select('id, name').in('id', coachIds)
    : { data: [] }

  // Resolve footage URL
  const footage = (session.session_footage as { veo_url: string | null }[] | null)?.[0]
  const veoUrl = footage?.veo_url ?? null

  // Cast to typed arrays for the client component
  const sessionPlayers = (session.session_players ?? []) as unknown as SessionPlayer[]
  const sessionExercises = (rawExercises ?? []) as unknown as SessionExercise[]

  // Compute attendance rate for the sidebar stat
  const totalPlayers = sessionPlayers.length
  const attended = sessionPlayers.filter(p => p.attended).length
  const attendanceRate = totalPlayers > 0 ? Math.round((attended / totalPlayers) * 100) : 0

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

          {/* Session header card */}
          <div style={{
            border: '1px solid #E5E7EB', borderRadius: '10px',
            padding: '24px', marginBottom: '16px',
          }}>
            {/* Date + age group pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111111', margin: 0 }}>
                {formatDate(session.date)}
              </h1>
              {session.age_group && (
                <span style={{
                  background: '#111111', color: '#FFFFFF',
                  fontSize: '12px', fontWeight: 500,
                  padding: '3px 10px', borderRadius: '9999px',
                }}>
                  {session.age_group}
                </span>
              )}
            </div>

            {/* Location + duration */}
            {(session.location || session.duration_minutes) && (
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                {session.location && (
                  <span style={{ fontSize: '14px', color: '#6B7280' }}>{session.location}</span>
                )}
                {session.duration_minutes && (
                  <span style={{ fontSize: '14px', color: '#6B7280' }}>{session.duration_minutes} min</span>
                )}
              </div>
            )}

            {/* Coach avatar row */}
            {coaches && coaches.length > 0 && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {coaches.map(c => (
                  <div
                    key={c.id}
                    title={c.name}
                    style={{
                      width: '32px', height: '32px', borderRadius: '9999px',
                      background: avatarColor(c.name), flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color: '#FFFFFF',
                    }}
                  >
                    {initials(c.name)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabs card (client component) */}
          <div style={{
            border: '1px solid #E5E7EB', borderRadius: '10px', padding: '24px',
          }}>
            <SessionTabs
              sessionPlayers={sessionPlayers}
              sessionExercises={sessionExercises}
            />
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '24px' }}>

          {/* Back link */}
          <Link href="/training/sessions" style={{
            display: 'block', fontSize: '13px', color: '#6B7280',
            textDecoration: 'none', marginBottom: '16px',
          }}>
            ← All Sessions
          </Link>

          {/* Attendance rate — black stats block */}
          <div style={{
            background: '#111111', color: '#FFFFFF',
            borderRadius: '10px', padding: '24px', marginBottom: '12px',
          }}>
            <div style={{ fontSize: '48px', fontWeight: 700, lineHeight: 1 }}>
              {attendanceRate}%
            </div>
            <div style={{
              fontSize: '11px', color: '#9CA3AF', marginTop: '8px',
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              Attendance Rate
            </div>
          </div>

          {/* Footage card */}
          <div style={{
            border: '1px solid #E5E7EB', borderRadius: '10px',
            padding: '20px', marginBottom: '12px',
          }}>
            <p style={{
              fontSize: '11px', fontWeight: 600, color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              margin: '0 0 12px 0',
            }}>
              Session Footage
            </p>
            {veoUrl ? (
              <a
                href={veoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block', textAlign: 'center',
                  background: '#111111', color: '#FFFFFF',
                  padding: '10px', borderRadius: '8px',
                  fontSize: '14px', fontWeight: 500, textDecoration: 'none',
                }}
              >
                View Footage →
              </a>
            ) : (
              <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
                No footage uploaded yet
              </p>
            )}
          </div>

          {/* Edit Session button */}
          <Link
            href={`/training/sessions/${session.id}/edit`}
            style={{
              display: 'block', textAlign: 'center',
              background: '#111111', color: '#FFFFFF',
              padding: '11px', borderRadius: '8px',
              fontSize: '14px', fontWeight: 500, textDecoration: 'none',
            }}
          >
            Edit Session
          </Link>
        </div>

      </div>
    </div>
  )
}
