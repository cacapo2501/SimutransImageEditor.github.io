// CityCar 用画像 圧縮配置 <-> 標準配置(512x64) 双方向変換モジュール

const CITYCAR_ANCHORS = [
  { type: 'left_bottom',  ax: 18,  ay: 50 },
  { type: 'right_bottom', ax: 99,  ay: 55 },
  { type: 'left_bottom',  ax: 151, ay: 52 },
  { type: 'left_bottom',  ax: 214, ay: 47 },
  { type: 'right_top',    ax: 301, ay: 39 },
  { type: 'left_top',     ax: 348, ay: 34 },
  { type: 'left_top',     ax: 419, ay: 37 },
  { type: 'right_bottom', ax: 489, ay: 53 }
];

// 512x64 標準配置画像を8スロットから切り出し、RGB=(0,0,0)の1px縦区切り線で圧縮配置化
export function compressCityCarCanvas(srcImg, isBaseOrCombined = true) {
  const w = srcImg.naturalWidth || srcImg.width;
  const h = srcImg.naturalHeight || srcImg.height;
  if (w < 512 || h < 64) {
    throw new Error(`標準配置画像は 512×64px 以上である必要があります (現在: ${w}×${h}px)。`);
  }

  const sCanvas = document.createElement('canvas');
  sCanvas.width = 512;
  sCanvas.height = 64;
  const sCtx = sCanvas.getContext('2d');
  sCtx.imageSmoothingEnabled = false;
  sCtx.drawImage(srcImg, 0, 0, 512, 64, 0, 0, 512, 64);
  const d = sCtx.getImageData(0, 0, 512, 64).data;

  const bgRgb = isBaseOrCombined ? [231, 255, 255] : [255, 255, 255];
  const bgHex = isBaseOrCombined ? '#E7FFFF' : '#FFFFFF';

  const isBgPixel = (x, y) => {
    const idx = (y * 512 + x) * 4;
    if (d[idx + 3] === 0) return true;
    return d[idx] === bgRgb[0] && d[idx + 1] === bgRgb[1] && d[idx + 2] === bgRgb[2];
  };

  const segments = [];
  for (let i = 0; i < 8; i++) {
    const slotX0 = i * 64;
    const slotX1 = (i + 1) * 64 - 1;
    const anc = CITYCAR_ANCHORS[i];

    let minX = slotX1 + 1;
    let maxX = slotX0 - 1;
    let minY = 64;
    let maxY = -1;

    for (let y = 0; y < 64; y++) {
      for (let x = slotX0; x <= slotX1; x++) {
        if (!isBgPixel(x, y)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX) {
      minX = Math.max(slotX0, Math.min(slotX1, anc.ax));
      maxX = minX;
      minY = Math.max(0, Math.min(63, anc.ay));
      maxY = minY;
    } else {
      if (anc.type === 'left_bottom') {
        minX = Math.min(minX, anc.ax);
        maxY = Math.max(maxY, anc.ay - 1);
      } else if (anc.type === 'right_bottom') {
        maxX = Math.max(maxX, anc.ax - 1);
        maxY = Math.max(maxY, anc.ay - 1);
      } else if (anc.type === 'left_top') {
        minX = Math.min(minX, anc.ax);
        minY = Math.min(minY, anc.ay);
      } else if (anc.type === 'right_top') {
        maxX = Math.max(maxX, anc.ax - 1);
        minY = Math.min(minY, anc.ay);
      }
    }

    minX = Math.max(slotX0, minX);
    maxX = Math.min(slotX1, maxX);
    minY = Math.max(0, minY);
    maxY = Math.min(63, maxY);

    segments.push({
      sx: minX,
      sy: minY,
      sw: Math.max(1, maxX - minX + 1),
      sh: Math.max(1, maxY - minY + 1)
    });
  }

  const outH = Math.max(...segments.map(s => s.sh));
  const outW = segments.reduce((acc, s) => acc + s.sw, 0) + 7;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  outCtx.imageSmoothingEnabled = false;

  outCtx.fillStyle = '#000000';
  outCtx.fillRect(0, 0, outW, outH);

  let curX = 0;
  for (let i = 0; i < 8; i++) {
    const seg = segments[i];
    const anc = CITYCAR_ANCHORS[i];
    outCtx.fillStyle = bgHex;
    outCtx.fillRect(curX, 0, seg.sw, outH);

    const dyOffset = anc.type.endsWith('bottom') ? (outH - seg.sh) : 0;
    outCtx.drawImage(sCanvas, seg.sx, seg.sy, seg.sw, seg.sh, curX, dyOffset, seg.sw, seg.sh);
    curX += seg.sw + 1;
  }

  return outCanvas;
}

// 黒(0,0,0)縦区切りで8分割された圧縮画像を 512x64 標準配置へ展開
export function expandCityCarCanvas(srcImg, isBaseOrCombined = true) {
  const w = srcImg.naturalWidth || srcImg.width;
  const h = srcImg.naturalHeight || srcImg.height;

  const sCanvas = document.createElement('canvas');
  sCanvas.width = w;
  sCanvas.height = h;
  const sCtx = sCanvas.getContext('2d');
  sCtx.imageSmoothingEnabled = false;
  sCtx.drawImage(srcImg, 0, 0);
  const d = sCtx.getImageData(0, 0, w, h).data;

  const blackCols = new Uint8Array(w);
  for (let x = 0; x < w; x++) {
    let allBlack = true;
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      if (d[idx] !== 0 || d[idx + 1] !== 0 || d[idx + 2] !== 0) {
        allBlack = false;
        break;
      }
    }
    if (allBlack) blackCols[x] = 1;
  }

  const separators = [];
  let inBlack = false;
  let start = 0;
  for (let x = 0; x < w; x++) {
    if (blackCols[x] && !inBlack) {
      inBlack = true;
      start = x;
    } else if (!blackCols[x] && inBlack) {
      inBlack = false;
      separators.push([start, x - 1]);
    }
  }
  if (inBlack) {
    separators.push([start, w - 1]);
  }

  const segments = [];
  let prevEnd = -1;
  for (const [sepStart, sepEnd] of separators) {
    if (sepStart - prevEnd > 1) {
      segments.push({ x0: prevEnd + 1, w: sepStart - (prevEnd + 1), h });
    }
    prevEnd = sepEnd;
  }
  if (prevEnd < w - 1) {
    segments.push({ x0: prevEnd + 1, w: w - (prevEnd + 1), h });
  }

  if (segments.length !== 8) {
    throw new Error(`検出された領域数が8ではありません (${segments.length}領域検出)。RGB=(0,0,0)の縦区切り線を確認してください。`);
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = 512;
  outCanvas.height = 64;
  const outCtx = outCanvas.getContext('2d');
  outCtx.imageSmoothingEnabled = false;
  outCtx.fillStyle = isBaseOrCombined ? '#E7FFFF' : '#FFFFFF';
  outCtx.fillRect(0, 0, 512, 64);

  for (let i = 0; i < 8; i++) {
    const seg = segments[i];
    const anc = CITYCAR_ANCHORS[i];
    let dx = anc.ax;
    let dy = anc.ay;

    if (anc.type === 'left_bottom') {
      dx = anc.ax;
      dy = anc.ay - seg.h;
    } else if (anc.type === 'right_bottom') {
      dx = anc.ax - seg.w;
      dy = anc.ay - seg.h;
    } else if (anc.type === 'left_top') {
      dx = anc.ax;
      dy = anc.ay;
    } else if (anc.type === 'right_top') {
      dx = anc.ax - seg.w;
      dy = anc.ay;
    }

    outCtx.drawImage(sCanvas, seg.x0, 0, seg.w, seg.h, dx, dy, seg.w, seg.h);
  }

  return outCanvas;
}

export class CityCarLayoutController {
  constructor(app) {
    this.app = app;
  }

  bindEvents() {
    document.getElementById('btn-citycar-compress')?.addEventListener('click', () => this.convertLoadedImages('compress'));
    document.getElementById('btn-citycar-expand')?.addEventListener('click', () => this.convertLoadedImages('expand'));
  }

  convertLoadedImages(mode) {
    const app = this.app;
    if (!app.baseImage && !app.maskImage) {
      alert('変換対象のベース画像またはマスク画像が読み込まれていません。');
      return;
    }

    try {
      let newBase = null;
      let newMask = null;

      if (mode === 'compress') {
        if (app.baseImage) newBase = compressCityCarCanvas(app.baseImage, true);
        if (app.maskImage) newMask = compressCityCarCanvas(app.maskImage, false);
      } else {
        if (app.baseImage) newBase = expandCityCarCanvas(app.baseImage, true);
        if (app.maskImage) newMask = expandCityCarCanvas(app.maskImage, false);
      }

      const nextBaseName = mode === 'compress'
        ? app.baseName.replace(/_s(def|combined)\.png$/i, '_$1.png')
        : app.baseName.replace(/_(def|combined)\.png$/i, '_s$1.png');
      const nextMaskName = mode === 'compress'
        ? app.maskName.replace(/_spaint\.png$/i, '_paint.png')
        : app.maskName.replace(/_paint\.png$/i, '_spaint.png');

      if (newBase) {
        app.applyBaseImage(newBase, nextBaseName, { resetMask: false });
      }
      if (newMask) {
        app.applyMaskImage(newMask, nextMaskName);
      }

      app.markDirty();
      app.zoomFit();
      app.render();

      const status = document.getElementById('lbl-citycar-status');
      if (status && newBase) {
        const label = mode === 'compress' ? '圧縮完了' : '展開完了';
        status.textContent = `${label}: ${newBase.width}×${newBase.height}px`;
      }
    } catch (err) {
      alert(err.message || String(err));
    }
  }
}