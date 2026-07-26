import { View, Text, StyleSheet } from 'react-native'
import { colors, radius } from '../lib/theme'
import { formatTime } from '../lib/pace'
import type { TrendPoint } from '../lib/history'

const CHART_HEIGHT = 130

/** 一番低い棒でも見えるように、下限の高さを残す */
const MIN_BAR_RATIO = 0.18

/**
 * 推定タイムの推移を棒で表す。
 * タイムは小さいほど速いので、**速いほど棒が高くなる**ように反転している。
 * グラフ用のパッケージを増やしたくないので View だけで組んでいる。
 */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return null

  const times = points.map((p) => p.seconds)
  const fastest = Math.min(...times)
  const slowest = Math.max(...times)
  const span = slowest - fastest

  /** 速いほど 1 に近づく */
  const ratio = (seconds: number) => {
    if (span <= 0) return 1
    const r = (slowest - seconds) / span
    return MIN_BAR_RATIO + r * (1 - MIN_BAR_RATIO)
  }

  const last = points[points.length - 1]

  return (
    <View>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>速い {formatTime(fastest, 1)}</Text>
        <Text style={styles.axisLabel}>遅い {formatTime(slowest, 1)}</Text>
      </View>

      <View style={styles.chart}>
        {points.map((p, i) => {
          const isBest = p.seconds === fastest
          const isLast = i === points.length - 1
          return (
            <View key={`${p.date}-${i}`} style={styles.column}>
              <View
                style={[
                  styles.bar,
                  { height: `${ratio(p.seconds) * 100}%` },
                  isBest && styles.barBest,
                  isLast && !isBest && styles.barLast,
                ]}
              />
            </View>
          )
        })}
      </View>

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>{formatShortDate(points[0].date)}</Text>
        <Text style={styles.axisLabel}>{formatShortDate(last.date)}</Text>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.barBest]} />
          <Text style={styles.legendText}>いちばん速かった日</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.barLast]} />
          <Text style={styles.legendText}>最新</Text>
        </View>
      </View>
    </View>
  )
}

/** "2026-07-25" → "7/25" */
function formatShortDate(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}

const styles = StyleSheet.create({
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  axisLabel: { fontSize: 10.5, color: colors.textFaint, fontVariant: ['tabular-nums'] },

  chart: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    backgroundColor: '#f6f8fc',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  column: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: '#a8bbdb', borderRadius: 2, minHeight: 3 },
  barBest: { backgroundColor: colors.good },
  barLast: { backgroundColor: colors.primary },

  legend: { flexDirection: 'row', gap: 14, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 11, color: colors.textFaint },
})
