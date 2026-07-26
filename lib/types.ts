// ---- 選手プロフィール ----

/** 競技カテゴリ。想定タイム幅と「400m からの上乗せ秒」の基準値に影響する */
export type Level = 'jhs' | 'hs' | 'univ' | 'masters'

/** 800m 選手のタイプ。400m 型か 1500m 型かで予測の重み付けを変える */
export type RunnerType = 'speed' | 'balanced' | 'endurance'

export type Role = 'athlete' | 'coach'

export interface Profile {
  displayName: string
  role: Role
  level: Level
  runnerType: RunnerType
  team: string
}

export interface PersonalBest {
  distance: number // m
  seconds: number
  recordedOn: string | null
}

// ---- 練習ログ ----

/**
 * 1本の走りが「単発全力」からどれだけ割り引かれた条件かを表す。
 * レスト条件が厳しいほど本来の力より遅いタイムになるため、
 * 予測時に単発全力相当へ換算する係数として使う（pace.ts の EFFORT_FACTOR）。
 */
export type Effort = 'trial' | 'repetition' | 'interval' | 'continuous'

export interface WorkoutRep {
  distance: number // m
  seconds: number
}

export interface Workout {
  id: string
  date: string // YYYY-MM-DD
  title: string
  effort: Effort
  reps: WorkoutRep[]
  restSec: number | null
  condition: number // 1(不調)〜5(絶好調)
  note: string
  menuId: string | null
}

// ---- メニュー ----

export type Phase = 'base' | 'build' | 'peak' | 'race'
export type SetKind = 'warmup' | 'main' | 'sub' | 'cooldown'

/** ペースゾーン。800m レース速度に対する割合で定義される（pace.ts の ZONES） */
export type ZoneKey =
  | 'jog'
  | 'threshold'
  | 'vo2'
  | 'pace1500'
  | 'race'
  | 'speed'
  | 'sprint'
  | 'none'

export interface MenuSet {
  key: string
  kind: SetKind
  /** 「300m × 5」のような見出し。distance/reps が 0 の場合の自由記述にも使う */
  label: string
  distance: number // m（0 なら距離指定なし＝ジョグや補強）
  reps: number
  sets: number // セット数。1 なら単一セット
  zone: ZoneKey
  targetSec: number | null // 1本あたりの目標秒（自動計算 or 手入力）
  restSec: number | null // 本間レスト
  setRestSec: number | null // セット間レスト
  note: string
}

export interface Menu {
  id: string
  title: string
  description: string
  phase: Phase
  level: Level
  focus: string
  sets: MenuSet[]
  /** 作成者名。共有コードから取り込んだものは元の作者名が入る */
  authorName: string
  /** 共有コードから取り込んだメニューかどうか */
  imported: boolean
  /** お気に入り。一覧の先頭に固定される */
  favorite: boolean
  createdAt: string
}

// ---- 予測 ----

export interface PredictionSource {
  method: 'cs' | 'pb400' | 'equiv'
  label: string
  seconds: number
  weight: number
  detail: string
}

export interface Prediction {
  /** 予測 800m タイム（秒）。材料が足りなければ null */
  seconds: number | null
  /** 予測レンジ（秒）。材料の少なさ・ばらつきに応じて広がる */
  rangeLow: number | null
  rangeHigh: number | null
  /** 0〜1。材料の種類・本数・距離の広がりから算出 */
  confidence: number
  sources: PredictionSource[]
  /** Critical Speed モデルが成立したときのみ入る */
  criticalSpeed: number | null // m/s
  dPrime: number | null // m
  /** 1500m 以上の記録があるときの持久力の指標。予測には使わない参考値 */
  vdot: number | null
  /** 予測できなかった理由・精度を上げるための助言 */
  advice: string[]
}
