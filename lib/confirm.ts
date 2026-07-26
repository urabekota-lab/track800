import { Alert, Platform } from 'react-native'

/**
 * 取り消せない操作の前に確認を取る。
 * React Native の Alert は web ではボタンが機能しないので、web だけブラウザの確認ダイアログを使う。
 */
export function confirmDestructive(title: string, message: string, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm()
    return
  }
  Alert.alert(title, message, [
    { text: 'キャンセル', style: 'cancel' },
    { text: '削除', style: 'destructive', onPress: onConfirm },
  ])
}
