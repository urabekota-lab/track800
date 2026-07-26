import { zoneTarget } from './pace'
import type { Level, Menu, MenuSet, Phase, SetKind, ZoneKey } from './types'

export const PHASE_LABEL: Record<Phase, string> = {
  base: '準備期',
  build: '鍛錬期',
  peak: '仕上げ期',
  race: '試合期',
}

export const PHASE_DESC: Record<Phase, string> = {
  base: '有酸素の土台と動きづくり。量を確保してケガをしない体をつくる時期。',
  build: 'スピード持久の中核。800m を走り切るための「粘れる速さ」を鍛える時期。',
  peak: 'レースペースに寄せて仕上げる時期。本数を落として質を上げる。',
  race: '試合に合わせて切れを出す時期。刺激を入れて疲労を抜く。',
}

/** 練習の位置づけ。週の中でどう組むかを決める */
export type DayType = 'point' | 'sub' | 'long' | 'rest'

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  point: 'ポイント練習',
  sub: 'つなぎ・補強',
  long: '距離走・持久',
  rest: '休養・回復',
}

export const LEVEL_LABEL: Record<Level, string> = {
  jhs: '中学生',
  hs: '高校生',
  univ: '大学生',
  masters: '社会人・マスターズ',
}

interface TemplateSet {
  kind: SetKind
  /** 0 なら距離指定なし（ジョグ・補強など）。その場合は label を必ず指定する */
  distance: number
  reps: number
  sets?: number
  zone: ZoneKey
  restSec?: number | null
  setRestSec?: number | null
  label?: string
  note?: string
}

interface Template {
  id: string
  title: string
  description: string
  phase: Phase
  focus: string
  dayType: DayType
  /** 1(軽い)〜5(最もきつい)。W-up/C-down の量とレストのスケールに使う */
  intensity: number
  main: TemplateSet[]
}

// ============================================================
// 800m 向け練習テンプレート
// ============================================================

const TEMPLATES: Template[] = [
  // ---------------- 準備期 ----------------
  {
    id: 'base-aerobic',
    title: '有酸素ジョグ＋流し',
    description: '土台をつくる基本メニュー。会話できるペースを崩さず、最後に流しで動きを整える。',
    phase: 'base', focus: '有酸素土台', dayType: 'long', intensity: 2,
    main: [
      { kind: 'main', distance: 0, reps: 1, zone: 'jog', label: 'ジョグ 40分', note: '会話できる強度をキープ' },
      { kind: 'sub', distance: 100, reps: 6, zone: 'speed', restSec: 90, note: '力まず、接地を意識して' },
    ],
  },
  {
    id: 'base-threshold',
    title: '閾値走 2000m×3',
    description: '「きついが最後まで同じペースで刻める」強度。800m のスタミナ源になる。',
    phase: 'base', focus: '閾値・持久', dayType: 'point', intensity: 3,
    main: [{ kind: 'main', distance: 2000, reps: 3, zone: 'threshold', restSec: 180, note: 'ペースを上げすぎない。3本目が一番速いのが理想' }],
  },
  {
    id: 'base-long-interval',
    title: 'ロングインターバル 1000m×5',
    description: '3000m レースペース相当。最大酸素摂取量を引き上げる定番。',
    phase: 'base', focus: 'VO2max', dayType: 'point', intensity: 4,
    main: [{ kind: 'main', distance: 1000, reps: 5, zone: 'vo2', restSec: 180, note: '1本目から突っ込まない' }],
  },
  {
    id: 'base-hill',
    title: '坂ダッシュ 150m×8',
    description: '接地と push を強くする。スピードを出さずに筋出力を上げられるのでこの時期に最適。',
    phase: 'base', focus: '筋出力・動きづくり', dayType: 'point', intensity: 3,
    main: [{ kind: 'main', distance: 150, reps: 8, zone: 'none', restSec: 180, note: '中程度の傾斜。下りは歩いて完全回復' }],
  },
  {
    id: 'base-buildup',
    title: 'ビルドアップ走 5000m',
    description: '1000m ごとにペースを上げる。ペース感覚と切り替えを同時に鍛える。',
    phase: 'base', focus: '持久・ペース感覚', dayType: 'point', intensity: 3,
    main: [
      { kind: 'main', distance: 2000, reps: 1, zone: 'jog', label: '2000m（ジョグ〜閾値の入り）' },
      { kind: 'main', distance: 2000, reps: 1, zone: 'threshold', label: '2000m（閾値）' },
      { kind: 'main', distance: 1000, reps: 1, zone: 'vo2', label: '1000m（3000mP）' },
    ],
  },
  {
    id: 'base-longrun',
    title: '距離走 60分',
    description: '週1回の長め。心肺と脚づくり。800m でも土台の量は効く。',
    phase: 'base', focus: '有酸素土台', dayType: 'long', intensity: 2,
    main: [{ kind: 'main', distance: 0, reps: 1, zone: 'jog', label: 'ジョグ 60分', note: '止まらず一定リズムで' }],
  },

  // ---------------- 鍛錬期 ----------------
  {
    id: 'build-600x4',
    title: '600m×4（1500mペース）',
    description: '800m のスピード持久を作る最重要メニュー。レストは長めに取って質を守る。',
    phase: 'build', focus: 'スピード持久', dayType: 'point', intensity: 5,
    main: [{ kind: 'main', distance: 600, reps: 4, zone: 'pace1500', restSec: 360, note: '設定を守れなくなったらそこで終える' }],
  },
  {
    id: 'build-300x6',
    title: '300m×6（レースペース）',
    description: 'レースペースの動きを反復して身体に覚え込ませる。フォームが崩れないことが条件。',
    phase: 'build', focus: 'レースペース', dayType: 'point', intensity: 4,
    main: [{ kind: 'main', distance: 300, reps: 6, zone: 'race', restSec: 180, note: '全部同じタイムで刻む' }],
  },
  {
    id: 'build-400x5',
    title: '400m×5',
    description: '800m の 2 本分を分割して踏む感覚。もっとも汎用性の高いポイント練習。',
    phase: 'build', focus: 'スピード持久', dayType: 'point', intensity: 5,
    main: [{ kind: 'main', distance: 400, reps: 5, zone: 'pace1500', restSec: 240 }],
  },
  {
    id: 'build-broken',
    title: 'ブロークン800（400+200+200）×2',
    description: '短いつなぎで 800m 分を走り切る。レース終盤の乳酸環境を再現できる。',
    phase: 'build', focus: '乳酸耐性', dayType: 'point', intensity: 5,
    main: [
      { kind: 'main', distance: 400, reps: 1, sets: 2, zone: 'race', restSec: 30, setRestSec: 600, note: 'レースの入りと同じ感覚で' },
      { kind: 'main', distance: 200, reps: 2, sets: 2, zone: 'race', restSec: 30, setRestSec: 600, note: 'つなぎ30秒。垂れても止まらない' },
    ],
  },
  {
    id: 'build-pyramid',
    title: 'ピラミッド 200-400-600-400-200',
    description: '距離が変わってもペースを保つ。集中力とペース感覚を同時に鍛えられる。',
    phase: 'build', focus: 'ペース感覚', dayType: 'point', intensity: 4,
    main: [
      { kind: 'main', distance: 200, reps: 1, zone: 'speed', restSec: 180 },
      { kind: 'main', distance: 400, reps: 1, zone: 'race', restSec: 240 },
      { kind: 'main', distance: 600, reps: 1, zone: 'pace1500', restSec: 300 },
      { kind: 'main', distance: 400, reps: 1, zone: 'race', restSec: 240 },
      { kind: 'main', distance: 200, reps: 1, zone: 'speed', restSec: 180 },
    ],
  },
  {
    id: 'build-mixed',
    title: '1000m×3 ＋ 200m×4',
    description: '前半で有酸素、後半でスピード。1回で両方触れる欲張りメニュー。',
    phase: 'build', focus: '複合', dayType: 'point', intensity: 5,
    main: [
      { kind: 'main', distance: 1000, reps: 3, zone: 'vo2', restSec: 180 },
      { kind: 'main', distance: 200, reps: 4, zone: 'speed', restSec: 180, note: '疲れた状態でのスピード維持' },
    ],
  },
  {
    id: 'build-500x4',
    title: '500m×4',
    description: '600m より扱いやすく、400m より持久寄り。鍛錬期の中盤に置きやすい。',
    phase: 'build', focus: 'スピード持久', dayType: 'point', intensity: 4,
    main: [{ kind: 'main', distance: 500, reps: 4, zone: 'pace1500', restSec: 300 }],
  },
  {
    id: 'build-hill10',
    title: '坂 200m×10',
    description: 'スピード持久を脚づくりの側から補強する。フラットのポイント練習の合間に。',
    phase: 'build', focus: '筋持久', dayType: 'point', intensity: 4,
    main: [{ kind: 'main', distance: 200, reps: 10, zone: 'none', restSec: 150, note: '下りジョグで戻る。腕振りを大きく' }],
  },
  {
    id: 'build-sub-jog',
    title: 'つなぎジョグ＋流し＋補強',
    description: 'ポイント練習の翌日。抜くことも練習のうち。',
    phase: 'build', focus: '回復', dayType: 'sub', intensity: 1,
    main: [
      { kind: 'main', distance: 0, reps: 1, zone: 'jog', label: 'ジョグ 30分' },
      { kind: 'sub', distance: 80, reps: 4, zone: 'speed', restSec: 90, note: '軽く。追い込まない' },
      { kind: 'sub', distance: 0, reps: 1, zone: 'none', label: '体幹補強 10分', note: 'プランク・サイドプランク・ヒップリフト' },
    ],
  },

  // ---------------- 仕上げ期 ----------------
  {
    id: 'peak-600x3',
    title: '600m×3（レースペース）',
    description: 'レースペースで 600m。ここが刻めれば 800m の目標は射程圏。',
    phase: 'peak', focus: 'レースペース', dayType: 'point', intensity: 5,
    main: [{ kind: 'main', distance: 600, reps: 3, zone: 'race', restSec: 480, note: 'レスト長め。1本の質を最優先' }],
  },
  {
    id: 'peak-300x3x2',
    title: '(300m×3)×2セット',
    description: 'レースペースより速い設定を、2セットに分けて反復。ラストの切り替えを作る。',
    phase: 'peak', focus: '乳酸耐性', dayType: 'point', intensity: 5,
    main: [{ kind: 'main', distance: 300, reps: 3, sets: 2, zone: 'speed', restSec: 180, setRestSec: 600 }],
  },
  {
    id: 'peak-descending',
    title: '500m + 300m + 200m',
    description: '距離を落としながらペースを上げる。レース展開そのものの練習。',
    phase: 'peak', focus: 'レース展開', dayType: 'point', intensity: 5,
    main: [
      { kind: 'main', distance: 500, reps: 1, zone: 'race', restSec: 480 },
      { kind: 'main', distance: 300, reps: 1, zone: 'speed', restSec: 360 },
      { kind: 'main', distance: 200, reps: 1, zone: 'sprint', restSec: null, note: '残っている力を全部出す' },
    ],
  },
  {
    id: 'peak-600tt',
    title: '600m タイムトライアル',
    description: '現在地の確認。ここで出たタイムを記録すると推定 800m タイムの精度が大きく上がる。',
    phase: 'peak', focus: '現在地の確認', dayType: 'point', intensity: 5,
    main: [{ kind: 'main', distance: 600, reps: 1, zone: 'sprint', restSec: null, note: '単独走。800m と同じ入りで' }],
  },
  {
    id: 'peak-400x4',
    title: '400m×4（レースペース）',
    description: '仕上げ期の標準。設定を外さないことが目的で、追い込むのが目的ではない。',
    phase: 'peak', focus: 'レースペース', dayType: 'point', intensity: 4,
    main: [{ kind: 'main', distance: 400, reps: 4, zone: 'race', restSec: 300 }],
  },

  // ---------------- 試合期 ----------------
  {
    id: 'race-200x4',
    title: '200m×4（切れを出す）',
    description: '試合週の刺激入れ。本数を絞って、動きの鋭さだけを引き出す。',
    phase: 'race', focus: '刺激・調整', dayType: 'point', intensity: 3,
    main: [{ kind: 'main', distance: 200, reps: 4, zone: 'speed', restSec: 240, note: '余力を残して終える' }],
  },
  {
    id: 'race-descending-short',
    title: '300m + 200m + 150m',
    description: '短く速く。レース3〜4日前に入れると当日の動きが軽くなる。',
    phase: 'race', focus: '刺激・調整', dayType: 'point', intensity: 3,
    main: [
      { kind: 'main', distance: 300, reps: 1, zone: 'speed', restSec: 360 },
      { kind: 'main', distance: 200, reps: 1, zone: 'speed', restSec: 300 },
      { kind: 'main', distance: 150, reps: 1, zone: 'sprint', restSec: null },
    ],
  },
  {
    id: 'race-taper',
    title: '調整ジョグ＋150m×3',
    description: 'レース2日前。疲労を抜きつつ、身体にレースペースを思い出させる。',
    phase: 'race', focus: '調整', dayType: 'sub', intensity: 2,
    main: [
      { kind: 'main', distance: 0, reps: 1, zone: 'jog', label: 'ジョグ 20分' },
      { kind: 'main', distance: 150, reps: 3, zone: 'race', restSec: 240, note: 'レースペースの感覚確認だけ' },
    ],
  },
  {
    id: 'race-day-before',
    title: 'レース前日：200m×2',
    description: '前日刺激。ここで追い込むと当日に響くので、必ず余力を残す。',
    phase: 'race', focus: '前日刺激', dayType: 'sub', intensity: 2,
    main: [
      { kind: 'main', distance: 200, reps: 2, zone: 'race', restSec: 300, note: '気持ちよく終わる。それ以上やらない' },
      { kind: 'sub', distance: 80, reps: 3, zone: 'speed', restSec: 90 },
    ],
  },
  {
    id: 'race-recovery',
    title: '完全休養 / 軽ジョグ',
    description: '回復も練習。身体が重い日は迷わずこちらを選ぶ。',
    phase: 'race', focus: '回復', dayType: 'rest', intensity: 1,
    main: [
      { kind: 'main', distance: 0, reps: 1, zone: 'jog', label: 'ジョグ 20分（または完全休養）', note: '脚が張っていれば走らない判断も正解' },
      { kind: 'sub', distance: 0, reps: 1, zone: 'none', label: 'ストレッチ 15分' },
    ],
  },
]

// ============================================================
// テンプレート → メニュー生成
// ============================================================

/** カテゴリによるレストの微調整（回復に時間がかかる層は長めに） */
const REST_SCALE: Record<Level, number> = { jhs: 1.15, hs: 1.0, univ: 1.0, masters: 1.1 }

function autoLabel(t: TemplateSet): string {
  if (t.label) return t.label
  if (t.distance <= 0) return '（自由記述）'
  return buildSetLabel(t.distance, t.reps, t.sets ?? 1)
}

/** 「400m × 5」「(200m × 2) × 2セット」のような見出しを組み立てる */
export function buildSetLabel(distance: number, reps: number, sets: number): string {
  if (sets > 1) {
    // 1セット1本なら「(400m × 1) × 2セット」ではなく「400m × 2セット」
    return reps > 1 ? `(${distance}m × ${reps}) × ${sets}セット` : `${distance}m × ${sets}セット`
  }
  return reps > 1 ? `${distance}m × ${reps}` : `${distance}m`
}

function warmupSets(intensity: number): TemplateSet[] {
  if (intensity <= 2) {
    return [{ kind: 'warmup', distance: 0, reps: 1, zone: 'jog', label: 'W-up：ジョグ 10分＋ストレッチ' }]
  }
  return [
    { kind: 'warmup', distance: 0, reps: 1, zone: 'jog', label: 'W-up：ジョグ 15〜20分' },
    { kind: 'warmup', distance: 0, reps: 1, zone: 'none', label: '動的ストレッチ＋ドリル 10分', note: 'もも上げ・スキップ・ギャロップなど' },
    { kind: 'warmup', distance: 80, reps: 3, zone: 'speed', restSec: 90, label: '流し 80m × 3' },
  ]
}

function cooldownSets(intensity: number): TemplateSet[] {
  return [
    { kind: 'cooldown', distance: 0, reps: 1, zone: 'jog', label: `C-down：ジョグ ${intensity >= 4 ? 15 : 10}分` },
    { kind: 'cooldown', distance: 0, reps: 1, zone: 'none', label: 'ストレッチ 10分' },
  ]
}

function toMenuSet(t: TemplateSet, index: number, pred800Sec: number | null, level: Level): MenuSet {
  const restScale = REST_SCALE[level]
  return {
    key: `s${index}`,
    kind: t.kind,
    label: autoLabel(t),
    distance: t.distance,
    reps: t.reps,
    sets: t.sets ?? 1,
    zone: t.zone,
    // 設定タイムはメインの本数だけに出す。W-up の流しや補強に秒を出すと
    // 全力で行くべきものと誤解される
    targetSec:
      pred800Sec && t.kind === 'main' && t.distance > 0 && t.zone !== 'none'
        ? zoneTarget(t.zone, pred800Sec, t.distance)
        : null,
    restSec: t.restSec != null ? Math.round(t.restSec * restScale) : null,
    setRestSec: t.setRestSec != null ? Math.round(t.setRestSec * restScale) : null,
    note: t.note ?? '',
  }
}

/**
 * テンプレートと推定 800m タイムから、目標タイム入りのメニューを組み立てる。
 * pred800Sec が null なら目標タイムは空欄のまま（メニュー構成だけ提示）。
 */
export function buildMenu(template: Template, pred800Sec: number | null, level: Level): Menu {
  const all = [
    ...warmupSets(template.intensity),
    ...template.main,
    ...cooldownSets(template.intensity),
  ]
  return {
    id: `gen-${template.id}`,
    title: template.title,
    description: template.description,
    phase: template.phase,
    level,
    focus: template.focus,
    sets: all.map((t, i) => toMenuSet(t, i, pred800Sec, level)),
    authorName: '自動提案',
    imported: false,
    favorite: false,
    createdAt: new Date().toISOString(),
  }
}

export interface SuggestOptions {
  phase: Phase
  dayType?: DayType | 'any'
  pred800Sec: number | null
  level: Level
  limit?: number
}

/** 条件に合うメニューを提案する。強度が高い順に並べる */
export function suggestMenus(opts: SuggestOptions): Menu[] {
  const { phase, dayType = 'any', pred800Sec, level, limit } = opts
  const matched = TEMPLATES
    .filter((t) => t.phase === phase)
    .filter((t) => dayType === 'any' || t.dayType === dayType)
    .sort((a, b) => b.intensity - a.intensity)

  const list = limit ? matched.slice(0, limit) : matched
  return list.map((t) => buildMenu(t, pred800Sec, level))
}

export interface WeekDay {
  day: string
  dayType: DayType
  menu: Menu | null
}

const WEEK_LABELS = ['月', '火', '水', '木', '金', '土', '日']

/**
 * 週あたりのポイント練習回数から 1 週間の並びを組む。
 * ポイント練習が連日にならないよう、間につなぎ・距離走を挟む。
 */
export function suggestWeek(phase: Phase, pointsPerWeek: number, pred800Sec: number | null, level: Level): WeekDay[] {
  const points = suggestMenus({ phase, dayType: 'point', pred800Sec, level })
  const subs = suggestMenus({ phase, dayType: 'sub', pred800Sec, level })
  const longs = suggestMenus({ phase, dayType: 'long', pred800Sec, level })
  const fallbackSub = subs[0] ?? suggestMenus({ phase: 'build', dayType: 'sub', pred800Sec, level })[0] ?? null
  const fallbackLong = longs[0] ?? suggestMenus({ phase: 'base', dayType: 'long', pred800Sec, level })[0] ?? null

  // ポイント練習を週の中で均等に散らす
  const n = Math.max(1, Math.min(4, pointsPerWeek))
  const pointDays = new Set<number>(
    n === 1 ? [2] : n === 2 ? [1, 4] : n === 3 ? [1, 3, 5] : [0, 2, 4, 6],
  )

  let pointIdx = 0
  return WEEK_LABELS.map((day, i) => {
    if (pointDays.has(i)) {
      const menu = points.length > 0 ? points[pointIdx % points.length] : null
      pointIdx++
      return { day, dayType: 'point' as DayType, menu }
    }
    // 日曜は距離走、それ以外はつなぎ。ポイントの翌日は必ずつなぎにする
    if (i === 6 && !pointDays.has(5)) return { day, dayType: 'long' as DayType, menu: fallbackLong }
    if (i === 3 && n <= 2) return { day, dayType: 'rest' as DayType, menu: null }
    return { day, dayType: 'sub' as DayType, menu: fallbackSub }
  })
}

/** メニューの総走行距離（W-up/C-down のジョグは距離未確定なので含まない） */
export function totalDistance(sets: MenuSet[]): number {
  return sets.reduce((a, s) => a + s.distance * Math.max(1, s.reps) * Math.max(1, s.sets), 0)
}

/** メニュー内で最も強度の高いゾーンを代表として返す（一覧のタグ表示用） */
const ZONE_ORDER: ZoneKey[] = ['none', 'jog', 'threshold', 'vo2', 'pace1500', 'race', 'speed', 'sprint']

export function mainZone(sets: MenuSet[]): ZoneKey {
  let best: ZoneKey = 'none'
  for (const s of sets) {
    if (s.kind !== 'main') continue
    if (ZONE_ORDER.indexOf(s.zone) > ZONE_ORDER.indexOf(best)) best = s.zone
  }
  return best
}

export { TEMPLATES }
export type { Template }
