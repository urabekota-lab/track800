import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../components/Screen'
import { useApp } from '../lib/AppContext'
import { confirmDestructive } from '../lib/confirm'
import { exportBackup, importBackup } from '../lib/backup'
import { Button, Card, Chip, ChipRow, Field, Input } from '../components/ui'
import { colors, radius } from '../lib/theme'
import { formatTime, parseTime } from '../lib/pace'
import { LEVEL_LABEL } from '../lib/menuGenerator'
import type { Level, RunnerType } from '../lib/types'

const LEVELS: Level[] = ['jhs', 'hs', 'univ', 'masters']

const TYPES: { key: RunnerType; label: string; desc: string }[] = [
  { key: 'speed', label: 'スピード型', desc: '400m が武器。前半で押して逃げ切りたい' },
  { key: 'balanced', label: 'バランス型', desc: 'スピードも持久もそこそこ。展開で勝負' },
  { key: 'endurance', label: '持久型', desc: '1500m も走れる。ラストの粘りで勝負' },
]

/** 800m の推定に効く距離を、効きやすい順に並べている */
const PB_DISTANCES = [400, 600, 800, 1000, 1500, 3000, 5000]

export default function SettingsScreen() {
  const {
    profile, personalBests, workouts, menus,
    updateProfile, savePersonalBests, replaceAll,
  } = useApp()

  const [displayName, setDisplayName] = useState('')
  const [team, setTeam] = useState('')
  const [pbInputs, setPbInputs] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setDisplayName(profile.displayName)
    setTeam(profile.team)
  }, [profile.displayName, profile.team])

  useEffect(() => {
    const next: Record<number, string> = {}
    for (const pb of personalBests) next[pb.distance] = formatTime(pb.seconds, 2)
    setPbInputs(next)
  }, [personalBests])

  const notify = (text: string) => { setMessage(text); setError('') }
  const fail = (e: any) => { setError(e?.message ?? '失敗しました'); setMessage('') }

  const saveProfileInfo = async () => {
    try {
      await updateProfile({ displayName: displayName.trim(), team: team.trim() })
      notify('プロフィールを保存しました')
    } catch (e) { fail(e) }
  }

  const savePbs = async () => {
    try {
      const list = PB_DISTANCES.map((distance) => {
        const seconds = parseTime((pbInputs[distance] ?? '').trim())
        return seconds != null ? { distance, seconds, recordedOn: null } : null
      }).filter((pb): pb is { distance: number; seconds: number; recordedOn: null } => pb != null)

      await savePersonalBests(list)
      notify('自己ベストを保存しました')
    } catch (e) { fail(e) }
  }

  const runExport = async () => {
    setBusy(true)
    try {
      notify(await exportBackup({ profile, personalBests, workouts, menus }))
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  const runImport = async () => {
    setBusy(true)
    try {
      const data = await importBackup()
      if (!data) { setBusy(false); return }
      confirmDestructive(
        'データを復元',
        `いまの記録${workouts.length}件・メニュー${menus.length}件は、ファイルの内容ですべて置き換わります。よろしいですか？`,
        async () => {
          await replaceAll(data)
          notify(`復元しました（記録${data.workouts.length}件・メニュー${data.menus.length}件）`)
        },
      )
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  return (
    <Screen avoidKeyboard>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>設定</Text>
      </View>

      <Card title="プロフィール" icon="person-outline">
        <Field label="名前" hint="共有コードを送るときに作成者名として付きます">
          <Input value={displayName} onChangeText={setDisplayName} placeholder="例：田中 太郎" />
        </Field>
        <Field label="所属（任意）">
          <Input value={team} onChangeText={setTeam} placeholder="例：〇〇高校陸上部" />
        </Field>
        <Button label="プロフィールを保存" onPress={saveProfileInfo} variant="secondary" />
      </Card>

      <Card title="カテゴリ" icon="school-outline">
        <ChipRow>
          {LEVELS.map((l) => (
            <Chip
              key={l}
              label={LEVEL_LABEL[l]}
              active={profile.level === l}
              onPress={() => updateProfile({ level: l })}
            />
          ))}
        </ChipRow>
        <Text style={styles.hint}>レストの長さと、400m からの推定の基準値に反映されます。</Text>
      </Card>

      <Card title="選手タイプ" icon="git-compare-outline">
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typeRow, profile.runnerType === t.key && styles.typeRowActive]}
            onPress={() => updateProfile({ runnerType: t.key })}
          >
            <Ionicons
              name={profile.runnerType === t.key ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={profile.runnerType === t.key ? colors.primary : colors.textFaint}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.typeLabel}>{t.label}</Text>
              <Text style={styles.typeDesc}>{t.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <Text style={styles.hint}>
          800m は同じ 400m ベストでもタイプによって出るタイムが変わります。予測の重み付けに使います。
        </Text>
      </Card>

      <Card title="自己ベスト" icon="trophy-outline">
        <Text style={styles.hint}>
          空欄にして保存すると削除されます。600m〜1000m は 800m の推定に最も効きます。
        </Text>
        {PB_DISTANCES.map((d) => (
          <View key={d} style={styles.pbRow}>
            <Text style={styles.pbDistance}>{d}m</Text>
            <Input
              value={pbInputs[d] ?? ''}
              onChangeText={(v) => setPbInputs({ ...pbInputs, [d]: v })}
              placeholder={d <= 600 ? '例：58.4' : '例：2:05.3'}
              keyboardType="numbers-and-punctuation"
              style={{ flex: 1 }}
            />
          </View>
        ))}
        <View style={{ height: 6 }} />
        <Button label="自己ベストを保存" onPress={savePbs} icon="save-outline" />
      </Card>

      <Card title="データの書き出し・取り込み" icon="save-outline">
        <Text style={styles.hint}>
          データはこの端末の中だけに保存されています。アプリを消すと一緒に消えるので、
          ときどきファイルに書き出しておくと安心です。機種変更のときもこれで移せます。
        </Text>
        <View style={styles.backupStats}>
          <Text style={styles.backupStatsText}>
            記録 {workouts.length}件 ・ メニュー {menus.length}件 ・ 自己ベスト {personalBests.length}件
          </Text>
        </View>
        <View style={{ gap: 8 }}>
          <Button
            label="ファイルに書き出す"
            icon="cloud-upload-outline"
            onPress={runExport}
            disabled={busy}
          />
          <Button
            label="ファイルから復元する"
            icon="cloud-download-outline"
            variant="secondary"
            onPress={runImport}
            disabled={busy}
          />
        </View>
      </Card>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, marginBottom: 12 },
  headerTitle: { fontSize: 19, fontWeight: 'bold', color: colors.text },

  hint: { fontSize: 11.5, color: colors.textFaint, lineHeight: 17, marginTop: 8 },

  typeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11,
    borderRadius: radius.sm, marginBottom: 6, backgroundColor: '#f8f9fc',
    borderWidth: 0.5, borderColor: 'transparent',
  },
  typeRowActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  typeLabel: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  typeDesc: { fontSize: 11, color: colors.textSub, marginTop: 2 },

  pbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  pbDistance: { width: 52, fontSize: 13, fontWeight: '700', color: colors.textSub },

  backupStats: {
    backgroundColor: '#f6f8fc', borderRadius: radius.sm, padding: 10, marginTop: 10, marginBottom: 12,
  },
  backupStatsText: { fontSize: 12, color: colors.textSub, fontWeight: '600' },

  message: { color: colors.success, fontSize: 12.5, paddingHorizontal: 18, marginBottom: 6 },
  error: { color: colors.danger, fontSize: 12.5, paddingHorizontal: 18, marginBottom: 6 },
})
