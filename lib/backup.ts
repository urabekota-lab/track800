import { Platform } from 'react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import { backupFileName, parseBackup, serializeBackup } from './storage'
import type { AppData } from './storage'

/**
 * 全データを1つの JSON ファイルに書き出す。
 * 端末を変えるときや、誤ってアプリを消したときの保険。
 */
export async function exportBackup(data: AppData): Promise<string> {
  const text = serializeBackup(data)
  const name = backupFileName()

  if (Platform.OS === 'web') {
    // web の共有 API はローカルファイルを扱えないので、ダウンロードさせる
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return `${name} をダウンロードしました`
  }

  const file = new File(Paths.cache, name)
  // 前回の書き出しが残っていることがあるので作り直す
  if (file.exists) file.delete()
  file.create()
  file.write(text)

  if (!(await Sharing.isAvailableAsync())) {
    return `${file.uri} に書き出しました`
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Track800 のデータを保存',
    UTI: 'public.json',
  })
  return '書き出しました。「ファイルに保存」を選ぶと端末に残せます'
}

/**
 * バックアップファイルを選んで読み込む。
 * 選択がキャンセルされた場合は null を返す。
 */
export async function importBackup(): Promise<AppData | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // 一部の端末やクラウド保存先では JSON に MIME が付かないので絞り込みすぎない
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  })
  if (result.canceled || !result.assets?.length) return null

  const asset = result.assets[0]

  if (Platform.OS === 'web') {
    const webFile = (asset as any).file as globalThis.File | undefined
    if (webFile) return parseBackup(await webFile.text())
    const res = await fetch(asset.uri)
    return parseBackup(await res.text())
  }

  return parseBackup(await new File(asset.uri).text())
}
