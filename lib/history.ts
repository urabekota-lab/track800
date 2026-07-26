import type { Workout } from './types'

/**
 * 過去の練習を振り返るための集計。
 * 画面側は表示だけに専念できるよう、計算はすべてここに置く。
 */

// ------------------------------------------------------------
// 月ごとのまとめ
// ------------------------------------------------------------

export interface MonthGroup {
  /** "2026-07" */
  key: string
  /** "2026年7月" */
  label: string
  workouts: Workout[]
  /** その月の総走行距離(m)。W-up などは記録していないので、記録した本数の合計 */
  meters: number
}

/** 1回の練習で記録された距離の合計 */
export function sessionMeters(w: Workout): number {
  return w.reps.reduce((a, r) => a + r.distance, 0)
}

export function monthGroups(workouts: Workout[]): MonthGroup[] {
  const map = new Map<string, Workout[]>()
  for (const w of workouts) {
    const key = w.date.slice(0, 7)
    const list = map.get(key)
    if (list) list.push(w)
    else map.set(key, [w])
  }

  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => ({
      key,
      label: `${key.slice(0, 4)}年${Number(key.slice(5, 7))}月`,
      workouts: [...list].sort((a, b) => b.date.localeCompare(a.date)),
      meters: list.reduce((a, w) => a + sessionMeters(w), 0),
    }))
}

// ------------------------------------------------------------
// 距離別の伸び
// ------------------------------------------------------------

export interface DistanceStat {
  distance: number
  /** その距離を走った練習の回数 */
  sessions: number
  /** 総本数 */
  reps: number
  /** 全期間で最も速い1本 */
  best: number
  bestDate: string
  /** 直近にその距離を走った練習の平均 */
  latestAvg: number
  latestDate: string
  /** その1つ前の練習の平均。比較できない場合は null */
  prevAvg: number | null
}

/** 距離ごとに、最速と直近の平均をまとめる */
export function distanceStats(workouts: Workout[]): DistanceStat[] {
  // 距離 → 練習日ごとの本数リスト
  const byDistance = new Map<number, Map<string, number[]>>()

  for (const w of workouts) {
    for (const r of w.reps) {
      if (r.distance <= 0 || r.seconds <= 0) continue
      let days = byDistance.get(r.distance)
      if (!days) {
        days = new Map()
        byDistance.set(r.distance, days)
      }
      const arr = days.get(w.date)
      if (arr) arr.push(r.seconds)
      else days.set(w.date, [r.seconds])
    }
  }

  const stats: DistanceStat[] = []
  const avg = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length

  for (const [distance, days] of byDistance) {
    // 日付の新しい順
    const sorted = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    const all = sorted.flatMap(([, times]) => times)

    let best = Infinity
    let bestDate = ''
    for (const [date, times] of sorted) {
      const m = Math.min(...times)
      if (m < best) {
        best = m
        bestDate = date
      }
    }

    stats.push({
      distance,
      sessions: sorted.length,
      reps: all.length,
      best,
      bestDate,
      latestAvg: avg(sorted[0][1]),
      latestDate: sorted[0][0],
      prevAvg: sorted.length >= 2 ? avg(sorted[1][1]) : null,
    })
  }

  return stats.sort((a, b) => a.distance - b.distance)
}

/** ある距離を走った練習を、新しい順に取り出す */
export function sessionsForDistance(workouts: Workout[], distance: number) {
  return workouts
    .map((w) => {
      const times = w.reps.filter((r) => r.distance === distance).map((r) => r.seconds)
      return times.length > 0
        ? {
            date: w.date,
            title: w.title,
            effort: w.effort,
            times: [...times].sort((a, b) => a - b),
            best: Math.min(...times),
            avg: times.reduce((a, x) => a + x, 0) / times.length,
          }
        : null
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.date.localeCompare(a.date))
}

// ------------------------------------------------------------
// 推移
// ------------------------------------------------------------

export interface TrendPoint {
  date: string
  seconds: number
}

export interface DistanceTrend {
  distance: number
  points: TrendPoint[]
  /** 最も速かった回 */
  best: TrendPoint | null
  /** 最初と最後の差（秒）。負なら短縮している */
  change: number | null
}

/**
 * 同じ距離のセッション平均を並べて推移を出す。
 *
 * 「その日までの記録で 800m 推定を出し直す」方式は使わない。
 * 推定に使えるモデル（400mから／距離換算／CS）が時期によって増減するため、
 * 実力ではなく「記録の構成の変化」がグラフに出てしまい、
 * 速くなっているのに遅くなったように見えることがある。
 *
 * 同一距離の比較なら換算もモデル選択も挟まらないので、素直に速さの変化を表せる。
 */
export function distanceTrend(workouts: Workout[], distance: number, maxPoints = 30): DistanceTrend {
  const points: TrendPoint[] = sessionsForDistance(workouts, distance)
    .map((s) => ({ date: s.date, seconds: s.avg }))
    // sessionsForDistance は新しい順なので、グラフ用に古い順へ
    .reverse()
    .slice(-maxPoints)

  if (points.length === 0) return { distance, points: [], best: null, change: null }

  const best = points.reduce((a, p) => (p.seconds < a.seconds ? p : a))
  const change = points.length >= 2 ? points[points.length - 1].seconds - points[0].seconds : null

  return { distance, points, best, change }
}

/** 推移を出せる距離（同じ距離で2回以上走っているもの）を、記録が多い順に返す */
export function trendableDistances(workouts: Workout[]): number[] {
  return distanceStats(workouts)
    .filter((s) => s.sessions >= 2)
    .sort((a, b) => b.sessions - a.sessions || a.distance - b.distance)
    .map((s) => s.distance)
}
