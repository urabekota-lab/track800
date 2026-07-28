// Track800 のアイコンを生成する。
// 依存を増やしたくないので、図形は符号付き距離関数(SDF)で描き、PNG は zlib だけで書き出す。
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

// ---------------- PNG エンコーダ ----------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type: RGBA
  ihdr[10] = 0  // deflate
  ihdr[11] = 0  // filter method
  ihdr[12] = 0  // no interlace

  // 各走査線の先頭にフィルタ種別(0=None)を付ける
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    const src = y * width * 4
    const dst = y * (width * 4 + 1)
    raw[dst] = 0
    rgba.copy(raw, dst + 1, src, src + width * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------- SDF プリミティブ ----------------

/** 線分 (x0,y0)-(x1,y1) からの距離 - r（カプセル） */
function sdCapsule(px, py, x0, y0, x1, y1, r) {
  const bax = x1 - x0, bay = y1 - y0
  const pax = px - x0, pay = py - y0
  const denom = bax * bax + bay * bay
  let h = denom === 0 ? 0 : (pax * bax + pay * bay) / denom
  h = Math.max(0, Math.min(1, h))
  const dx = pax - bax * h, dy = pay - bay * h
  return Math.hypot(dx, dy) - r
}

/** 中心 (cx,cy)、半サイズ (hw,hh)、角丸 r の丸長方形 */
function sdRoundBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r
  const qy = Math.abs(py - cy) - hh + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/** 実体の SDF を太さ w の輪郭に変える */
const outline = (d, w) => Math.abs(d) - w / 2

const sdMin = (a, b) => Math.min(a, b)

// ---------------- デザイン（1024 四方の設計座標系） ----------------

const D = 1024
const CX = 512, CY = 512

// トラック（楕円形の走路）
const TRACK_A = 110   // 直線部の半分の長さ
const TRACK_R = 330   // カーブ半径
const TRACK_W = 48    // 走路の太さ

// 「800」の字形
const GLYPH_H = 250
const GLYPH_W = 150
const GLYPH_GAP = 26
const GLYPH_STROKE = 38

// アプリ本体の配色（チャコール＋青）に合わせる
const COLOR_BG_TOP = [0x2b, 0x36, 0x44]    // チャコール（明）
const COLOR_BG_BOTTOM = [0x15, 0x1b, 0x24] // チャコール（暗）
const COLOR_TRACK = [0x3b, 0x82, 0xf6]     // 青。暗い地の上で沈まない明るさにする
const COLOR_TEXT = [0xff, 0xff, 0xff]

/** 数字 0：丸長方形の輪郭 */
function sdZero(px, py, cx, cy) {
  const hw = GLYPH_W / 2, hh = GLYPH_H / 2
  return outline(sdRoundBox(px, py, cx, cy, hw, hh, Math.min(hw, hh) * 0.92), GLYPH_STROKE)
}

/**
 * 数字 8：上下2つの輪郭を重ねる。
 * 上下で幅を変えると2つの丸長方形の継ぎ目が段差として見えるので、幅は揃える。
 */
function sdEight(px, py, cx, cy) {
  const hh = GLYPH_H / 4
  const hw = GLYPH_W / 2
  const top = outline(sdRoundBox(px, py, cx, cy - hh, hw, hh, hh * 0.92), GLYPH_STROKE)
  const bottom = outline(sdRoundBox(px, py, cx, cy + hh, hw, hh, hh * 0.92), GLYPH_STROKE)
  return sdMin(top, bottom)
}

/** 走路の SDF */
function sdTrack(px, py) {
  return outline(
    sdCapsule(px, py, CX - TRACK_A, CY, CX + TRACK_A, CY, TRACK_R),
    TRACK_W,
  )
}

/** 「800」の SDF */
function sdText(px, py) {
  const step = GLYPH_W + GLYPH_GAP
  const left = CX - step
  return sdMin(
    sdEight(px, py, left, CY),
    sdMin(sdZero(px, py, left + step, CY), sdZero(px, py, left + 2 * step, CY)),
  )
}

// ---------------- レンダリング ----------------

/**
 * @param size    出力ピクセル数（正方形）
 * @param opts.markScale  図柄の拡大率（安全領域に収めるために縮める）
 * @param opts.noText     「800」を描かない。小さく表示される favicon 用
 */
function render(size, opts = {}) {
  const { markScale = 1, noText = false } = opts
  const buf = Buffer.alloc(size * size * 4)
  const toPixels = size / D // 設計座標の距離をピクセル距離に直す係数

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // ピクセル中心を設計座標へ
      const dx = (x + 0.5) / toPixels
      const dy = (y + 0.5) / toPixels
      // 図柄を中心まわりに markScale 倍する
      const px = CX + (dx - CX) / markScale
      const py = CY + (dy - CY) / markScale

      const t = y / (size - 1)
      let r = COLOR_BG_TOP[0] + (COLOR_BG_BOTTOM[0] - COLOR_BG_TOP[0]) * t
      let g = COLOR_BG_TOP[1] + (COLOR_BG_BOTTOM[1] - COLOR_BG_TOP[1]) * t
      let b = COLOR_BG_TOP[2] + (COLOR_BG_BOTTOM[2] - COLOR_BG_TOP[2]) * t
      let a = 255

      const layers = [[sdTrack(px, py), COLOR_TRACK]]
      if (!noText) layers.push([sdText(px, py), COLOR_TEXT])

      // SDF からピクセル単位の距離を出し、境界 1px でアンチエイリアスする
      for (const [sd, color] of layers) {
        const dPix = sd * markScale * toPixels
        const cov = Math.max(0, Math.min(1, 0.5 - dPix))
        if (cov <= 0) continue
        r = color[0] * cov + r * (1 - cov)
        g = color[1] * cov + g * (1 - cov)
        b = color[2] * cov + b * (1 - cov)
        a = 255 * cov + a * (1 - cov)
      }

      const i = (y * size + x) * 4
      buf[i] = Math.round(r)
      buf[i + 1] = Math.round(g)
      buf[i + 2] = Math.round(b)
      buf[i + 3] = Math.round(a)
    }
  }
  return encodePng(size, size, buf)
}

const root = process.argv[2]
if (!root) throw new Error('プロジェクトのルートディレクトリを指定してください')

const files = [
  // --- ネイティブ / Expo 設定用 ---
  ['assets/icon.png', render(1024)],
  // Android のアダプティブアイコンは外周が切り取られるので図柄を中央 62% に収める。
  // 背景は塗りつぶす（透明にすると白文字がランチャー背景に溶ける）
  ['assets/adaptive-icon.png', render(1024, { markScale: 0.62 })],
  // favicon は 16px 前後まで縮むので「800」は潰れる。マークだけにする
  ['assets/favicon.png', render(196, { noText: true, markScale: 0.92 })],

  // --- PWA 用（public/ の中身は書き出し先のルートへそのままコピーされる） ---
  // iOS がホーム画面に追加するときに使う。角丸は iOS 側が付けるので四角のまま出す
  ['public/apple-touch-icon.png', render(180)],
  ['public/icon-192.png', render(192)],
  ['public/icon-512.png', render(512)],
]

for (const [name, data] of files) {
  const p = path.join(root, name)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, data)
  console.log(name, data.length, 'bytes')
}
