import { PaintClipboardManager } from './paint-clipboard.js';
import { PaintDialogs } from './paint-dialogs.js';
import { PaintResizeController, cloneCanvasFromSource } from './paint-resize.js';
import { PaintInputController } from './paint-input.js';
import { PaintToolHandler, updatePaintStatus } from './paint-tools.js';
import { PaintOnionSkinManager } from './paint-onion-skin.js';
import { PaintRepeatManager } from './paint-repeat.js';
import { PaintSelectionMover } from './paint-selection-move.js';
import { PaintGridSnapManager } from './paint-grid-snap.js';
import { PaintRectHandlesController } from './paint-rect-handles.js';
import { renderEditorPaletteUI, updateEditorCurrentColorUI } from './paint-palette-ui.js';
import { renderPaintModalUI } from './ui-paint-modal.js';
import { renderSubModalsUI } from './ui-sub-modals.js';
import { renderDeftileModalUI } from './ui-deftile-modal.js';
import { renderPaintTextModalUI } from './ui-paint-text-modal.js';
import { PaintTextController } from './paint-text-modal.js';

const DRAWING_TOOLS = new Set(['pencil', 'line', 'rectFill', 'bucket', 'text']);
const SELECT_TOOLS = new Set(['rectSelect', 'polySelect', 'wand', 'colorSelect']);

export class PaintEditor {
  constructor(app) {
    this.app = app;
    this.targetType = 'base'; // 'base' | 'mask' | 'deftile' | 'aircraftPlan'
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
    this.onionSkinMgr = null;
    this.repeatMgr = null;
    this.selMover = null;
    this.gridSnap = null;
    this.rectHandles = null;
    this.isTouchMode = typeof window !== 'undefined' && Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    this.currentColor = '#FFFFFF';
    this.currentTool = 'pencil';
    this.previousTool = 'pencil';
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
    this.initialMaskSnapshot = null;
  }

  _ensureInitialized() {
    if (this.initialized) return true;
    renderPaintModalUI();
    renderSubModalsUI();
    renderDeftileModalUI();
    renderPaintTextModalUI();

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
    this.onionSkinMgr = new PaintOnionSkinManager(this);
    this.repeatMgr = new PaintRepeatManager(this);
    this.selMover = new PaintSelectionMover(this);
    this.gridSnap = new PaintGridSnapManager(this);
    this.rectHandles = new PaintRectHandlesController(this);
    this.textCtrl = new PaintTextController(this);

    this.resizeCtrl.bindEvents();
    this.inputCtrl.bindAll();
    this.onionSkinMgr.bindEvents();
    this.repeatMgr.bindEvents();
    this.gridSnap.bindEvents();
    this.textCtrl.bindEvents();

    const btnToggleLive = document.getElementById('btn-toggle-live-preview-size');
    if (btnToggleLive) {
      btnToggleLive.onclick = () => document.getElementById('paint-deftile-live-preview')?.classList.toggle('expanded');
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

  isDrawingTool() {
    return DRAWING_TOOLS.has(this.currentTool);
  }

  selectTool(toolName) {
    if (this.clipMgr && this.clipMgr.floatingLayer) this.clipMgr.commitFloatingLayer();
    if (toolName === 'picker' && this.currentTool !== 'picker') {
      this.previousTool = this.currentTool;
    } else if (toolName !== 'picker') {
      this.previousTool = toolName;
    }

    this.currentTool = toolName;
    document.querySelectorAll('#paint-toolbar .paint-tool-btn[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === toolName);
    });

    this.lineStart = null;
    this.rectFillStart = null;
    this.selStart = null;
    this.polyPoints = [];
    if (this.currentTool === 'hand') {
      this.selectionMask = null;
      if (this.selMover) this.selMover.reset();
    }
    if (this.rectHandles) this.rectHandles.reset();

    this._drawOverlay();
    this._updateStatus();
  }

  updateCursor(hoverPx = null, hoverPy = null) {
    if (!this.viewport) return;
    let cur = 'crosshair';
    if (this.inputCtrl && this.inputCtrl.isPanning) cur = 'grabbing';
    else if (this.dialogs?.colorReplace?.isHandMode() || this.currentTool === 'hand') cur = 'grab';
    else if (this.currentTool === 'moveSel') cur = 'move';
    else if (
      hoverPx !== null && hoverPy !== null &&
      this.selectionMask && this.selectionMode === 'replace' &&
      SELECT_TOOLS.has(this.currentTool) &&
      hoverPx >= 0 && hoverPx < this.width && hoverPy >= 0 && hoverPy < this.height &&
      this.selectionMask[hoverPy * this.width + hoverPx]
    ) {
      cur = 'move';
    }
    this.viewport.style.cursor = cur;
    if (this.canvas) this.canvas.style.cursor = cur;
    if (this.overlayCanvas) this.overlayCanvas.style.cursor = cur;
  }

  open(targetType = 'base') {
    if (!this._ensureInitialized()) return;
    this.targetType = targetType;

    let srcImg = null;
    if (targetType === 'base') srcImg = this.app.baseImage;
    else if (targetType === 'mask') srcImg = this.app.maskImage;
    else if (targetType === 'deftile') srcImg = this.app.deftileBuilder?.deftileCanvas;
    else if (targetType === 'aircraftPlan') srcImg = this.app.aircraftCtrl?.planCanvas;

    if (!srcImg) {
      alert('編集対象の画像が読み込まれていません。');
      return;
    }

    const btnResize = document.getElementById('btn-paint-resize');
    if (btnResize) btnResize.style.display = targetType === 'base' ? 'inline-block' : 'none';
    const livePreviewBox = document.getElementById('paint-deftile-live-preview');
    if (livePreviewBox) livePreviewBox.style.display = targetType === 'deftile' ? 'flex' : 'none';

    this.width = srcImg.naturalWidth || srcImg.width;
    this.height = srcImg.naturalHeight || srcImg.height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.overlayCanvas.width = this.width;
    this.overlayCanvas.height = this.height;

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(srcImg, 0, 0);

    // 32bit画像の場合は含まれる透明・半透明アルファ色を自動的にパレットへ追加
    let autoAlphaInfo = null;
    if (targetType === 'base' || targetType === 'mask') {
      const px = this.ctx.getImageData(0, 0, this.width, this.height).data;
      autoAlphaInfo = this.app.paletteManager.autoRegisterAlphaColors(targetType, px);
    }

    this.selectionMask = null;
    this.polyPoints = [];
    this.lineStart = null;
    this.rectFillStart = null;
    this.selStart = null;
    this.clipMgr.reset();
    this.selMover.reset();
    this.rectHandles.reset();
    this.onionSkinMgr.clearAll();
    document.querySelectorAll('#paint-sidebar details.paint-accordion').forEach(d => { d.open = false; });

    this.undoStack = [];
    this.redoStack = [];
    this.initialMaskSnapshot = (this.targetType === 'base' && this.app.maskImage)
      ? cloneCanvasFromSource(this.app.maskImage)
      : null;

    this._renderPaletteUI();
    this.inputCtrl?.applyDefaultCompactLayout?.();
    this.updateCursor();
    if (typeof this.modal.showModal === 'function') this.modal.showModal();
    else this.modal.setAttribute('open', '');

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
    if (autoAlphaInfo?.hasAlpha) {
      const suffix = autoAlphaInfo.addedCount > 0 ? ` (${autoAlphaInfo.addedCount}色を自動追加)` : ' (登録済)';
      this._showHint(`✨ 32bitアルファ画像を検出: 透明/半透明カラーをパレットに適用しました${suffix}`);
    }
  }

  _refreshDeftileLivePreview() {
    if (this.targetType === 'deftile' && this.app.deftileBuilder) {
      this.app.deftileBuilder.renderLiveMiniPreview(this.canvas);
    }
  }

  applyAndClose() {
    if (this.clipMgr && this.clipMgr.floatingLayer) this.clipMgr.commitFloatingLayer();
    if (this.onionSkinMgr) this.onionSkinMgr.clearAll();

    const outCanvas = document.createElement('canvas');
    outCanvas.width = this.width;
    outCanvas.height = this.height;
    outCanvas.getContext('2d').drawImage(this.canvas, 0, 0);

    if (this.targetType === 'deftile') {
      this.app.deftileBuilder.setDeftileCanvas(outCanvas);
      this.modal.close();
      return;
    }
    if (this.targetType === 'aircraftPlan') {
      this.app.aircraftCtrl.setPlanCanvas(outCanvas);
      this.modal.close();
      return;
    }

    if (this.targetType === 'base') {
      this.app.applyBaseImage(outCanvas, this.app.baseName, { resetMask: false, resetDat: false, isTransform: true });
    } else {
      this.app.applyMaskImage(outCanvas, this.app.maskName);
    }

    this.app.markDirty();
    this.app.render();
    this.modal.close();
  }

  _cancelAndClose() {
    if (this.onionSkinMgr) this.onionSkinMgr.clearAll();
    if (this.targetType === 'base' && this.initialMaskSnapshot) {
      this.app.applyMaskImage(this.initialMaskSnapshot, this.app.maskName);
      this.app.render();
    }
    this.modal.close();
  }

  _captureHistoryState() {
    const data = this.ctx.getImageData(0, 0, this.width, this.height);
    const maskSnap = (this.targetType === 'base' && this.app.maskImage) ? cloneCanvasFromSource(this.app.maskImage) : null;
    return { imageData: data, width: this.width, height: this.height, maskCanvas: maskSnap };
  }

  _pushHistory(state = null) {
    this.undoStack.push(state || this._captureHistoryState());
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
    this.selMover.reset();
    this._updateTransform();
    this._drawOverlay();
    this._updateStatus();
    this._refreshDeftileLivePreview();
  }

  undo() {
    if (this.clipMgr && this.clipMgr.floatingLayer) { this.clipMgr.cancelFloatingLayer(); return; }
    if (this.undoStack.length === 0) return;
    this.redoStack.push(this._captureHistoryState());
    this._restoreHistoryState(this.undoStack.pop());
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(this._captureHistoryState());
    this._restoreHistoryState(this.redoStack.pop());
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
    if (this.rectHandles) this.rectHandles.updateUI();
  }

  _showHint(msg) {
    const hintEl = document.getElementById('paint-lbl-hint');
    if (hintEl) hintEl.textContent = msg;
  }

  _drawPixel(x, y) { this.repeatMgr.drawPixel(x, y); }
  _handlePointerDown(px, py) { this.toolHandler.handlePointerDown(px, py); this._refreshDeftileLivePreview(); }
  _handlePointerMove(px, py) {
    this.toolHandler.handlePointerMove(px, py);
    if (this.isDrawing && this.currentTool === 'pencil') this._refreshDeftileLivePreview();
  }
  _handlePointerUp(px, py) { this.toolHandler.handlePointerUp(px, py); this._refreshDeftileLivePreview(); }
  _finalizePolySelect() { this.toolHandler.finalizePolySelect(); }
  _drawOverlay(curPos = null) {
    this.toolHandler.drawOverlay(curPos);
    if (this.rectHandles) this.rectHandles.updateUI();
    this._refreshDeftileLivePreview();
  }

  _updateStatus() {
    updatePaintStatus(this);
  }
}
