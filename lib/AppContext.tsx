import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { decodeMenu } from './shareCode'
import { emptyData, loadData, newId, saveData } from './storage'
import type { AppData } from './storage'
import { predict800 } from './pace'
import type { Menu, PersonalBest, Prediction, Profile, Workout } from './types'

interface AppState extends AppData {
  prediction: Prediction
  loading: boolean

  updateProfile: (patch: Partial<Profile>) => Promise<void>
  savePersonalBests: (list: PersonalBest[]) => Promise<void>

  addWorkout: (workout: Omit<Workout, 'id'>) => Promise<void>
  removeWorkout: (id: string) => Promise<void>

  /** id があれば上書き、なければ新規作成。作成/更新後のメニューを返す */
  saveMenu: (menu: Omit<Menu, 'id' | 'createdAt'> & { id?: string }) => Promise<Menu>
  removeMenu: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  /** 共有コードを取り込む。読み取れなければ例外を投げる */
  importMenuCode: (code: string) => Promise<Menu>

  /** バックアップからの復元。既存データはすべて置き換わる */
  replaceAll: (data: AppData) => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

const EMPTY_PREDICTION: Prediction = {
  seconds: null, rangeLow: null, rangeHigh: null, confidence: 0,
  sources: [], criticalSpeed: null, dPrime: null, vdot: null, advice: [],
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  /** 画面の状態と端末内の保存を必ず一緒に更新する */
  const commit = useCallback(async (next: AppData) => {
    setData(next)
    await saveData(next)
  }, [])

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      setData((prev) => {
        const next = { ...prev, profile: { ...prev.profile, ...patch } }
        saveData(next)
        return next
      })
    },
    [],
  )

  const savePersonalBests = useCallback(
    async (list: PersonalBest[]) => {
      setData((prev) => {
        const next = { ...prev, personalBests: [...list].sort((a, b) => a.distance - b.distance) }
        saveData(next)
        return next
      })
    },
    [],
  )

  const addWorkout = useCallback(async (workout: Omit<Workout, 'id'>) => {
    setData((prev) => {
      const next = {
        ...prev,
        workouts: [{ ...workout, id: newId() }, ...prev.workouts].sort(
          (a, b) => b.date.localeCompare(a.date),
        ),
      }
      saveData(next)
      return next
    })
  }, [])

  const removeWorkout = useCallback(async (id: string) => {
    setData((prev) => {
      const next = { ...prev, workouts: prev.workouts.filter((w) => w.id !== id) }
      saveData(next)
      return next
    })
  }, [])

  const saveMenu = useCallback(
    async (input: Omit<Menu, 'id' | 'createdAt'> & { id?: string }) => {
      const saved: Menu = {
        ...input,
        id: input.id ?? newId(),
        createdAt: new Date().toISOString(),
      }
      setData((prev) => {
        const exists = prev.menus.some((m) => m.id === saved.id)
        const next = {
          ...prev,
          menus: exists
            ? prev.menus.map((m) => (m.id === saved.id ? { ...saved, createdAt: m.createdAt } : m))
            : [saved, ...prev.menus],
        }
        saveData(next)
        return next
      })
      return saved
    },
    [],
  )

  const removeMenu = useCallback(async (id: string) => {
    setData((prev) => {
      const next = { ...prev, menus: prev.menus.filter((m) => m.id !== id) }
      saveData(next)
      return next
    })
  }, [])

  const toggleFavorite = useCallback(async (id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        menus: prev.menus.map((m) => (m.id === id ? { ...m, favorite: !m.favorite } : m)),
      }
      saveData(next)
      return next
    })
  }, [])

  const importMenuCode = useCallback(async (code: string) => {
    const menu = decodeMenu(code)
    setData((prev) => {
      const next = { ...prev, menus: [menu, ...prev.menus] }
      saveData(next)
      return next
    })
    return menu
  }, [])

  const replaceAll = useCallback(async (next: AppData) => { await commit(next) }, [commit])

  const prediction = useMemo(() => {
    if (loading) return EMPTY_PREDICTION
    return predict800({
      personalBests: data.personalBests,
      workouts: data.workouts,
      runnerType: data.profile.runnerType,
      level: data.profile.level,
    })
  }, [loading, data.personalBests, data.workouts, data.profile])

  const value: AppState = {
    ...data,
    prediction,
    loading,
    updateProfile,
    savePersonalBests,
    addWorkout,
    removeWorkout,
    saveMenu,
    removeMenu,
    toggleFavorite,
    importMenuCode,
    replaceAll,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp は AppProvider の中で呼んでください')
  return ctx
}
