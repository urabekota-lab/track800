import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import type { RefreshControlProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../lib/theme'

interface ScreenProps {
  children: ReactNode
  /** 引き下げ更新。ホームなど取得系の画面でだけ渡す */
  refreshControl?: React.ReactElement<RefreshControlProps>
  /**
   * タブの上に乗る画面は false（タブバーが下の安全領域を持つ）。
   * スタックで開く画面は true にして自前で下余白を確保する。
   */
  insetBottom?: boolean
  /** 入力欄のある画面でキーボードよけを有効にする */
  avoidKeyboard?: boolean
}

/**
 * 全画面共通のスクロール土台。
 * ノッチ・ダイナミックアイランド・ホームインジケータを避けるため、
 * 上下の余白は固定値ではなく端末の安全領域から取る。
 */
export function Screen({ children, refreshControl, insetBottom, avoidKeyboard }: ScreenProps) {
  const insets = useSafeAreaInsets()

  const scroll = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{
        // ノッチのない端末や web では insets.top が 0 になるので、最低限の余白は確保する
        paddingTop: Math.max(insets.top, 12) + 12,
        paddingBottom: (insetBottom ? insets.bottom : 0) + 28,
      }}
      // 入力中でもボタンやチップを1タップで押せるようにする
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  )

  if (!avoidKeyboard) return <View style={styles.root}>{scroll}</View>

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {scroll}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
})
