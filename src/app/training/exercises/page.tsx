import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExerciseLibrary, { type Exercise } from './_components/ExerciseLibrary'

export default async function ExercisesPage() {
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

  // Fetch exercises: org-specific OR global
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, description, category, suitable_age_groups, is_global, organisation_id')
    .or(`organisation_id.eq.${organisationId},is_global.eq.true`)
    .order('name')

  return (
    <div style={{
      background: '#FFFFFF', minHeight: '100vh',
      fontFamily: 'Inter, sans-serif', padding: '32px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111111', margin: 0 }}>
            Exercise Library
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0' }}>
            Drills and exercises for your sessions
          </p>
        </div>

        <ExerciseLibrary
          initialExercises={(exercises ?? []) as Exercise[]}
          organisationId={organisationId}
        />
      </div>
    </div>
  )
}
