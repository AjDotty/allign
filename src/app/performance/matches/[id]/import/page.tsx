'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchData = {
  id: string
  opponent: string
  date: string
  age_group: string | null
}

type LineupEntry = {
  player_id: string
  position_group: string
  player: { id: string; name: string; shirt_number: number | null }
}

type MatchedEvent = {
  xmlId: string
  startSeconds: number
  endSeconds: number
  code: string
  clip: File | null
  matched: boolean
  grade: number | null
  playerName: string
  assignedPlayerId: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const difficultyWeights: Record<string, number> = {
  'Safety Pass': 0.6, 'Forward Pass': 0.8, 'Switch': 1.0,
  'Cross': 1.0, 'Through Ball': 1.2, 'Progressive Pass': 1.3,
  'Line-Breaking Pass': 1.4, 'Dribble into Space': 0.8,
  'Progressive Dribble': 1.1, 'Dribble Under Pressure': 1.3,
  'Skill Move': 1.4, 'Holding Carry': 0.7,
  'Carry into Attacking Third': 1.1, 'Progressive Carry': 1.2,
  'Carry Under Pressure': 1.3, 'Blocked Shot': 0.8,
  'Shot Off Target': 0.9, 'Header Shot': 1.0, 'Shot on Target': 1.1,
  'Big Chance': 1.3, 'Clearance': 0.8, 'Aerial Duel': 0.9,
  'Block': 1.0, 'Tackle': 1.1, 'Interception': 1.2,
  'HV Defensive Action': 1.4, 'Pass': 0.8, 'Shot': 1.0,
  'Dribble': 1.0, 'Carry': 1.0, 'Header': 1.0,
}

const mapCodeToEventType = (code: string): string => {
  const mapping: Record<string, string> = {
    'Pass': 'pass', 'Shot': 'shot', 'Carry': 'carry',
    'Dribble': 'dribble', 'Tackle': 'defensive_action',
    'Interception': 'defensive_action', 'Header': 'shot',
    'Clearance': 'defensive_action', 'Block': 'defensive_action',
    'HV Defensive Action': 'defensive_action',
  }
  return mapping[code] || 'pass'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Format: New Playlist - 05 - 34m03s - 1.mp4  (space-dash-space separator)
function parseClipFilename(filename: string) {
  const withoutExt = filename.replace('.mp4', '').replace(/__\d+_$/, '')

  // Split on ' - ' (space dash space) — actual Metrica export format
  const parts = withoutExt.split(' - ')

  console.log('[Parse]', filename, '→ parts:', parts)

  // parts[0] = playlist name
  // parts[1] = event number (05, 04 etc)
  // parts[2] = timestamp (34m03s)
  // parts[3] = grade (1, 0, -1, 2)

  const eventNum = parseInt(parts[1]?.trim() || '0')
  const gradeStr = parts[3]?.trim() || ''
  const grade = gradeStr !== '' ? parseInt(gradeStr.replace('+', '')) : null
  const isValidGrade = grade !== null && [-1, 0, 1, 2].includes(grade)

  return { eventNum, grade, isValidGrade }
}

function gradeBadgeStyle(grade: number | null): React.CSSProperties {
  const colors: Record<number, string> = { '-1': '#EF4444', '0': '#9CA3AF', '1': '#22C55E', '2': '#3B82F6' }
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '28px', height: '28px', borderRadius: '9999px',
    background: grade !== null ? (colors[grade] ?? '#E5E7EB') : '#E5E7EB',
    color: '#FFFFFF', fontSize: '11px', fontWeight: 700,
  }
}

function gradeLabel(grade: number | null): string {
  if (grade === null) return '?'
  if (grade > 0) return `+${grade}`
  return `${grade}`
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  border: '1px solid #E5E7EB', borderRadius: '10px',
  padding: '24px', background: '#FFFFFF', marginBottom: '16px',
}

function btnPrimary(disabled = false): React.CSSProperties {
  return {
    background: disabled ? '#9CA3AF' : '#111111',
    color: '#FFFFFF', border: 'none', borderRadius: '8px',
    padding: '11px 24px', fontSize: '14px', fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  }
}

const btnSecondary: React.CSSProperties = {
  background: '#FFFFFF', color: '#111111',
  border: '1px solid #E5E7EB', borderRadius: '8px',
  padding: '11px 24px', fontSize: '14px', fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Upload', 'Preview', 'Confirm']
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
      {steps.map((label, idx) => {
        const n = (idx + 1) as 1 | 2 | 3
        const done = current > n
        const active = current === n
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: idx < 2 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '9999px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700,
                background: done || active ? '#111111' : '#FFFFFF',
                color: done || active ? '#FFFFFF' : '#9CA3AF',
                border: done || active ? 'none' : '1.5px solid #E5E7EB',
              }}>
                {done ? '✓' : n}
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap',
                color: active ? '#111111' : done ? '#6B7280' : '#9CA3AF',
              }}>
                {label}
              </span>
            </div>
            {idx < 2 && (
              <div style={{
                flex: 1, height: '1px', margin: '0 8px', marginBottom: '20px',
                background: current > n ? '#111111' : '#E5E7EB',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({
  label, accept, multiple, files, onFiles,
}: {
  label: string
  accept: string
  multiple: boolean
  files: File[]
  onFiles: (files: File[]) => void
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const exts = accept.split(',').map(s => s.trim())
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      exts.some(ext => f.name.toLowerCase().endsWith(ext.replace('*', '')))
    )
    if (dropped.length > 0) onFiles(multiple ? dropped : [dropped[0]])
  }, [accept, multiple, onFiles])

  const fileLabel = files.length === 0
    ? null
    : files.length === 1
    ? files[0].name
    : `${files.length} clips selected`

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        flex: 1, border: `2px dashed ${dragging ? '#111111' : files.length > 0 ? '#22C55E' : '#E5E7EB'}`,
        borderRadius: '10px', padding: '32px 16px', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '10px', minHeight: '140px',
        background: dragging ? '#F9FAFB' : '#FFFFFF', transition: 'all 0.15s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={e => {
          const picked = Array.from(e.target.files ?? [])
          if (picked.length > 0) onFiles(multiple ? picked : [picked[0]])
          e.target.value = ''
        }}
      />
      <div style={{ fontSize: '28px', color: files.length > 0 ? '#22C55E' : '#9CA3AF' }}>
        {files.length > 0 ? '✓' : '↑'}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111111', marginBottom: '4px' }}>
          {label}
        </div>
        {fileLabel ? (
          <div style={{ fontSize: '12px', color: '#22C55E', fontWeight: 500 }}>{fileLabel}</div>
        ) : (
          <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
            Drop here or{' '}
            <span style={{ color: '#111111', textDecoration: 'underline' }}>browse</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const router = useRouter()
  const params = useParams()
  const rawId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : null
  const matchId = rawId ?? ''
  const isValidUUID = !!matchId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)
  const supabase = createClient()

  // Identity & match
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [lineup, setLineup] = useState<LineupEntry[]>([])
  const [organisationId, setOrganisationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Steps
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1
  const [xmlFiles, setXmlFiles] = useState<File[]>([])
  const [clipFiles, setClipFiles] = useState<File[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  // Step 2
  const [matchedEvents, setMatchedEvents] = useState<MatchedEvent[]>([])
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, string>>({})

  // Step 3
  const [importing, setImporting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [importDone, setImportDone] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const [importError, setImportError] = useState<string | null>(null)

  // ── On mount ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isValidUUID) return   // wait until params resolve to a real UUID
    async function load() {
      console.log('[Import] matchId:', matchId)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: member } = await supabase
        .from('members').select('id').eq('user_id', user.id).single()

      if (member) {
        const { data: orgMembership } = await supabase
          .from('organisation_members').select('organisation_id')
          .eq('member_id', member.id).single()
        if (orgMembership) setOrganisationId(orgMembership.organisation_id)
      }

      const { data: matchRow } = await supabase
        .from('matches').select('id, opponent, date, age_group')
        .eq('id', matchId).single()
      if (matchRow) setMatchData(matchRow)

      const { data: lineupRows } = await supabase
        .from('match_lineups')
        .select('player_id, position_group, players(id, name, shirt_number)')
        .eq('match_id', matchId)

      if (lineupRows) {
        const mapped: LineupEntry[] = lineupRows.flatMap(row => {
          const arr = Array.isArray(row.players) ? row.players : row.players ? [row.players] : []
          const p = (arr[0] as any) ?? null
          if (!p) return []
          return [{
            player_id: row.player_id,
            position_group: row.position_group ?? 'DEF',
            player: { id: p.id, name: p.name, shirt_number: p.shirt_number ?? null },
          }]
        })
        setLineup(mapped)
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, isValidUUID])

  // ── Step 1 → 2: Parse ─────────────────────────────────────────────────────

  async function handleParse() {
    setParseError(null)
    const xmlFile = xmlFiles[0]
    if (!xmlFile || clipFiles.length === 0) return

    try {
      const xmlText = await xmlFile.text()
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
      const instances = xmlDoc.querySelectorAll('instance')

      const xmlEvents = Array.from(instances).map(instance => {
        // Extract player name from VEI Players label group, or first label
        let playerName = ''
        const labels = instance.querySelectorAll('label')
        labels.forEach(label => {
          const group = label.querySelector('group')?.textContent?.trim()
          const text = label.querySelector('text')?.textContent?.trim() ?? ''
          if (group === 'VEI Players' && text) {
            // Tag names are formatted as "${shirt}\n${name}" — take the part after \n
            playerName = text.includes('\n') ? text.split('\n')[1] : text
          }
        })
        // Fall back to first label text if no VEI Players group found
        if (!playerName && labels.length > 0) {
          const firstText = labels[0].querySelector('text')?.textContent?.trim() ?? ''
          playerName = firstText.includes('\n') ? firstText.split('\n')[1] : firstText
        }

        return {
          xmlId: instance.querySelector('ID')?.textContent?.trim() ?? '',
          startSeconds: parseFloat(instance.querySelector('start')?.textContent || '0'),
          endSeconds: parseFloat(instance.querySelector('end')?.textContent || '0'),
          code: instance.querySelector('code')?.textContent?.trim() ?? '',
          playerName,
        }
      }).filter(e => e.xmlId !== '')

      if (xmlEvents.length === 0) {
        setParseError('No events found in XML. Check the file is a valid Metrica export.')
        return
      }

      // ── Debug logging ────────────────────────────────────────────────────
      console.log('[Import] Raw clip names:', clipFiles.map(c => c.name))

      clipFiles.forEach(clip => {
        const cleaned = clip.name.replace(/__\d+_(?=\.mp4$)/, '')
        const withoutExt = cleaned.replace('.mp4', '')
        const parts = withoutExt.split('_-_')
        const eventNum = parseInt(parts[1]?.trim() || '0')
        const gradeStr = parts[3]?.trim() || ''
        const grade = gradeStr !== '' ? parseInt(gradeStr.replace('+', '')) : null
        console.log('[Import] Clip:', clip.name, '→ parts:', parts, '→ eventNum:', eventNum, '→ grade:', grade)
      })

      console.log('[Import] XML IDs:', xmlEvents.map(e => ({ xmlId: e.xmlId, code: e.code })))

      xmlEvents.forEach(event => {
        const intXmlId = parseInt(event.xmlId)
        clipFiles.forEach(clip => {
          const parsed = parseClipFilename(clip.name)
          console.log(`[Import] Matching event ${intXmlId} vs clip eventNum ${parsed.eventNum} → ${intXmlId === parsed.eventNum ? 'MATCH' : 'no match'}`)
        })
      })
      // ── End debug ─────────────────────────────────────────────────────────

      const resolvePlayerId = (name: string): string | null => {
        if (!name) return null
        return lineup.find(p =>
          p.player.name.toLowerCase().trim() === name.toLowerCase().trim()
        )?.player_id ?? null
      }

      // ── Player resolution debug ───────────────────────────────────────────
      console.log('[Import] Lineup players:', lineup.map(l => ({
        player_id: l.player_id,
        name: l.player.name,
      })))

      xmlEvents.forEach(event => {
        console.log('[Import] Event player name from XML:', JSON.stringify(event.playerName))
        const resolved = resolvePlayerId(event.playerName)
        console.log('[Import] Resolved player_id:', resolved)
      })
      // ── End player resolution debug ───────────────────────────────────────

      const matched: MatchedEvent[] = xmlEvents.map(event => {
        const matchedClip = clipFiles.find(clip => {
          const parsed = parseClipFilename(clip.name)
          return parsed.eventNum === parseInt(event.xmlId || '0')
        })
        const parsedClip = matchedClip ? parseClipFilename(matchedClip.name) : null
        const assignedPlayerId = resolvePlayerId(event.playerName)
        return {
          ...event,
          clip: matchedClip ?? null,
          matched: !!matchedClip,
          grade: parsedClip?.isValidGrade ? parsedClip.grade : null,
          assignedPlayerId,
        }
      })

      // Pre-populate selectedPlayers from resolved player IDs
      const initialAssignments: Record<string, string> = {}
      matched.forEach(e => {
        if (e.matched && e.assignedPlayerId) {
          initialAssignments[e.xmlId] = e.assignedPlayerId
        }
      })

      setMatchedEvents(matched)
      setSelectedPlayers(initialAssignments)
      setStep(2)
    } catch {
      setParseError('Failed to parse XML. Make sure it is a valid Metrica XML export.')
    }
  }

  // ── Step 2 → import ───────────────────────────────────────────────────────

  async function handleImport() {
    if (!organisationId) { setImportError('Organisation not loaded'); return }
    setImporting(true)
    setImportError(null)

    const toImport = matchedEvents.filter(e => e.matched && e.clip)
    setUploadProgress({ current: 0, total: toImport.length })

    // Ensure bucket exists (best-effort — may require elevated permissions)
    try {
      const { error: bucketErr } = await supabase.storage.getBucket('match-clips')
      if (bucketErr) {
        await supabase.storage.createBucket('match-clips', { public: true })
      }
    } catch {
      // continue — upload will surface permission errors if bucket missing
    }

    let count = 0
    for (let i = 0; i < toImport.length; i++) {
      const event = toImport[i]
      setUploadProgress({ current: i + 1, total: toImport.length })

      // 1. Upload clip
      const filePath = `${organisationId}/${matchId}/${event.xmlId}.mp4`
      const { error: uploadErr } = await supabase.storage
        .from('match-clips')
        .upload(filePath, event.clip!, { contentType: 'video/mp4', upsert: true })

      if (uploadErr) {
        setImportError(`Clip upload failed (event ${event.xmlId}): ${uploadErr.message}`)
        setImporting(false)
        return
      }

      const { data: urlData } = supabase.storage.from('match-clips').getPublicUrl(filePath)
      const clipUrl = urlData.publicUrl

      // 2. Insert match event
      const { error: insertErr } = await supabase.from('match_events').insert({
        match_id: matchId,
        organisation_id: organisationId,
        player_id: selectedPlayers[event.xmlId] || null,
        event_type: mapCodeToEventType(event.code),
        event_sub_category: event.code,
        difficulty_weight: difficultyWeights[event.code] ?? 1.0,
        completed: true,
        grade: event.grade ?? 0,
        timestamp_seconds: event.startSeconds,
        clip_url: clipUrl || null,
        attacking_third: false,
        is_defensive_third: false,
        is_big_chance: false,
        is_hv_def: event.code === 'HV Defensive Action' || event.code === 'Interception',
        is_goal: false,
      })

      if (insertErr) {
        setImportError(`Event insert failed (event ${event.xmlId}): ${insertErr.message}`)
        setImporting(false)
        return
      }

      count++
    }

    setImportCount(count)
    setImportDone(true)
    setImporting(false)

    setTimeout(() => {
      router.push(`/performance/matches/${matchId}/grade`)
    }, 1000)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalCount = matchedEvents.length
  const matchedCount = matchedEvents.filter(e => e.matched).length
  const unmatchedCount = matchedEvents.filter(e => !e.matched).length
  const invalidGradeCount = matchedEvents.filter(e => e.matched && e.grade === null).length
  const canParse = xmlFiles.length > 0 && clipFiles.length > 0
  const canImport = matchedCount > 0 && !importing

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', color: '#9CA3AF', fontSize: '14px' }}>
          Loading…
        </div>
      </div>
    )
  }

  const titleOpponent = matchData?.opponent ?? 'Match'
  const titleAge = matchData?.age_group ? ` vs ${matchData.age_group}` : ''
  const pageTitle = `Import Events — ${titleOpponent}${titleAge}`

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111111', margin: 0 }}>
            {pageTitle}
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0' }}>
            Upload Metrica XML and clips
          </p>
        </div>

        <StepIndicator current={importDone ? 3 : step} />

        {/* ── Success ── */}
        {importDone && (
          <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111111', margin: '0 0 8px' }}>
              {importCount} {importCount === 1 ? 'event' : 'events'} imported successfully
            </h2>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 28px' }}>
              Events are ready for review and grading.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Link href={`/performance/matches/${matchId}/grade`} style={{ textDecoration: 'none' }}>
                <button type="button" style={btnPrimary()}>Review &amp; Grade</button>
              </Link>
              <Link href={`/performance/matches/${matchId}`} style={{ textDecoration: 'none' }}>
                <button type="button" style={btnSecondary}>Back to Match</button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Step 1: Upload ── */}
        {!importDone && step === 1 && (
          <div style={card}>
            <p style={{
              fontSize: '11px', fontWeight: 600, color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 20px',
            }}>
              Upload Files
            </p>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <DropZone
                label="Metrica XML Export"
                accept=".xml"
                multiple={false}
                files={xmlFiles}
                onFiles={setXmlFiles}
              />
              <DropZone
                label="Metrica Clips (MP4)"
                accept=".mp4"
                multiple
                files={clipFiles}
                onFiles={setClipFiles}
              />
            </div>

            {parseError && (
              <p style={{ fontSize: '13px', color: '#EF4444', margin: '0 0 16px' }}>{parseError}</p>
            )}

            <button
              type="button"
              onClick={handleParse}
              disabled={!canParse}
              style={{ ...btnPrimary(!canParse), width: '100%' }}
            >
              Parse Events
            </button>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {!importDone && step === 2 && (
          <>
            <div style={card}>
              {/* Summary */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: '16px',
              }}>
                <div>
                  <p style={{
                    fontSize: '11px', fontWeight: 600, color: '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px',
                  }}>
                    Preview
                  </p>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6B7280', flexWrap: 'wrap' }}>
                    <span><strong style={{ color: '#111111' }}>{totalCount}</strong> events</span>
                    <span style={{ color: '#22C55E' }}><strong>{matchedCount}</strong> matched</span>
                    {unmatchedCount > 0 && (
                      <span style={{ color: '#EF4444' }}><strong>{unmatchedCount}</strong> unmatched</span>
                    )}
                    {invalidGradeCount > 0 && (
                      <span style={{ color: '#F59E0B' }}><strong>{invalidGradeCount}</strong> invalid grades</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setStep(1); setMatchedEvents([]) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '13px', color: '#6B7280', fontFamily: 'inherit',
                  }}
                >
                  ← Re-upload
                </button>
              </div>

              {/* Table */}
              <div style={{
                maxHeight: '55vh', overflowY: 'auto',
                border: '1px solid #E5E7EB', borderRadius: '8px',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0 }}>
                      {['#', 'Time', 'Code', 'Grade', 'Clip', 'Player'].map(h => (
                        <th key={h} style={{
                          padding: '10px 12px', textAlign: 'left', fontSize: '11px',
                          fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                          letterSpacing: '0.05em', background: '#F9FAFB',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matchedEvents.map((event, i) => (
                      <tr
                        key={event.xmlId}
                        style={{
                          borderBottom: '1px solid #F3F4F6',
                          background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                        }}
                      >
                        {/* Event # */}
                        <td style={{ padding: '10px 12px', color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
                          {event.xmlId}
                        </td>
                        {/* Time */}
                        <td style={{ padding: '10px 12px', color: '#111111', fontVariantNumeric: 'tabular-nums' }}>
                          {formatTime(event.startSeconds)}
                        </td>
                        {/* Code */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            background: '#111111', color: '#FFFFFF',
                            fontSize: '11px', fontWeight: 500,
                            padding: '2px 8px', borderRadius: '9999px', whiteSpace: 'nowrap',
                          }}>
                            {event.code}
                          </span>
                        </td>
                        {/* Grade */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={gradeBadgeStyle(event.grade)}>
                            {gradeLabel(event.grade)}
                          </span>
                        </td>
                        {/* Clip match */}
                        <td style={{ padding: '10px 12px' }}>
                          {event.matched
                            ? <span style={{ color: '#22C55E', fontWeight: 500 }}>✓</span>
                            : <span style={{ color: '#EF4444', fontWeight: 500 }}>✗</span>
                          }
                        </td>
                        {/* Player dropdown */}
                        <td style={{ padding: '10px 12px' }}>
                          {event.matched ? (
                            <select
                              value={selectedPlayers[event.xmlId] ?? ''}
                              onChange={e => setSelectedPlayers(prev => ({
                                ...prev, [event.xmlId]: e.target.value,
                              }))}
                              style={{
                                border: '1px solid #E5E7EB', borderRadius: '6px',
                                padding: '4px 8px', fontSize: '12px', color: '#111111',
                                background: '#FFFFFF', fontFamily: 'inherit',
                                cursor: 'pointer', maxWidth: '160px',
                              }}
                            >
                              <option value="">— Assign player —</option>
                              {lineup.map(lp => (
                                <option key={lp.player_id} value={lp.player_id}>
                                  {lp.player.shirt_number != null ? `${lp.player.shirt_number} · ` : ''}{lp.player.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ color: '#9CA3AF', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Progress during import */}
            {importing && (
              <div style={{ ...card, marginBottom: '16px' }}>
                <p style={{ fontSize: '14px', color: '#111111', margin: '0 0 12px' }}>
                  Uploading clip {uploadProgress.current} of {uploadProgress.total}…
                </p>
                <div style={{ background: '#E5E7EB', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{
                    background: '#111111',
                    width: uploadProgress.total > 0
                      ? `${(uploadProgress.current / uploadProgress.total) * 100}%`
                      : '0%',
                    height: '100%', borderRadius: '4px', transition: 'width 0.2s',
                  }} />
                </div>
              </div>
            )}

            {importError && (
              <p style={{ fontSize: '13px', color: '#EF4444', margin: '0 0 16px' }}>{importError}</p>
            )}

            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              style={{ ...btnPrimary(!canImport), width: '100%' }}
            >
              {importing ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}…` : `Import ${matchedCount} ${matchedCount === 1 ? 'Event' : 'Events'}`}
            </button>
          </>
        )}

        {/* Back link */}
        {!importDone && (
          <div style={{ marginTop: '24px' }}>
            <Link
              href={`/performance/matches/${matchId}`}
              style={{ fontSize: '14px', color: '#6B7280', textDecoration: 'none' }}
            >
              ← Back to Match
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
