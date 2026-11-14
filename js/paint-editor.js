import { PaintClipboardManager } from './paint-clipboard.js';
import { PaintDialogs } from './paint-dialogs.js';
import { PaintResizeController, cloneCanvasFromSource } from './paint-resize.js';
import { PaintInputController } from './paint-input.js';
import { PaintToolHandler } from './paint-tools.js';
import { renderEditorPaletteUI, updateEditorCurrentColorUI } from './paint-palette-ui.js';
import { renderPaintModalUI } from './ui-paint-modal.js';
import { renderSubModalsUI } from './ui-sub-modals.js';
import { renderDeftileModalUI } from './ui-deftile-modal.js';

export class PaintEditor {
  constructor(app) {
    this.app = app;
    this.targetType = 'base'; // 'base' | 'mask' | 'deftile'
    this.width = 0;
    this.height = 0;
    this.initialized = false;

    this.modal = null;
    this.canvas = null;
    this.ctx = null;
    this.overlayCanvas = null;
    this.oCtx = null;
    this.viewport = null;

    this.clipMgr = null;
    this.dialogs = null;
    this.resizeCtrl = null;
    this.inputCtrl = null;
    this.toolHandler = null;

    this.currentColor = '#FFFFFF';
    this.currentTool = 'pencil';
    this.selectionMode = 'replace';
    this.zoomLevel = 8.0;
    this.panX = 40;
    this.panY = 40;
    this.isDrawing = false;
    this.lastDrawPos = null;

    this.lineStart = null;
    this.rectFillStart = null;
    this.selStart = null;
    this.polyPoints = [];
    this.selectionMask = null;

    this.showGrid = false;
    this.gridStep = 8;
    this.gridColor = '#00FF66';
    this.showIsoTile = false;
    this.isoTileW = 64;
    this.isoTileH = 32;
    this.isoColor = '#FFAA00';

    this.undoStack = [];
    this.redoStack = [];
    this.maxUndo = 25;
  }

  _ensureInitialized() {
    if (this.initialized) return true;

    renderPaintModalUI();
    renderSubModalsUI();
    renderDeftileModalUI();

    this.modal = document.getElementById('modal-paint-editor');
    this.canvas = document.getElementById('paint-canvas');
    this.overlayCanvas = document.getElementById('paint-overlay-canvas');
    this.viewport = document.getElementById('paint-viewport');

    if (!this.modal || !this.canvas || !this.overlayCanvas || !this.viewport) {
      alert('ペイントエディタのUI初期化に失敗しました。ページを再読み込みしてください。');
      return false;
    }

    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.oCtx = this.overlayCanvas.getContext('2d');
    this.clipMgr = new PaintClipboardManager(this);
    this.dialogs = new PaintDialogs(this);
    this.resizeCtrl = new PaintResizeController(this);
    this.inputCtrl = new PaintInputController(this);
    this.toolHandler = new PaintToolHandler(this);

    this.resizeCtrl.bindEvents();
    this.inputCtrl.bindAll();

    const btnToggleLive = document.getElementById('btn-toggle-live-preview-size');
    if (btnToggleLive) {
      btnToggleLive.onclick = () => {
        document.getElementById('paint-deftile-live-preview')?.classList.toggle('expanded');
      };
    }

    this.initialized = true;
    return true;
  }

  get keybindings() {
    if (!this.dialogs) this._ensureInitialized();
    return this.dialogs ? this.dialogs.keybindings : {};
  }

  saveKeybindings() {
    if (this.dialogs) this.dialogs.saveKeybindings();
  }

  open(targetType = 'base') {
    if (!this._ensureInitialized()) return;

    this.targetType = targetType;
    let srcImg = null;
    if (targetType === 'base') srcImg = this.app.baseImage;
    else if (targetType === 'mask') srcImg = this.app.maskImage;
    else if (targetType === 'deftile') srcImg = this.app.deftileBuilder?.deftileCanvas;

    if (!srcImg) {
      alert('編集対象の画像が読み込まれていません。');
      return;
    }

    const btnResize = document.getElementById('btn-paint-resize');
    if (btnResize) {
      btnResize.style.display = targetType === 'base' ? 'inline-block' : 'none';
    }

    const livePreviewBox = document.getElementById('paint-deftile-live-preview');
    if (livePreviewBox) {
      livePreviewBox.style.display = targetType === 'deftile' ? 'flex' : 'none';
    }

    this.width = srcImg.naturalWidth || srcImg.width;
    this.height = srcImg.naturalHeight || srcImg.height;

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.overlayCanvas.width = this.width;
    this.overlayCanvas.height = this.height;

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(srcImg, 0, 0);

    this.selectionMask = null;
    this.polyPoints = [];
    this.lineStart = null;
    this.rectFillStart = null;
    this.selStart = null;
    this.clipMgr.reset();

    this.undoStack = [];
    this.redoStack = [];
    this._pushHistory();

    this._renderPaletteUI();
    if (typeof this.modal.showModal === 'function') {
      this.modal.showModal();
    } else {
      this.modal.setAttribute('open', '');
    }

    requestAnimationFrame(() => {
      const vw = this.viewport.clientWidth;
      const vh = this.viewport.clientHeight;
      const fitZoom = Math.max(1, Math.min(32, Math.floor(Math.min((vw - 80) / this.width, (vh - 80) / this.height))));
      this.zoomLevel = Math.max(2, fitZoom);
      this.panX = Math.round((vw - this.width * this.zoomLevel) / 2);
      this.panY = Math.round((vh - this.height * this.zoomLevel) / 2);
      this._updateTransform();
      this._drawOverlay();
      this._refreshDeftileLivePreview();
    });

    this._updateStatus();
  }

  _refreshDeftileLivePreview() {
    if (this.targetType === 'deftile' && this.app.deftileBuilder) {
      this.app.deftileBuilder.renderLiveMiniPreview(this.canvas);
    }
  }

  applyAndClose() {
    if (this.clipMgr && this.clipMgr.floatingLayer) this.clipMgr.commitFloatingLayer();

    const outCanvas = document.createElement('canvas');
    outCanvas.width = this.width;
    outCanvas.height = this.height;
    outCanvas.getContext('2d').drawImage(this.canvas, 0, 0);

    if (this.targetType === 'deftile') {
      this.app.deftileBuilder.setDeftileCanvas(outCanvas);
      this.modal.close();
      return;
    }

    const latestState = this.undoStack[this.undoStack.length - 1];
    if (this.targetType === 'base' && latestState && latestState.maskCanvas) {
      this.app.applyBaseImage(outCanvas, this.app.baseName, { resetMask: false });
      this.app.applyMaskImage(latestState.maskCanvas, this.app.maskName);
    } else if (this.targetType === 'base') {
      this.app.applyBaseImage(outCanvas, this.app.baseName, { resetMask: false });
    } else {
      this.app.applyMaskImage(outCanvas, this.app.maskName);
    }

    this.app.markDirty();
    this.app.render();
    this.modal.close();
  }

  _cancelAndClose() {
    if (this.targetType === 'base' && this.undoStack.length > 0 && this.undoStack[0].maskCanvas) {
      this.app.applyMaskImage(this.undoStack[0].maskCanvas, this.app.maskName);
      this.app.render();
    }
    this.modal.close();
  }

  _pushHistory() {
    const data = this.ctx.getImageData(0, 0, this.width, this.height);
    const maskSnap = (this.targetType === 'base' && this.app.maskImage)
      ? cloneCanvasFromSource(this.app.maskImage)
      : null;

    this.undoStack.push({ imageData: data, width: this.width, height: this.height, maskCanvas: maskSnap });
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];
  }

  _restoreHistoryState(state) {
    if (!state) return;
    this.width = state.width;
    this.height = state.height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.overlayCanvas.width = this.width;
    this.overlayCanvas.height = this.height;
    this.ctx.putImageData(state.imageData, 0, 0);

    if (this.targetType === 'base' && state.maskCanvas) {
      this.app.baseW = this.width;
      this.app.baseH = this.height;
      this.app.applyMaskImage(state.maskCanvas, this.app.maskName);
    }

    this.selectionMask = null;
    this.polyPoints = [];
    this._updateTransform();
    this._drawOverlay();
    this._updateStatus();
    this._refreshDeftileLivePreview();
  }

  undo() {
    if (this.clipMgr && this.clipMgr.floatingLayer) { this.clipMgr.cancelFloatingLayer(); return; }
    if (this.undoStack.length <= 1) return;
    this.redoStack.push(this.undoStack.pop());
    this._restoreHistoryState(this.undoStack[this.undoStack.length - 1]);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this._restoreHistoryState(next);
  }

  _renderPaletteUI() { renderEditorPaletteUI(this); }
  _updateCurrentColorUI() { updateEditorCurrentColorUI(this); }

  _updateTransform() {
    const s = this.zoomLevel;
    const tStr = `translate(${this.panX}px, ${this.panY}px) scale(${s})`;
    this.canvas.style.transformOrigin = '0 0';
    this.canvas.style.transform = tStr;
    this.overlayCanvas.style.transformOrigin = '0 0';
    this.overlayCanvas.style.transform = tStr;
    const lbl = document.getElementById('paint-lbl-zoom');
    if (lbl) lbl.textContent = `${Math.round(s * 100)}%`;
  }

  _showHint(msg) {
    const hintEl = document.getElementById('paint-lbl-hint');
    if (hintEl) hintEl.textContent = msg;
  }

  _drawPixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    if (this.selectionMask && !this.selectionMask[y * this.width + x]) return;
    this.ctx.fillStyle = this.currentColor;
    this.ctx.fillRect(x, y, 1, 1);
  }

  _handlePointerDown(px, py) {
    this.toolHandler.handlePointerDown(px, py);
    this._refreshDeftileLivePreview();
  }
  _handlePointerMove(px, py) {
    this.toolHandler.handlePointerMove(px, py);
    if (this.isDrawing && this.currentTool === 'pencil') {
      this._refreshDeftileLivePreview();
    }
  }
  _handlePointerUp(px, py) {
    this.toolHandler.handlePointerUp(px, py);
    this._refreshDeftileLivePreview();
  }
  _finalizePolySelect() { this.toolHandler.finalizePolySelect(); }
  _drawOverlay(curPos = null) {
    this.toolHandler.drawOverlay(curPos);
    this._refreshDeftileLivePreview();
  }

  _updateStatus() {
    const modeNames = {
      replace: '新規',
      add: '＋追加',
      subtract: '－一部削除',
      intersect: '×乗算(交差)'
    };
    const toolLbl = document.getElementById('paint-lbl-tool');
    if (toolLbl) {
      toolLbl.textContent = `ツール: ${this.currentTool} | 選択モード: ${modeNames[this.selectionMode] || this.selectionMode} (${this.width}×${this.height}px)`;
    }

    if (this.currentTool === 'polySelect') {
      this._showHint('クリックで頂点追加 / 始点クリック・ダブルクリック・Enterで確定 / Escで取消');
    } else if (this.currentTool === 'rectFill') {
      this._showHint('ドラッグで矩形範囲を一括塗りつぶし');
    } else {
      this._showHint('');
    }
  }
}