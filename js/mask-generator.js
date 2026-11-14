import { hexToInt, intToHex, hexToRgb, hsvToHex } from './color-utils.js';

export class MaskGenerator {
  // ベース画像のピクセル解析（整数キーによる高速スキャン）
  static analyzeBaseImage(app, img, name) {
    app.baseImage = img;
    app.baseName = name || 'base.png';
    app.baseW = img.naturalWidth || img.width;
    app.baseH = img.naturalHeight || img.height;

    const off = document.createElement('canvas');
    off.width = app.baseW;
    off.height = app.baseH;
    const ctx = off.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const d = ctx.getImageData(0, 0, app.baseW, app.baseH).data;
    const total = app.baseW * app.baseH;
    app.baseRgb = new Uint8Array(total * 3);
    app.baseAlpha = new Uint8Array(total);
    app.isBgMask = new Uint8Array(total);
    app.editableMask = new Uint8Array(total);
    app.isBaseSpecialColor = new Uint8Array(total);

    const specialInts = new Set();
    if (app.specialColors) {
      app.specialColors.forEach(hex => specialInts.add(hexToInt(hex)));
    }

    for (let i = 0; i < total; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
      app.baseRgb[i * 3] = r;
      app.baseRgb[i * 3 + 1] = g;
      app.baseRgb[i * 3 + 2] = b;
      app.baseAlpha[i] = a;

      if ((r === 231 && g === 255 && b === 255) || a === 0) {
        app.isBgMask[i] = 1;
      } else {
        const rgbInt = (r << 16) | (g << 8) | b;
        if (specialInts.has(rgbInt)) {
          app.isBaseSpecialColor[i] = 1;
        } else if (r === g && g === b) {
          app.editableMask[i] = 1;
        }
      }
    }

    const info = document.getElementById('lbl-base-info');
    if (info) info.textContent = `ベース: ${app.baseName} (${app.baseW}x${app.baseH})`;
  }

  // SpecialColor読み込み時の再計算（整数キーによる高速スキャン）
  static recomputeBaseSpecialColors(app) {
    if (!app.baseRgb || !app.specialColors || app.specialColors.size === 0) return;
    const total = app.baseW * app.baseH;
    app.isBaseSpecialColor = new Uint8Array(total);

    const specialInts = new Set();
    app.specialColors.forEach(hex => specialInts.add(hexToInt(hex)));

    for (let i = 0; i < total; i++) {
      if (app.isBgMask && app.isBgMask[i]) continue;
      const r = app.baseRgb[i * 3], g = app.baseRgb[i * 3 + 1], b = app.baseRgb[i * 3 + 2];
      const rgbInt = (r << 16) | (g << 8) | b;
      if (specialInts.has(rgbInt)) {
        app.isBaseSpecialColor[i] = 1;
        app.editableMask[i] = 0;
      }
    }
  }

  // マスク画像のピクセル解析（整数キー集計により数万色でも一瞬で完了）
  static analyzeMaskImage(app, img, name) {
    app.maskImage = img;
    app.maskName = name || 'mask.png';

    const off = document.createElement('canvas');
    off.width = app.baseW;
    off.height = app.baseH;
    const ctx = off.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, app.baseW, app.baseH);

    const d = ctx.getImageData(0, 0, app.baseW, app.baseH).data;
    const total = app.baseW * app.baseH;
    app.maskRgb = new Uint8Array(total * 3);
    const colorCountInt = new Map();

    for (let i = 0; i < total; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      app.maskRgb[i * 3] = r;
      app.maskRgb[i * 3 + 1] = g;
      app.maskRgb[i * 3 + 2] = b;
      const rgbInt = (r << 16) | (g << 8) | b;
      colorCountInt.set(rgbInt, (colorCountInt.get(rgbInt) || 0) + 1);
    }

    const sorted = Array.from(colorCountInt.entries()).sort((a, b) => b[1] - a[1]);
    app.maskColors = sorted.map(([rgbInt, count]) => {
      const hex = intToHex(rgbInt);
      if (!app.maskTintColors.has(hex)) app.maskTintColors.set(hex, hex);
      return { hex, count };
    });

    const info = document.getElementById('lbl-mask-info');
    if (info) info.textContent = `マスク: ${app.maskName} (${app.maskColors.length}色)`;
  }

  // ベース画像からマスク画像を自動生成（キャンバス直接適用で高速化）
  static generateFromBase(app) {
    if (!app.baseImage || !app.baseRgb) return null;

    let minGray = 255, maxGray = 0, grayFound = false;
    for (let i = 0; i < app.baseW * app.baseH; i++) {
      if (app.isBgMask[i] || (app.isBaseSpecialColor && app.isBaseSpecialColor[i])) continue;
      const r = app.baseRgb[i * 3], g = app.baseRgb[i * 3 + 1], b = app.baseRgb[i * 3 + 2];
      if (r === g && g === b) {
        grayFound = true;
        if (r < minGray) minGray = r;
        if (r > maxGray) maxGray = r;
      }
    }
    if (!grayFound) { minGray = 0; maxGray = 255; }

    // 256階調分のグレー -> RGB変換テーブルを事前計算
    const grayLutR = new Uint8Array(256);
    const grayLutG = new Uint8Array(256);
    const grayLutB = new Uint8Array(256);
    for (let v = 0; v < 256; v++) {
      const t = maxGray > minGray ? Math.max(0, Math.min(1, (v - minGray) / (maxGray - minGray))) : 0.5;
      const h = Math.round(240 * (1.0 - t));
      const [mr, mg, mb] = hexToRgb(hsvToHex(h, 25, 100));
      grayLutR[v] = mr;
      grayLutG[v] = mg;
      grayLutB[v] = mb;
    }

    const mCanvas = document.createElement('canvas');
    mCanvas.width = app.baseW;
    mCanvas.height = app.baseH;
    const mCtx = mCanvas.getContext('2d');
    const mImgData = mCtx.createImageData(app.baseW, app.baseH);
    const mData = mImgData.data;

    for (let i = 0; i < app.baseW * app.baseH; i++) {
      const idx = i * 4;
      const r = app.baseRgb[i * 3], g = app.baseRgb[i * 3 + 1], b = app.baseRgb[i * 3 + 2];
      const a = app.baseAlpha[i];

      if (app.isBgMask[i] || a === 0) {
        mData[idx] = 231; mData[idx + 1] = 255; mData[idx + 2] = 255; mData[idx + 3] = a;
      } else if (app.isBaseSpecialColor && app.isBaseSpecialColor[i]) {
        mData[idx] = r; mData[idx + 1] = g; mData[idx + 2] = b; mData[idx + 3] = 255;
      } else if (r === g && g === b) {
        mData[idx] = grayLutR[r]; mData[idx + 1] = grayLutG[r]; mData[idx + 2] = grayLutB[r]; mData[idx + 3] = 255;
      } else {
        // SpecialColorとグレー以外の色はベース画像の色をそのまま引き継ぐ
        mData[idx] = r; mData[idx + 1] = g; mData[idx + 2] = b; mData[idx + 3] = a || 255;
      }
    }

    mCtx.putImageData(mImgData, 0, 0);
    app.applyMaskImage(mCanvas, 'auto_generated_mask.png');
    app.markDirty();
    app.render();
    return mCanvas;
  }
}
