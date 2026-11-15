// CityCar 用圧縮画像を黒(0,0,0)縦区切りで8分割し、512x64標準配置へ展開するモジュール

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
    const btnExpand = document.getElementById('btn-citycar-expand');
    if (btnExpand) btnExpand.onclick = () => this.expandLoadedImages();
  }

  expandLoadedImages() {
    const app = this.app;
    if (!app.baseImage && !app.maskImage) {
      alert('展開対象のベース画像またはマスク画像が読み込まれていません。');
      return;
    }

    try {
      let newBase = null;
      let newMask = null;

      if (app.baseImage) {
        newBase = expandCityCarCanvas(app.baseImage, true);
      }
      if (app.maskImage) {
        newMask = expandCityCarCanvas(app.maskImage, false);
      }

      const nextBaseName = app.baseName.replace(/_(def|combined)\.png$/i, '_s$1.png');
      const nextMaskName = app.maskName.replace(/_paint\.png$/i, '_spaint.png');

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
      if (status) {
        status.textContent = '展開完了: 512×64px (8方向アンカー配置)';
      }
    } catch (err) {
      alert(err.message || String(err));
    }
  }
}