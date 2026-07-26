import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useApp } from '../lib/AppContext'
import { confirmDestructive } from '../lib/confirm'
import { EFFORT_LABEL, formatTime, parseTime } from '../lib/pace'
import { Button, Card, ChipRow, Chip, Empty, Field, Input } from '../components/ui'
import { Screen } from '../components/Screen'
import { colors, radius } from '../lib/theme'
import type { Effort } from '../lib/types'

const EFFORTS: Effort[] = ['trial', 'repetition', 'interval', 'continuous']

const EFFORT_HINT: Record<Effort, string> = {
  trial: 'レースやタイムトライアル。そのまま実力として扱います',
  repetition: '完全回復をとって走った本。ほぼ実力どおりとみなします',
  interval: '短〜中レスト。疲労分を差し引いて実力に換算します',
  continuous: '連続走・変化走。疲労の影響が最も大きいとみなします',
}

interface RepRow {
  distance: string
  time: string
}

/** offset 日前の日付を YYYY-MM-DD で返す */
function dateString(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const todayString = () => dateString(0)

/** スマホで日付を手打ちさせないための候補（直近1週間） */
const DATE_CHOICES = [0, -1, -2, -3, -4, -5, -6].map((offset) => {
  const value = dateString(offset)
  const label =
    offset === 0 ? '今日'
    : offset === -1 ? '昨日'
    : `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}(${'日月火水木金土'[new Date(value).getDay()]})`
  return { value, label }
})

export default function LogScreen() {
  const { workouts, addWorkout, removeWorkout } = useApp()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [date, setDate] = useState(todayString())
  const [title, setTitle] = useState('')
  const [effort, setEffort] = useState<Effort>('interval')
  const [rows, setRows] = useState<RepRow[]>([{ distance: '400', time: '' }])
  const [restSec, setRestSec] = useState('')
  const [condition, setCondition] = useState(3)
  const [note, setNote] = useState('')

  const isCustomDate = !DATE_CHOICES.some((d) => d.value === date)

  const reset = useCallback(() => {
    setDate(todayString())
    setTitle('')
    setEffort('interval')
    setRows([{ distance: '400', time: '' }])
    setRestSec('')
    setCondition(3)
    setNote('')
    setError('')
  }, [])

  const addRow = () => {
    const last = rows[rows.length - 1]
    setRows([...rows, { distance: last?.distance ?? '400', time: '' }])
  }

  const updateRow = (i: number, patch: Partial<RepRow>) => {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const removeRow = (i: number) => {
    setRows(rows.length === 1 ? rows : rows.filter((_, idx) => idx !== i))
  }

  /** 全行の距離をまとめて書き換える（400m×5 のような均一メニュー用） */
  const applyDistanceToAll = () => {
    const d = rows[0]?.distance ?? ''
    setRows(rows.map((r) => ({ ...r, distance: d })))
  }

  const save = async () => {
    setError('')

    const reps = rows
      .map((r) => ({ distance: Number(r.distance), seconds: parseTime(r.time) }))
      .filter((r) => r.distance > 0 && r.seconds != null) as { distance: number; seconds: number }[]

    if (reps.length === 0) {
      setError('少なくとも1本、距離とタイムを入力してください（例：400 / 62.5）')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('日付は YYYY-MM-DD の形式で入力してください')
      return
    }

    setSaving(true)
    try {
      await addWorkout({
        date,
        title: title.trim(),
        effort,
        reps,
        restSec: restSec ? parseTime(restSec) : null,
        condition,
        note: note.trim(),
        menuId: null,
      })
      reset()
      setOpen(false)
    } catch (e: any) {
      setError(e?.message ?? '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (id: string, label: string) => {
    confirmDestructive('記録を削除', `「${label}」を削除しますか？`, () => removeWorkout(id))
  }

  return (
    <Screen avoidKeyboard>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>練習の記録</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setOpen(!open); if (!open) reset() }}
        >
          <Ionicons name={open ? 'close' : 'add'} size={18} color="#fff" />
          <Text style={styles.addBtnText}>{open ? '閉じる' : '記録する'}</Text>
        </TouchableOpacity>
      </View>

      {open && (
        <Card title="練習を記録" icon="create-outline">
          <Field label="日付">
            <ChipRow>
              {DATE_CHOICES.map((d) => (
                <Chip key={d.value} label={d.label} active={date === d.value} onPress={() => setDate(d.value)} />
              ))}
              <Chip
                label="それ以前"
                active={isCustomDate}
                onPress={() => setDate(isCustomDate ? todayString() : dateString(-7))}
              />
            </ChipRow>
            {isCustomDate && (
              <View style={{ marginTop: 8 }}>
                <Input
                  value={date}
                  onChangeText={setDate}
                  placeholder="2026-07-25"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            )}
          </Field>

          <Field label="メニュー名（任意）">
            <Input value={title} onChangeText={setTitle} placeholder="例：400m×5" />
          </Field>

          <Field label="走り方" hint={EFFORT_HINT[effort]}>
            <ChipRow>
              {EFFORTS.map((e) => (
                <Chip key={e} label={EFFORT_LABEL[e]} active={effort === e} onPress={() => setEffort(e)} />
              ))}
            </ChipRow>
          </Field>

          <Field label="各本のタイム" hint="タイムは 62.5 や 1:02.5 のどちらでも入力できます">
            {rows.map((r, i) => (
              <View key={i} style={styles.repRow}>
                <Text style={styles.repIndex}>{i + 1}</Text>
                <Input
                  value={r.distance}
                  onChangeText={(v) => updateRow(i, { distance: v.replace(/[^0-9]/g, '') })}
                  placeholder="400"
                  keyboardType="number-pad"
                  style={styles.repDistance}
                />
                <Text style={styles.repUnit}>m</Text>
                <Input
                  value={r.time}
                  onChangeText={(v) => updateRow(i, { time: v })}
                  placeholder="62.5"
                  // 「1:02.5」のコロンも打てるよう、純粋な数字キーパッドにはしない
                  keyboardType="numbers-and-punctuation"
                  style={styles.repTime}
                />
                <TouchableOpacity onPress={() => removeRow(i)} style={styles.repDelete}>
                  <Ionicons name="close-circle" size={19} color={colors.textFaint} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.repActions}>
              <TouchableOpacity style={styles.smallBtn} onPress={addRow}>
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={styles.smallBtnText}>本数を追加</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallBtn} onPress={applyDistanceToAll}>
                <Ionicons name="copy-outline" size={13} color={colors.primary} />
                <Text style={styles.smallBtnText}>1本目の距離を全部に</Text>
              </TouchableOpacity>
            </View>
          </Field>

          <Field label="レスト（任意）">
            <Input
              value={restSec}
              onChangeText={setRestSec}
              placeholder="例：3:00"
              keyboardType="numbers-and-punctuation"
            />
          </Field>

          <Field label="コンディション">
            <ChipRow>
              {[1, 2, 3, 4, 5].map((c) => (
                <Chip
                  key={c}
                  label={['不調', 'やや不調', 'ふつう', 'good', '絶好調'][c - 1]}
                  active={condition === c}
                  onPress={() => setCondition(c)}
                />
              ))}
            </ChipRow>
          </Field>

          <Field label="メモ（任意）">
            <Input value={note} onChangeText={setNote} placeholder="風が強かった／後半垂れた など" multiline />
          </Field>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={saving ? '保存中…' : '保存する'} onPress={save} disabled={saving} icon="checkmark" />
        </Card>
      )}

      <View style={styles.list}>
        {workouts.length === 0 ? (
          <Card><Empty text="まだ記録がありません。「記録する」から追加しましょう。" /></Card>
        ) : (
          workouts.map((w) => {
            const fastest = w.reps.length > 0 ? Math.min(...w.reps.map((r) => r.seconds)) : null
            return (
              <View key={w.id} style={styles.logCard}>
                <View style={styles.logHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logTitle}>{w.title || EFFORT_LABEL[w.effort]}</Text>
                    <Text style={styles.logDate}>{w.date} ・ {EFFORT_LABEL[w.effort]}</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmDelete(w.id, w.title || w.date)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                  </TouchableOpacity>
                </View>

                <View style={styles.repsWrap}>
                  {w.reps.map((r, i) => (
                    <View key={i} style={[styles.repPill, r.seconds === fastest && styles.repPillBest]}>
                      <Text style={[styles.repPillDist, r.seconds === fastest && { color: '#fff' }]}>{r.distance}m</Text>
                      <Text style={[styles.repPillTime, r.seconds === fastest && { color: '#fff' }]}>
                        {formatTime(r.seconds, 1)}
                      </Text>
                    </View>
                  ))}
                </View>

                {w.note ? <Text style={styles.logNote}>{w.note}</Text> : null}
              </View>
            )
          })
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 12 },
  headerTitle: { flex: 1, fontSize: 19, fontWeight: 'bold', color: colors.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  repRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  repIndex: { width: 16, fontSize: 12, color: colors.textFaint, fontWeight: '700' },
  repDistance: { width: 66, textAlign: 'right' },
  repUnit: { fontSize: 12, color: colors.textSub },
  repTime: { flex: 1 },
  repDelete: { padding: 2 },
  repActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99,
  },
  smallBtnText: { fontSize: 11.5, color: colors.primary, fontWeight: '700' },

  error: { color: colors.danger, fontSize: 12, marginBottom: 10 },

  list: { paddingHorizontal: 12 },
  logCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5,
    borderColor: colors.border, padding: 12, marginBottom: 10,
  },
  logHead: { flexDirection: 'row', alignItems: 'flex-start' },
  logTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  logDate: { fontSize: 11, color: colors.textSub, marginTop: 2 },
  repsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  repPill: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: '#f1f4fa',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5,
  },
  repPillBest: { backgroundColor: colors.accent },
  repPillDist: { fontSize: 10, color: colors.textFaint, fontWeight: '600' },
  repPillTime: { fontSize: 13, color: colors.text, fontWeight: '700' },
  logNote: { fontSize: 11.5, color: colors.textSub, marginTop: 8, lineHeight: 17 },
})
