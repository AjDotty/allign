'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Exercise = {
  id: string
  name: string
  description: string | null
  category: string | null
  suitable_age_groups: string[] | null
  is_global: boolean
  organisation_id: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Passing', 'Possession', 'Defending', 'Finishing', 'Physical']
const AGE_GROUPS = ['All', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16']
const MODAL_CATEGORIES = ['Passing', 'Possession', 'Defending', 'Finishing', 'Physical']
const MODAL_AGE_GROUPS = ['U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16']

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  border: '1px solid #E5E7EB', borderRadius: '8px',
  padding: '10px 14px', fontSize: '14px', color: '#111111',
  background: '#FFFFFF', outline: 'none', fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box',
}

function pill(active: boolean): React.CSSProperties {
  return {
    padding: '5px 14px', borderRadius: '9999px', fontSize: '13px',
    fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid #E5E7EB',
    background: active ? '#111111' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#111111',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExerciseLibrary({
  initialExercises,
  organisationId,
}: {
  initialExercises: Exercise[]
  organisationId: string
}) {
  // Library state
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [ageGroupFilter, setAgeGroupFilter] = useState('All')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formAgeGroups, setFormAgeGroups] = useState<string[]>([])
  const [formIsGlobal, setFormIsGlobal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // ── Derived stats (from full unfiltered list) ──────────────────────────────

  const mostUsedCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    exercises.forEach(e => {
      if (e.category) counts[e.category] = (counts[e.category] ?? 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  }, [exercises])

  // ── Filtered exercises ─────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return exercises.filter(e => {
      if (categoryFilter !== 'All' && e.category !== categoryFilter) return false
      if (ageGroupFilter !== 'All' && !(e.suitable_age_groups ?? []).includes(ageGroupFilter)) return false
      if (q && !e.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [exercises, search, categoryFilter, ageGroupFilter])

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openModal() {
    setFormName(''); setFormDescription(''); setFormCategory('')
    setFormAgeGroups([]); setFormIsGlobal(false)
    setModalError(null); setModalOpen(true)
  }

  function toggleFormAgeGroup(ag: string) {
    setFormAgeGroups(prev =>
      prev.includes(ag) ? prev.filter(a => a !== ag) : [...prev, ag]
    )
  }

  async function handleSave() {
    if (!formName.trim()) { setModalError('Name is required'); return }
    setSaving(true); setModalError(null)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('exercises')
      .insert({
        name: formName.trim(),
        description: formDescription.trim() || null,
        category: formCategory ? formCategory.toLowerCase() : null,
        suitable_age_groups: formAgeGroups.length > 0 ? formAgeGroups : null,
        is_global: formIsGlobal,
        organisation_id: organisationId,
      })
      .select()
      .single()

    if (error || !data) {
      setModalError(error?.message ?? 'Failed to save exercise')
      setSaving(false)
      return
    }

    // Optimistic add to list
    setExercises(prev => [data as Exercise, ...prev])
    setModalOpen(false)
    setSaving(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

        {/* ── Left column ── */}
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>

          {/* Search */}
          <div style={{ marginBottom: '14px' }}>
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises…"
              style={inputStyle}
            />
          </div>

          {/* Category filter pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            {CATEGORIES.map(c => (
              <button key={c} type="button" onClick={() => setCategoryFilter(c)} style={pill(categoryFilter === c)}>
                {c}
              </button>
            ))}
          </div>

          {/* Age group filter pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            {AGE_GROUPS.map(ag => (
              <button key={ag} type="button" onClick={() => setAgeGroupFilter(ag)} style={pill(ageGroupFilter === ag)}>
                {ag}
              </button>
            ))}
          </div>

          {/* Exercise grid */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <p style={{ color: '#6B7280', fontSize: '15px', margin: '0 0 20px 0' }}>No exercises found</p>
              <button type="button" onClick={openModal} style={{
                background: '#111111', color: '#FFFFFF', border: 'none',
                borderRadius: '8px', padding: '10px 20px',
                fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Add Exercise
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {filtered.map(e => (
                <ExerciseCard key={e.id} exercise={e} />
              ))}
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '24px' }}>

          {/* Stats block */}
          <div style={{
            background: '#111111', color: '#FFFFFF',
            borderRadius: '10px', padding: '24px', marginBottom: '12px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>{exercises.length}</div>
                <div style={{
                  fontSize: '11px', color: '#9CA3AF', marginTop: '6px',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  Total Exercises
                </div>
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1, paddingTop: '4px' }}>{mostUsedCategory}</div>
                <div style={{
                  fontSize: '11px', color: '#9CA3AF', marginTop: '6px',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  Top Category
                </div>
              </div>
            </div>
          </div>

          {/* Add Exercise button */}
          <button
            type="button" onClick={openModal}
            style={{
              display: 'block', width: '100%', textAlign: 'center',
              background: '#111111', color: '#FFFFFF', border: 'none',
              borderRadius: '8px', padding: '11px',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Add Exercise
          </button>
        </div>
      </div>

      {/* ── Add Exercise Modal ── */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '24px',
          }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div style={{
            background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '16px',
            padding: '32px', width: '100%', maxWidth: '480px',
            maxHeight: '90vh', overflowY: 'auto', fontFamily: 'Inter, sans-serif',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111111', margin: '0 0 24px 0' }}>
              Add Exercise
            </h2>

            {/* Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#111111', marginBottom: '6px' }}>
                Name
              </label>
              <input
                type="text" value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Exercise name"
                style={inputStyle}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#111111', marginBottom: '6px' }}>
                Description
              </label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Describe the exercise…"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Category */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#111111', marginBottom: '10px' }}>
                Category
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {MODAL_CATEGORIES.map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => setFormCategory(formCategory === c ? '' : c)}
                    style={pill(formCategory === c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Age groups */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#111111', marginBottom: '10px' }}>
                Suitable Age Groups
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {MODAL_AGE_GROUPS.map(ag => (
                  <button
                    key={ag} type="button"
                    onClick={() => toggleFormAgeGroup(ag)}
                    style={pill(formAgeGroups.includes(ag))}
                  >
                    {ag}
                  </button>
                ))}
              </div>
            </div>

            {/* Global toggle */}
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox" id="is_global"
                checked={formIsGlobal}
                onChange={e => setFormIsGlobal(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#111111' }}
              />
              <label htmlFor="is_global" style={{ fontSize: '14px', color: '#111111', cursor: 'pointer' }}>
                Share with all academies
              </label>
            </div>

            {/* Error */}
            {modalError && (
              <p style={{ fontSize: '13px', color: '#EF4444', margin: '0 0 16px 0' }}>{modalError}</p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button" onClick={() => setModalOpen(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '14px', color: '#6B7280', fontFamily: 'inherit', padding: '10px 4px',
                }}
              >
                Cancel
              </button>
              <button
                type="button" onClick={handleSave} disabled={saving}
                style={{
                  background: saving ? '#555555' : '#111111',
                  color: '#FFFFFF', border: 'none', borderRadius: '8px',
                  padding: '10px 20px', fontSize: '14px', fontWeight: 500,
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {saving ? 'Saving…' : 'Add Exercise'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise: e }: { exercise: Exercise }) {
  return (
    <div style={{
      border: '1px solid #E5E7EB', borderRadius: '10px',
      padding: '20px', background: '#FFFFFF',
    }}>
      {/* Name + category pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#111111', lineHeight: 1.3 }}>
          {e.name}
        </span>
        {e.category && (
          <span style={{
            background: '#111111', color: '#FFFFFF',
            fontSize: '11px', fontWeight: 500,
            padding: '3px 8px', borderRadius: '9999px', flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            {e.category}
          </span>
        )}
      </div>

      {/* Age groups */}
      {e.suitable_age_groups && e.suitable_age_groups.length > 0 && (
        <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 8px 0' }}>
          {e.suitable_age_groups.join(', ')}
        </p>
      )}

      {/* Description */}
      {e.description && (
        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
          {e.description}
        </p>
      )}
    </div>
  )
}
