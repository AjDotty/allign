'use server'

import { createClient } from '@/lib/supabase/server'

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function percentileRank(values: number[], value: number): number {
  if (values.length <= 1) return 50
  const below = values.filter(v => v < value).length
  return (below / (values.length - 1)) * 100
}

type VEIResult = {
  playerName: string
  veiIndex: number
  isValid: boolean
  positionGroup: string
  profile?: {
    finisher: number
    creator: number
    progressor: number
    disruptor: number
    security: number
  }
}

export async function computeVEI(
  matchId: string
): Promise<
  | { success: true; results: VEIResult[] }
  | { success: false; error: string }
> {
  try {
    const supabase = await createClient()

    // Step 1: fetch all match_events for matchId
    const { data: events, error: eventsError } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)

    if (eventsError) throw new Error(eventsError.message)

    // Step 2: fetch match_lineups joined with players
    const { data: lineups, error: lineupsError } = await supabase
      .from('match_lineups')
      .select('player_id, position_group, minutes_played, players(id, name)')
      .eq('match_id', matchId)

    if (lineupsError) throw new Error(lineupsError.message)

    // Step 3: fetch match for organisation_id and duration
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('organisation_id, duration_minutes')
      .eq('id', matchId)
      .single()

    if (matchError) throw new Error(matchError.message)

    const organisationId = match.organisation_id
    const matchDuration: number = match.duration_minutes ?? 50

    console.log('[VEI] match duration:', match?.duration_minutes)
    console.log('[VEI] lineups:', (lineups ?? []).map(l => ({
      player_id: l.player_id,
      minutes_played: l.minutes_played,
    })))

    // Step 4: For each lineup entry, compute raw metrics
    type RawMetrics = {
      playerId: string
      playerName: string
      positionGroup: string
      hasHvDef: boolean
      minutesPlayed: number
      weightedInvolvement: number
      att3Rate: number
      shotvolRate: number
      dribbleRate: number
      passGrade: number
      shotGrade: number
      carryGrade: number
      dribbleGrade: number
      goalRate: number
      bigchanceRate: number
      hvdefRate: number
      hvdefGrade: number
    }

    const allMetrics: RawMetrics[] = (lineups ?? []).map(lu => {
      const playerArr = Array.isArray(lu.players) ? lu.players : lu.players ? [lu.players] : []
      const playerName = (playerArr[0] as any)?.name ?? 'Unknown'

      const mp = lu.minutes_played && lu.minutes_played > 0
        ? lu.minutes_played
        : matchDuration

      console.log('[VEI] computing for player:', lu.player_id, 'mp:', mp)

      const playerEvents = (events ?? []).filter(e => e.player_id === lu.player_id)

      const weightedInvolvement =
        playerEvents.reduce((sum, e) => sum + (e.difficulty_weight ?? 0), 0) / mp * 10

      const att3Rate =
        playerEvents.filter(e => e.attacking_third).length / mp * 10

      const shotvolRate =
        playerEvents.filter(e => e.event_type === 'shot').length / mp * 10

      const dribbleRate =
        playerEvents.filter(e => e.event_type === 'dribble').length / mp * 10

      const passGrade = mean(
        playerEvents.filter(e => e.event_type === 'pass').map(e => e.grade)
      )

      const shotGrade = mean(
        playerEvents.filter(e => e.event_type === 'shot').map(e => e.grade)
      )

      const carryGrade = mean(
        playerEvents.filter(e => e.event_type === 'carry').map(e => e.grade)
      )

      const dribbleGrade = mean(
        playerEvents.filter(e => e.event_type === 'dribble').map(e => e.grade)
      )

      const goalRate =
        playerEvents.filter(e => e.is_goal).length / mp * 10

      const bigchanceRate =
        playerEvents.filter(e => e.is_big_chance).length / mp * 10

      const hvdefRate =
        playerEvents.filter(e => e.is_hv_def).length / mp * 10

      const hvdefGrade = mean(
        playerEvents.filter(e => e.is_hv_def).map(e => e.grade)
      )

      const hasHvDef = playerEvents.some(e => e.is_hv_def)

      return {
        playerId: lu.player_id,
        playerName,
        positionGroup: lu.position_group,
        hasHvDef,
        minutesPlayed: mp,
        weightedInvolvement,
        att3Rate,
        shotvolRate,
        dribbleRate,
        passGrade,
        shotGrade,
        carryGrade,
        dribbleGrade,
        goalRate,
        bigchanceRate,
        hvdefRate,
        hvdefGrade,
      }
    })

    // Step 5: Percentile computation within position group
    const metricKeys = [
      'weightedInvolvement',
      'att3Rate',
      'shotvolRate',
      'dribbleRate',
      'passGrade',
      'shotGrade',
      'carryGrade',
      'dribbleGrade',
      'goalRate',
      'bigchanceRate',
      'hvdefRate',
      'hvdefGrade',
    ] as const

    const uniquePositionGroups = [...new Set(allMetrics.map(m => m.positionGroup))]

    const percentileMap = new Map<string, Record<string, number>>()

    for (const group of uniquePositionGroups) {
      const groupMetrics = allMetrics.filter(m => m.positionGroup === group)

      for (const player of groupMetrics) {
        const pct: Record<string, number> = {}

        for (const key of metricKeys) {
          const allValues = groupMetrics.map(m => m[key])
          pct[key] = percentileRank(allValues, player[key])
        }

        percentileMap.set(player.playerId, pct)
      }
    }

    // Step 6: Compute sub-scores per player
    const results: VEIResult[] = []

    const upsertRows: Record<string, unknown>[] = []

    for (const m of allMetrics) {
      const pct = percentileMap.get(m.playerId)!

      const volumeScore =
        pct.weightedInvolvement * 0.45 +
        pct.att3Rate * 0.25 +
        pct.shotvolRate * 0.15 +
        pct.dribbleRate * 0.15

      const efficiencyScore =
        pct.passGrade * 0.35 +
        pct.carryGrade * 0.25 +
        pct.dribbleGrade * 0.25 +
        pct.shotGrade * 0.15

      const impactScore =
        pct.goalRate * 0.35 +
        pct.bigchanceRate * 0.25 +
        pct.hvdefRate * 0.25 +
        pct.hvdefGrade * 0.15

      const vei = volumeScore * 0.30 + efficiencyScore * 0.35 + impactScore * 0.35
      const veiIndex = Math.round(vei / 10 * 10) / 10

      const isValid = m.hasHvDef
      const invalidReason = isValid ? null : 'No HV Defensive Action graded'

      upsertRows.push({
        match_id: matchId,
        player_id: m.playerId,
        organisation_id: organisationId,
        position_group: m.positionGroup,
        minutes_played: Number(m.minutesPlayed) || 50,
        spec_version: 'v2',
        weighted_involvement: Number(m.weightedInvolvement) || 0,
        att3_rate: Number(m.att3Rate) || 0,
        shotvol_rate: Number(m.shotvolRate) || 0,
        dribble_rate: Number(m.dribbleRate) || 0,
        pass_grade: Number(m.passGrade) || 0,
        shot_grade: Number(m.shotGrade) || 0,
        carry_grade: Number(m.carryGrade) || 0,
        dribble_grade: Number(m.dribbleGrade) || 0,
        goal_rate: Number(m.goalRate) || 0,
        bigchance_rate: Number(m.bigchanceRate) || 0,
        hvdef_rate: Number(m.hvdefRate) || 0,
        hvdef_grade: Number(m.hvdefGrade) || 0,
        // Percentile columns (0-100 within position group)
        pass_grade_pct: Number(pct.passGrade) || 0,
        shot_grade_pct: Number(pct.shotGrade) || 0,
        carry_grade_pct: Number(pct.carryGrade) || 0,
        dribble_grade_pct: Number(pct.dribbleGrade) || 0,
        att3_pct: Number(pct.att3Rate) || 0,
        shotvol_pct: Number(pct.shotvolRate) || 0,
        dribble_rate_pct: Number(pct.dribbleRate) || 0,
        goal_pct: Number(pct.goalRate) || 0,
        bigchance_pct: Number(pct.bigchanceRate) || 0,
        hvdef_pct: Number(pct.hvdefRate) || 0,
        hvdef_grade_pct: Number(pct.hvdefGrade) || 0,
        weighted_involvement_pct: Number(pct.weightedInvolvement) || 0,
        volume_score: Number(volumeScore) || 0,
        efficiency_score: Number(efficiencyScore) || 0,
        impact_score: Number(impactScore) || 0,
        vei: Number(vei) || 0,
        vei_index: Number(veiIndex) || 0,
        is_valid: isValid,
        invalid_reason: invalidReason ?? null,
      })

      results.push({
        playerName: m.playerName,
        veiIndex,
        isValid,
        positionGroup: m.positionGroup,
      })
    }

    // Step 7: Upsert to player_match_vei
    console.log('[VEI] upsert rows:', upsertRows.map(r => ({
      match_id: r.match_id,
      player_id: r.player_id,
      volume_score: r.volume_score,
      efficiency_score: r.efficiency_score,
      impact_score: r.impact_score,
      vei: (r.volume_score as number) * 0.30 + (r.efficiency_score as number) * 0.35 + (r.impact_score as number) * 0.35,
      vei_index: r.vei_index,
      is_valid: r.is_valid,
    })))

    const { error: upsertError } = await supabase
      .from('player_match_vei')
      .upsert(upsertRows, { onConflict: 'match_id,player_id' })

    if (upsertError) throw new Error(upsertError.message)

    // Step 8: Compute and upsert player profiles (season averages)
    for (const m of allMetrics) {
      const { data: allVeiRows } = await supabase
        .from('player_match_vei')
        .select('*')
        .eq('player_id', m.playerId)
        .eq('organisation_id', organisationId)
        .eq('is_valid', true)

      if (!allVeiRows || allVeiRows.length === 0) continue

      const avg = (key: string) =>
        allVeiRows.reduce((sum, r) => sum + (Number((r as any)[key]) || 0), 0) / allVeiRows.length

      const avgPassGradePct         = avg('pass_grade_pct') || 50
      const avgShotGradePct         = avg('shot_grade_pct') || 50
      const avgCarryGradePct        = avg('carry_grade_pct') || 50
      const avgDribbleGradePct      = avg('dribble_grade_pct') || 50
      const avgAtt3Pct              = avg('att3_pct') || 50
      const avgGoalPct              = avg('goal_pct') || 50
      const avgBigchancePct         = avg('bigchance_pct') || 50
      const avgHvdefPct             = avg('hvdef_pct') || 50
      const avgHvdefGradePct        = avg('hvdef_grade_pct') || 50
      const avgWeightedInvolvementPct = avg('weighted_involvement_pct') || 50
      const avgShotvolPct           = avg('shotvol_pct') || 50
      const avgDribbleRatePct       = avg('dribble_rate_pct') || 50

      const finisher = Math.min(100, Math.max(0,
        avgGoalPct * 0.40 +
        avgBigchancePct * 0.35 +
        avgShotGradePct * 0.25
      ))

      const creator = Math.min(100, Math.max(0,
        avgPassGradePct * 0.40 +
        avgAtt3Pct * 0.30 +
        avgBigchancePct * 0.30
      ))

      const progressor = Math.min(100, Math.max(0,
        avgCarryGradePct * 0.35 +
        avgDribbleGradePct * 0.35 +
        avgWeightedInvolvementPct * 0.30
      ))

      const disruptor = Math.min(100, Math.max(0,
        avgHvdefPct * 0.45 +
        avgHvdefGradePct * 0.35 +
        avgShotvolPct * 0.20
      ))

      const security = Math.min(100, Math.max(0,
        avgPassGradePct * 0.40 +
        avgCarryGradePct * 0.30 +
        avgDribbleRatePct * 0.30
      ))

      const r2 = Math.round
      await supabase
        .from('player_profiles')
        .upsert({
          player_id: m.playerId,
          organisation_id: organisationId,
          finisher:    r2(finisher * 100) / 100,
          creator:     r2(creator * 100) / 100,
          progressor:  r2(progressor * 100) / 100,
          disruptor:   r2(disruptor * 100) / 100,
          security:    r2(security * 100) / 100,
          matches_included: allVeiRows.length,
          spec_version: 'v1',
          computed_at: new Date().toISOString(),
        }, { onConflict: 'player_id,organisation_id' })

      // Attach profile to results
      const resultEntry = results.find(r => r.playerName === m.playerName)
      if (resultEntry) {
        resultEntry.profile = {
          finisher:   r2(finisher * 100) / 100,
          creator:    r2(creator * 100) / 100,
          progressor: r2(progressor * 100) / 100,
          disruptor:  r2(disruptor * 100) / 100,
          security:   r2(security * 100) / 100,
        }
      }
    }

    return { success: true, results }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
