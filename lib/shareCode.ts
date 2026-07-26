import { buildSetLabel } from './menuGenerator'
import { newId } from './storage'
import type { Menu, MenuSet, SetKind, ZoneKey } from './types'

/**
 * メニュー1件を文字列に変換して、LINE などで受け渡しできるようにする。
 * サーバーを使わずに共有を成立させるための仕組み。
 *
 * 形式: "T800" + バージョン1桁 + 本体 + チェックサム2桁
 * 本体は JSON を UTF-8 → 独自の 64 進表記にしたもの。
 */

const PREFIX = 'T800'
const VERSION = '1'

// 記号を含めるとメッセージアプリで折り返しやリンク化が起きるので英数字のみにする
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const EXTRA = '._'
const CHARS = ALPHABET + EXTRA

const CHAR_INDEX: Record<string, number> = {}
for (let i = 0; i < CHARS.length; i++) CHAR_INDEX[CHARS[i]] = i

// ------------------------------------------------------------
// UTF-8 と 64 進表記
// React Native では btoa/atob が使えるとは限らないので自前で持つ
// ------------------------------------------------------------

function utf8Encode(input: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i)
    // サロゲートペアを1つのコードポイントに戻す
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000
        i++
      }
    }
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    }
  }
  return bytes
}

function utf8Decode(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i]
    let code: number
    if (b < 0x80) {
      code = b
      i += 1
    } else if ((b & 0xe0) === 0xc0) {
      code = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)
      i += 2
    } else if ((b & 0xf0) === 0xe0) {
      code = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      i += 3
    } else {
      code =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f)
      i += 4
    }
    if (code > 0xffff) {
      code -= 0x10000
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff))
    } else {
      out += String.fromCharCode(code)
    }
  }
  return out
}

/** 3バイトを4文字へ（末尾の端数はビット数から復元できるので詰め文字を使わない） */
function encode64(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    out += CHARS[b0 >> 2]
    out += CHARS[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)]
    if (b1 === undefined) break
    out += CHARS[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)]
    if (b2 === undefined) break
    out += CHARS[b2 & 0x3f]
  }
  return out
}

function decode64(text: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < text.length; i += 4) {
    const c0 = CHAR_INDEX[text[i]]
    const c1 = CHAR_INDEX[text[i + 1]]
    const c2 = CHAR_INDEX[text[i + 2]]
    const c3 = CHAR_INDEX[text[i + 3]]
    if (c0 === undefined || c1 === undefined) break
    bytes.push((c0 << 2) | (c1 >> 4))
    if (c2 === undefined) break
    bytes.push(((c1 & 0x0f) << 4) | (c2 >> 2))
    if (c3 === undefined) break
    bytes.push(((c2 & 0x03) << 6) | c3)
  }
  return bytes
}

/** 貼り付け時の欠けや混入に気づくための簡易チェックサム */
function checksum(text: string): string {
  let a = 1
  let b = 0
  for (let i = 0; i < text.length; i++) {
    a = (a + text.charCodeAt(i)) % 4093
    b = (b + a) % 4093
  }
  return CHARS[a % 64] + CHARS[b % 64]
}

// ------------------------------------------------------------
// メニューの圧縮表現
// 長い文字列は貼り付けが大変なので、キーを1文字にし、
// 距離から復元できるラベルは持たせない
// ------------------------------------------------------------

const KIND_CODES: SetKind[] = ['warmup', 'main', 'sub', 'cooldown']
const ZONE_CODES: ZoneKey[] = [
  'none', 'jog', 'threshold', 'vo2', 'pace1500', 'race', 'speed', 'sprint',
]

type PackedSet = [
  kind: number,
  distance: number,
  reps: number,
  sets: number,
  zone: number,
  targetSec: number | null,
  restSec: number | null,
  setRestSec: number | null,
  note: string,
  // 距離から自動生成できるラベルは空にして、コードを短く保つ
  label: string,
]

function packSet(s: MenuSet): PackedSet {
  const auto = s.distance > 0 ? buildSetLabel(s.distance, s.reps, s.sets) : ''
  return [
    Math.max(0, KIND_CODES.indexOf(s.kind)),
    s.distance,
    s.reps,
    s.sets,
    Math.max(0, ZONE_CODES.indexOf(s.zone)),
    s.targetSec != null ? Math.round(s.targetSec * 100) / 100 : null,
    s.restSec,
    s.setRestSec,
    s.note,
    // 「流し 80m × 3」のような独自の見出しは自動生成では戻せないので送る
    s.label === auto ? '' : s.label,
  ]
}

function unpackSet(p: any, index: number): MenuSet {
  const distance = Math.max(0, Math.round(Number(p?.[1]) || 0))
  const reps = Math.max(1, Math.round(Number(p?.[2]) || 1))
  const sets = Math.max(1, Math.round(Number(p?.[3]) || 1))
  const label = String(p?.[9] ?? '')
  return {
    key: `s${index}`,
    kind: KIND_CODES[p?.[0]] ?? 'main',
    label: label || (distance > 0 ? buildSetLabel(distance, reps, sets) : ''),
    distance,
    reps,
    sets,
    zone: ZONE_CODES[p?.[4]] ?? 'none',
    targetSec: typeof p?.[5] === 'number' ? p[5] : null,
    restSec: typeof p?.[6] === 'number' ? p[6] : null,
    setRestSec: typeof p?.[7] === 'number' ? p[7] : null,
    note: String(p?.[8] ?? ''),
  }
}

/** メニューを共有コードに変換する */
export function encodeMenu(menu: Menu): string {
  const payload = {
    t: menu.title,
    d: menu.description,
    p: menu.phase,
    l: menu.level,
    f: menu.focus,
    a: menu.authorName,
    s: menu.sets.map(packSet),
  }
  const body = encode64(utf8Encode(JSON.stringify(payload)))
  return PREFIX + VERSION + body + checksum(body)
}

/**
 * 共有コードをメニューに戻す。
 * 読み取れない場合は理由の分かるエラーを投げる。
 */
export function decodeMenu(input: string): Menu {
  // メッセージアプリを経由すると改行や空白が混ざるので落とす
  const code = input.replace(/\s+/g, '')

  if (!code) throw new Error('コードが入力されていません')
  if (!code.startsWith(PREFIX)) {
    throw new Error('Track800 の共有コードではないようです（T800 で始まります）')
  }
  if (code[PREFIX.length] !== VERSION) {
    throw new Error('このコードは別のバージョンで作られています。アプリを更新してください')
  }

  const body = code.slice(PREFIX.length + 1, -2)
  const sum = code.slice(-2)
  if (!body) throw new Error('コードが短すぎます。全部コピーできているか確認してください')
  if (checksum(body) !== sum) {
    throw new Error('コードが途中で欠けているようです。もう一度すべてコピーしてください')
  }

  let payload: any
  try {
    payload = JSON.parse(utf8Decode(decode64(body)))
  } catch {
    throw new Error('コードを読み取れませんでした')
  }
  if (!payload?.t) throw new Error('メニュー名が入っていません')

  return {
    id: newId(),
    title: String(payload.t),
    description: String(payload.d ?? ''),
    phase: ['base', 'build', 'peak', 'race'].includes(payload.p) ? payload.p : 'build',
    level: ['jhs', 'hs', 'univ', 'masters'].includes(payload.l) ? payload.l : 'hs',
    focus: String(payload.f ?? ''),
    sets: Array.isArray(payload.s) ? payload.s.map(unpackSet) : [],
    authorName: String(payload.a ?? '') || '不明',
    imported: true,
    favorite: false,
    createdAt: new Date().toISOString(),
  }
}
