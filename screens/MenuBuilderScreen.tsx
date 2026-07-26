import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Screen } from '../components/Screen'
import { useApp } from '../lib/AppContext'
import { Button, Card, Chip, ChipRow, Field, Input } from '../components/ui'
import { colors, radius } from '../lib/theme'
import { ZONES, formatTime, parseTime, zoneTarget } from '../lib/pace'
import { LEVEL_LABEL, PHASE_LABEL, buildSetLabel } from '../lib/menuGenerator'
import type { Level, Menu, MenuSet, Phase, SetKind, ZoneKey } from '../lib/types'

const PHASES: Phase[] = ['base', 'build', 'peak', 'race']
const LEVELS: Level[] = ['jhs', 'hs', 'univ', 'masters']
const KINDS: SetKind[] = ['warmup', 'main', 'sub', 'cooldown']
const KIND_LABEL: Record<SetKind, string> = {
  warmup: 'W-up', main: 'メイン', sub: '補助', cooldown: 'C-down',
}

interface DraftSet {
  key: string
  kind: SetKind
  distance: string
  reps: string
  sets: string
  zone: ZoneKey
  target: string
  rest: string
  setRest: string
  note: string
  /** 距離を指定しない項目（ジョグ・補強など）の自由記述 */
  freeLabel: string
}

let keyCounter = 0
const nextKey = () => `d${++keyCounter}`

function emptySet(kind: SetKind = 'main'): DraftSet {
  return {
    key: nextKey(), kind, distance: '', reps: '1', sets: '1',
    zone: 'none', target: '', rest: '', setRest: '', note: '', freeLabel: '',
  }
}

function toDraft(s: MenuSet): DraftSet {
  return {
    key: nextKey(),
    kind: s.kind,
    distance: s.distance > 0 ? String(s.distance) : '',
    reps: String(s.reps || 1),
    sets: String(s.sets || 1),
    zone: s.zone,
    target: s.targetSec ? formatTime(s.targetSec, s.targetSec < 60 ? 1 : 0) : '',
    rest: s.restSec ? formatTime(s.restSec, 0) : '',
    setRest: s.setRestSec ? formatTime(s.setRestSec, 0) : '',
    note: s.note,
    freeLabel: s.distance > 0 ? '' : s.label,
  }
}

function draftLabel(d: DraftSet): string {
  const dist = Number(d.distance)
  if (!dist) return d.freeLabel || '（内容未入力）'
  return buildSetLabel(dist, Math.max(1, Number(d.reps) || 1), Math.max(1, Number(d.sets) || 1))
}

function toMenuSet(d: DraftSet): MenuSet {
  const dist = Number(d.distance) || 0
  return {
    key: d.key,
    kind: d.kind,
    label: draftLabel(d),
    distance: dist,
    reps: Math.max(1, Number(d.reps) || 1),
    sets: Math.max(1, Number(d.sets) || 1),
    zone: d.zone,
    targetSec: parseTime(d.target),
    restSec: parseTime(d.rest),
    setRestSec: parseTime(d.setRest),
    note: d.note.trim(),
  }
}

export default function MenuBuilderScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { profile, prediction, saveMenu } = useApp()

  const editing: Menu | undefined = route.params?.menu

  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [phase, setPhase] = useState<Phase>(editing?.phase ?? 'build')
  const [level, setLevel] = useState<Level>(editing?.level ?? profile.level)
  const [focus, setFocus] = useState(editing?.focus ?? '')
  const [drafts, setDrafts] = useState<DraftSet[]>(
    editing ? editing.sets.map(toDraft) : [emptySet('warmup'), emptySet('main'), emptySet('cooldown')],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const patch = (key: string, p: Partial<DraftSet>) => {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...p } : d)))
  }

  const move = (index: number, delta: number) => {
    const to = index + delta
    if (to < 0 || to >= drafts.length) return
    const next = [...drafts]
    const [item] = next.splice(index, 1)
    next.splice(to, 0, item)
    setDrafts(next)
  }

  /** ゾーンと距離から設定タイムを自動で入れる */
  const autoFill = (d: DraftSet) => {
    const dist = Number(d.distance)
    if (!prediction.seconds || !dist || d.zone === 'none') return
    const sec = zoneTarget(d.zone, prediction.seconds, dist)
    if (sec) patch(d.key, { target: formatTime(sec, sec < 60 ? 1 : 0) })
  }

  const save = async () => {
    setError('')
    if (!title.trim()) {
      setError('メニュー名を入力してください')
      return
    }
    const sets = drafts
      .filter((d) => Number(d.distance) > 0 || d.freeLabel.trim())
      .map(toMenuSet)
    if (sets.length === 0) {
      setError('少なくとも1つの内容を入力してください')
      return
    }

    setSaving(true)
    try {
      await saveMenu({
        // 提案から来たメニューは id を持たないので、新規として保存される
        id: editing && !editing.id.startsWith('gen-') ? editing.id : undefined,
        title: title.trim(),
        description: description.trim(),
        phase,
        level,
        focus: focus.trim(),
        sets,
        authorName: editing?.authorName || profile.displayName || '自分',
        imported: editing?.imported ?? false,
        favorite: editing?.favorite ?? false,
      })
      navigation.goBack()
    } catch (e: any) {
      setError(e?.message ?? '保存に失敗しました')
      setSaving(false)
    }
  }

  return (
    <Screen avoidKeyboard insetBottom>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editing ? 'メニューを編集' : 'メニューを作成'}</Text>
      </View>

      <Card title="基本情報" icon="information-circle-outline">
        <Field label="メニュー名">
          <Input value={title} onChangeText={setTitle} placeholder="例：600m×4（1500mペース）" />
        </Field>
        <Field label="ねらい・説明">
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="何のための練習か、どこを意識するか"
            multiline
          />
        </Field>
        <Field label="時期">
          <ChipRow>
            {PHASES.map((p) => (
              <Chip key={p} label={PHASE_LABEL[p]} active={phase === p} onPress={() => setPhase(p)} />
            ))}
          </ChipRow>
        </Field>
        <Field label="対象">
          <ChipRow>
            {LEVELS.map((l) => (
              <Chip key={l} label={LEVEL_LABEL[l]} active={level === l} onPress={() => setLevel(l)} />
            ))}
          </ChipRow>
        </Field>
        <Field label="キーワード（任意）" hint="スピード持久 / 乳酸耐性 / 有酸素土台 など">
          <Input value={focus} onChangeText={setFocus} placeholder="スピード持久" />
        </Field>
      </Card>

      {drafts.map((d, i) => (
        <Card key={d.key}>
          <View style={styles.setHeader}>
            <ChipRow>
              {KINDS.map((k) => (
                <Chip key={k} label={KIND_LABEL[k]} active={d.kind === k} onPress={() => patch(d.key, { kind: k })} />
              ))}
            </ChipRow>
            <View style={styles.setHeaderActions}>
              <TouchableOpacity onPress={() => move(i, -1)} style={styles.iconSmall}>
                <Ionicons name="chevron-up" size={16} color={colors.textSub} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => move(i, 1)} style={styles.iconSmall}>
                <Ionicons name="chevron-down" size={16} color={colors.textSub} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDrafts(drafts.filter((x) => x.key !== d.key))}
                style={styles.iconSmall}
              >
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.preview}>{draftLabel(d)}</Text>

          <View style={styles.numRow}>
            <View style={styles.numCell}>
              <Text style={styles.numLabel}>距離(m)</Text>
              <Input
                value={d.distance}
                onChangeText={(v) => patch(d.key, { distance: v.replace(/[^0-9]/g, '') })}
                placeholder="400"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.numCell}>
              <Text style={styles.numLabel}>本数</Text>
              <Input
                value={d.reps}
                onChangeText={(v) => patch(d.key, { reps: v.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.numCell}>
              <Text style={styles.numLabel}>セット</Text>
              <Input
                value={d.sets}
                onChangeText={(v) => patch(d.key, { sets: v.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {!d.distance && (
            <Field label="内容（距離を使わない場合）" hint="例：ジョグ 40分／体幹補強 10分">
              <Input
                value={d.freeLabel}
                onChangeText={(v) => patch(d.key, { freeLabel: v })}
                placeholder="ジョグ 40分"
              />
            </Field>
          )}

          <Field label="強度ゾーン">
            <ChipRow>
              <Chip label="指定なし" active={d.zone === 'none'} onPress={() => patch(d.key, { zone: 'none' })} />
              {ZONES.map((z) => (
                <Chip
                  key={z.key}
                  label={z.name}
                  active={d.zone === z.key}
                  color={z.color}
                  onPress={() => patch(d.key, { zone: z.key })}
                />
              ))}
            </ChipRow>
          </Field>

          <View style={styles.numRow}>
            <View style={[styles.numCell, { flex: 1.3 }]}>
              <Text style={styles.numLabel}>設定タイム</Text>
              <Input
                value={d.target}
                onChangeText={(v) => patch(d.key, { target: v })}
                placeholder="62.5"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.numCell}>
              <Text style={styles.numLabel}>レスト</Text>
              <Input
                value={d.rest}
                onChangeText={(v) => patch(d.key, { rest: v })}
                placeholder="3:00"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.numCell}>
              <Text style={styles.numLabel}>セット間</Text>
              <Input
                value={d.setRest}
                onChangeText={(v) => patch(d.key, { setRest: v })}
                placeholder="10:00"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          {prediction.seconds != null && Number(d.distance) > 0 && d.zone !== 'none' && (
            <TouchableOpacity style={styles.autoBtn} onPress={() => autoFill(d)}>
              <Ionicons name="flash-outline" size={13} color={colors.primary} />
              <Text style={styles.autoBtnText}>
                推定タイムから設定を自動入力（
                {formatTime(zoneTarget(d.zone, prediction.seconds, Number(d.distance)), 1)}）
              </Text>
            </TouchableOpacity>
          )}

          <Field label="ポイント（任意）">
            <Input
              value={d.note}
              onChangeText={(v) => patch(d.key, { note: v })}
              placeholder="意識すること・注意点"
            />
          </Field>
        </Card>
      ))}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.addSetBtn} onPress={() => setDrafts([...drafts, emptySet()])}>
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={styles.addSetText}>項目を追加</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={saving ? '保存中…' : editing ? '変更を保存' : 'メニューを保存'}
          icon="checkmark"
          onPress={save}
          disabled={saving}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, marginBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },

  setHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  setHeaderActions: { flexDirection: 'row', gap: 2 },
  iconSmall: { padding: 5 },
  preview: {
    fontSize: 15, fontWeight: '700', color: colors.primary, backgroundColor: colors.primarySoft,
    borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },

  numRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  numCell: { flex: 1 },
  numLabel: { fontSize: 11, fontWeight: '600', color: colors.textSub, marginBottom: 5 },

  autoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft,
    borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 12,
  },
  autoBtnText: { flex: 1, fontSize: 11.5, color: colors.primary, fontWeight: '600' },

  footer: { paddingHorizontal: 12, gap: 10 },
  addSetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 13,
  },
  addSetText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 12.5 },
})
