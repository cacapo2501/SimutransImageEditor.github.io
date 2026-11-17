import { flipEditorTransform } from './paint-flip.js';
import {
  loadImageFromFileReliable,
  combineSelectionMask,
  extractSelectionCanvas,
  compositeFloatingWithSelectionMask
} from './paint-clipboard-helpers.js';

export class PaintClipboardManager {
  constructor(editor) {
    this.editor = editor;
    this.clipboard = null;
    this.floatingLayer = null;
    this.isDraggingFloating = false;
    this.floatingDragStartPos = [0, 0];
    this.floatingDragStartMouse = [0, 0];

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
    const btnEditText = document.getElementById('btn-edit-floating-text');
    if (btnEditText) {
      btnEditText.style.display = (this.floatingLayer && this.floatingLayer.isText) ? '' : 'none';
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

  // 画像貼り付け時にスクロール等の非移動ツールから移動可能な選択移動ツールへ切り替える
  _switchToPasteMoveTool() {
    const ed = this.editor;
    if (ed.currentTool !== 'moveSel') {
      ed.selectTool('moveSel');
    }
  }

  applySelectionMask(newMask) {
    const ed = this.editor;
    ed.selectionMask = combineSelectionMask(ed.selectionMask, newMask, ed.selectionMode, ed.width * ed.height);
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

    const extracted = extractSelectionCanvas(ed);
    if (!extracted) return;

    this.clipboard = {
      canvas: extracted.canvas,
      width: extracted.width,
      height: extracted.height,
      srcX: extracted.srcX,
      srcY: extracted.srcY
    };
    const label = extracted.isFull ? '全体画像をコピーしました' : '選択範囲をコピーしました';
    ed._showHint(`${label} (${extracted.width}×${extracted.height}px)`);
  }

  pasteClipboard() {
    const ed = this.editor;
    if (!this.clipboard) {
      return alert('コピーされた画像がありません。先に範囲を選択してコピーしてください。');
    }
    if (this.floatingLayer) this.commitFloatingLayer();

    this._switchToPasteMoveTool();

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

    this._switchToPasteMoveTool();

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

    let initX = pos ? Math.max(0, Math.min(ed.width - w, pos[0])) : Math.max(0, Math.floor((ed.width - w) / 2));
    let initY = pos ? Math.max(0, Math.min(ed.height - h, pos[1])) : Math.max(0, Math.floor((ed.height - h) / 2));
    if (!pos && ed.gridSnap && ed.gridSnap.enabled) {
      const sw = Math.max(1, ed.gridSnap.stepW);
      const sh = Math.max(1, ed.gridSnap.stepH);
      initX = Math.floor(initX / sw) * sw;
      initY = Math.floor(initY / sh) * sh;
    }

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
    ed._showHint(`外部画像 (${name}: ${w}×${h}px) を配置しました。ドラッグまたは矢印キーで位置調整し「✓ 確定」で焼き込みます`);
  }

  // 文字編集モーダルで作成したテキストキャンバスをフローティング配置する
  placeTextFloatingLayer(srcCanvas, pos, textConfig, { replaceExisting = false } = {}) {
    const ed = this.editor;
    if (this.floatingLayer) {
      if (replaceExisting) {
        this.floatingLayer = null;
      } else {
        this.commitFloatingLayer();
      }
    }

    this._switchToPasteMoveTool();

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

    const initX = Array.isArray(pos) ? pos[0] : 0;
    const initY = Array.isArray(pos) ? pos[1] : 0;

    this.floatingLayer = {
      canvas: c,
      width: w,
      height: h,
      x: initX,
      y: initY,
      isImported: false,
      isText: true,
      textConfig: { ...textConfig }
    };

    this._updateFloatingBarUI();
    ed._drawOverlay();
    ed._showHint(`🔤 文字 (${w}×${h}px) を配置中: ドラッグ/矢印キーで移動、「✏️ 文字編集」で再編集、「✓ 確定」で焼き込み`);
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
      compositeFloatingWithSelectionMask(ed, this.floatingLayer);
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
      this.floatingDragStartPos = [fl.x, fl.y];
      this.floatingDragStartMouse = [px, py];
      return true;
    }
    this.commitFloatingLayer();
    return false;
  }

  handlePointerMove(px, py) {
    if (!this.isDraggingFloating || !this.floatingLayer) return false;
    const ed = this.editor;
    const rawDx = px - this.floatingDragStartMouse[0];
    const rawDy = py - this.floatingDragStartMouse[1];
    const [dx, dy] = ed.gridSnap ? ed.gridSnap.snapDelta(rawDx, rawDy) : [rawDx, rawDy];
    this.floatingLayer.x = this.floatingDragStartPos[0] + dx;
    this.floatingLayer.y = this.floatingDragStartPos[1] + dy;
    ed._drawOverlay();
    const snapTag = (ed.gridSnap && ed.gridSnap.enabled) ? ` (スナップ ${ed.gridSnap.stepW}×${ed.gridSnap.stepH})` : '';
    ed._showHint(`📌 貼付画像を移動中: (${this.floatingLayer.x}, ${this.floatingLayer.y}) ΔX=${dx}px, ΔY=${dy}px${snapTag}`);
    return true;
  }

  handlePointerUp() {
    if (!this.isDraggingFloating) return false;
    this.isDraggingFloating = false;
    return true;
  }

  handleKeyDown(e) {
    if (!this.floatingLayer) return false;
    const ed = this.editor;
    const stepX = (ed.gridSnap && ed.gridSnap.enabled) ? Math.max(1, ed.gridSnap.stepW) : 1;
    const stepY = (ed.gridSnap && ed.gridSnap.enabled) ? Math.max(1, ed.gridSnap.stepH) : 1;
    if (e.code === 'ArrowUp') { e.preventDefault(); this.floatingLayer.y -= stepY; ed._drawOverlay(); return true; }
    if (e.code === 'ArrowDown') { e.preventDefault(); this.floatingLayer.y += stepY; ed._drawOverlay(); return true; }
    if (e.code === 'ArrowLeft') { e.preventDefault(); this.floatingLayer.x -= stepX; ed._drawOverlay(); return true; }
    if (e.code === 'ArrowRight') { e.preventDefault(); this.floatingLayer.x += stepX; ed._drawOverlay(); return true; }
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
