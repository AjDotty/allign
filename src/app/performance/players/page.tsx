import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlayerCard from './PlayerCard'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PlayersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members').select('id').eq('user_id', user.id).single()

  const { data: orgMembership } = member
    ? await supabase
        .from('organisation_members')
        .select('organisation_id')
        .eq('member_id', member.id)
        .single()
    : { data: null }

  if (!orgMembership?.organisation_id) redirect('/')
  const organisationId = orgMembership.organisation_id

  const { data: players } = await supabase
    .from('players')
    .select('id, name, age_group, position_group, shirt_number')
    .eq('home_organisation_id', organisationId)
    .order('name')

  const list = players ?? []

  // Fetch avg VEI per player (valid rows only)
  const playerIds = list.map(p => p.id)
  const veiByPlayer: Record<string, number> = {}
  if (playerIds.length > 0) {
    const { data: veiRows } = await supabase
      .from('player_match_vei')
      .select('player_id, vei_index')
      .in('player_id', playerIds)
      .eq('is_valid', true)
      .not('vei_index', 'is', null)

    for (const row of veiRows ?? []) {
      if (row.vei_index === null) continue
      if (!veiByPlayer[row.player_id]) veiByPlayer[row.player_id] = 0
      veiByPlayer[row.player_id] = (veiByPlayer[row.player_id] ?? 0) + row.vei_index
    }
    // Convert sums to averages
    const counts: Record<string, number> = {}
    for (const row of veiRows ?? []) {
      if (row.vei_index === null) continue
      counts[row.player_id] = (counts[row.player_id] ?? 0) + 1
    }
    for (const pid of Object.keys(veiByPlayer)) {
      veiByPlayer[pid] = veiByPlayer[pid] / (counts[pid] ?? 1)
    }
  }

  // Position sort order: DEF → MID → ATT → other
  const POS_ORDER: Record<string, number> = { DEF: 0, MID: 1, ATT: 2 }
  function posRank(p: string | null) { return POS_ORDER[p ?? ''] ?? 3 }

  // Group by age_group, sorted alphabetically; ungrouped last
  const grouped: Record<string, typeof list> = {}
  for (const p of list) {
    const key = p.age_group ?? 'Unassigned'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(p)
  }
  // Sort within each group by position then name
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) =>
      posRank(a.position_group) - posRank(b.position_group) || a.name.localeCompare(b.name)
    )
  }
  const sortedGroups = [
    ...Object.keys(grouped).filter(g => g !== 'Unassigned').sort(),
    ...('Unassigned' in grouped ? ['Unassigned'] : []),
  ]

  return (
    <div style={{
      background: '#FFFFFF', minHeight: '100vh',
      fontFamily: 'Inter, sans-serif', padding: '32px',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111111', margin: 0 }}>
            Players
          </h1>
          <div style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
            {list.length} player{list.length !== 1 ? 's' : ''} registered
          </div>
        </div>

        {list.length === 0 ? (
          <div style={{
            border: '1px solid #E5E7EB', borderRadius: '10px',
            padding: '64px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '14px', color: '#9CA3AF' }}>No players registered yet</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
            {sortedGroups.map(group => (
              <div key={group}>

                {/* Age group heading */}
                <div style={{
                  fontSize: '11px', fontWeight: 600, color: '#9CA3AF',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {group}
                  <span style={{
                    background: '#111111', color: '#FFFFFF',
                    fontSize: '10px', fontWeight: 700,
                    padding: '1px 7px', borderRadius: '9999px',
                    letterSpacing: '0.02em',
                  }}>
                    {grouped[group].length}
                  </span>
                </div>

                {/* Player grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '12px',
                }}>
                  {grouped[group].map(player => (
                    <PlayerCard
                      key={player.id}
                      id={player.id}
                      name={player.name}
                      position_group={player.position_group}
                      shirt_number={player.shirt_number}
                      avg_vei={veiByPlayer[player.id] ?? null}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
