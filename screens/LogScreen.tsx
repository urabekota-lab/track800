import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useApp } from '../lib/AppContext'
import { analyzeWorkout } from '../lib/analysis'
import { confirmDestructive } from '../lib/confirm'
import { EFFORT_LABEL, formatTime, parseTime } from '../lib/pace'
import {
  distanceStats, distanceTrend, monthGroups, sessionMeters, sessionsForDistance, trendableDistances,
} from '../lib/history'
import { Button, Card, ChipRow, Chip, Empty, Field, Input } from '../components/ui'
import { Screen } from '../components/Screen'
import { TrendChart } from '../components/TrendChart'
import { colors, radius } from '../lib/theme'
import type { Effort, Workout } from '../lib/types'

const EFFORTS: Effort[] = ['trial', 'repetition', 'interval', 'continuous']

const EFFORT_HINT: Record<Effort, string> = {
  trial: 'レースやタイムトライアル。そのまま実力として扱います',
  repetition: '完全回復をとって走った本。ほぼ実力どおりとみなします',
  interval: '短〜中レスト。疲労分を差し引いて実力に換算します',
  continuous: '連続走・変化走。疲労の影響が最も大きいとみなします',
}

type Tab = 'history' | 'trend' | 'distance'

const TABS: { key: Tab; label: string }[] = [
  { key: 'history', label: '履歴' },
  { key: 'trend', label: '推移' },
  { key: 'distance', label: '距離別' },
]

interface RepRow {
  distance: string
  time: string
  /** メニューから来た設定タイム（秒）。手入力の行では null */
  target?: number | null
}

/** メニュー詳細から渡ってくる形 */
interface Prefill {
  menuId: string | null
  title: string
  rows: { distance: number; target: number | null }[]
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

const formatMeters = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`)

export default function LogScreen() {
  const { workouts, addWorkout, removeWorkout } = useApp()
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const [tab, setTab] = useState<Tab>('history')
  const [open, setOpen] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
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
    setMenuId(null)
  }, [])

  // メニュー詳細の「この練習をやる」から来たら、設定タイム付きで入力欄を埋める
  const prefill: Prefill | undefined = route.params?.prefill
  useEffect(() => {
    if (!prefill) return
    setDate(todayString())
    setTitle(prefill.title)
    setMenuId(prefill.menuId)
    setRows(prefill.rows.map((r) => ({ distance: String(r.distance), time: '', target: r.target })))
    setError('')
    setOpen(true)
    setTab('history')
    // 同じ内容で二重に埋めないよう、使ったら消す
    navigation.setParams({ prefill: undefined })
  }, [prefill, navigation])

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
      .map((r) => ({ distance: Number(r.distance), seconds: parseTime(r.time), target: r.target ?? null }))
      .filter((r) => r.distance > 0 && r.seconds != null) as
        { distance: number; seconds: number; target: number | null }[]

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
        date, title: title.trim(), effort, reps,
        restSec: restSec ? parseTime(restSec) : null,
        condition, note: note.trim(), menuId,
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
                {/* メニューから来た本は設定タイムを並べて出す */}
                {r.target != null ? (
                  <Text style={styles.repTarget}>設定{formatTime(r.target, 1)}</Text>
                ) : null}
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

      {workouts.length === 0 ? (
        <View style={styles.list}>
          <Card><Empty text="まだ記録がありません。「記録する」から追加しましょう。" /></Card>
        </View>
      ) : (
        <>
          <View style={styles.tabWrap}>
            <ChipRow>
              {TABS.map((t) => (
                <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
              ))}
            </ChipRow>
          </View>

          {tab === 'history' && <HistoryView workouts={workouts} onDelete={confirmDelete} />}
          {tab === 'trend' && <TrendView workouts={workouts} />}
          {tab === 'distance' && <DistanceView workouts={workouts} />}
        </>
      )}
    </Screen>
  )
}

// ============================================================
// 履歴：月ごとにまとめて振り返る
// ============================================================

function HistoryView({ workouts, onDelete }: {
  workouts: Workout[]
  onDelete: (id: string, label: string) => void
}) {
  const groups = useMemo(() => monthGroups(workouts), [workouts])

  return (
    <View style={styles.list}>
      {groups.map((g) => (
        <View key={g.key}>
          <View style={styles.monthHead}>
            <Text style={styles.monthLabel}>{g.label}</Text>
            <Text style={styles.monthMeta}>
              {g.workouts.length}回 ・ {formatMeters(g.meters)}
            </Text>
          </View>

          {g.workouts.map((w) => {
            const fastest = w.reps.length > 0 ? Math.min(...w.reps.map((r) => r.seconds)) : null
            return (
              <View key={w.id} style={styles.logCard}>
                <View style={styles.logHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logTitle}>{w.title || EFFORT_LABEL[w.effort]}</Text>
                    <Text style={styles.logDate}>
                      {w.date} ・ {EFFORT_LABEL[w.effort]} ・ {formatMeters(sessionMeters(w))}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => onDelete(w.id, w.title || w.date)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                  </TouchableOpacity>
                </View>

                <View style={styles.repsWrap}>
                  {w.reps.map((r, i) => {
                    const delta = r.target != null ? r.seconds - r.target : null
                    return (
                      <View key={i} style={[styles.repPill, r.seconds === fastest && styles.repPillBest]}>
                        <Text style={[styles.repPillDist, r.seconds === fastest && { color: '#fff' }]}>{r.distance}m</Text>
                        <Text style={[styles.repPillTime, r.seconds === fastest && { color: '#fff' }]}>
                          {formatTime(r.seconds, 1)}
                        </Text>
                        {/* 設定との差。負なら設定より速い */}
                        {delta != null && (
                          <Text style={[
                            styles.repPillDelta,
                            r.seconds === fastest ? { color: '#fff' } : delta <= 0 ? { color: colors.good } : { color: colors.warn },
                          ]}>
                            {delta <= 0 ? '' : '+'}{delta.toFixed(1)}
                          </Text>
                        )}
                      </View>
                    )
                  })}
                </View>

                <WorkoutAnalysisBlock workout={w} />

                {w.note ? <Text style={styles.logNote}>{w.note}</Text> : null}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

/** 1回の練習の分析。落ち込み・ばらつき・設定達成をまとめて出す */
function WorkoutAnalysisBlock({ workout }: { workout: Workout }) {
  const a = useMemo(() => analyzeWorkout(workout), [workout])

  const metrics: { label: string; value: string }[] = []
  if (a.fadePct != null) metrics.push({ label: '落ち込み', value: `${a.fadePct.toFixed(1)}%` })
  if (a.spread != null) metrics.push({ label: 'ばらつき', value: `±${a.spread.toFixed(1)}秒` })
  if (a.onTarget) metrics.push({ label: '設定達成', value: `${a.onTarget.hit}/${a.onTarget.total}本` })

  if (metrics.length === 0) return null

  const tone =
    a.verdictKind === 'good' ? styles.verdictGood
    : a.verdictKind === 'warn' ? styles.verdictWarn
    : styles.verdictInfo

  return (
    <View style={styles.analysis}>
      <View style={styles.metricRow}>
        {metrics.map((m) => (
          <View key={m.label} style={styles.metricCell}>
            <Text style={styles.metricLabel}>{m.label}</Text>
            <Text style={styles.metricValue}>{m.value}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.verdict, tone]}>{a.verdict}</Text>
    </View>
  )
}

// ============================================================
// 推移：練習を続けた結果として推定が動いているか
// ============================================================

function TrendView({ workouts }: { workouts: Workout[] }) {
  const distances = useMemo(() => trendableDistances(workouts), [workouts])
  const [picked, setPicked] = useState<number | null>(null)
  const distance = picked ?? distances[0] ?? null

  const trend = useMemo(
    () => (distance == null ? null : distanceTrend(workouts, distance)),
    [workouts, distance],
  )

  if (distance == null || !trend) {
    return (
      <View style={styles.list}>
        <Card>
          <Empty text="同じ距離を2回以上走ると、その距離の推移が出ます。" />
        </Card>
      </View>
    )
  }

  const change = trend.change
  const improved = change != null && change < 0

  return (
    <View style={styles.list}>
      <Card title={`${distance}m の推移`} icon="trending-down-outline">
        <ChipRow>
          {distances.map((d) => (
            <Chip key={d} label={`${d}m`} active={d === distance} onPress={() => setPicked(d)} />
          ))}
        </ChipRow>

        <View style={{ height: 12 }} />

        {change != null && (
          <View style={[styles.changeBox, improved ? styles.changeGood : styles.changeBad]}>
            <Ionicons
              name={improved ? 'arrow-down-circle' : 'arrow-up-circle'}
              size={20}
              color={improved ? colors.success : colors.textSub}
            />
            <Text style={styles.changeText}>
              初回から {improved ? '' : '＋'}{Math.abs(change).toFixed(1)}秒
              {improved ? ' 速くなっています' : ' 遅くなっています'}
            </Text>
          </View>
        )}

        <TrendChart points={trend.points} />

        {trend.best && (
          <Text style={styles.hint}>
            いちばん速かったのは {trend.best.date} の平均 {formatTime(trend.best.seconds, 1)} です。
          </Text>
        )}
        <Text style={styles.hint}>
          各棒はその日の {distance}m の平均タイムです。同じ距離どうしの比較なので、
          換算をはさまずに速さの変化がそのまま出ます。
          レストの長さや本数が違う日は、条件も違う点に注意してください。
        </Text>
      </Card>
    </View>
  )
}

// ============================================================
// 距離別：同じ距離で速くなっているか
// ============================================================

function DistanceView({ workouts }: { workouts: Workout[] }) {
  const stats = useMemo(() => distanceStats(workouts), [workouts])
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <View style={styles.list}>
      <Card title="距離別の記録" icon="podium-outline">
        <Text style={styles.hint}>
          同じ距離での前回との比較です。タップすると、その距離を走った練習の一覧が出ます。
        </Text>

        {stats.map((s) => {
          const delta = s.prevAvg != null ? s.latestAvg - s.prevAvg : null
          const isOpen = expanded === s.distance
          return (
            <View key={s.distance}>
              <TouchableOpacity
                style={styles.distRow}
                onPress={() => setExpanded(isOpen ? null : s.distance)}
              >
                <View style={styles.distHead}>
                  <Text style={styles.distName}>{s.distance}m</Text>
                  <Text style={styles.distMeta}>{s.sessions}回 ・ {s.reps}本</Text>
                </View>

                <View style={styles.distNums}>
                  <View style={styles.distNumCell}>
                    <Text style={styles.distNumLabel}>最速</Text>
                    <Text style={styles.distNumValue}>{formatTime(s.best, 1)}</Text>
                  </View>
                  <View style={styles.distNumCell}>
                    <Text style={styles.distNumLabel}>直近の平均</Text>
                    <Text style={styles.distNumValue}>{formatTime(s.latestAvg, 1)}</Text>
                  </View>
                  <View style={styles.distDeltaCell}>
                    {delta == null ? (
                      <Text style={styles.distDeltaNone}>—</Text>
                    ) : (
                      <Text style={[styles.distDelta, delta < 0 ? styles.deltaGood : styles.deltaBad]}>
                        {delta < 0 ? '▼' : '▲'}{Math.abs(delta).toFixed(1)}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={colors.textFaint}
                  />
                </View>
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.sessionList}>
                  {sessionsForDistance(workouts, s.distance).map((ses, i) => (
                    <View key={`${ses.date}-${i}`} style={styles.sessionRow}>
                      <Text style={styles.sessionDate}>{ses.date.slice(5).replace('-', '/')}</Text>
                      <Text style={styles.sessionTimes} numberOfLines={1}>
                        {ses.times.map((t) => formatTime(t, 1)).join('  ')}
                      </Text>
                      <Text style={styles.sessionAvg}>平均 {formatTime(ses.avg, 1)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )
        })}
      </Card>
    </View>
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

  tabWrap: { paddingHorizontal: 12, marginBottom: 4 },

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
  hint: { fontSize: 11, color: colors.textFaint, lineHeight: 17, marginTop: 8 },

  list: { paddingHorizontal: 12 },

  monthHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 6, marginTop: 6, marginBottom: 7,
  },
  monthLabel: { fontSize: 13.5, fontWeight: '900', color: colors.primary },
  monthMeta: { fontSize: 11, color: colors.textFaint, fontVariant: ['tabular-nums'] },

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
  repPillBest: { backgroundColor: colors.accentStrong },
  repPillDist: { fontSize: 10, color: colors.textFaint, fontWeight: '600' },
  repPillTime: { fontSize: 13, color: colors.text, fontWeight: '700' },
  repPillDelta: { fontSize: 10.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  repTarget: { fontSize: 10.5, color: colors.textFaint, fontVariant: ['tabular-nums'] },

  analysis: {
    backgroundColor: '#f6f8fc', borderRadius: radius.sm, padding: 10, marginTop: 9,
  },
  metricRow: { flexDirection: 'row', gap: 8 },
  metricCell: { flex: 1 },
  metricLabel: { fontSize: 10.5, color: colors.textFaint, fontWeight: '700' },
  metricValue: { fontSize: 14, color: colors.text, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 1 },
  verdict: { fontSize: 11.5, lineHeight: 17, marginTop: 8, fontWeight: '600' },
  verdictGood: { color: colors.good },
  verdictWarn: { color: colors.warn },
  verdictInfo: { color: colors.textSub },
  logNote: { fontSize: 11.5, color: colors.textSub, marginTop: 8, lineHeight: 17 },

  trendSingle: {
    fontSize: 30, fontWeight: '900', color: colors.text,
    fontVariant: ['tabular-nums'], textAlign: 'center', marginVertical: 6,
  },
  changeBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radius.sm, paddingHorizontal: 11, paddingVertical: 9, marginBottom: 10,
  },
  changeGood: { backgroundColor: '#e8f6ee' },
  changeBad: { backgroundColor: '#f2f4f8' },
  changeText: { fontSize: 13, fontWeight: '700', color: colors.text },

  distRow: { paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: colors.border },
  distHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  distName: { fontSize: 14, fontWeight: '900', color: colors.text },
  distMeta: { fontSize: 11, color: colors.textFaint },
  distNums: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 },
  distNumCell: { flex: 1 },
  distNumLabel: { fontSize: 10.5, color: colors.textFaint, fontWeight: '700' },
  distNumValue: { fontSize: 13, color: colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
  distDeltaCell: { width: 52, alignItems: 'flex-end' },
  distDelta: { fontSize: 12.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  deltaGood: { color: colors.success },
  deltaBad: { color: colors.textSub },
  distDeltaNone: { fontSize: 12, color: colors.textFaint },

  sessionList: { backgroundColor: '#f6f8fc', borderRadius: radius.sm, padding: 9, marginBottom: 4 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  sessionDate: { width: 42, fontSize: 11, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  sessionTimes: { flex: 1, fontSize: 11.5, color: colors.text, fontVariant: ['tabular-nums'] },
  sessionAvg: { fontSize: 11, color: colors.textSub, fontVariant: ['tabular-nums'] },
})
