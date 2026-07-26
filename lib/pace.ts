import type {
  Effort, Level, PersonalBest, Prediction, PredictionSource,
  RunnerType, Workout, ZoneKey,
} from './types'

// ============================================================
// タイム文字列の相互変換
// ============================================================

/**
 * "2:05.43" / "2'05" / "125.4" / "58.2" などを秒に変換する。
 * 解釈できない場合は null。
 */
export function parseTime(input: string): number | null {
  const s = input.trim().replace(/["'’＇]/g, ':').replace(/[：]/g, ':')
  if (!s) return null

  const parts = s.split(':').filter((p) => p !== '')
  if (parts.length === 0 || parts.length > 3) return null
  if (parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null

  const nums = parts.map(Number)
  if (nums.some((n) => !isFinite(n))) return null

  // 3要素は h:mm:ss、2要素は mm:ss、1要素はそのまま秒
  const total =
    nums.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2]
    : nums.length === 2 ? nums[0] * 60 + nums[1]
    : nums[0]

  return total > 0 ? total : null
}

/** 秒を "2:05.43" 形式へ。60秒未満は "58.20" のように分を省く */
export function formatTime(seconds: number | null | undefined, decimals = 2): string {
  if (seconds == null || !isFinite(seconds) || seconds <= 0) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  if (m === 0) return s.toFixed(decimals)
  return `${m}:${s.toFixed(decimals).padStart(decimals > 0 ? decimals + 3 : 2, '0')}`
}

/** レストなど「秒数だが小数不要」な値の表示。90 → "1'30" */
export function formatRest(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds) || seconds <= 0) return '-'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds - m * 60)
  if (m === 0) return `${s}秒`
  return s === 0 ? `${m}分` : `${m}分${s}秒`
}

/** 距離とタイムから km あたりのペース表示 */
export function formatPacePerKm(distance: number, seconds: number): string {
  if (distance <= 0 || seconds <= 0) return '-'
  return `${formatTime((seconds / distance) * 1000, 0)}/km`
}

// ============================================================
// 練習の1本を「単発全力相当」に換算する係数
// ============================================================

/**
 * レスト条件が厳しいほど、同じ力でもタイムは遅く出る。
 * 予測モデルには「フレッシュな状態で単発全力を出したら何秒か」を渡したいので、
 * 練習条件に応じてタイムを割り引く。
 * 経験則ベースの係数であり、厳密な生理学的定数ではない。
 */
const EFFORT_FACTOR: Record<Effort, number> = {
  trial: 1.0,        // レース・タイムトライアル（そのまま使える）
  repetition: 0.995, // 完全回復レペティション
  interval: 0.985,   // 短〜中レストのインターバル
  continuous: 0.97,  // 連続走・変化走・ビルドアップ
}

export const EFFORT_LABEL: Record<Effort, string> = {
  trial: 'レース / TT',
  repetition: 'レペ（完全回復）',
  interval: 'インターバル',
  continuous: '連続走 / 変化走',
}

// ============================================================
// Critical Speed モデル
// ============================================================

export interface PerfPoint {
  distance: number
  seconds: number
  origin: string // 由来の説明（UI 表示用）
}

export interface CsFit {
  cs: number // m/s
  dPrime: number // m
  r2: number
  points: number
}

/**
 * CS モデルが成立する距離帯。
 * このモデルは概ね 2〜15 分の全力持続に対して線形になる前提なので、
 * 400m のような短距離を混ぜると CS が過大・D' が過小に歪む。
 */
const CS_MIN_DISTANCE = 600
const CS_MAX_DISTANCE = 5000

/**
 * 距離の異なる複数の全力相当の記録から D = CS·t + D' を最小二乗フィットする。
 * CS は有酸素的に維持できる速度、D' はそれを超えて使える「貯金」の距離。
 * 中距離のパフォーマンス予測で標準的に使われるモデル。
 */
export function fitCriticalSpeed(points: PerfPoint[]): CsFit | null {
  const pts = dedupeByDistance(points)
    .filter((p) => p.distance >= CS_MIN_DISTANCE && p.distance <= CS_MAX_DISTANCE)
  if (pts.length < 2) return null

  const n = pts.length
  const sumT = pts.reduce((a, p) => a + p.seconds, 0)
  const sumD = pts.reduce((a, p) => a + p.distance, 0)
  const sumTT = pts.reduce((a, p) => a + p.seconds * p.seconds, 0)
  const sumTD = pts.reduce((a, p) => a + p.seconds * p.distance, 0)

  const denom = n * sumTT - sumT * sumT
  if (Math.abs(denom) < 1e-9) return null

  const cs = (n * sumTD - sumT * sumD) / denom
  const dPrime = (sumD - cs * sumT) / n

  // 中距離選手として現実的な範囲から外れたフィットは信用しない
  if (!isFinite(cs) || !isFinite(dPrime)) return null
  if (cs < 2.5 || cs > 9) return null
  if (dPrime < 20 || dPrime > 600) return null

  const meanD = sumD / n
  const ssTot = pts.reduce((a, p) => a + (p.distance - meanD) ** 2, 0)
  const ssRes = pts.reduce((a, p) => a + (p.distance - (cs * p.seconds + dPrime)) ** 2, 0)
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0

  return { cs, dPrime, r2, points: n }
}

/** CS モデルから任意距離のタイムを予測する */
export function predictFromCs(fit: CsFit, distance: number): number | null {
  if (distance <= fit.dPrime) return null
  const t = (distance - fit.dPrime) / fit.cs
  return t > 0 ? t : null
}

/** 同一距離が複数あれば速い方だけ残す */
function dedupeByDistance(points: PerfPoint[]): PerfPoint[] {
  const best = new Map<number, PerfPoint>()
  for (const p of points) {
    if (p.distance <= 0 || p.seconds <= 0) continue
    const cur = best.get(p.distance)
    if (!cur || p.seconds < cur.seconds) best.set(p.distance, p)
  }
  return [...best.values()].sort((a, b) => a.distance - b.distance)
}

// ============================================================
// VDOT（Jack Daniels）— 持久力側のアンカー
// ============================================================

function pctVo2max(minutes: number): number {
  return 0.8
    + 0.1894393 * Math.exp(-0.012778 * minutes)
    + 0.2989558 * Math.exp(-0.1932605 * minutes)
}

function vo2FromVelocity(metersPerMin: number): number {
  return -4.6 + 0.182258 * metersPerMin + 0.000104 * metersPerMin * metersPerMin
}

export function vdot(distance: number, seconds: number): number | null {
  if (distance <= 0 || seconds <= 0) return null
  const minutes = seconds / 60
  const v = distance / minutes
  const value = vo2FromVelocity(v) / pctVo2max(minutes)
  return isFinite(value) && value > 0 ? value : null
}

/** VDOT から指定距離のタイムを逆算する（単調性を利用した二分探索） */
export function timeFromVdot(targetVdot: number, distance: number): number | null {
  if (targetVdot <= 0 || distance <= 0) return null
  let lo = distance / 12 // 12 m/s より速いことはない
  let hi = distance / 1.5 // 1.5 m/s より遅いことはない
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const v = vdot(distance, mid)
    if (v == null) return null
    // タイムが遅いほど VDOT は下がる
    if (v > targetVdot) lo = mid
    else hi = mid
  }
  const result = (lo + hi) / 2
  return isFinite(result) ? result : null
}

// ============================================================
// 400m ベストからの推定（スピードリザーブ方式）
// ============================================================

/** 800m ≒ 400mPB × 2 + K。K は「持久力の上乗せ分」 */
const K_BASE = 11.5
const K_BY_TYPE: Record<RunnerType, number> = { speed: 2.5, balanced: 0, endurance: -2.0 }
const K_BY_LEVEL: Record<Level, number> = { jhs: 2.0, hs: 0.5, univ: -0.5, masters: 0.5 }

export function predict800FromPb400(sec400: number, type: RunnerType, level: Level): number {
  return sec400 * 2 + K_BASE + K_BY_TYPE[type] + K_BY_LEVEL[level]
}

// ============================================================
// 距離換算テーブル
// ============================================================

/**
 * 800m を 1.0 としたときの各距離の所要時間比。
 * 「800m を主戦場にする選手」の典型的なプロフィールを基準にしている。
 * 例: 800m 2:00 の選手なら 400m は 120 × 0.4417 = 53.0 秒。
 *
 * Riegel 式（指数 1.06）は 800m と 1500m の間では実測と合わない
 * （実際の 800/1500 比から逆算すると指数は約 1.19 になる）ため、
 * 短中距離では指数式ではなくこの実測ベースの比を使う。
 */
const RATIO_TABLE: [distance: number, ratio: number][] = [
  [200, 0.204],
  [300, 0.318],
  [400, 0.4417],
  [500, 0.575],
  [600, 0.7167],
  [800, 1.0],
  [1000, 1.308],
  [1500, 2.11],
  [3000, 4.72],
  [5000, 8.2],
]

/** 選手タイプによる比の補正。持久型は長い距離が相対的に強い */
function typeAdjust(distance: number, type: RunnerType): number {
  if (type === 'balanced' || distance === 800) return 1
  const short = distance < 800
  if (type === 'speed') return short ? 0.985 : 1.03
  return short ? 1.015 : 0.97
}

/** 対数距離で線形補間して、任意の距離の比を得る */
function ratioAt(distance: number, type: RunnerType): number | null {
  const table = RATIO_TABLE
  if (distance < table[0][0] || distance > table[table.length - 1][0]) return null

  let base = table[table.length - 1][1]
  for (let i = 0; i < table.length - 1; i++) {
    const [d0, r0] = table[i]
    const [d1, r1] = table[i + 1]
    if (distance >= d0 && distance <= d1) {
      const t = (Math.log(distance) - Math.log(d0)) / (Math.log(d1) - Math.log(d0))
      base = r0 + (r1 - r0) * t
      break
    }
  }
  return base * typeAdjust(distance, type)
}

/** ある距離の記録を 800m 相当のタイムに換算する */
export function convertTo800(distance: number, seconds: number, type: RunnerType): number | null {
  const ratio = ratioAt(distance, type)
  if (!ratio || ratio <= 0) return null
  return seconds / ratio
}

/**
 * 換算元として 800m にどれだけ近いかの重み。
 * 1000m の記録は 3000m の記録よりはるかに 800m を語る。
 */
function closeness(distance: number): number {
  const z = Math.log(distance / 800) / 0.55
  return Math.exp(-z * z)
}

// ============================================================
// 800m 予測の統合
// ============================================================

export interface PredictInput {
  personalBests: PersonalBest[]
  workouts: Workout[]
  runnerType: RunnerType
  level: Level
  /** 練習ログを何日分さかのぼるか */
  windowDays?: number
}

/** 練習ログを「単発全力相当」のパフォーマンス点に変換する */
export function workoutsToPoints(workouts: Workout[], windowDays = 120): PerfPoint[] {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000
  const points: PerfPoint[] = []

  for (const w of workouts) {
    const ts = Date.parse(w.date)
    if (isFinite(ts) && ts < cutoff) continue

    // セッション中の最速本を「その日の力」の代表値とする
    const byDistance = new Map<number, number>()
    for (const rep of w.reps) {
      if (rep.distance <= 0 || rep.seconds <= 0) continue
      const cur = byDistance.get(rep.distance)
      if (cur == null || rep.seconds < cur) byDistance.set(rep.distance, rep.seconds)
    }

    const factor = EFFORT_FACTOR[w.effort] ?? EFFORT_FACTOR.interval
    for (const [distance, seconds] of byDistance) {
      points.push({
        distance,
        seconds: seconds * factor,
        origin: `${w.date} ${w.title || EFFORT_LABEL[w.effort]}`,
      })
    }
  }
  return points
}

export function predict800(input: PredictInput): Prediction {
  const { personalBests, workouts, runnerType, level } = input
  const advice: string[] = []

  const pbPoints: PerfPoint[] = personalBests
    .filter((pb) => pb.distance > 0 && pb.seconds > 0)
    .map((pb) => ({ distance: pb.distance, seconds: pb.seconds, origin: '自己ベスト' }))

  const workoutPoints = workoutsToPoints(workouts, input.windowDays ?? 120)
  const points = dedupeByDistance([...pbPoints, ...workoutPoints])

  const empty: Prediction = {
    seconds: null, rangeLow: null, rangeHigh: null, confidence: 0,
    sources: [], criticalSpeed: null, dPrime: null, vdot: null, advice,
  }

  if (points.length === 0) {
    advice.push('自己ベストを1つ登録するか、練習を1回記録すると推定が始まります。')
    return empty
  }

  const sources: PredictionSource[] = []

  // --- 1) Critical Speed モデル ---
  // 800m に外挿するので、距離の広がりがあるほど信頼できる
  const fit = fitCriticalSpeed(points)
  let csSeconds: number | null = null
  if (fit) {
    const csPoints = points.filter((p) => p.distance >= 600 && p.distance <= 5000)
    const spread = csPoints[csPoints.length - 1].distance / csPoints[0].distance
    csSeconds = spread >= 1.5 ? predictFromCs(fit, 800) : null
    if (csSeconds) {
      // 2点だけのフィットは必ず R²=1 になるので、点数が増えるまで質を割り引く
      const pointBonus = fit.points >= 3 ? Math.min(1, fit.r2) : 0.6
      const spreadBonus = Math.min(1, 0.5 + (spread - 1.5) / 2)
      sources.push({
        method: 'cs',
        label: '練習内容から（CSモデル）',
        seconds: csSeconds,
        weight: 0.45 * pointBonus * spreadBonus,
        detail: `CS ${fit.cs.toFixed(2)}m/s ・ D' ${Math.round(fit.dPrime)}m ・ ${fit.points}点${fit.points >= 3 ? ` (R²${fit.r2.toFixed(2)})` : ''}`,
      })
    }
  }

  // --- 2) 400m ベストからのスピードリザーブ方式 ---
  const p400 = points.find((p) => p.distance >= 380 && p.distance <= 420)
  if (p400) {
    const sec = predict800FromPb400(p400.seconds, runnerType, level)
    sources.push({
      method: 'pb400',
      label: '400mの走力から',
      seconds: sec,
      weight: 0.3,
      detail: `400m ${formatTime(p400.seconds)} × 2 ＋ 上乗せ ${(sec - p400.seconds * 2).toFixed(1)}秒`,
    })
  }

  // --- 3) 各記録を 800m 相当に換算して、800m に近い距離ほど重く平均する ---
  // 400m 前後は 2) が担当するので二重計上しない
  const equivPoints = points
    .filter((p) => p.distance >= 250 && p.distance <= 5000)
    .filter((p) => !(p.distance >= 380 && p.distance <= 420))
    .map((p) => ({ p, seconds: convertTo800(p.distance, p.seconds, runnerType), w: closeness(p.distance) }))
    .filter((x): x is { p: PerfPoint; seconds: number; w: number } => x.seconds != null)

  let bestCloseness = p400 ? closeness(400) : 0
  if (equivPoints.length > 0) {
    const wSum = equivPoints.reduce((a, x) => a + x.w, 0)
    const equivSeconds = equivPoints.reduce((a, x) => a + x.seconds * x.w, 0) / wSum
    const nearest = equivPoints.reduce((a, x) => (x.w > a.w ? x : a))
    bestCloseness = Math.max(bestCloseness, nearest.w)

    sources.push({
      method: 'equiv',
      label: '記録の距離換算から',
      seconds: equivSeconds,
      weight: 0.45,
      detail: `${nearest.p.distance}m ${formatTime(nearest.p.seconds)} を中心に ${equivPoints.length}件を換算`,
    })
  }

  if (sources.length === 0) {
    advice.push('800m の推定には、250m〜5000m の全力に近い記録が必要です。')
    advice.push('まずは 400m か 1000m の全力タイムを登録してみてください。')
    return empty
  }

  const totalWeight = sources.reduce((a, s) => a + s.weight, 0)
  const seconds = sources.reduce((a, s) => a + s.seconds * s.weight, 0) / totalWeight

  // --- 信頼度 ---
  // 「800m にどれだけ近い距離の記録を持っているか」が最も効く
  let confidence = 0.2
  if (csSeconds != null && fit) confidence += 0.2 + (fit.points >= 3 ? 0.1 * Math.min(1, fit.r2) : 0)
  if (p400) confidence += 0.15
  confidence += 0.45 * bestCloseness
  if (points.length >= 4) confidence += 0.05
  if (personalBests.length > 0) confidence += 0.05

  // 別々のモデルが違う答えを出しているなら、それだけ確信は持てない
  const disagreement = sources.length > 1
    ? (Math.max(...sources.map((s) => s.seconds)) - Math.min(...sources.map((s) => s.seconds))) / seconds
    : 0
  confidence = Math.min(0.95, confidence) - Math.min(0.3, disagreement * 4)
  confidence = Math.max(0.1, confidence)

  // レンジは信頼度だけから決める（表示上の「精度」と必ず整合させる）
  const half = Math.max(1.0, seconds * (0.008 + 0.05 * (1 - confidence)))

  // --- 持久力の指標（予測には使わず、参考値として表示する） ---
  // VDOT は 1500m 未満では信頼できないので、長い記録があるときだけ出す
  const longest = [...points].reverse().find((p) => p.distance >= 1500)
  const vdotValue = longest ? vdot(longest.distance, longest.seconds) : null

  // --- 精度を上げるための助言 ---
  if (!p400) advice.push('400m の全力タイムを登録すると、スピード面の精度が上がります。')
  if (bestCloseness < closeness(1000)) {
    advice.push('600m〜1000m の記録が 800m の予測に一番効きます。1本測ってみましょう。')
  }
  if (csSeconds == null) {
    advice.push('600m 以上で距離の違う記録が2種類そろうと、CSモデルによる推定が加わります。')
  }
  if (!longest) advice.push('1500m 以上の記録があると、持久力の指標（VDOT）も表示されます。')

  return {
    seconds,
    rangeLow: seconds - half,
    rangeHigh: seconds + half,
    confidence,
    sources: sources.map((s) => ({ ...s, weight: s.weight / totalWeight })),
    criticalSpeed: fit?.cs ?? null,
    dPrime: fit?.dPrime ?? null,
    vdot: vdotValue,
    advice,
  }
}

// ============================================================
// ペースゾーン
// ============================================================

export interface Zone {
  key: ZoneKey
  name: string
  /** 800m レース速度に対する速度比の下限・上限 */
  lo: number
  hi: number
  color: string
  purpose: string
}

/**
 * 800m レース速度（v800）を基準にしたゾーン定義。
 * 例: 2:00 の選手なら v800 = 6.67m/s。閾値走は 0.71 倍 ≒ 4.73m/s ≒ 3'31/km。
 */
export const ZONES: Zone[] = [
  { key: 'jog', name: 'ジョグ', lo: 0.44, hi: 0.52, color: '#64748b', purpose: 'W-up・回復・土台づくり' },
  { key: 'threshold', name: '閾値走', lo: 0.68, hi: 0.74, color: '#0d9488', purpose: '乳酸を処理する力を上げる' },
  { key: 'vo2', name: 'VO2max（3000mP）', lo: 0.78, hi: 0.84, color: '#2563eb', purpose: '最大酸素摂取量を上げる' },
  { key: 'pace1500', name: '1500mペース', lo: 0.86, hi: 0.91, color: '#7c3aed', purpose: 'スピード持久の中核' },
  { key: 'race', name: '800mレースペース', lo: 0.98, hi: 1.02, color: '#dc2626', purpose: 'レース感覚とリズム' },
  { key: 'speed', name: 'スピード', lo: 1.03, hi: 1.08, color: '#ea580c', purpose: '乳酸耐性・ラスト勝負' },
  { key: 'sprint', name: 'スプリント', lo: 1.09, hi: 1.15, color: '#db2777', purpose: '最高速度・神経系' },
]

export function zoneOf(key: ZoneKey): Zone | null {
  return ZONES.find((z) => z.key === key) ?? null
}

/** 800m 予測タイムから基準速度 v800 (m/s) を得る */
export function velocity800(pred800Sec: number): number {
  return 800 / pred800Sec
}

/** ゾーン × 距離 の目標タイム帯（秒）。速い側が fast */
export function zoneRange(zone: Zone, pred800Sec: number, distance: number): { fast: number; slow: number } {
  const v = velocity800(pred800Sec)
  return {
    fast: distance / (v * zone.hi),
    slow: distance / (v * zone.lo),
  }
}

/** ゾーン × 距離 の目標タイム（中央値、秒） */
export function zoneTarget(key: ZoneKey, pred800Sec: number, distance: number): number | null {
  const zone = zoneOf(key)
  if (!zone || key === 'none' || distance <= 0 || pred800Sec <= 0) return null
  const v = velocity800(pred800Sec) * ((zone.lo + zone.hi) / 2)
  return distance / v
}

// ============================================================
// レース展開・換算タイム
// ============================================================

/** 800m の理想的な 200m ごとの通過（わずかな positive split） */
const SPLIT_FRACTIONS = [0.2295, 0.2495, 0.254, 0.267]

export interface RaceSplit {
  point: number // m
  lap: number // 直近200mの区間タイム
  cumulative: number // 通過タイム
}

export function raceSplits(pred800Sec: number): RaceSplit[] {
  let cumulative = 0
  return SPLIT_FRACTIONS.map((f, i) => {
    const lap = pred800Sec * f
    cumulative += lap
    return { point: (i + 1) * 200, lap, cumulative }
  })
}

/** 換算タイムを表示する距離 */
const EQUIV_DISTANCES = [400, 600, 1000, 1500, 3000]

/**
 * 800m 予測タイムから他距離の目安タイムを出す。
 * convertTo800 と同じ比を使っているので、両者は必ず逆算の関係になる。
 */
export function equivalentTimes(pred800Sec: number, type: RunnerType): { distance: number; seconds: number }[] {
  return EQUIV_DISTANCES
    .map((distance) => ({ distance, ratio: ratioAt(distance, type) }))
    .filter((x): x is { distance: number; ratio: number } => x.ratio != null)
    .map(({ distance, ratio }) => ({ distance, seconds: pred800Sec * ratio }))
}
