import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useApp } from '../lib/AppContext'
import { Card, Empty } from '../components/ui'
import { Screen } from '../components/Screen'
import { colors, radius } from '../lib/theme'
import {
  EFFORT_LABEL, ZONES, equivalentTimes, formatTime, raceSplits, velocity800, zoneRange,
} from '../lib/pace'
import { LEVEL_LABEL } from '../lib/menuGenerator'

const TYPE_LABEL = { speed: 'スピード型', balanced: 'バランス型', endurance: '持久型' } as const

export default function HomeScreen() {
  const navigation = useNavigation<any>()
  const { profile, prediction, workouts } = useApp()

  const pred = prediction.seconds
  const recent = workouts.slice(0, 3)

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>
            {profile.displayName ? `${profile.displayName} さん` : 'ようこそ'}
          </Text>
          <Text style={styles.headerSub}>
            {LEVEL_LABEL[profile.level]} ・ {TYPE_LABEL[profile.runnerType]}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('設定')} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={19} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ---- 推定タイム ---- */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>いまの練習内容からの推定 800m</Text>
        {pred ? (
          <>
            <Text style={styles.heroTime}>{formatTime(pred, 1)}</Text>
            <Text style={styles.heroRange}>
              予測レンジ {formatTime(prediction.rangeLow, 1)} 〜 {formatTime(prediction.rangeHigh, 1)}
            </Text>
            <View style={styles.confWrap}>
              <View style={styles.confTrack}>
                <View style={[styles.confFill, { width: `${Math.round(prediction.confidence * 100)}%` }]} />
              </View>
              <Text style={styles.confText}>精度 {Math.round(prediction.confidence * 100)}%</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.heroEmpty}>まだ推定できません</Text>
            <Text style={styles.heroRange}>自己ベストの登録か、練習を1回記録すると表示されます</Text>
            <TouchableOpacity style={styles.heroCta} onPress={() => navigation.navigate('記録')}>
              <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.heroCtaText}>練習を記録する</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ---- 根拠 ---- */}
      {prediction.sources.length > 0 && (
        <Card title="この数字の根拠" icon="analytics-outline">
          {prediction.sources.map((s) => (
            <View key={s.method} style={styles.sourceRow}>
              <View style={styles.sourceHead}>
                <Text style={styles.sourceLabel}>{s.label}</Text>
                <Text style={styles.sourceTime}>{formatTime(s.seconds, 1)}</Text>
              </View>
              <Text style={styles.sourceDetail}>{s.detail}</Text>
              <View style={styles.weightTrack}>
                <View style={[styles.weightFill, { width: `${Math.round(s.weight * 100)}%` }]} />
              </View>
              <Text style={styles.weightText}>寄与 {Math.round(s.weight * 100)}%</Text>
            </View>
          ))}
          {prediction.criticalSpeed != null && (
            <Text style={styles.csNote}>
              CS（維持できる速度）{prediction.criticalSpeed.toFixed(2)} m/s ／
              D'（そこから上乗せできる距離の貯金）{Math.round(prediction.dPrime ?? 0)} m
            </Text>
          )}
          {prediction.vdot != null && (
            <Text style={[styles.csNote, { marginTop: 6 }]}>
              持久力の指標 VDOT {prediction.vdot.toFixed(1)}
              （1500m 以上の記録から算出。800m の予測そのものには使っていません）
            </Text>
          )}
        </Card>
      )}

      {/* ---- レース展開 ---- */}
      {pred && (
        <Card title="このタイムで走るときの通過" icon="flag-outline">
          <View style={styles.splitRow}>
            {raceSplits(pred).map((s) => (
              <View key={s.point} style={styles.splitCell}>
                <Text style={styles.splitPoint}>{s.point}m</Text>
                <Text style={styles.splitCum}>{formatTime(s.cumulative, 1)}</Text>
                <Text style={styles.splitLap}>({s.lap.toFixed(1)})</Text>
              </View>
            ))}
          </View>
          <Text style={styles.hint}>
            800m は前半をわずかに速く入るのが最も速い。1周目の通過は{' '}
            <Text style={styles.hintStrong}>{formatTime(pred * 0.479, 1)}</Text> が目安です。
          </Text>
        </Card>
      )}

      {/* ---- ペースゾーン ---- */}
      {pred && (
        <Card title="練習のペース設定" icon="speedometer-outline">
          {ZONES.map((z) => {
            const r400 = zoneRange(z, pred, 400)
            const rkm = zoneRange(z, pred, 1000)
            return (
              <View key={z.key} style={styles.zoneRow}>
                <View style={styles.zoneNameRow}>
                  <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
                  <Text style={styles.zoneName}>{z.name}</Text>
                </View>
                <Text style={styles.zonePurpose}>{z.purpose}</Text>
                <View style={styles.zoneValueRow}>
                  <View style={styles.zoneValueCell}>
                    <Text style={styles.zoneValueLabel}>400m</Text>
                    <Text style={styles.zoneValue}>
                      {formatTime(r400.fast, 0)}〜{formatTime(r400.slow, 0)}
                    </Text>
                  </View>
                  <View style={styles.zoneValueCell}>
                    <Text style={styles.zoneValueLabel}>1km</Text>
                    <Text style={styles.zoneValue}>
                      {formatTime(rkm.fast, 0)}〜{formatTime(rkm.slow, 0)}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
          <Text style={styles.hint}>
            基準速度 {velocity800(pred).toFixed(2)} m/s（800mレースペース）から算出しています。
          </Text>
        </Card>
      )}

      {/* ---- 換算タイム ---- */}
      {pred && (
        <Card title="他の距離の目安" icon="swap-horizontal-outline">
          <View style={styles.equivRow}>
            {equivalentTimes(pred, profile.runnerType).map((e) => (
              <View key={e.distance} style={styles.equivCell}>
                <Text style={styles.equivDist}>{e.distance}m</Text>
                <Text style={styles.equivTime}>{formatTime(e.seconds, e.seconds < 60 ? 1 : 0)}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* ---- 精度を上げるには ---- */}
      {prediction.advice.length > 0 && (
        <Card title="推定の精度を上げるには" icon="bulb-outline">
          {prediction.advice.map((a, i) => (
            <View key={i} style={styles.adviceRow}>
              <Ionicons name="chevron-forward" size={13} color={colors.accent} />
              <Text style={styles.adviceText}>{a}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* ---- 直近の練習 ---- */}
      <Card title="直近の練習" icon="calendar-outline">
        {recent.length === 0 ? (
          <Empty text="まだ記録がありません" />
        ) : (
          recent.map((w) => (
            <TouchableOpacity key={w.id} style={styles.logRow} onPress={() => navigation.navigate('記録')}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logTitle} numberOfLines={1}>{w.title || EFFORT_LABEL[w.effort]}</Text>
                <Text style={styles.logSub}>
                  {w.date}
                  {w.reps.length > 0
                    ? ` ・ ${w.reps.length}本 ・ 最速 ${formatTime(Math.min(...w.reps.map((r) => r.seconds)), 1)}`
                    : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          ))
        )}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 12 },
  hello: { fontSize: 17, fontWeight: 'bold', color: colors.text },
  headerSub: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  iconBtn: { backgroundColor: colors.primary, borderRadius: 99, padding: 9 },

  hero: {
    backgroundColor: colors.primary, marginHorizontal: 12, borderRadius: radius.lg,
    padding: 20, marginBottom: 12, alignItems: 'center',
  },
  heroLabel: { fontSize: 12, color: '#a9bde4', fontWeight: '600' },
  heroTime: { fontSize: 52, fontWeight: '900', color: '#fff', letterSpacing: -1, marginTop: 4 },
  heroEmpty: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 8 },
  heroRange: { fontSize: 12, color: '#a9bde4', marginTop: 4, textAlign: 'center' },
  confWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, alignSelf: 'stretch' },
  confTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  confFill: { height: 5, borderRadius: 3, backgroundColor: colors.accent },
  confText: { fontSize: 11, color: '#a9bde4', fontWeight: '600' },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, marginTop: 14,
  },
  heroCtaText: { color: colors.primary, fontWeight: 'bold', fontSize: 13 },

  sourceRow: { marginBottom: 12 },
  sourceHead: { flexDirection: 'row', alignItems: 'baseline' },
  sourceLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  sourceTime: { fontSize: 14, fontWeight: '800', color: colors.primary },
  sourceDetail: { fontSize: 11, color: colors.textSub, marginTop: 2 },
  weightTrack: { height: 4, borderRadius: 2, backgroundColor: '#eef1f7', marginTop: 6 },
  weightFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  weightText: { fontSize: 10, color: colors.textFaint, marginTop: 3 },
  csNote: { fontSize: 11, color: colors.textSub, backgroundColor: '#f6f8fc', padding: 9, borderRadius: 8, lineHeight: 17 },

  splitRow: { flexDirection: 'row', gap: 6 },
  splitCell: { flex: 1, backgroundColor: '#f6f8fc', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  splitPoint: { fontSize: 10, color: colors.textFaint, fontWeight: '600' },
  splitCum: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 2 },
  splitLap: { fontSize: 10, color: colors.textSub },

  zoneRow: { paddingVertical: 9, borderTopWidth: 0.5, borderTopColor: colors.border },
  zoneNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneName: { fontSize: 13, fontWeight: '700', color: colors.text },
  zonePurpose: { fontSize: 10.5, color: colors.textFaint, marginTop: 2, marginLeft: 15 },
  zoneValueRow: { flexDirection: 'row', gap: 6, marginTop: 6, marginLeft: 15 },
  zoneValueCell: {
    flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 5,
    backgroundColor: '#f6f8fc', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5,
  },
  zoneValueLabel: { fontSize: 10, color: colors.textFaint, fontWeight: '700' },
  zoneValue: { fontSize: 12.5, color: colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] },

  equivRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  equivCell: { flexGrow: 1, minWidth: 84, backgroundColor: '#f6f8fc', borderRadius: 8, padding: 9, alignItems: 'center' },
  equivDist: { fontSize: 10, color: colors.textFaint, fontWeight: '600' },
  equivTime: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },

  adviceRow: { flexDirection: 'row', gap: 4, marginBottom: 6, alignItems: 'flex-start' },
  adviceText: { flex: 1, fontSize: 12, color: colors.textSub, lineHeight: 18 },

  logRow: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    backgroundColor: '#f6f8fc', borderRadius: 8, marginBottom: 6,
  },
  logTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  logSub: { fontSize: 11, color: colors.textSub, marginTop: 2 },

  hint: { fontSize: 11, color: colors.textFaint, marginTop: 10, lineHeight: 17 },
  hintStrong: { fontWeight: 'bold', color: colors.text },
})
