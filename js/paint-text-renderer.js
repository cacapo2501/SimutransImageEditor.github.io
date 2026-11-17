// 文字描画・実寸(px)計測・ドット絵二値化トリミングロジック
import { hexToRgb } from './color-utils.js';

export const TEXT_FONT_PRESETS = [
  { value: 'monospace', label: 'monospace (等幅標準)' },
  { value: 'sans-serif', label: 'sans-serif (ゴシック標準)' },
  { value: 'serif', label: 'serif (明朝標準)' },
  { value: '"Meiryo", "Yu Gothic", sans-serif', label: 'メイリオ / 游ゴシック' },
  { value: '"MS Gothic", monospace', label: 'ＭＳ ゴシック' },
  { value: '"MS Mincho", serif', label: 'ＭＳ 明朝' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial / Helvetica' },
  { value: '__custom__', label: 'カスタムフォント名を指定...' }
];

export function resolveFontFamily(fontFamily, customFont) {
  if (fontFamily === '__custom__') {
    const c = String(customFont || '').trim();
    return c || 'monospace';
  }
  return String(fontFamily || 'monospace').trim() || 'monospace';
}

export function buildCanvasFontString(opts = {}) {
  const size = Math.max(1, Math.min(256, parseFloat(opts.fontSize) || 10));
  const family = resolveFontFamily(opts.fontFamily, opts.customFont);
  const italic = opts.italic ? 'italic ' : '';
  const bold = opts.bold ? 'bold ' : '';
  return `${italic}${bold}${size}px ${family}`;
}

// 1文字ずつ文字間隔(px)を適用して描画し、実際の描画ピクセル外接矩形でクロップしたキャンバスを返す
export function renderTextToTrimmedCanvas(opts = {}) {
  const text = String(opts.text ?? '');
  const fontSize = Math.max(1, Math.min(256, parseFloat(opts.fontSize) || 10));
  const letterSpacing = Number.isFinite(parseFloat(opts.letterSpacing)) ? parseFloat(opts.letterSpacing) : 0;
  const lineHeightMul = Math.max(0.5, Math.min(4.0, parseFloat(opts.lineHeight) || 1.2));
  const sharp = opts.sharp !== false;
  const threshold = Math.max(1, Math.min(254, parseInt(opts.threshold, 10) || 64));
  const colorHex = /^#[0-9A-Fa-f]{6}$/.test(String(opts.colorHex || '')) ? String(opts.colorHex).toUpperCase() : '#FFFFFF';
  const [tr, tg, tb] = hexToRgb(colorHex);
  const fontStr = buildCanvasFontString(opts);

  const lines = text.split(/\r?\n/);
  const measCanvas = document.createElement('canvas');
  measCanvas.width = 16;
  measCanvas.height = 16;
  const measCtx = measCanvas.getContext('2d');
  measCtx.font = fontStr;

  let maxLineW = 1;
  lines.forEach((line) => {
    const chars = Array.from(line);
    let lw = 0;
    chars.forEach((ch, idx) => {
      lw += measCtx.measureText(ch).width;
      if (idx < chars.length - 1) lw += letterSpacing;
    });
    if (lw > maxLineW) maxLineW = lw;
  });

  const pad = Math.ceil(fontSize * 1.5) + 16;
  const lineStepY = fontSize * lineHeightMul;
  const workW = Math.max(16, Math.min(2048, Math.ceil(maxLineW) + pad * 2));
  const workH = Math.max(16, Math.min(2048, Math.ceil(lines.length * lineStepY + fontSize) + pad * 2));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = workW;
  workCanvas.height = workH;
  const wCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  wCtx.font = fontStr;
  wCtx.fillStyle = colorHex;
  wCtx.textBaseline = 'top';

  lines.forEach((line, lineIdx) => {
    const chars = Array.from(line);
    let curX = pad;
    const curY = pad + lineIdx * lineStepY;
    chars.forEach((ch) => {
      wCtx.fillText(ch, curX, curY);
      curX += measCtx.measureText(ch).width + letterSpacing;
    });
  });

  const img = wCtx.getImageData(0, 0, workW, workH);
  const d = img.data;
  let minX = workW, minY = workH, maxX = -1, maxY = -1;

  for (let y = 0; y < workH; y++) {
    for (let x = 0; x < workW; x++) {
      const idx = (y * workW + x) * 4;
      const a = d[idx + 3];
      if (sharp) {
        if (a >= threshold) {
          d[idx] = tr;
          d[idx + 1] = tg;
          d[idx + 2] = tb;
          d[idx + 3] = 255;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        } else {
          d[idx + 3] = 0;
        }
      } else if (a > 0) {
        d[idx] = tr;
        d[idx + 1] = tg;
        d[idx + 2] = tb;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = 1;
    emptyCanvas.height = 1;
    return { canvas: emptyCanvas, width: 0, height: 0, isEmpty: true };
  }

  wCtx.putImageData(img, 0, 0);
  const outW = maxX - minX + 1;
  const outH = maxY - minY + 1;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const oCtx = outCanvas.getContext('2d');
  oCtx.imageSmoothingEnabled = false;
  oCtx.drawImage(workCanvas, minX, minY, outW, outH, 0, 0, outW, outH);

  return { canvas: outCanvas, width: outW, height: outH, isEmpty: false };
}
