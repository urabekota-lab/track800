import { EFFORT_LABEL } from './pace'
import type { Phase, Workout } from './types'

/**
 * 1回の練習を分析する。
 * 800m は「最後まで垂れずに押せるか」で決まるので、落ち込みを最重要指標として扱う。
 */

export interface RepAnalysis {
  index: number
  distance: number
  seconds: number
  target: number | null
  /** 設定との差（秒）。負なら設定より速い */
  delta: number | null
}

export type VerdictKind = 'good' | 'warn' | 'info'

export interface WorkoutAnalysis {
  reps: RepAnalysis[]
  /** 同じ距離が3本以上あるときだけ出る、最終本と1本目の差（秒）。正なら垂れている */
  fade: number | null
  /** 落ち込みを1本目に対する割合(%)で表したもの */
  fadePct: number | null
  /** 本数間のばらつき（標準偏差, 秒） */
  spread: number | null
  /** 設定との平均差（秒）。負なら設定より速い */
  avgDelta: number | null
  /** 設定タイムを持つ本数と、そのうち設定以内で走れた本数 */
  onTarget: { hit: number; total: number } | null
  /** 短い総評 */
  verdict: string
  verdictKind: VerdictKind
}

/** 落ち込みをこの割合(%)以上出したら「垂れている」とみなす */
const FADE_WARN_PCT = 4

/** 設定よりこの秒数以上速いと「速すぎる」とみなす */
const TOO_FAST_SEC = 1.5

const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length

function stdev(xs: number[]): number | null {
  if (xs.length < 2) return null
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

export function analyzeWorkout(w: Workout): WorkoutAnalysis {
  const reps: RepAnalysis[] = w.reps.map((r, i) => ({
    index: i + 1,
    distance: r.distance,
    seconds: r.seconds,
    target: r.target ?? null,
    delta: r.target != null ? r.seconds - r.target : null,
  }))

  // 落ち込みは同じ距離の中でしか比べられない。
  // 一番本数の多い距離を代表として使う
  const byDistance = new Map<number, number[]>()
  for (const r of w.reps) {
    const arr = byDistance.get(r.distance)
    if (arr) arr.push(r.seconds)
    else byDistance.set(r.distance, [r.seconds])
  }
  const main = [...byDistance.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  const mainTimes = main?.[1] ?? []

  let fade: number | null = null
  let fadePct: number | null = null
  if (mainTimes.length >= 3) {
    fade = mainTimes[mainTimes.length - 1] - mainTimes[0]
    fadePct = (fade / mainTimes[0]) * 100
  }

  const spread = mainTimes.length >= 2 ? stdev(mainTimes) : null

  const withTarget = reps.filter((r) => r.delta != null)
  const avgDelta = withTarget.length > 0 ? mean(withTarget.map((r) => r.delta!)) : null
  const onTarget = withTarget.length > 0
    ? { hit: withTarget.filter((r) => r.delta! <= 0).length, total: withTarget.length }
    : null

  return { reps, fade, fadePct, spread, avgDelta, onTarget, ...verdictOf({ fadePct, avgDelta, spread, hasTarget: withTarget.length > 0 }) }
}

function verdictOf({ fadePct, avgDelta, spread, hasTarget }: {
  fadePct: number | null
  avgDelta: number | null
  spread: number | null
  hasTarget: boolean
}): { verdict: string; verdictKind: VerdictKind } {
  // 設定より大きく速い場合が最優先。狙った刺激から外れているため
  if (hasTarget && avgDelta != null && avgDelta < -TOO_FAST_SEC) {
    return {
      verdict: `設定より平均 ${Math.abs(avgDelta).toFixed(1)}秒 速く走っています。狙った刺激から外れている可能性があります。`,
      verdictKind: 'warn',
    }
  }
  if (fadePct != null && fadePct >= FADE_WARN_PCT) {
    return {
      verdict: `後半で ${fadePct.toFixed(1)}% 落ちています。設定を守り切れる範囲に下げるか、乳酸耐性の練習を増やしましょう。`,
      verdictKind: 'warn',
    }
  }
  if (hasTarget && avgDelta != null && avgDelta > TOO_FAST_SEC) {
    return {
      verdict: `設定より平均 ${avgDelta.toFixed(1)}秒 遅れています。疲労が残っているか、設定が今の力より速いかもしれません。`,
      verdictKind: 'info',
    }
  }
  if (fadePct != null && fadePct < 1.5 && (spread == null || spread < 1.0)) {
    return { verdict: '最後まで崩れずに揃っています。狙いどおりの練習です。', verdictKind: 'good' }
  }
  if (fadePct != null) {
    return { verdict: `落ち込みは ${fadePct.toFixed(1)}% で許容範囲です。`, verdictKind: 'good' }
  }
  return { verdict: '本数が少ないため、落ち込みは判定していません。', verdictKind: 'info' }
}

/** 一覧に出す1行サマリー */
export function shortSummary(w: Workout): string {
  const a = analyzeWorkout(w)
  const parts: string[] = [EFFORT_LABEL[w.effort]]
  if (a.fadePct != null) parts.push(`落ち込み ${a.fadePct.toFixed(1)}%`)
  if (a.onTarget) parts.push(`設定達成 ${a.onTarget.hit}/${a.onTarget.total}`)
  return parts.join(' ・ ')
}

// ------------------------------------------------------------
// 目標レースから時期を決める
// ------------------------------------------------------------

export interface SeasonInfo {
  /** レースまでの残り日数。過ぎていれば負 */
  daysLeft: number
  weeksLeft: number
  phase: Phase
  phaseReason: string
}

/**
 * レース日までの残り週数から時期を割り出す。
 * 大学は日程がはっきりしているので、手で時期を選ばせるより確実。
 */
export function seasonInfo(raceDate: string, today = new Date()): SeasonInfo | null {
  const t = Date.parse(`${raceDate}T00:00:00`)
  if (!isFinite(t)) return null

  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const daysLeft = Math.round((t - base) / (24 * 60 * 60 * 1000))
  const weeksLeft = Math.floor(daysLeft / 7)

  const { phase, phaseReason } =
    daysLeft < 0 ? { phase: 'base' as Phase, phaseReason: '目標レースは終了しています。次のレースを設定するか、準備期として土台づくりに戻りましょう。' }
    : weeksLeft >= 16 ? { phase: 'base' as Phase, phaseReason: 'レースまで4ヶ月以上あります。土台づくりの時期です。' }
    : weeksLeft >= 8 ? { phase: 'build' as Phase, phaseReason: 'レースまで2〜4ヶ月。スピード持久を積む鍛錬期です。' }
    : weeksLeft >= 3 ? { phase: 'peak' as Phase, phaseReason: 'レースまで3〜8週。質を上げる仕上げ期です。' }
    : { phase: 'race' as Phase, phaseReason: 'レースまで3週以内。量を落として鋭さを出す試合期です。' }

  return { daysLeft, weeksLeft, phase, phaseReason }
}
