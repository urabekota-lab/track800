import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '../lib/theme'
import { formatRest, formatTime, zoneOf } from '../lib/pace'
import { LEVEL_LABEL, PHASE_LABEL, mainZone, totalDistance } from '../lib/menuGenerator'
import type { Menu, MenuSet, SetKind } from '../lib/types'

const KIND_LABEL: Record<SetKind, string> = {
  warmup: 'W-up',
  main: 'メイン',
  sub: '補助',
  cooldown: 'C-down',
}

const KIND_COLOR: Record<SetKind, string> = {
  warmup: '#94a3b8',
  main: colors.primary,
  sub: '#7c3aed',
  cooldown: '#94a3b8',
}

/** ゾーンの色つきタグ */
export function ZoneTag({ zone }: { zone: string }) {
  const z = zoneOf(zone as any)
  if (!z) return null
  return (
    <View style={[styles.zoneTag, { backgroundColor: z.color + '18', borderColor: z.color + '55' }]}>
      <Text style={[styles.zoneTagText, { color: z.color }]}>{z.name}</Text>
    </View>
  )
}

/** メニュー1件分の詳細（セットの内訳） */
export function MenuSetList({ sets }: { sets: MenuSet[] }) {
  return (
    <View>
      {sets.map((s, i) => (
        <View key={s.key || String(i)} style={styles.setRow}>
          <View style={[styles.kindBar, { backgroundColor: KIND_COLOR[s.kind] }]} />
          <View style={styles.setBody}>
            <View style={styles.setHeadRow}>
              <Text style={styles.setKind}>{KIND_LABEL[s.kind]}</Text>
              <ZoneTag zone={s.zone} />
            </View>
            <Text style={styles.setLabel}>{s.label}</Text>

            <View style={styles.setMetaRow}>
              {s.targetSec ? (
                <View style={styles.metaItem}>
                  <Ionicons name="stopwatch-outline" size={12} color={colors.accent} />
                  <Text style={[styles.metaText, { color: colors.accent, fontWeight: '700' }]}>
                    設定 {formatTime(s.targetSec, s.targetSec < 60 ? 1 : 0)}
                  </Text>
                </View>
              ) : null}
              {s.restSec ? (
                <View style={styles.metaItem}>
                  <Ionicons name="pause-outline" size={12} color={colors.textSub} />
                  <Text style={styles.metaText}>レスト {formatRest(s.restSec)}</Text>
                </View>
              ) : null}
              {s.setRestSec ? (
                <View style={styles.metaItem}>
                  <Ionicons name="repeat-outline" size={12} color={colors.textSub} />
                  <Text style={styles.metaText}>セット間 {formatRest(s.setRestSec)}</Text>
                </View>
              ) : null}
            </View>

            {s.note ? <Text style={styles.setNote}>{s.note}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  )
}

/** 一覧用のコンパクトなメニューカード */
export function MenuCard({ menu, onPress, onToggleFavorite, right }: {
  menu: Menu
  onPress?: () => void
  onToggleFavorite?: () => void
  right?: React.ReactNode
}) {
  const dist = totalDistance(menu.sets)
  const zone = zoneOf(mainZone(menu.sets))

  return (
    <TouchableOpacity style={styles.menuCard} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <View style={styles.menuTopRow}>
        <Text style={styles.menuTitle} numberOfLines={1}>{menu.title}</Text>
        {right}
      </View>

      {menu.description ? (
        <Text style={styles.menuDesc} numberOfLines={2}>{menu.description}</Text>
      ) : null}

      <View style={styles.menuTagRow}>
        <View style={styles.tag}><Text style={styles.tagText}>{PHASE_LABEL[menu.phase]}</Text></View>
        <View style={styles.tag}><Text style={styles.tagText}>{LEVEL_LABEL[menu.level]}</Text></View>
        {zone ? <ZoneTag zone={zone.key} /> : null}
        {dist > 0 ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${dist}m`}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.menuFootRow}>
        {menu.imported ? (
          <View style={styles.metaItem}>
            <Ionicons name="download-outline" size={12} color={colors.textFaint} />
            <Text style={styles.menuAuthor} numberOfLines={1}>{menu.authorName} から取り込み</Text>
          </View>
        ) : (
          <Text style={styles.menuAuthor} numberOfLines={1}>{menu.authorName}</Text>
        )}
        {onToggleFavorite && (
          <TouchableOpacity style={styles.metaItem} onPress={onToggleFavorite} hitSlop={8}>
            <Ionicons
              name={menu.favorite ? 'star' : 'star-outline'}
              size={17}
              color={menu.favorite ? '#f59e0b' : colors.textFaint}
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  zoneTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, borderWidth: 0.5 },
  zoneTagText: { fontSize: 10, fontWeight: '700' },

  setRow: { flexDirection: 'row', gap: 9, marginBottom: 10 },
  kindBar: { width: 3, borderRadius: 2 },
  setBody: { flex: 1 },
  setHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  setKind: { fontSize: 10, fontWeight: '700', color: colors.textFaint },
  setLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  setMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 3 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: colors.textSub },
  setNote: { fontSize: 11, color: colors.textFaint, marginTop: 3, lineHeight: 16 },

  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  menuTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuTitle: { flex: 1, fontSize: 15, fontWeight: 'bold', color: colors.text },
  menuDesc: { fontSize: 12, color: colors.textSub, marginTop: 4, lineHeight: 17 },
  menuTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  tag: { backgroundColor: '#f1f4fa', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, color: colors.textSub, fontWeight: '600' },
  menuFootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 9 },
  menuAuthor: { fontSize: 11, color: colors.textFaint },
})
