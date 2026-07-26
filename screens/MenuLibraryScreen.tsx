import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useApp } from '../lib/AppContext'
import { Button, Card, Chip, ChipRow, Empty, Field, Input } from '../components/ui'
import { MenuCard } from '../components/menu'
import { Screen } from '../components/Screen'
import { colors, radius } from '../lib/theme'
import { PHASE_LABEL } from '../lib/menuGenerator'
import type { Phase } from '../lib/types'

const PHASES: (Phase | 'all')[] = ['all', 'base', 'build', 'peak', 'race']

export default function MenuLibraryScreen() {
  const navigation = useNavigation<any>()
  const { menus, toggleFavorite, importMenuCode } = useApp()

  const [search, setSearch] = useState('')
  const [phase, setPhase] = useState<Phase | 'all'>('all')
  const [importOpen, setImportOpen] = useState(false)
  const [code, setCode] = useState('')
  const [importError, setImportError] = useState('')
  const [importMessage, setImportMessage] = useState('')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return menus
      .filter((m) => phase === 'all' || m.phase === phase)
      .filter((m) =>
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.focus.toLowerCase().includes(q),
      )
      // お気に入りを先頭に固定し、その中では新しい順
      .sort((a, b) =>
        a.favorite === b.favorite
          ? b.createdAt.localeCompare(a.createdAt)
          : a.favorite ? -1 : 1,
      )
  }, [menus, search, phase])

  const runImport = async () => {
    setImportError('')
    setImportMessage('')
    try {
      const menu = await importMenuCode(code)
      setCode('')
      setImportOpen(false)
      setImportMessage(`「${menu.title}」を取り込みました`)
    } catch (e: any) {
      setImportError(e?.message ?? '取り込めませんでした')
    }
  }

  return (
    <Screen avoidKeyboard>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>メニュー</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('メニュー作成', {})}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>作成</Text>
        </TouchableOpacity>
      </View>

      <Card>
        <View style={styles.searchRow}>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="メニュー名・内容で検索"
            style={{ flex: 1 }}
          />
          <TouchableOpacity
            style={[styles.importBtn, importOpen && { backgroundColor: colors.primary }]}
            onPress={() => { setImportOpen(!importOpen); setImportError(''); setImportMessage('') }}
          >
            <Ionicons
              name="download-outline"
              size={18}
              color={importOpen ? '#fff' : colors.primary}
            />
          </TouchableOpacity>
        </View>

        {importOpen && (
          <View style={styles.importPanel}>
            <Field
              label="共有コードを取り込む"
              hint="仲間から送られてきた「T800…」で始まるコードを貼り付けてください"
            >
              <Input
                value={code}
                onChangeText={setCode}
                placeholder="T800..."
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
            {importError ? <Text style={styles.error}>{importError}</Text> : null}
            <Button label="取り込む" icon="download-outline" onPress={runImport} disabled={!code.trim()} />
          </View>
        )}

        <View style={styles.filterWrap}>
          <ChipRow>
            {PHASES.map((p) => (
              <Chip
                key={p}
                label={p === 'all' ? 'すべて' : PHASE_LABEL[p]}
                active={phase === p}
                onPress={() => setPhase(p)}
              />
            ))}
          </ChipRow>
        </View>
      </Card>

      {importMessage ? <Text style={styles.message}>{importMessage}</Text> : null}

      <View style={styles.list}>
        {visible.length === 0 ? (
          <Empty
            text={
              menus.length === 0
                ? 'まだメニューがありません。「作成」で自分で組むか、「提案」から気に入ったものを保存しましょう。'
                : '条件に合うメニューがありません'
            }
          />
        ) : (
          visible.map((m) => (
            <MenuCard
              key={m.id}
              menu={m}
              onPress={() => navigation.navigate('メニュー詳細', { menuId: m.id })}
              onToggleFavorite={() => toggleFavorite(m.id)}
            />
          ))
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

  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  importBtn: {
    width: 40, height: 40, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft,
  },
  importPanel: { marginTop: 12 },
  filterWrap: { marginTop: 12 },

  list: { paddingHorizontal: 12 },
  error: { color: colors.danger, fontSize: 12, marginBottom: 10, lineHeight: 18 },
  message: { color: colors.success, fontSize: 12.5, paddingHorizontal: 18, marginBottom: 10 },
})
