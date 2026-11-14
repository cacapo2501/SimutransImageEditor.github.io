export class PaintClipboardManager {
  constructor(editor) {
    this.editor = editor;
    this.clipboard = null;      // { canvas, width, height, srcX, srcY }
    this.floatingLayer = null;  // { canvas, width, height, x, y }
    this.isDraggingFloating = false;
    this.floatingDragOffset = [0, 0];
  }

  reset() {
    this.floatingLayer = null;
    this.isDraggingFloating = false;
    this._updateFloatingBarUI();
  }

  _updateFloatingBarUI() {
    const bar = document.getElementById('floating-action-bar');
    if (bar) {
      bar.style.display = this.floatingLayer ? 'flex' : 'none';
    }
  }

  // 選択範囲の演算統合（新規・追加・一部削除・乗算）
  applySelectionMask(newMask) {
    const ed = this.editor;
    const total = ed.width * ed.height;

    if (ed.selectionMode === 'replace' || !ed.selectionMask) {
      if (ed.selectionMode === 'subtract' || ed.selectionMode === 'intersect') {
        ed.selectionMask = null;
      } else {
        ed.selectionMask = newMask;
      }
    } else {
      const result = new Uint8Array(total);
      let hasAny = false;
      for (let i = 0; i < total; i++) {
        const oldVal = ed.selectionMask[i] === 1;
        const newVal = newMask[i] === 1;
        let keep = false;

        if (ed.selectionMode === 'add') keep = oldVal || newVal;
        else if (ed.selectionMode === 'subtract') keep = oldVal && !newVal;
        else if (ed.selectionMode === 'intersect') keep = oldVal && newVal;

        if (keep) {
          result[i] = 1;
          hasAny = true;
        }
      }
      ed.selectionMask = hasAny ? result : null;
    }

    ed._drawOverlay();
  }

  // 選択範囲（またはフローティング・全体）をコピー
  copySelection() {
    const ed = this.editor;

    if (this.floatingLayer) {
      const c = document.createElement('canvas');
      c.width = this.floatingLayer.width;
      c.height = this.floatingLayer.height;
      c.getContext('2d').drawImage(this.floatingLayer.canvas, 0, 0);
      this.clipboard = {
        canvas: c,
        width: c.width,
        height: c.height,
        srcX: this.floatingLayer.x,
        srcY: this.floatingLayer.y
      };
      ed._showHint(`コピーしました (${c.width}×${c.height}px)`);
      return;
    }

    const srcData = ed.ctx.getImageData(0, 0, ed.width, ed.height);

    if (!ed.selectionMask) {
      const c = document.createElement('canvas');
      c.width = ed.width;
      c.height = ed.height;
      c.getContext('2d').putImageData(srcData, 0, 0);
      this.clipboard = { canvas: c, width: ed.width, height: ed.height, srcX: 0, srcY: 0 };
      ed._showHint(`全体画像をコピーしました (${ed.width}×${ed.height}px)`);
      return;
    }

    const bounds = this._getSelectionBounds(ed.selectionMask, ed.width, ed.height);
    if (!bounds) return;

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
    this.clipboard = { canvas: c, width: w, height: h, srcX: minX, srcY: minY };
    ed._showHint(`選択範囲をコピーしました (${w}×${h}px)`);
  }

  // クリップボードから貼り付け（フローティング状態）
  pasteClipboard() {
    const ed = this.editor;
    if (!this.clipboard) {
      return alert('コピーされた画像がありません。先に範囲を選択してコピーしてください。');
    }
    if (this.floatingLayer) this.commitFloatingLayer();

    const c = document.createElement('canvas');
    c.width = this.clipboard.width;
    c.height = this.clipboard.height;
    c.getContext('2d').drawImage(this.clipboard.canvas, 0, 0);

    ed.selectionMask = null;
    this.floatingLayer = {
      canvas: c,
      width: c.width,
      height: c.height,
      x: Math.max(0, Math.min(ed.width - c.width, this.clipboard.srcX)),
      y: Math.max(0, Math.min(ed.height - c.height, this.clipboard.srcY))
    };

    this._updateFloatingBarUI();
    ed._drawOverlay();
    ed._showHint('ドラッグまたは矢印キーで位置調整し、Enterまたは「✓ 確定」で貼り付けます');
  }

  // 外部画像を取り込んでフローティング配置
  importExternalImage() {
    const ed = this.editor;
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
      if (!inp.files || !inp.files[0]) return;
      try {
        const img = await ed.app.paletteManager.loadImageSafely(inp.files[0]);
        if (this.floatingLayer) this.commitFloatingLayer();

        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const cCtx = c.getContext('2d');
        cCtx.imageSmoothingEnabled = false;
        cCtx.drawImage(img, 0, 0);

        // Simutrans背景色 (#E7FFFF) を自動透過抜き
        const imgData = cCtx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] === 231 && d[i + 1] === 255 && d[i + 2] === 255) {
            d[i + 3] = 0;
          }
        }
        cCtx.putImageData(imgData, 0, 0);

        ed.selectionMask = null;
        this.floatingLayer = {
          canvas: c,
          width: w,
          height: h,
          x: Math.max(0, Math.floor((ed.width - w) / 2)),
          y: Math.max(0, Math.floor((ed.height - h) / 2))
        };

        this._updateFloatingBarUI();
        ed._drawOverlay();
        ed._showHint(`外部画像 (${w}×${h}px) を配置しました。ドラッグで位置調整し「✓ 確定」で焼き込みます`);
      } catch (err) {
        alert('画像の読み込みに失敗しました: ' + err);
      }
    };
    inp.click();
  }

  commitFloatingLayer() {
    if (!this.floatingLayer) return;
    const ed = this.editor;
    ed._pushHistory();
    ed.ctx.imageSmoothingEnabled = false;
    ed.ctx.drawImage(this.floatingLayer.canvas, this.floatingLayer.x, this.floatingLayer.y);
    this.floatingLayer = null;
    this._updateFloatingBarUI();
    ed._drawOverlay();
    ed._showHint('貼り付けを確定しました');
  }

  cancelFloatingLayer() {
    if (!this.floatingLayer) return;
    this.floatingLayer = null;
    this._updateFloatingBarUI();
    this.editor._drawOverlay();
    this.editor._showHint('貼り付けをキャンセルしました');
  }

  flipHorizontal() { this._flipTransform(true, false); }
  flipVertical() { this._flipTransform(false, true); }

  _flipTransform(flipH, flipV) {
    const ed = this.editor;

    // 1. フローティング貼り付け中の反転
    if (this.floatingLayer) {
      const fl = this.floatingLayer;
      const c = document.createElement('canvas');
      c.width = fl.width;
      c.height = fl.height;
      const cCtx = c.getContext('2d');
      cCtx.imageSmoothingEnabled = false;
      cCtx.translate(flipH ? fl.width : 0, flipV ? fl.height : 0);
      cCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      cCtx.drawImage(fl.canvas, 0, 0);
      fl.canvas = c;
      ed._drawOverlay();
      return;
    }

    ed._pushHistory();

    // 2. 選択範囲なしの全体反転
    if (!ed.selectionMask) {
      const c = document.createElement('canvas');
      c.width = ed.width;
      c.height = ed.height;
      const cCtx = c.getContext('2d');
      cCtx.imageSmoothingEnabled = false;
      cCtx.translate(flipH ? ed.width : 0, flipV ? ed.height : 0);
      cCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      cCtx.drawImage(ed.canvas, 0, 0);

      ed.ctx.clearRect(0, 0, ed.width, ed.height);
      ed.ctx.drawImage(c, 0, 0);
      ed._drawOverlay();
      return;
    }

    // 3. 選択範囲内のピクセルとマスクの反転
    const bounds = this._getSelectionBounds(ed.selectionMask, ed.width, ed.height);
    if (!bounds) return;
    const { minX, minY, maxX, maxY } = bounds;

    const imgData = ed.ctx.getImageData(0, 0, ed.width, ed.height);
    const origData = new Uint8ClampedArray(imgData.data);
    const origMask = new Uint8Array(ed.selectionMask);
    const newMask = new Uint8Array(ed.selectionMask);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * ed.width + x;
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
        const srcIdx = y * ed.width + x;
        if (origMask[srcIdx]) {
          const dstX = flipH ? (minX + maxX - x) : x;
          const dstY = flipV ? (minY + maxY - y) : y;
          const dstIdx = dstY * ed.width + dstX;

          newMask[dstIdx] = 1;
          imgData.data[dstIdx * 4] = origData[srcIdx * 4];
          imgData.data[dstIdx * 4 + 1] = origData[srcIdx * 4 + 1];
          imgData.data[dstIdx * 4 + 2] = origData[srcIdx * 4 + 2];
          imgData.data[dstIdx * 4 + 3] = origData[srcIdx * 4 + 3];
        }
      }
    }

    ed.selectionMask = newMask;
    ed.ctx.putImageData(imgData, 0, 0);
    ed._drawOverlay();
  }

  _getSelectionBounds(mask, width, height) {
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

  // ポインター・キーボード操作フック
  handlePointerDown(px, py) {
    if (!this.floatingLayer) return false;
    const fl = this.floatingLayer;
    if (px >= fl.x && px < fl.x + fl.width && py >= fl.y && py < fl.y + fl.height) {
      this.isDraggingFloating = true;
      this.floatingDragOffset = [px - fl.x, py - fl.y];
      return true;
    }
    this.commitFloatingLayer();
    return false;
  }

  handlePointerMove(px, py) {
    if (!this.isDraggingFloating || !this.floatingLayer) return false;
    this.floatingLayer.x = px - this.floatingDragOffset[0];
    this.floatingLayer.y = py - this.floatingDragOffset[1];
    this.editor._drawOverlay();
    return true;
  }

  handlePointerUp() {
    if (!this.isDraggingFloating) return false;
    this.isDraggingFloating = false;
    return true;
  }

  handleKeyDown(e) {
    if (!this.floatingLayer) return false;
    if (e.code === 'ArrowUp') { e.preventDefault(); this.floatingLayer.y -= 1; this.editor._drawOverlay(); return true; }
    if (e.code === 'ArrowDown') { e.preventDefault(); this.floatingLayer.y += 1; this.editor._drawOverlay(); return true; }
    if (e.code === 'ArrowLeft') { e.preventDefault(); this.floatingLayer.x -= 1; this.editor._drawOverlay(); return true; }
    if (e.code === 'ArrowRight') { e.preventDefault(); this.floatingLayer.x += 1; this.editor._drawOverlay(); return true; }
    if (e.code === 'Enter') { e.preventDefault(); this.commitFloatingLayer(); return true; }
    if (e.code === 'Escape') { e.preventDefault(); this.cancelFloatingLayer(); return true; }
    return false;
  }

  drawFloatingOverlay(oCtx, zoomLevel) {
    if (!this.floatingLayer) return;
    const fl = this.floatingLayer;
    oCtx.imageSmoothingEnabled = false;
    oCtx.drawImage(fl.canvas, fl.x, fl.y);

    const lw = 1 / Math.max(1, zoomLevel * 0.5);
    oCtx.lineWidth = lw;
    oCtx.strokeStyle = '#00FF88';
    oCtx.strokeRect(fl.x, fl.y, fl.width, fl.height);
  }
}
