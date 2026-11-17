export function getSelectionBounds(mask, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function flipEditorTransform(editor, clipMgr, flipH, flipV) {
  // 1. フローティング貼り付け中の反転
  if (clipMgr.floatingLayer) {
    const fl = clipMgr.floatingLayer;
    const c = document.createElement('canvas');
    c.width = fl.width;
    c.height = fl.height;
    const cCtx = c.getContext('2d');
    cCtx.imageSmoothingEnabled = false;
    cCtx.translate(flipH ? fl.width : 0, flipV ? fl.height : 0);
    cCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    cCtx.drawImage(fl.canvas, 0, 0);
    fl.canvas = c;
    editor._drawOverlay();
    return;
  }

  // 2. 選択範囲なしの全体反転
  if (!editor.selectionMask) {
    editor._pushHistory();
    const c = document.createElement('canvas');
    c.width = editor.width;
    c.height = editor.height;
    const cCtx = c.getContext('2d');
    cCtx.imageSmoothingEnabled = false;
    cCtx.translate(flipH ? editor.width : 0, flipV ? editor.height : 0);
    cCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    cCtx.drawImage(editor.canvas, 0, 0);

    editor.ctx.clearRect(0, 0, editor.width, editor.height);
    editor.ctx.drawImage(c, 0, 0);
    editor._drawOverlay();
    return;
  }

  // 3. 選択範囲内のピクセルとマスクの反転
  const bounds = getSelectionBounds(editor.selectionMask, editor.width, editor.height);
  if (!bounds) return;
  editor._pushHistory();
  const { minX, minY, maxX, maxY } = bounds;

  const imgData = editor.ctx.getImageData(0, 0, editor.width, editor.height);
  const origData = new Uint8ClampedArray(imgData.data);
  const origMask = new Uint8Array(editor.selectionMask);
  const newMask = new Uint8Array(editor.selectionMask);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * editor.width + x;
      if (origMask[idx]) {
        newMask[idx] = 0;
        imgData.data[idx * 4] = 231;
        imgData.data[idx * 4 + 1] = 255;
        imgData.data[idx * 4 + 2] = 255;
        imgData.data[idx * 4 + 3] = 255;
      }
    }
  }

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const srcIdx = y * editor.width + x;
      if (origMask[srcIdx]) {
        const dstX = flipH ? (minX + maxX - x) : x;
        const dstY = flipV ? (minY + maxY - y) : y;
        const dstIdx = dstY * editor.width + dstX;

        newMask[dstIdx] = 1;
        imgData.data[dstIdx * 4] = origData[srcIdx * 4];
        imgData.data[dstIdx * 4 + 1] = origData[srcIdx * 4 + 1];
        imgData.data[dstIdx * 4 + 2] = origData[srcIdx * 4 + 2];
        imgData.data[dstIdx * 4 + 3] = origData[srcIdx * 4 + 3];
      }
    }
  }

  editor.selectionMask = newMask;

  // 上方リピート有効時は反転後の選択範囲内ピクセルを上層へも転写
  if (editor.repeatMgr && editor.repeatMgr.isActive()) {
    const d = imgData.data;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const pIdx = y * editor.width + x;
        if (!newMask[pIdx]) continue;
        const idx = pIdx * 4;
        for (let k = 1; k <= editor.repeatMgr.count; k++) {
          const ty = y - k * editor.repeatMgr.stepY;
          if (ty < 0 || ty >= editor.height) break;
          const tPos = ty * editor.width + x;
          if (!newMask[tPos]) {
            const tIdx = tPos * 4;
            d[tIdx] = d[idx];
            d[tIdx + 1] = d[idx + 1];
            d[tIdx + 2] = d[idx + 2];
            d[tIdx + 3] = d[idx + 3];
          }
        }
      }
    }
  }

  editor.ctx.putImageData(imgData, 0, 0);
  editor._drawOverlay();
}