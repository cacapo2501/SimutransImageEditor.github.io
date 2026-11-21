// pak64 車両アドオン用画像 圧縮配置 <-> 標準配置 変換モジュール

function bodyWidthDiagonal(len) {
  return 2 * len + 5;
}

function bodyHeightDiagonal(len) {
  return 12 + len;
}

function bodyWidthVertical() {
  return 8;
}

function bodyHeightVertical(len) {
  return 10 + Math.ceil((len * 2 * 724) / 1024);
}

function bodyWidthHorizontal(len) {
  return Math.ceil((4 * 724 / 1024) * len);
}

function bodyHeightHorizontal() {
  return 14;
}

const POS_SOUTH = [26, 50];
const POS_EAST = [102, 50];
const POS_SE = [156, 51];
const POS_SW = [212, 35];
const POS_NORTH = [303, 30];
const POS_WEST = [337, 30];
const POS_NW = [412, 29];
const POS_NE = [492, 35];

function getStandardDirectionRects(len) {
  const wd = bodyWidthDiagonal(len);
  const hd = bodyHeightDiagonal(len);
  const wv = bodyWidthVertical();
  const hv = bodyHeightVertical(len);
  const wh = bodyWidthHorizontal(len);
  const hh = bodyHeightHorizontal();

  return [
    { dir: 'S',  x: POS_SOUTH[0],      y: POS_SOUTH[1] - hd, w: wd, h: hd },
    { dir: 'E',  x: POS_EAST[0] - wd,  y: POS_EAST[1] - hd,  w: wd, h: hd },
    { dir: 'SE', x: POS_SE[0],         y: POS_SE[1] - hv,    w: wv, h: hv },
    { dir: 'SW', x: POS_SW[0],         y: POS_SW[1],         w: wh, h: hh },
    { dir: 'N',  x: POS_NORTH[0] - wd, y: POS_NORTH[1],      w: wd, h: hd },
    { dir: 'W',  x: POS_WEST[0],       y: POS_WEST[1],       w: wd, h: hd },
    { dir: 'NW', x: POS_NW[0],         y: POS_NW[1],         w: wv, h: hv },
    { dir: 'NE', x: POS_NE[0] - wh,    y: POS_NE[1],         w: wh, h: hh }
  ];
}

export function parseVehicleLength(rawVal) {
  const s = String(rawVal || '8').trim().toUpperCase();
  if (s === 'A') return 10;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(32, n) : 8;
}

export function getCompressedUnitSize(len) {
  const h = Math.max(bodyHeightDiagonal(len), bodyHeightVertical(len), bodyHeightHorizontal());
  const w = bodyWidthDiagonal(len) * 4 + bodyWidthVertical() * 2 + bodyWidthHorizontal(len) * 2 + 7;
  return { w, h };
}

export function compressVehicleCanvas(srcImg, bodyLength, fillBgHex = '#000000') {
  const len = parseVehicleLength(bodyLength);
  const srcW = srcImg.naturalWidth || srcImg.width;
  const srcH = srcImg.naturalHeight || srcImg.height;
  const rows = Math.max(1, Math.floor(srcH / 64));
  const { w: outW, h: rowH } = getCompressedUnitSize(len);
  const outH = (rowH + 1) * rows - 1;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const ctx = outCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = fillBgHex;
  ctx.fillRect(0, 0, outW, outH);

  const rects = getStandardDirectionRects(len);
  for (let row = 0; row < rows; row++) {
    let cmpX = 0;
    const cmpY = (rowH + 1) * row;
    for (const r of rects) {
      const stdY = r.y + row * 64;
      if (r.x + r.w <= srcW && stdY + r.h <= srcH) {
        ctx.drawImage(srcImg, r.x, stdY, r.w, r.h, cmpX, cmpY, r.w, r.h);
      }
      cmpX += r.w + 1;
    }
  }
  return outCanvas;
}

export function expandVehicleCanvas(srcImg, bodyLength, isBaseOrCombined = true) {
  const len = parseVehicleLength(bodyLength);
  const srcW = srcImg.naturalWidth || srcImg.width;
  const srcH = srcImg.naturalHeight || srcImg.height;
  const { h: rowH } = getCompressedUnitSize(len);
  const rows = Math.max(1, Math.floor((srcH + 1) / (rowH + 1)));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = 512;
  outCanvas.height = 64 * rows;
  const ctx = outCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = isBaseOrCombined ? '#E7FFFF' : '#FFFFFF';
  ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

  const rects = getStandardDirectionRects(len);
  for (let row = 0; row < rows; row++) {
    let cmpX = 0;
    const cmpY = (rowH + 1) * row;
    for (const r of rects) {
      const stdY = r.y + row * 64;
      if (cmpX + r.w <= srcW && cmpY + r.h <= srcH) {
        ctx.drawImage(srcImg, cmpX, cmpY, r.w, r.h, r.x, stdY, r.w, r.h);
      }
      cmpX += r.w + 1;
    }
  }
  return outCanvas;
}

function swapLayoutTagInName(filename, toChar) {
  if (!filename) return filename;
  const replaced = filename.replace(/_[sc]([0-9A])(def|paint|combined)/i, (_, lenChar, kind) => {
    return `_${toChar}${lenChar}${kind}`;
  });
  return replaced;
}

export class VehicleLayoutController {
  constructor(app) {
    this.app = app;
  }

  bindEvents() {
    const btnCompress = document.getElementById('btn-vehicle-compress');
    const btnExpand = document.getElementById('btn-vehicle-expand');
    if (btnCompress) btnCompress.onclick = () => this.convertBoth('compress');
    if (btnExpand) btnExpand.onclick = () => this.convertBoth('expand');
  }

  syncLengthFromFilename(filename) {
    if (!filename) return;
    const m = filename.match(/_[sc]([0-9A])(def|paint|combined)/i);
    if (m) {
      const rawLen = m[1].toUpperCase();
      const numVal = rawLen === 'A' ? '10' : rawLen;
      const inp = document.getElementById('inp-vehicle-length');
      if (inp) inp.value = numVal;
    }
  }

  convertBoth(mode) {
    const app = this.app;
    if (!app.baseImage && !app.maskImage) {
      alert('変換対象のベース画像またはマスク画像が読み込まれていません。');
      return;
    }

    const rawLen = document.getElementById('inp-vehicle-length')?.value || '8';
    const len = parseVehicleLength(rawLen);
    const useBgColorOnCompress = Boolean(document.getElementById('chk-vehicle-compress-bg')?.checked);

    let newBaseCanvas = null;
    let newMaskCanvas = null;

    if (mode === 'compress') {
      if (app.baseImage) {
        const bgBase = useBgColorOnCompress ? '#E7FFFF' : '#000000';
        newBaseCanvas = compressVehicleCanvas(app.baseImage, len, bgBase);
      }
      if (app.maskImage) {
        const bgMask = useBgColorOnCompress ? '#FFFFFF' : '#000000';
        newMaskCanvas = compressVehicleCanvas(app.maskImage, len, bgMask);
      }
    } else {
      if (app.baseImage) {
        newBaseCanvas = expandVehicleCanvas(app.baseImage, len, true);
      }
      if (app.maskImage) {
        newMaskCanvas = expandVehicleCanvas(app.maskImage, len, false);
      }
    }

    const tagChar = mode === 'compress' ? 'c' : 's';
    const nextBaseName = swapLayoutTagInName(app.baseName, tagChar);
    const nextMaskName = swapLayoutTagInName(app.maskName, tagChar);

    if (newBaseCanvas) {
      app.applyBaseImage(newBaseCanvas, nextBaseName, { resetMask: false, resetDat: false, isTransform: true });
    }
    if (newMaskCanvas) {
      app.applyMaskImage(newMaskCanvas, nextMaskName);
    }

    app.markDirty();
    app.zoomFit();
    app.render();

    const info = document.getElementById('lbl-vehicle-status');
    if (info && newBaseCanvas) {
      const modeName = mode === 'compress' ? '圧縮配置' : '標準配置';
      info.textContent = `変換完了 (${modeName} / 長さ=${len}): ${newBaseCanvas.width}×${newBaseCanvas.height}px`;
    }
  }
}