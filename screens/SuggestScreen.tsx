import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useApp } from '../lib/AppContext'
import { Card, Chip, ChipRow, Empty } from '../components/ui'
import { Screen } from '../components/Screen'
import { MenuCard } from '../components/menu'
import { colors, radius } from '../lib/theme'
import { formatTime } from '../lib/pace'
import {
  DAY_TYPE_LABEL, PHASE_DESC, PHASE_LABEL, suggestMenus, suggestWeek,
} from '../lib/menuGenerator'
import type { DayType } from '../lib/menuGenerator'
import type { Phase } from '../lib/types'

const PHASES: Phase[] = ['base', 'build', 'peak', 'race']
const DAY_TYPES: (DayType | 'any')[] = ['any', 'point', 'sub', 'long']

export default function SuggestScreen() {
  const navigation = useNavigation<any>()
  const { profile, prediction } = useApp()
  const [phase, setPhase] = useState<Phase>('build')
  const [dayType, setDayType] = useState<DayType | 'any'>('any')
  const [mode, setMode] = useState<'single' | 'week'>('single')
  const [pointsPerWeek, setPointsPerWeek] = useState(2)

  const level = profile?.level ?? 'hs'
  const pred = prediction.seconds

  const menus = useMemo(
    () => suggestMenus({ phase, dayType, pred800Sec: pred, level }),
    [phase, dayType, pred, level],
  )

  const week = useMemo(
    () => suggestWeek(phase, pointsPerWeek, pred, level),
    [phase, pointsPerWeek, pred, level],
  )

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>メニュー提案</Text>
        <Text style={styles.headerSub}>
          {pred
            ? `推定 ${formatTime(pred, 1)} を基準に設定タイムを計算しています`
            : '推定タイムが出ると、各本の設定タイムが自動で入ります'}
        </Text>
      </View>

      <Card>
        <View style={styles.modeTabs}>
          {(['single', 'week'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeTab, mode === m && styles.modeTabActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
                {m === 'single' ? '1回分を探す' : '1週間を組む'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.filterLabel}>時期</Text>
        <ChipRow>
          {PHASES.map((p) => (
            <Chip key={p} label={PHASE_LABEL[p]} active={phase === p} onPress={() => setPhase(p)} />
          ))}
        </ChipRow>
        <Text style={styles.phaseDesc}>{PHASE_DESC[phase]}</Text>

        {mode === 'single' ? (
          <>
            <Text style={styles.filterLabel}>種類</Text>
            <ChipRow>
              {DAY_TYPES.map((d) => (
                <Chip
                  key={d}
                  label={d === 'any' ? 'すべて' : DAY_TYPE_LABEL[d]}
                  active={dayType === d}
                  onPress={() => setDayType(d)}
                />
              ))}
            </ChipRow>
          </>
        ) : (
          <>
            <Text style={styles.filterLabel}>週のポイント練習の回数</Text>
            <ChipRow>
              {[1, 2, 3, 4].map((n) => (
                <Chip
                  key={n}
                  label={`週${n}回`}
                  active={pointsPerWeek === n}
                  onPress={() => setPointsPerWeek(n)}
                />
              ))}
            </ChipRow>
          </>
        )}
      </Card>

      {mode === 'single' ? (
        <View style={styles.list}>
          {menus.length === 0 ? (
            <Empty text="条件に合うメニューがありません" />
          ) : (
            menus.map((m) => (
              <MenuCard
                key={m.id}
                menu={m}
                onPress={() => navigation.navigate('メニュー詳細', { menu: m })}
              />
            ))
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {week.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={styles.weekRow}
              disabled={!d.menu}
              activeOpacity={0.7}
              onPress={() => d.menu && navigation.navigate('メニュー詳細', { menu: d.menu })}
            >
              <View style={styles.weekDay}>
                <Text style={styles.weekDayText}>{d.day}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.weekType}>{DAY_TYPE_LABEL[d.dayType]}</Text>
                <Text style={styles.weekMenu} numberOfLines={1}>
                  {d.menu ? d.menu.title : '完全休養'}
                </Text>
              </View>
              {d.menu ? <Ionicons name="chevron-forward" size={16} color={colors.textFaint} /> : null}
            </TouchableOpacity>
          ))}
          <Text style={styles.weekNote}>
            ポイント練習が連日にならないよう並べています。疲労が抜けていない日は、迷わずつなぎに落としてください。
          </Text>
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, marginBottom: 12 },
  headerTitle: { fontSize: 19, fontWeight: 'bold', color: colors.text },
  headerSub: { fontSize: 12, color: colors.textSub, marginTop: 3, lineHeight: 17 },

  modeTabs: { flexDirection: 'row', backgroundColor: '#eef1f7', borderRadius: radius.sm, padding: 3, marginBottom: 14 },
  modeTab: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  modeTabActive: { backgroundColor: colors.surface },
  modeTabText: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  modeTabTextActive: { color: colors.primary },

  filterLabel: { fontSize: 12, fontWeight: '600', color: colors.textSub, marginBottom: 6, marginTop: 6 },
  phaseDesc: { fontSize: 11.5, color: colors.textFaint, marginTop: 8, lineHeight: 17 },

  list: { paddingHorizontal: 12 },

  weekRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: 11, marginBottom: 8,
  },
  weekDay: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  weekDayText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  weekType: { fontSize: 10, color: colors.textFaint, fontWeight: '700' },
  weekMenu: { fontSize: 13.5, fontWeight: '600', color: colors.text, marginTop: 1 },
  weekNote: { fontSize: 11.5, color: colors.textFaint, lineHeight: 17, marginTop: 4, paddingHorizontal: 2 },
})
