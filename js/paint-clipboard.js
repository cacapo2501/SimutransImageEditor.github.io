import { getSelectionBounds, flipEditorTransform } from './paint-flip.js';

function loadImageFromFileReliable(file) {
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

export class PaintClipboardManager {
  constructor(editor) {
    this.editor = editor;
    this.clipboard = null;
    this.floatingLayer = null;
    this.isDraggingFloating = false;
    this.floatingDragOffset = [0, 0];

    this.lastImportedCanvas = null;
    this.lastImportedName = '';
    this.lastImportedPos = null;
  }

  reset() {
    this.floatingLayer = null;
    this.isDraggingFloating = false;
    this._updateFloatingBarUI();
    this._updateReimportBtnUI();
  }

  _updateFloatingBarUI() {
    const bar = document.getElementById('floating-action-bar');
    if (bar) {
      bar.style.display = this.floatingLayer ? 'flex' : 'none';
    }
  }

  _updateReimportBtnUI() {
    const btn = document.getElementById('btn-paint-reimport-img');
    if (btn) {
      btn.disabled = !this.lastImportedCanvas;
      btn.title = this.lastImportedCanvas
        ? `前回貼り付けた画像 (${this.lastImportedName}) をもう一度貼り付け`
        : '前回貼り付けた外部画像をもう一度貼り付け';
    }
  }

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
    ed._updateStatus();
  }

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

    const bounds = getSelectionBounds(ed.selectionMask, ed.width, ed.height);
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

    if (!ed.repeatMgr || !ed.repeatMgr.isActive()) {
      ed.selectionMask = null;
    }

    this.floatingLayer = {
      canvas: c,
      width: c.width,
      height: c.height,
      x: Math.max(0, Math.min(ed.width - c.width, this.clipboard.srcX)),
      y: Math.max(0, Math.min(ed.height - c.height, this.clipboard.srcY)),
      isImported: false
    };

    this._updateFloatingBarUI();
    ed._drawOverlay();
    ed._showHint('ドラッグまたは矢印キーで位置調整し、Enterまたは「✓ 確定」で貼り付けます');
  }

  _placeImportedCanvas(srcCanvas, name, pos = null) {
    const ed = this.editor;
    if (this.floatingLayer) this.commitFloatingLayer();

    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cCtx = c.getContext('2d');
    cCtx.imageSmoothingEnabled = false;
    cCtx.drawImage(srcCanvas, 0, 0);

    if (!ed.repeatMgr || !ed.repeatMgr.isActive()) {
      ed.selectionMask = null;
    }

    const initX = pos ? Math.max(0, Math.min(ed.width - w, pos[0])) : Math.max(0, Math.floor((ed.width - w) / 2));
    const initY = pos ? Math.max(0, Math.min(ed.height - h, pos[1])) : Math.max(0, Math.floor((ed.height - h) / 2));

    this.floatingLayer = {
      canvas: c,
      width: w,
      height: h,
      x: initX,
      y: initY,
      isImported: true
    };

    this._updateFloatingBarUI();
    this._updateReimportBtnUI();
    ed._drawOverlay();
    ed._showHint(`外部画像 (${name}: ${w}×${h}px) を配置しました。ドラッグで位置調整し「✓ 確定」で焼き込みます`);
  }

  importExternalImage() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/png,image/jpeg,image/gif,image/webp,image/*';
    inp.style.position = 'fixed';
    inp.style.left = '-9999px';
    inp.style.opacity = '0';

    const host = this.editor.modal || document.body;
    host.appendChild(inp);

    const cleanup = () => {
      if (inp.parentNode) inp.parentNode.removeChild(inp);
    };

    inp.addEventListener('change', async () => {
      const file = inp.files && inp.files[0];
      cleanup();
      if (!file) return;

      try {
        const img = await loadImageFromFileReliable(file);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const cCtx = c.getContext('2d');
        cCtx.imageSmoothingEnabled = false;
        cCtx.drawImage(img, 0, 0);

        const imgData = cCtx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] === 231 && d[i + 1] === 255 && d[i + 2] === 255) {
            d[i + 3] = 0;
          }
        }
        cCtx.putImageData(imgData, 0, 0);

        this.lastImportedCanvas = c;
        this.lastImportedName = file.name;
        this.lastImportedPos = null;

        this._placeImportedCanvas(c, file.name, null);
      } catch (err) {
        alert('画像の読み込みに失敗しました: ' + (err.message || err));
      }
    });

    inp.click();
  }

  reapplyLastImportedImage() {
    if (!this.lastImportedCanvas) {
      alert('前回貼り付けた外部画像がありません。先に「🖼️ 画像貼付」から画像を取り込んでください。');
      return;
    }
    this._placeImportedCanvas(this.lastImportedCanvas, this.lastImportedName, this.lastImportedPos);
  }

  commitFloatingLayer() {
    if (!this.floatingLayer) return;
    const ed = this.editor;
    if (this.floatingLayer.isImported) {
      this.lastImportedPos = [this.floatingLayer.x, this.floatingLayer.y];
    }
    ed._pushHistory();
    const before = ed.repeatMgr ? ed.repeatMgr.snapshotBefore() : null;

    if (ed.selectionMask) {
      const fl = this.floatingLayer;
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
      if (ed.repeatMgr && before) ed.repeatMgr.applyDiff(before);
    } else {
      ed.ctx.imageSmoothingEnabled = false;
      ed.ctx.drawImage(this.floatingLayer.canvas, this.floatingLayer.x, this.floatingLayer.y);
    }

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

  flipHorizontal() { flipEditorTransform(this.editor, this, true, false); }
  flipVertical() { flipEditorTransform(this.editor, this, false, true); }

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
