import { rgbToHex } from './color-utils.js';
import {
  drawLineContinuous,
  floodFill,
  magicWandMask,
  colorSelectMask,
  rasterizePolygonMask,
  renderTextPixels,
  drawSelectionOverlay,
  drawGuidesOverlay
} from './paint-algorithms.js';
import { PaintClipboardManager } from './paint-clipboard.js';
import { PaintDialogs } from './paint-dialogs.js';
import { renderPaintModalUI } from './ui-paint-modal.js';
import { renderSubModalsUI } from './ui-sub-modals.js';

export class PaintEditor {
  constructor(app) {
    this.app = app;
    this.targetType = 'base';
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

    this.currentColor = '#FFFFFF';
    this.currentTool = 'pencil';
    this.selectionMode = 'replace';
    this.zoomLevel = 8.0;
    this.panX = 40;
    this.panY = 40;
    this.isPanning = false;
    this.panStart = [0, 0];
    this.isDrawing = false;
    this.lastDrawPos = null;

    this.touchStartDist = null;
    this.touchStartZoom = 1.0;
    this.touchStartPan = [0, 0];
    this.touchStartCenter = [0, 0];

    this.lineStart = null;
    this.rectFillStart = null;
    this.selStart = null;
    this.polyPoints = [];
    this.selectionMask = null;

    this.showGrid = false;
    this.gridStep = 8;
    this.showIsoTile = false;
    this.isoTileW = 64;
    this.isoTileH = 32;

    this.undoStack = [];
    this.redoStack = [];
    this.maxUndo = 25;
  }

  _ensureInitialized() {
    if (this.initialized) return true;

    renderPaintModalUI();
    renderSubModalsUI();

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

    this._bindEvents();
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
    const srcImg = targetType === 'base' ? this.app.baseImage : this.app.maskImage;
    if (!srcImg) {
      alert(`${targetType === 'base' ? 'ベース' : 'マスク'}画像が読み込まれていません。`);
      return;
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
    this.modal.showModal();

    requestAnimationFrame(() => {
      const vw = this.viewport.clientWidth;
      const vh = this.viewport.clientHeight;
      const fitZoom = Math.max(1, Math.min(32, Math.floor(Math.min((vw - 80) / this.width, (vh - 80) / this.height))));
      this.zoomLevel = Math.max(2, fitZoom);
      this.panX = Math.round((vw - this.width * this.zoomLevel) / 2);
      this.panY = Math.round((vh - this.height * this.zoomLevel) / 2);
      this._updateTransform();
      this._drawOverlay();
    });

    this._updateStatus();
  }

  applyAndClose() {
    if (this.clipMgr && this.clipMgr.floatingLayer) this.clipMgr.commitFloatingLayer();

    const outCanvas = document.createElement('canvas');
    outCanvas.width = this.width;
    outCanvas.height = this.height;
    outCanvas.getContext('2d').drawImage(this.canvas, 0, 0);

    const img = new Image();
    img.onload = () => {
      if (this.targetType === 'base') {
        this.app.applyBaseImage(img, this.app.baseName);
      } else {
        this.app.applyMaskImage(img, this.app.maskName);
      }
      this.app.markDirty();
      this.app.render();
      this.modal.close();
    };
    img.src = outCanvas.toDataURL('image/png');
  }

  _pushHistory() {
    const data = this.ctx.getImageData(0, 0, this.width, this.height);
    this.undoStack.push(data);
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.clipMgr && this.clipMgr.floatingLayer) { this.clipMgr.cancelFloatingLayer(); return; }
    if (this.undoStack.length <= 1) return;
    this.redoStack.push(this.undoStack.pop());
    this.ctx.putImageData(this.undoStack[this.undoStack.length - 1], 0, 0);
    this._drawOverlay();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this.ctx.putImageData(next, 0, 0);
    this._drawOverlay();
  }

  _renderPaletteUI() {
    const container = document.getElementById('paint-palette-slots');
    const emptyMsg = document.getElementById('paint-palette-empty-msg');
    if (!container) return;
    container.innerHTML = '';

    const pm = this.app.paletteManager;
    let colors = [];

    const baseTools = document.getElementById('base-palette-tools');
    const maskTools = document.getElementById('mask-palette-tools');

    if (this.targetType === 'base') {
      if (baseTools) baseTools.style.display = 'block';
      if (maskTools) maskTools.style.display = 'none';
      if (pm.basePalette.length === 0) pm.generateBasePalette();
      colors = [...pm.basePalette];
      if (this.app.specialColors && this.app.specialColors.size > 0) {
        colors.push(...Array.from(this.app.specialColors));
      }
    } else {
      if (baseTools) baseTools.style.display = 'none';
      if (maskTools) maskTools.style.display = 'block';
      colors = [...pm.maskPalette];
    }

    if (emptyMsg) emptyMsg.style.display = colors.length === 0 ? 'block' : 'none';

    colors.forEach(hex => {
      const btn = document.createElement('button');
      btn.className = 'palette-color-btn';
      btn.style.backgroundColor = hex;
      btn.title = hex + (this.targetType === 'mask' ? ' (右クリックで削除)' : '');
      btn.onclick = () => { this.currentColor = hex; this._updateCurrentColorUI(); };

      if (this.targetType === 'mask') {
        btn.oncontextmenu = (e) => {
          e.preventDefault();
          if (confirm(`マスクパレットから色 ${hex} を削除しますか？`)) {
            pm.removeColorFromMaskPalette(hex);
            this._renderPaletteUI();
          }
        };
      }
      container.appendChild(btn);
    });

    if (colors.length > 0 && !colors.includes(this.currentColor)) this.currentColor = colors[0];
    this._updateCurrentColorUI();
  }

  _updateCurrentColorUI() {
    const sw = document.getElementById('paint-current-color-swatch');
    const hx = document.getElementById('paint-current-color-hex');
    if (sw) sw.style.backgroundColor = this.currentColor;
    if (hx) hx.textContent = this.currentColor;
  }

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

  _bindEvents() {
    const bindClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };

    document.querySelectorAll('.paint-tool-btn').forEach(btn => {
      btn.onclick = () => {
        if (this.clipMgr.floatingLayer) this.clipMgr.commitFloatingLayer();
        document.querySelectorAll('.paint-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTool = btn.dataset.tool;
        this.lineStart = null;
        this.rectFillStart = null;
        this.selStart = null;
        this.polyPoints = [];
        this._drawOverlay();
        this._updateStatus();
      };
    });

    document.querySelectorAll('.sel-mode-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.sel-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectionMode = btn.dataset.selMode;
        this._updateStatus();
      };
    });

    bindClick('btn-paint-copy', () => this.clipMgr.copySelection());
    bindClick('btn-paint-paste', () => this.clipMgr.pasteClipboard());
    bindClick('btn-paint-import-img', () => this.clipMgr.importExternalImage());
    bindClick('btn-paint-flip-h', () => this.clipMgr.flipHorizontal());
    bindClick('btn-paint-flip-v', () => this.clipMgr.flipVertical());
    bindClick('btn-commit-floating', () => this.clipMgr.commitFloatingLayer());
    bindClick('btn-cancel-floating', () => this.clipMgr.cancelFloatingLayer());

    const chkGrid = document.getElementById('chk-paint-grid');
    const inpGridStep = document.getElementById('inp-paint-grid-step');
    const chkIso = document.getElementById('chk-paint-iso');
    const inpIsoW = document.getElementById('inp-paint-iso-w');
    const inpIsoH = document.getElementById('inp-paint-iso-h');

    if (chkGrid) chkGrid.onchange = (e) => { this.showGrid = e.target.checked; this._drawOverlay(); };
    if (inpGridStep) inpGridStep.oninput = (e) => { this.gridStep = Math.max(1, Math.min(256, parseInt(e.target.value, 10) || 8)); this._drawOverlay(); };
    if (chkIso) chkIso.onchange = (e) => { this.showIsoTile = e.target.checked; this._drawOverlay(); };
    if (inpIsoW) {
      inpIsoW.oninput = (e) => {
        const w = Math.max(4, Math.min(512, parseInt(e.target.value, 10) || 64));
        this.isoTileW = w;
        const autoH = Math.max(2, Math.round(w / 2));
        this.isoTileH = autoH;
        if (inpIsoH) inpIsoH.value = autoH;
        this._drawOverlay();
      };
    }
    if (inpIsoH) inpIsoH.oninput = (e) => { this.isoTileH = Math.max(2, Math.min(512, parseInt(e.target.value, 10) || 32)); this._drawOverlay(); };

    bindClick('btn-paint-apply', () => this.applyAndClose());
    bindClick('btn-paint-cancel', () => this.modal.close());
    bindClick('btn-paint-undo', () => this.undo());
    bindClick('btn-paint-redo', () => this.redo());
    bindClick('btn-paint-clear-sel', () => {
      this.selectionMask = null;
      this.polyPoints = [];
      this._drawOverlay();
    });

    bindClick('btn-gen-base-palette', () => {
      const pm = this.app.paletteManager;
      pm.basePaletteConfig.brightestHex = document.getElementById('inp-gray-max').value.trim() || '#FEFEFE';
      pm.basePaletteConfig.darkestHex = document.getElementById('inp-gray-min').value.trim() || '#404040';
      pm.basePaletteConfig.steps = parseInt(document.getElementById('inp-gray-steps').value, 10) || 16;
      pm.generateBasePalette();
      this._renderPaletteUI();
    });

    bindClick('btn-add-mask-custom-color', async () => {
      const picked = await this.app.colorPicker.open(this.currentColor || '#FFFFFF');
      if (picked) {
        this.app.paletteManager.addColorToMaskPalette(picked);
        this.currentColor = picked;
        this._renderPaletteUI();
      }
    });

    bindClick('btn-open-image-sampler', () => this.dialogs.openSamplerModal());
    bindClick('btn-open-color-replace', () => this.dialogs.openColorReplaceDialog());
    bindClick('btn-paint-keybindings', () => this.dialogs.openKeybindingDialog());

    this.viewport.onwheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.25 : 0.8;
      const newZoom = Math.max(1, Math.min(64, this.zoomLevel * delta));
      const rect = this.viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const ix = (cx - this.panX) / this.zoomLevel;
      const iy = (cy - this.panY) / this.zoomLevel;
      this.zoomLevel = newZoom;
      this.panX = Math.round(cx - ix * newZoom);
      this.panY = Math.round(cy - iy * newZoom);
      this._updateTransform();
    };

    const getPixelCoords = (clientX, clientY) => {
      const rect = this.viewport.getBoundingClientRect();
      const px = Math.floor((clientX - rect.left - this.panX) / this.zoomLevel);
      const py = Math.floor((clientY - rect.top - this.panY) / this.zoomLevel);
      return { px, py };
    };

    this.viewport.onmousedown = (e) => {
      if (e.button === 1 || e.button === 2 || e.spaceKey) {
        this.isPanning = true;
        this.panStart = [e.clientX - this.panX, e.clientY - this.panY];
        return;
      }
      const { px, py } = getPixelCoords(e.clientX, e.clientY);
      this._handlePointerDown(px, py);
    };

    this.viewport.ondblclick = (e) => {
      if (this.currentTool === 'polySelect' && this.polyPoints.length >= 3) {
        e.preventDefault();
        this._finalizePolySelect();
      }
    };

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStart[0];
        this.panY = e.clientY - this.panStart[1];
        this._updateTransform();
        return;
      }
      if (!this.modal.open) return;
      const { px, py } = getPixelCoords(e.clientX, e.clientY);
      const coordLbl = document.getElementById('paint-lbl-coord');
      if (coordLbl) coordLbl.textContent = `X: ${px}, Y: ${py}`;
      this._handlePointerMove(px, py);
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) this.isPanning = false;
      const { px, py } = getPixelCoords(e.clientX, e.clientY);
      this._handlePointerUp(px, py);
    });

    this.viewport.addEventListener('touchstart', (e) => {
      if (!this.modal.open) return;
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const { px, py } = getPixelCoords(t.clientX, t.clientY);
        this._handlePointerDown(px, py);
      } else if (e.touches.length === 2) {
        this.isDrawing = false;
        this.clipMgr.isDraggingFloating = false;
        const t1 = e.touches[0], t2 = e.touches[1];
        this.touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        this.touchStartZoom = this.zoomLevel;
        const rect = this.viewport.getBoundingClientRect();
        this.touchStartCenter = [((t1.clientX + t2.clientX) / 2) - rect.left, ((t1.clientY + t2.clientY) / 2) - rect.top];
        this.touchStartPan = [this.panX, this.panY];
      }
    }, { passive: false });

    this.viewport.addEventListener('touchmove', (e) => {
      if (!this.modal.open) return;
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const { px, py } = getPixelCoords(t.clientX, t.clientY);
        const coordLbl = document.getElementById('paint-lbl-coord');
        if (coordLbl) coordLbl.textContent = `X: ${px}, Y: ${py}`;
        this._handlePointerMove(px, py);
      } else if (e.touches.length === 2 && this.touchStartDist) {
        const t1 = e.touches[0], t2 = e.touches[1];
        const curDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const newZoom = Math.max(1, Math.min(64, this.touchStartZoom * (curDist / this.touchStartDist)));
        const rect = this.viewport.getBoundingClientRect();
        const curCenterX = ((t1.clientX + t2.clientX) / 2) - rect.left;
        const curCenterY = ((t1.clientY + t2.clientY) / 2) - rect.top;
        const imgX = (this.touchStartCenter[0] - this.touchStartPan[0]) / this.touchStartZoom;
        const imgY = (this.touchStartCenter[1] - this.touchStartPan[1]) / this.touchStartZoom;
        this.zoomLevel = newZoom;
        this.panX = Math.round(curCenterX - imgX * newZoom);
        this.panY = Math.round(curCenterY - imgY * newZoom);
        this._updateTransform();
      }
    }, { passive: false });

    this.viewport.addEventListener('touchend', (e) => {
      if (!this.modal.open) return;
      if (e.touches.length === 0) {
        const t = e.changedTouches[0];
        const { px, py } = getPixelCoords(t.clientX, t.clientY);
        this._handlePointerUp(px, py);
        this.touchStartDist = null;
      }
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (!this.modal.open) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') { e.preventDefault(); this.clipMgr.copySelection(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') { e.preventDefault(); this.clipMgr.pasteClipboard(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); this.redo(); return; }

      if (this.clipMgr.handleKeyDown(e)) return;

      if (e.code === 'Enter' && this.currentTool === 'polySelect' && this.polyPoints.length >= 3) {
        e.preventDefault();
        this._finalizePolySelect();
        return;
      }
      if (e.code === 'Escape' || ((e.ctrlKey || e.metaKey) && e.code === 'KeyD')) {
        if (this.polyPoints.length > 0) {
          this.polyPoints = [];
          this._drawOverlay();
        } else {
          this.selectionMask = null;
          this._drawOverlay();
        }
        return;
      }

      for (const [tool, code] of Object.entries(this.dialogs.keybindings)) {
        if (e.code === code) {
          const btn = document.querySelector(`.paint-tool-btn[data-tool="${tool}"]`);
          if (btn) btn.click();
          break;
        }
      }
    });
  }

  _handlePointerDown(px, py) {
    if (this.clipMgr.handlePointerDown(px, py)) return;
    if (px < 0 || px >= this.width || py < 0 || py >= this.height) return;

    if (this.currentTool === 'picker') {
      const p = this.ctx.getImageData(px, py, 1, 1).data;
      if (p[3] > 0) {
        const hex = rgbToHex(p[0], p[1], p[2]);
        this.currentColor = hex;
        this._updateCurrentColorUI();
        if (this.targetType === 'mask') {
          this.app.paletteManager.addColorToMaskPalette(hex);
          this._renderPaletteUI();
        }
      }
      return;
    }

    this.isDrawing = true;
    this.lastDrawPos = [px, py];

    if (this.currentTool === 'pencil') {
      this._pushHistory();
      this._drawPixel(px, py);
    } else if (this.currentTool === 'line') {
      this.lineStart = [px, py];
    } else if (this.currentTool === 'rectFill') {
      this.rectFillStart = [px, py];
      this._drawOverlay([px, py]);
    } else if (this.currentTool === 'bucket') {
      this._pushHistory();
      floodFill(this.ctx, this.width, this.height, px, py, this.currentColor, this.selectionMask);
      this.isDrawing = false;
    } else if (this.currentTool === 'rectSelect') {
      this.selStart = [px, py];
    } else if (this.currentTool === 'polySelect') {
      if (this.polyPoints.length >= 3 && Math.hypot(px - this.polyPoints[0][0], py - this.polyPoints[0][1]) <= 1.5) {
        this._finalizePolySelect();
      } else {
        const last = this.polyPoints[this.polyPoints.length - 1];
        if (!last || last[0] !== px || last[1] !== py) this.polyPoints.push([px, py]);
        this._drawOverlay([px, py]);
      }
      this.isDrawing = false;
    } else if (this.currentTool === 'wand') {
      this.clipMgr.applySelectionMask(magicWandMask(this.ctx, this.width, this.height, px, py));
      this.isDrawing = false;
    } else if (this.currentTool === 'colorSelect') {
      this.clipMgr.applySelectionMask(colorSelectMask(this.ctx, this.width, this.height, px, py));
      this.isDrawing = false;
    } else if (this.currentTool === 'text') {
      const text = prompt('挿入するテキストを入力してください:');
      if (text) {
        const fontSize = parseInt(prompt('フォントサイズ (px):', '10'), 10) || 10;
        this._pushHistory();
        renderTextPixels(this.width, this.height, text, fontSize, px, py, (tx, ty) => this._drawPixel(tx, ty));
      }
      this.isDrawing = false;
    }
  }

  _handlePointerMove(px, py) {
    if (this.clipMgr.handlePointerMove(px, py)) return;

    if (this.isDrawing) {
      if (this.currentTool === 'pencil') {
        const [lx, ly] = this.lastDrawPos;
        drawLineContinuous(lx, ly, px, py, (x, y) => this._drawPixel(x, y));
        this.lastDrawPos = [px, py];
      } else if (this.currentTool === 'line' || this.currentTool === 'rectFill' || this.currentTool === 'rectSelect') {
        this._drawOverlay([px, py]);
      }
    } else if (this.currentTool === 'polySelect' && this.polyPoints.length > 0) {
      this._drawOverlay([px, py]);
    }
  }

  _handlePointerUp(px, py) {
    if (this.clipMgr.handlePointerUp()) return;
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.currentTool === 'line' && this.lineStart) {
      this._pushHistory();
      drawLineContinuous(this.lineStart[0], this.lineStart[1], px, py, (x, y) => this._drawPixel(x, y));
      this.lineStart = null;
      this._drawOverlay();
    } else if (this.currentTool === 'rectFill' && this.rectFillStart) {
      this._pushHistory();
      const x0 = Math.max(0, Math.min(this.rectFillStart[0], px));
      const x1 = Math.min(this.width - 1, Math.max(this.rectFillStart[0], px));
      const y0 = Math.max(0, Math.min(this.rectFillStart[1], py));
      const y1 = Math.min(this.height - 1, Math.max(this.rectFillStart[1], py));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) this._drawPixel(x, y);
      }
      this.rectFillStart = null;
      this._drawOverlay();
    } else if (this.currentTool === 'rectSelect' && this.selStart) {
      const x0 = Math.max(0, Math.min(this.selStart[0], px));
      const x1 = Math.min(this.width - 1, Math.max(this.selStart[0], px));
      const y0 = Math.max(0, Math.min(this.selStart[1], py));
      const y1 = Math.min(this.height - 1, Math.max(this.selStart[1], py));
      const newMask = new Uint8Array(this.width * this.height);
      for (let sy = y0; sy <= y1; sy++) {
        for (let sx = x0; sx <= x1; sx++) newMask[sy * this.width + sx] = 1;
      }
      this.selStart = null;
      this.clipMgr.applySelectionMask(newMask);
    }
  }

  _finalizePolySelect() {
    if (this.polyPoints.length < 3) return;
    const newMask = rasterizePolygonMask(this.width, this.height, this.polyPoints);
    this.polyPoints = [];
    this.clipMgr.applySelectionMask(newMask);
  }

  _drawPixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    if (this.selectionMask && !this.selectionMask[y * this.width + x]) return;
    this.ctx.fillStyle = this.currentColor;
    this.ctx.fillRect(x, y, 1, 1);
  }

  _drawOverlay(curPos = null) {
    this.oCtx.clearRect(0, 0, this.width, this.height);
    this.clipMgr.drawFloatingOverlay(this.oCtx, this.zoomLevel);
    drawSelectionOverlay(this.oCtx, this.width, this.height, this.selectionMask);

    if (this.currentTool === 'line' && this.lineStart && curPos) {
      this.oCtx.fillStyle = this.currentColor;
      drawLineContinuous(this.lineStart[0], this.lineStart[1], curPos[0], curPos[1], (x, y) => this.oCtx.fillRect(x, y, 1, 1));
    } else if (this.currentTool === 'rectFill' && this.rectFillStart && curPos) {
      const x0 = Math.min(this.rectFillStart[0], curPos[0]);
      const y0 = Math.min(this.rectFillStart[1], curPos[1]);
      const w = Math.abs(curPos[0] - this.rectFillStart[0]) + 1;
      const h = Math.abs(curPos[1] - this.rectFillStart[1]) + 1;
      this.oCtx.fillStyle = this.currentColor;
      this.oCtx.globalAlpha = 0.7;
      this.oCtx.fillRect(x0, y0, w, h);
      this.oCtx.globalAlpha = 1.0;
    } else if (this.currentTool === 'rectSelect' && this.selStart && curPos) {
      const x = Math.min(this.selStart[0], curPos[0]);
      const y = Math.min(this.selStart[1], curPos[1]);
      const w = Math.abs(curPos[0] - this.selStart[0]) + 1;
      const h = Math.abs(curPos[1] - this.selStart[1]) + 1;
      this.oCtx.fillStyle = 'rgba(255, 255, 0, 0.25)';
      this.oCtx.fillRect(x, y, w, h);
    }

    if (this.polyPoints.length > 0) {
      this.oCtx.lineWidth = 1 / Math.max(1, this.zoomLevel * 0.5);
      this.oCtx.strokeStyle = '#00FF66';
      this.oCtx.beginPath();
      this.oCtx.moveTo(this.polyPoints[0][0] + 0.5, this.polyPoints[0][1] + 0.5);
      for (let i = 1; i < this.polyPoints.length; i++) {
        this.oCtx.lineTo(this.polyPoints[i][0] + 0.5, this.polyPoints[i][1] + 0.5);
      }
      if (curPos) this.oCtx.lineTo(curPos[0] + 0.5, curPos[1] + 0.5);
      this.oCtx.stroke();

      if (curPos && this.polyPoints.length >= 2) {
        this.oCtx.setLineDash([1, 1]);
        this.oCtx.strokeStyle = 'rgba(0, 255, 102, 0.55)';
        this.oCtx.beginPath();
        this.oCtx.moveTo(curPos[0] + 0.5, curPos[1] + 0.5);
        this.oCtx.lineTo(this.polyPoints[0][0] + 0.5, this.polyPoints[0][1] + 0.5);
        this.oCtx.stroke();
        this.oCtx.setLineDash([]);
      }

      this.polyPoints.forEach(([vx, vy], idx) => {
        this.oCtx.fillStyle = idx === 0 ? '#00FF66' : '#FFFF00';
        this.oCtx.fillRect(vx, vy, 1, 1);
      });
    }

    drawGuidesOverlay(this.oCtx, this.width, this.height, this.zoomLevel, {
      showGrid: this.showGrid,
      gridStep: this.gridStep,
      showIsoTile: this.showIsoTile,
      isoTileW: this.isoTileW,
      isoTileH: this.isoTileH
    });
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
      toolLbl.textContent = `ツール: ${this.currentTool} | 選択モード: ${modeNames[this.selectionMode] || this.selectionMode}`;
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
