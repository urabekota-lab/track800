import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Screen } from '../components/Screen'
import { useApp } from '../lib/AppContext'
import { confirmDestructive } from '../lib/confirm'
import { encodeMenu } from '../lib/shareCode'
import { Button, Card } from '../components/ui'
import { MenuSetList } from '../components/menu'
import { colors, radius } from '../lib/theme'
import { formatTime, zoneTarget } from '../lib/pace'
import { LEVEL_LABEL, PHASE_LABEL, totalDistance } from '../lib/menuGenerator'
import type { Menu } from '../lib/types'

export default function MenuDetailScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { menus, profile, prediction, saveMenu, removeMenu, toggleFavorite } = useApp()

  /** 提案画面からはメニュー実体が、一覧からは id が渡ってくる */
  const passedMenu: Menu | undefined = route.params?.menu
  const menuId: string | undefined = route.params?.menuId

  const menu = useMemo(
    () => (menuId ? menus.find((m) => m.id === menuId) ?? null : passedMenu ?? null),
    [menuId, menus, passedMenu],
  )

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [useMyPace, setUseMyPace] = useState(false)
  const [shownCode, setShownCode] = useState('')

  /** 提案画面から来たメニューはまだ保存されていない */
  const isDraft = !menuId

  /** 自分の推定タイムで設定を引き直したセット */
  const displaySets = useMemo(() => {
    if (!menu) return []
    if (!useMyPace || !prediction.seconds) return menu.sets
    return menu.sets.map((s) => ({
      ...s,
      targetSec:
        s.kind === 'main' && s.distance > 0 && s.zone !== 'none'
          ? zoneTarget(s.zone, prediction.seconds!, s.distance)
          : s.targetSec,
    }))
  }, [menu, useMyPace, prediction.seconds])

  if (!menu) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>メニューが見つかりません</Text>
      </View>
    )
  }

  const handleSave = async () => {
    setError('')
    try {
      const saved = await saveMenu({
        title: menu.title,
        description: menu.description,
        phase: menu.phase,
        level: menu.level,
        focus: menu.focus,
        sets: displaySets,
        authorName: profile.displayName || '自分',
        imported: false,
        favorite: false,
      })
      // 保存済みの実体に切り替えて、以降は共有や編集ができるようにする
      navigation.setParams({ menuId: saved.id, menu: undefined })
      setMessage('メニューに保存しました')
    } catch (e: any) {
      setError(e?.message ?? '保存に失敗しました')
    }
  }

  const handleShare = async () => {
    setError('')
    const code = encodeMenu({ ...menu, sets: displaySets })
    const body =
      `【Track800】${menu.title}\n` +
      `下のコードをアプリの「メニュー」→ 取り込みボタンに貼り付けてください。\n\n${code}`

    if (Platform.OS === 'web') {
      // web の共有シートは対応が限られるので、コードを画面に出して自分でコピーしてもらう
      setShownCode(code)
      try {
        await navigator.clipboard?.writeText(body)
        setMessage('共有コードをコピーしました')
      } catch {
        setMessage('下のコードを選択してコピーしてください')
      }
      return
    }
    try {
      await Share.share({ message: body })
    } catch (e: any) {
      setError(e?.message ?? '共有できませんでした')
    }
  }

  const handleDelete = () => {
    confirmDestructive('メニューを削除', `「${menu.title}」を削除しますか？`, async () => {
      await removeMenu(menu.id)
      navigation.goBack()
    })
  }

  const dist = totalDistance(displaySets)

  return (
    <Screen insetBottom>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        {!isDraft && (
          <TouchableOpacity onPress={() => toggleFavorite(menu.id)} style={styles.favBtn}>
            <Ionicons
              name={menu.favorite ? 'star' : 'star-outline'}
              size={20}
              color={menu.favorite ? '#f59e0b' : colors.textSub}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>{menu.title}</Text>
        {menu.description ? <Text style={styles.desc}>{menu.description}</Text> : null}
        <View style={styles.tagRow}>
          <View style={styles.tag}><Text style={styles.tagText}>{PHASE_LABEL[menu.phase]}</Text></View>
          <View style={styles.tag}><Text style={styles.tagText}>{LEVEL_LABEL[menu.level]}</Text></View>
          {menu.focus ? <View style={styles.tag}><Text style={styles.tagText}>{menu.focus}</Text></View> : null}
          {dist > 0 ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                走行 {dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${dist}m`}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.author}>
          {menu.imported ? `${menu.authorName} から取り込み` : `作成：${menu.authorName || '自分'}`}
        </Text>
      </View>

      {prediction.seconds != null && (
        <TouchableOpacity style={styles.paceToggle} onPress={() => setUseMyPace(!useMyPace)}>
          <Ionicons
            name={useMyPace ? 'checkbox' : 'square-outline'}
            size={18}
            color={useMyPace ? colors.primary : colors.textFaint}
          />
          <Text style={styles.paceToggleText}>
            設定タイムを自分の推定（{formatTime(prediction.seconds, 1)}）に合わせる
          </Text>
        </TouchableOpacity>
      )}

      <Card title="メニュー内容" icon="list-outline">
        <MenuSetList sets={displaySets} />
      </Card>

      {shownCode ? (
        <Card title="共有コード" icon="share-social-outline">
          <Text selectable style={styles.code}>{shownCode}</Text>
          <Text style={styles.codeHint}>
            このコードを送ると、相手はアプリに貼り付けるだけで同じメニューを取り込めます。
          </Text>
        </Card>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {isDraft ? (
          <Button label="自分のメニューに保存" icon="bookmark-outline" onPress={handleSave} />
        ) : (
          <>
            <Button label="共有コードを送る" icon="share-social-outline" onPress={handleShare} />
            <Button
              label="編集する"
              icon="create-outline"
              variant="secondary"
              onPress={() => navigation.navigate('メニュー作成', { menu })}
            />
            <Button label="削除する" icon="trash-outline" variant="danger" onPress={handleDelete} />
          </>
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 4 },
  backBtn: { flex: 1, padding: 6, alignSelf: 'flex-start' },
  favBtn: { padding: 8 },

  titleWrap: { paddingHorizontal: 18, marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '900', color: colors.text, lineHeight: 30 },
  desc: { fontSize: 13, color: colors.textSub, marginTop: 7, lineHeight: 20 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 11 },
  tag: { backgroundColor: '#e8edf7', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  author: { fontSize: 11, color: colors.textFaint, marginTop: 9 },

  paceToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 12,
    backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12,
  },
  paceToggleText: { flex: 1, fontSize: 12.5, color: colors.primary, fontWeight: '600' },

  code: {
    fontSize: 11, color: colors.text, backgroundColor: '#f1f4fa', borderRadius: radius.sm,
    padding: 10, lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeHint: { fontSize: 11, color: colors.textFaint, marginTop: 8, lineHeight: 17 },

  actions: { paddingHorizontal: 12, gap: 8 },
  message: { color: colors.success, fontSize: 12.5, paddingHorizontal: 18, marginBottom: 8 },
  error: { color: colors.danger, fontSize: 12.5, paddingHorizontal: 18, marginBottom: 8 },
})
