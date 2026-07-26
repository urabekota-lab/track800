import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Level, Menu, PersonalBest, Profile, RunnerType, Workout } from './types'

/**
 * 端末内にすべてのデータを持つ。サーバーもアカウントも使わない。
 * 量が小さい（1シーズン分の記録でも数十KB）ので、1つのキーにまとめて読み書きする。
 */
const STORAGE_KEY = 'track800:v1'

export interface AppData {
  profile: Profile
  personalBests: PersonalBest[]
  workouts: Workout[]
  menus: Menu[]
}

export const DEFAULT_PROFILE: Profile = {
  displayName: '',
  role: 'athlete',
  // 大学生を主な利用者として想定しているので初期値にする
  level: 'univ',
  runnerType: 'balanced',
  team: '',
  targetRace: null,
}

export function emptyData(): AppData {
  return { profile: { ...DEFAULT_PROFILE }, personalBests: [], workouts: [], menus: [] }
}

/** 端末内で一意なら十分なので、時刻と乱数を組み合わせる */
export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

// ------------------------------------------------------------
// 読み込み時の検証
// 手で編集したバックアップを取り込むこともあるので、
// 壊れた値はエラーにせず既定値へ寄せる
// ------------------------------------------------------------

const LEVELS: Level[] = ['jhs', 'hs', 'univ', 'masters']
const TYPES: RunnerType[] = ['speed', 'balanced', 'endurance']

const str = (v: any, fallback = '') => (typeof v === 'string' ? v : fallback)
const num = (v: any, fallback = 0) => (typeof v === 'number' && isFinite(v) ? v : fallback)
const bool = (v: any) => v === true

function toProfile(raw: any): Profile {
  const p = raw ?? {}
  return {
    displayName: str(p.displayName),
    role: p.role === 'coach' ? 'coach' : 'athlete',
    level: LEVELS.includes(p.level) ? p.level : 'hs',
    runnerType: TYPES.includes(p.runnerType) ? p.runnerType : 'balanced',
    team: str(p.team),
    targetRace:
      p.targetRace && /^\d{4}-\d{2}-\d{2}$/.test(str(p.targetRace.date))
        ? { name: str(p.targetRace.name), date: str(p.targetRace.date) }
        : null,
  }
}

function toPersonalBests(raw: any): PersonalBest[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((pb) => ({
      distance: Math.round(num(pb?.distance)),
      seconds: num(pb?.seconds),
      recordedOn: typeof pb?.recordedOn === 'string' ? pb.recordedOn : null,
    }))
    .filter((pb) => pb.distance > 0 && pb.seconds > 0)
}

function toWorkouts(raw: any): Workout[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((w) => ({
      id: str(w?.id) || newId(),
      date: str(w?.date),
      title: str(w?.title),
      effort:
        w?.effort === 'trial' || w?.effort === 'repetition' || w?.effort === 'continuous'
          ? w.effort
          : 'interval',
      reps: Array.isArray(w?.reps)
        ? w.reps
            .map((r: any) => ({
              distance: Math.round(num(r?.distance)),
              seconds: num(r?.seconds),
              target: typeof r?.target === 'number' && r.target > 0 ? r.target : null,
            }))
            .filter((r: any) => r.distance > 0 && r.seconds > 0)
        : [],
      restSec: typeof w?.restSec === 'number' ? w.restSec : null,
      condition: Math.min(5, Math.max(1, Math.round(num(w?.condition, 3)))),
      note: str(w?.note),
      menuId: typeof w?.menuId === 'string' ? w.menuId : null,
    }))
    .filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w.date))
}

function toMenus(raw: any): Menu[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((m) => ({
      id: str(m?.id) || newId(),
      title: str(m?.title),
      description: str(m?.description),
      phase:
        m?.phase === 'base' || m?.phase === 'peak' || m?.phase === 'race' ? m.phase : 'build',
      level: LEVELS.includes(m?.level) ? m.level : 'hs',
      focus: str(m?.focus),
      sets: Array.isArray(m?.sets)
        ? m.sets.map((s: any, i: number) => ({
            key: str(s?.key) || `s${i}`,
            kind:
              s?.kind === 'warmup' || s?.kind === 'sub' || s?.kind === 'cooldown' ? s.kind : 'main',
            label: str(s?.label),
            distance: Math.round(num(s?.distance)),
            reps: Math.max(1, Math.round(num(s?.reps, 1))),
            sets: Math.max(1, Math.round(num(s?.sets, 1))),
            zone: str(s?.zone, 'none') as any,
            targetSec: typeof s?.targetSec === 'number' ? s.targetSec : null,
            restSec: typeof s?.restSec === 'number' ? s.restSec : null,
            setRestSec: typeof s?.setRestSec === 'number' ? s.setRestSec : null,
            note: str(s?.note),
          }))
        : [],
      authorName: str(m?.authorName),
      imported: bool(m?.imported),
      favorite: bool(m?.favorite),
      createdAt: str(m?.createdAt) || new Date().toISOString(),
    }))
    .filter((m) => m.title)
}

export function normalize(raw: any): AppData {
  return {
    profile: toProfile(raw?.profile),
    personalBests: toPersonalBests(raw?.personalBests),
    workouts: toWorkouts(raw?.workouts),
    menus: toMenus(raw?.menus),
  }
}

// ------------------------------------------------------------
// 読み書き
// ------------------------------------------------------------

export async function loadData(): Promise<AppData> {
  const text = await AsyncStorage.getItem(STORAGE_KEY)
  if (!text) return emptyData()
  try {
    return normalize(JSON.parse(text))
  } catch {
    // 壊れていても起動できるようにする（バックアップからの復元で直せる）
    return emptyData()
  }
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ------------------------------------------------------------
// バックアップ
// ------------------------------------------------------------

const BACKUP_FORMAT = 'track800-backup'

export function serializeBackup(data: AppData): string {
  return JSON.stringify(
    { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), data },
    null,
    2,
  )
}

/** バックアップ JSON を読み取る。形式が違えば理由の分かるエラーを投げる */
export function parseBackup(text: string): AppData {
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('ファイルの中身が壊れているか、JSON ではありません')
  }
  if (parsed?.format !== BACKUP_FORMAT) {
    throw new Error('Track800 の書き出しファイルではないようです')
  }
  return normalize(parsed.data)
}

/** バックアップ用のファイル名（YYYY-MM-DD 付き） */
export function backupFileName(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `track800-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`
}
