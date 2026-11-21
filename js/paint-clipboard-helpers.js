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
    return { canvas: c, width: ed.width, height: ed.height, srcX: 0, srcY: 0, isFull: true, mask: null };
  }

  const bounds = getSelectionBounds(ed.selectionMask, ed.width, ed.height);
  if (!bounds) return null;

  const { minX, minY, w, h } = bounds;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cCtx = c.getContext('2d');
  const outData = cCtx.createImageData(w, h);
  const localMask = new Uint8Array(w * h);

  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const gIdx = (minY + sy) * ed.width + (minX + sx);
      const lIdx = sy * w + sx;
      const dIdx = lIdx * 4;
      if (ed.selectionMask[gIdx]) {
        localMask[lIdx] = 1;
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
  return { canvas: c, width: w, height: h, srcX: minX, srcY: minY, isFull: false, mask: localMask };
}

// フローティングレイヤーをキャンバスへ焼き込む（32bit画像のアルファ値も消さずにそのまま保持）
export function compositeFloatingWithSelectionMask(ed, fl, { ignoreSelectionMask = false } = {}) {
  const flData = fl.canvas.getContext('2d').getImageData(0, 0, fl.width, fl.height).data;
  const dstImg = ed.ctx.getImageData(0, 0, ed.width, ed.height);
  const dd = dstImg.data;
  const hasSelMask = !ignoreSelectionMask && Boolean(ed.selectionMask);

  for (let sy = 0; sy < fl.height; sy++) {
    const gy = fl.y + sy;
    if (gy < 0 || gy >= ed.height) continue;
    for (let sx = 0; sx < fl.width; sx++) {
      const gx = fl.x + sx;
      if (gx < 0 || gx >= ed.width) continue;
      const gPos = gy * ed.width + gx;
      if (hasSelMask && !ed.selectionMask[gPos]) continue;

      const lPos = sy * fl.width + sx;
      const sIdx = lPos * 4;
      const sa = flData[sIdx + 3];
      const dIdx = gPos * 4;

      if (fl.isText) {
        // 文字配置時は文字ピクセル(sa > 0)のみを背景の上に重ねる
        if (sa > 0) {
          dd[dIdx] = flData[sIdx];
          dd[dIdx + 1] = flData[sIdx + 1];
          dd[dIdx + 2] = flData[sIdx + 2];
          dd[dIdx + 3] = sa;
        }
      } else if (fl.isImported) {
        if (fl.hasNativeAlpha) {
          // 32bit RGBA外部画像: 元画像のR,G,B,Aをそのまま貼り付ける（半透明・透明アルファを消さない）
          dd[dIdx] = flData[sIdx];
          dd[dIdx + 1] = flData[sIdx + 1];
          dd[dIdx + 2] = flData[sIdx + 2];
          dd[dIdx + 3] = sa;
        } else if (sa > 0) {
          // 24bit外部画像: 透過色(#E7FFFF)以外のピクセルを alpha=255 で貼り付ける
          dd[dIdx] = flData[sIdx];
          dd[dIdx + 1] = flData[sIdx + 1];
          dd[dIdx + 2] = flData[sIdx + 2];
          dd[dIdx + 3] = 255;
        }
      } else {
        // コピー＆ペースト時: 選択範囲内のピクセルは元の32bitアルファ(0〜255)ごとそのまま転写
        const inCopyMask = !fl.copyMask || fl.copyMask[lPos] === 1;
        if (inCopyMask) {
          dd[dIdx] = flData[sIdx];
          dd[dIdx + 1] = flData[sIdx + 1];
          dd[dIdx + 2] = flData[sIdx + 2];
          dd[dIdx + 3] = sa;
        }
      }
    }
  }
  ed.ctx.putImageData(dstImg, 0, 0);
}
