// Simutrans ツールバー用アイコン (32x32) 自動生成＆カーソルPNG補助モジュール
import { resolveSpecialColorConflicts } from './color-utils.js';
import { buildFormattedImages } from './dat-image-formats.js';
import { guessInitialTileSize } from './dat-picker-viewport.js';

export const CURSOR_ICON_OBJ_TYPES = new Set([
  'building', 'way', 'way-object', 'bridge', 'tunnel', 'roadsign'
]);

export function supportsCursorIcon(objType) {
  return CURSOR_ICON_OBJ_TYPES.has(objType);
}

let _cachedTemplatePromise = null;

// ./icon.png ロード失敗時用のフォールバックボタン画像 (32x32 立体灰枠)
export function createFallbackButtonTemplateCanvas(createCanvasFn = null) {
  const mk = createCanvasFn || ((w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  });
  const c = mk(32, 32);
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(32, 32);
  const d = imgData.data;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      let v;
      if (x < 2 || y < 2) v = 223;
      else if (x >= 30 || y >= 30) v = (x === 31 || y === 31) ? 83 : 107;
      else v = Math.round(202 - ((x + y - 4) / 54) * 95);
      const i = (y * 32 + x) * 4;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}

// サーバーに同梱された ./icon.png の左上 32x32 ボタン画像を取得・キャッシュする
export async function loadButtonTemplateCanvas() {
  if (_cachedTemplatePromise) return _cachedTemplatePromise;
  _cachedTemplatePromise = (async () => {
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = `./icon.png?v=${Date.now()}`;
      });
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, 32, 32, 0, 0, 32, 32);
      return c;
    } catch (e) {
      return createFallbackButtonTemplateCanvas();
    }
  })();
  return _cachedTemplatePromise;
}

function isBgPixel(r, g, b, a) {
  return a <= 16 || (r === 231 && g === 255 && b === 255);
}

// 指定範囲のオブジェクトの非背景バウンディングボックスを算出する
export function findForegroundBounds(data, w, h, rx = 0, ry = 0, rw = w, rh = h) {
  const x0 = Math.max(0, rx);
  const y0 = Math.max(0, ry);
  const x1 = Math.min(w, rx + rw);
  const y1 = Math.min(h, ry + rh);
  let minX = x1, minY = y1, maxX = -1, maxY = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      if (!isBgPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// ./icon.png 左上 32x32 の内側(上下左右 2px を除く 28x28)へオブジェクトが映えるよう縮小合成する
export function composeButtonIconCanvas(templateCanvas, srcCanvas, { border = 2 } = {}, createCanvasFn = null) {
  const mk = createCanvasFn || ((w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  });
  const btnW = 32, btnH = 32;
  const innerSize = btnW - border * 2; // 28px

  const out = mk(btnW, btnH);
  const outCtx = out.getContext('2d');
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(templateCanvas, 0, 0, btnW, btnH, 0, 0, btnW, btnH);

  if (!srcCanvas || !srcCanvas.width || !srcCanvas.height) return out;

  const srcW = srcCanvas.width, srcH = srcCanvas.height;
  const srcData = srcCanvas.getContext('2d').getImageData(0, 0, srcW, srcH).data;
  const bounds = findForegroundBounds(srcData, srcW, srcH);
  if (!bounds) return out;

  const scale = Math.min(innerSize / bounds.w, innerSize / bounds.h);
  const dstW = Math.max(1, Math.min(innerSize, Math.round(bounds.w * scale)));
  const dstH = Math.max(1, Math.min(innerSize, Math.round(bounds.h * scale)));
  const dx0 = border + Math.floor((innerSize - dstW) / 2);
  const dy0 = border + Math.floor((innerSize - dstH) / 2);

  const outImg = outCtx.getImageData(0, 0, btnW, btnH);
  const od = outImg.data;

  // #E7FFFF のにじみを防ぐため、背景画素を除外したRGBA面積平均リサンプリングで鮮明に縮小合成する
  for (let oy = 0; oy < dstH; oy++) {
    const sy0 = bounds.y + (oy / dstH) * bounds.h;
    const sy1 = bounds.y + ((oy + 1) / dstH) * bounds.h;
    const iyStart = Math.max(0, Math.floor(sy0));
    const iyEnd = Math.min(srcH - 1, Math.floor(sy1 - 1e-6));

    for (let ox = 0; ox < dstW; ox++) {
      const sx0 = bounds.x + (ox / dstW) * bounds.w;
      const sx1 = bounds.x + ((ox + 1) / dstW) * bounds.w;
      const ixStart = Math.max(0, Math.floor(sx0));
      const ixEnd = Math.min(srcW - 1, Math.floor(sx1 - 1e-6));

      let sumR = 0, sumG = 0, sumB = 0, fgWeight = 0, totalArea = 0;
      for (let sy = iyStart; sy <= iyEnd; sy++) {
        const wy = Math.max(0, Math.min(sy + 1, sy1) - Math.max(sy, sy0));
        for (let sx = ixStart; sx <= ixEnd; sx++) {
          const wx = Math.max(0, Math.min(sx + 1, sx1) - Math.max(sx, sx0));
          const area = wx * wy;
          if (area <= 0) continue;
          totalArea += area;
          const si = (sy * srcW + sx) * 4;
          const r = srcData[si], g = srcData[si + 1], b = srcData[si + 2], a = srcData[si + 3];
          if (!isBgPixel(r, g, b, a)) {
            const w = area * (a / 255);
            sumR += r * w;
            sumG += g * w;
            sumB += b * w;
            fgWeight += w;
          }
        }
      }
      if (fgWeight <= 0 || totalArea <= 0) continue;

      const fr = sumR / fgWeight;
      const fg = sumG / fgWeight;
      const fb = sumB / fgWeight;
      const cov = fgWeight / totalArea;
      // 細い線(架線・軌道)も視認性を保てるよう適度にコントラストを残しつつ滑らかに合成
      const alpha = Math.min(1, cov >= 0.45 ? 1 : cov * 1.45);
      const di = ((dy0 + oy) * btnW + (dx0 + ox)) * 4;
      od[di] = Math.round(od[di] * (1 - alpha) + fr * alpha);
      od[di + 1] = Math.round(od[di + 1] * (1 - alpha) + fg * alpha);
      od[di + 2] = Math.round(od[di + 2] * (1 - alpha) + fb * alpha);
      od[di + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);
  return out;
}

const PREFERRED_ICON_KEYS = {
  way: ['Image[NS]', 'Image[EW]', 'Image[SE]'],
  'way-object': ['FrontImage[NS]', 'FrontImage[EW]'],
  bridge: ['BackRamp[S]', 'BackStart[S]', 'BackImage[NS]'],
  tunnel: ['BackImage[S]', 'FrontImage[S]', 'BackImage[Sl]'],
  roadsign: ['Image[0]', 'FrontImage[0]']
};

function cropRectCanvas(srcCanvas, sx, sy, sw, sh) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, sw);
  c.height = Math.max(1, sh);
  c.getContext('2d').drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

// 編集中画像からアイコン化に適した代表領域（1ビュー全体または代表セル）を切り出す
export function extractIconSourceCanvas(app, objType, values, common) {
  if (!app?.baseImage || !app.baseW || !app.baseH) return null;
  const pixels = app.computeFinalImage();
  if (!pixels) return null;

  const copy = new Uint8ClampedArray(pixels);
  resolveSpecialColorConflicts(copy, app.baseW, app.baseH, app.specialColors, app.isBaseSpecialColor, app.isBgMask);
  const full = document.createElement('canvas');
  full.width = app.baseW; full.height = app.baseH;
  full.getContext('2d').putImageData(new ImageData(copy, app.baseW, app.baseH), 0, 0);

  const mode = values?.iconSampleMode || 'auto';
  if (mode === 'full_image') return full;

  const isBld = objType === 'building' || objType === 'factory';
  if (mode === 'full_view' || (mode === 'auto' && isBld)) {
    const views = Math.max(1, parseInt(values?.dimsViews, 10) || 1);
    const seasons = Math.max(1, parseInt(values?.seasons, 10) || 1);
    const frames = objType === 'factory' ? 1 : Math.max(1, parseInt(values?.frames, 10) || 1);
    const tcRows = app.tileCutter?.shouldCutOnExport?.() ? Math.max(1, parseInt(app.tileCutter.sourceRows, 10) || 1) : 1;
    const vw = views > 1 ? Math.floor(app.baseW / views) : app.baseW;
    const vh = Math.floor(app.baseH / (tcRows * seasons * frames)) || app.baseH;
    const rowIdx = Math.max(0, Math.min(tcRows - 1, parseInt(common?.startRow, 10) || 0));
    const sy = Math.min(app.baseH - vh, rowIdx * vh * seasons * frames);
    const viewCrop = cropRectCanvas(full, 0, Math.max(0, sy), vw, vh);
    if (viewCrop) return viewCrop;
  }

  const useCut = isBld && app.tileCutter?.shouldCutOnExport?.();
  const sampleSrc = useCut ? app.tileCutter.cutCanvas(full) : full;
  const [tw, th] = guessInitialTileSize(sampleSrc.width, sampleSrc.height, objType, app.tileCutter);
  const rawEntries = buildFormattedImages(objType, { ...values, iconMode: 'none', cursorMode: 'none', includeCursorIcon: false }, common)
    .entries.filter(e => !e.metaLine);

  if (mode.startsWith('key:')) {
    const targetKey = mode.slice(4);
    const hit = rawEntries.find(e => e.key === targetKey);
    if (hit) return cropRectCanvas(sampleSrc, hit.col * tw, hit.row * th, tw, th);
  }

  const sData = sampleSrc.getContext('2d').getImageData(0, 0, sampleSrc.width, sampleSrc.height).data;
  const prefKeys = PREFERRED_ICON_KEYS[objType] || [];
  const ordered = [
    ...prefKeys.map(k => rawEntries.find(e => e.key === k)).filter(Boolean),
    ...rawEntries
  ];
  for (const e of ordered) {
    const sx = e.col * tw, sy = e.row * th;
    if (sx >= sampleSrc.width || sy >= sampleSrc.height) continue;
    if (findForegroundBounds(sData, sampleSrc.width, sampleSrc.height, sx, sy, tw, th)) {
      return cropRectCanvas(sampleSrc, sx, sy, Math.min(tw, sampleSrc.width - sx), Math.min(th, sampleSrc.height - sy));
    }
  }
  return full;
}

export async function generateAutoIconCanvas(app, objType, values, common) {
  const template = await loadButtonTemplateCanvas();
  const src = extractIconSourceCanvas(app, objType, values, common);
  return composeButtonIconCanvas(template, src, { border: 2 });
}

export function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('アイコンPNGの生成に失敗しました。')); return; }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

export function dataUrlToPngBytes(dataUrl) {
  const m = String(dataUrl || '').match(/^data:[^;]+;base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
