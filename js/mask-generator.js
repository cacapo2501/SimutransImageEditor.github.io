import { rgbToHex, hexToRgb, hsvToHex } from './color-utils.js';

export class MaskGenerator {
  // ベース画像のピクセル解析とマスク配列生成
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

    for (let i = 0; i < total; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
      app.baseRgb[i * 3] = r;
      app.baseRgb[i * 3 + 1] = g;
      app.baseRgb[i * 3 + 2] = b;
      app.baseAlpha[i] = a;

      if ((r === 231 && g === 255 && b === 255) || a === 0) {
        app.isBgMask[i] = 1;
      } else {
        const hex = rgbToHex(r, g, b);
        if (app.specialColors && app.specialColors.has(hex)) {
          app.isBaseSpecialColor[i] = 1;
        } else if (r === g && g === b) {
          app.editableMask[i] = 1;
        }
      }
    }

    const info = document.getElementById('lbl-base-info');
    if (info) info.textContent = `ベース: ${app.baseName} (${app.baseW}x${app.baseH})`;
  }

  // SpecialColor読み込み時のベース画像特殊色マスク再計算
  static recomputeBaseSpecialColors(app) {
    if (!app.baseRgb || !app.specialColors || app.specialColors.size === 0) return;
    const total = app.baseW * app.baseH;
    app.isBaseSpecialColor = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      if (app.isBgMask && app.isBgMask[i]) continue;
      const r = app.baseRgb[i * 3], g = app.baseRgb[i * 3 + 1], b = app.baseRgb[i * 3 + 2];
      const hex = rgbToHex(r, g, b);
      if (app.specialColors.has(hex)) {
        app.isBaseSpecialColor[i] = 1;
        app.editableMask[i] = 0;
      }
    }
  }

  // マスク画像のピクセル解析
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
    const colorCount = new Map();

    for (let i = 0; i < total; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      app.maskRgb[i * 3] = r;
      app.maskRgb[i * 3 + 1] = g;
      app.maskRgb[i * 3 + 2] = b;
      const hex = rgbToHex(r, g, b);
      colorCount.set(hex, (colorCount.get(hex) || 0) + 1);
      if (!app.maskTintColors.has(hex)) app.maskTintColors.set(hex, hex);
    }

    app.maskColors = Array.from(colorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([hex, count]) => ({ hex, count }));

    const info = document.getElementById('lbl-mask-info');
    if (info) info.textContent = `マスク: ${app.maskName}`;
  }

  // ★ ベース画像からマスク画像を自動生成 ★
  // ・背景色 (#E7FFFF / 透過): そのまま維持
  // ・SpecialColor: ベース色をそのまま引き継ぐ
  // ・グレー (R=G=B): 最も明るい色=#FFC0C0 (H=0°), 最も暗い色=#C0C0FF (H=240°) として色相をスカラー変化
  // ・SpecialColorとグレー以外の色: ベース画像の色をそのまま引き継ぐ
  static generateFromBase(app) {
    return new Promise((resolve) => {
      if (!app.baseImage || !app.baseRgb) return resolve(null);

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
          // 背景色 (#E7FFFF または透過)
          mData[idx] = 231; mData[idx + 1] = 255; mData[idx + 2] = 255; mData[idx + 3] = a;
        } else if (app.isBaseSpecialColor && app.isBaseSpecialColor[i]) {
          // SpecialColorはベース色をそのまま維持
          mData[idx] = r; mData[idx + 1] = g; mData[idx + 2] = b; mData[idx + 3] = 255;
        } else if (r === g && g === b) {
          // グレー階調は #FFC0C0 〜 #C0C0FF の色相スカラー変化
          const t = maxGray > minGray ? (r - minGray) / (maxGray - minGray) : 0.5;
          const h = Math.round(240 * (1.0 - t));
          const [mr, mg, mb] = hexToRgb(hsvToHex(h, 25, 100));
          mData[idx] = mr; mData[idx + 1] = mg; mData[idx + 2] = mb; mData[idx + 3] = 255;
        } else {
          // SpecialColorとグレー以外の色はベース画像の色をそのまま引き継ぐ
          mData[idx] = r; mData[idx + 1] = g; mData[idx + 2] = b; mData[idx + 3] = a || 255;
        }
      }

      mCtx.putImageData(mImgData, 0, 0);
      const maskImg = new Image();
      maskImg.onload = () => {
        app.applyMaskImage(maskImg, 'auto_generated_mask.png');
        app.markDirty();
        app.render();
        resolve(maskImg);
      };
      maskImg.src = mCanvas.toDataURL('image/png');
    });
  }
}
