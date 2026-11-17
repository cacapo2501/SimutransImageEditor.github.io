// クリップボードコピー・外部画像読込・選択マスク演算・フローティング確定用ヘルパー
import { getSelectionBounds } from './paint-flip.js';

export function loadImageFromFileReliable(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('画像データのデコードに失敗しました。'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });
}

export function combineSelectionMask(oldMask, newMask, mode, total) {
  if (mode === 'replace' || !oldMask) {
    return (mode === 'subtract' || mode === 'intersect') ? null : newMask;
  }
  const result = new Uint8Array(total);
  let hasAny = false;
  for (let i = 0; i < total; i++) {
    const oldVal = oldMask[i] === 1;
    const newVal = newMask[i] === 1;
    let keep = false;
    if (mode === 'add') keep = oldVal || newVal;
    else if (mode === 'subtract') keep = oldVal && !newVal;
    else if (mode === 'intersect') keep = oldVal && newVal;
    if (keep) {
      result[i] = 1;
      hasAny = true;
    }
  }
  return hasAny ? result : null;
}

export function extractSelectionCanvas(ed) {
  const srcData = ed.ctx.getImageData(0, 0, ed.width, ed.height);
  if (!ed.selectionMask) {
    const c = document.createElement('canvas');
    c.width = ed.width;
    c.height = ed.height;
    c.getContext('2d').putImageData(srcData, 0, 0);
    return { canvas: c, width: ed.width, height: ed.height, srcX: 0, srcY: 0, isFull: true };
  }

  const bounds = getSelectionBounds(ed.selectionMask, ed.width, ed.height);
  if (!bounds) return null;

  const { minX, minY, w, h } = bounds;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cCtx = c.getContext('2d');
  const outData = cCtx.createImageData(w, h);

  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const gIdx = (minY + sy) * ed.width + (minX + sx);
      const dIdx = (sy * w + sx) * 4;
      if (ed.selectionMask[gIdx]) {
        outData.data[dIdx] = srcData.data[gIdx * 4];
        outData.data[dIdx + 1] = srcData.data[gIdx * 4 + 1];
        outData.data[dIdx + 2] = srcData.data[gIdx * 4 + 2];
        outData.data[dIdx + 3] = srcData.data[gIdx * 4 + 3];
      } else {
        outData.data[dIdx + 3] = 0;
      }
    }
  }

  cCtx.putImageData(outData, 0, 0);
  return { canvas: c, width: w, height: h, srcX: minX, srcY: minY, isFull: false };
}

export function compositeFloatingWithSelectionMask(ed, fl) {
  const flData = fl.canvas.getContext('2d').getImageData(0, 0, fl.width, fl.height).data;
  const dstImg = ed.ctx.getImageData(0, 0, ed.width, ed.height);
  const dd = dstImg.data;
  for (let sy = 0; sy < fl.height; sy++) {
    const gy = fl.y + sy;
    if (gy < 0 || gy >= ed.height) continue;
    for (let sx = 0; sx < fl.width; sx++) {
      const gx = fl.x + sx;
      if (gx < 0 || gx >= ed.width) continue;
      const gPos = gy * ed.width + gx;
      if (!ed.selectionMask[gPos]) continue;
      const sIdx = (sy * fl.width + sx) * 4;
      if (flData[sIdx + 3] > 0) {
        const dIdx = gPos * 4;
        dd[dIdx] = flData[sIdx];
        dd[dIdx + 1] = flData[sIdx + 1];
        dd[dIdx + 2] = flData[sIdx + 2];
        dd[dIdx + 3] = 255;
      }
    }
  }
  ed.ctx.putImageData(dstImg, 0, 0);
}
