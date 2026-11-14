import { parseSpecialColorsCsv } from './color-utils.js';
import { HSVColorPicker } from './color-picker.js';
import { StorageAPI } from './storage-api.js';
import { RenderEngine } from './render-engine.js';
import { CanvasController } from './canvas-controller.js';
import { loadImageAsync } from './project-io.js';
import { PaletteManager } from './palette-manager.js';
import { PaintEditor } from './paint-editor.js';
import { MaskGenerator } from './mask-generator.js';
import { LayerManager } from './layer-manager.js';
import { ToneTintController } from './tone-tint-controller.js';
import { DeftileBuilder } from './deftile-builder.js';
import { ImageIOController } from './image-io-controller.js';
import { drawSimutransIsoTiles } from './paint-algorithms.js';
import { renderSidebarUI } from './ui-sidebar.js';
import { renderPaintModalUI } from './ui-paint-modal.js';
import { renderSubModalsUI } from './ui-sub-modals.js';
import { renderDeftileModalUI } from './ui-deftile-modal.js';

function safePickFile(accept = '.png') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      document.body.removeChild(input);
      resolve(file || null);
    };

    window.addEventListener('focus', () => {
      setTimeout(() => {
        if (input.parentNode) {
          document.body.removeChild(input);
          resolve(null);
        }
      }, 500);
    }, { once: true });

    input.click();
  });
}

class AdvancedMultiplyApp {
  constructor() {
    renderSidebarUI();
    renderPaintModalUI();
    renderSubModalsUI();
    renderDeftileModalUI();

    this.storage = new StorageAPI();
    this.colorPicker = new HSVColorPicker();
    this.paletteManager = new PaletteManager(this);

    this.baseImage = null;
    this.baseName = 'base.png';
    this.baseW = 0; this.baseH = 0;
    this.baseRgb = null; this.baseAlpha = null;
    this.isBgMask = null;
    this.editableMask = null;
    this.isBaseSpecialColor = null;

    this.maskImage = null;
    this.maskName = 'mask.png';
    this.maskRgb = null;
    this.maskColors = [];
    this.maskTintColors = new Map();
    this.enableMaskTint = true;

    this.specialColors = new Set();
    this.layers = [];
    this.activeIdx = -1;

    this.globalTone = {
      dark_color_hex: '#000018',
      min_dark_pct: 0.0,
      max_bright_pct: 100.0,
      alpha_pct: 100.0,
      dodge_color_hex: '#FFFFFF',
      dodge_max_strength: 100.0,
      enable_dodge: true
    };
    this.maskToneOverrides = new Map();

    this.windowDarken = {
      enabled: false,
      ratio_pct: 50,
      seed: 12345,
      include_all_special: false
    };

    this.enableBlur = true;
    this.blurRadius = 0.0;
    this.pixelSnap = true;

    this.showMainIsoTile = false;
    this.mainIsoTileW = 64;
    this.mainIsoTileH = 32;
    this.mainIsoColor = '#FFAA00';

    this.zoomLevel = 1.0;
    this.panX = 60; this.panY = 60;
    this.isPanning = false; this.spacePressed = false;
    this.dragMode = null; this.isEyedropper = false;
    this.isDirty = false;

    this.canvas = document.getElementById('main-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.viewport = document.getElementById('canvas-viewport');

    this.canvasCtrl = new CanvasController(this);
    this.paintEditor = new PaintEditor(this);
    this.layerManager = new LayerManager(this, safePickFile);
    this.toneTintCtrl = new ToneTintController(this);
    this.deftileBuilder = new DeftileBuilder(this, safePickFile);
    this.imageIOCtrl = new ImageIOController(this, safePickFile);

    this._bindZoomAndGuideEvents();
    this.imageIOCtrl.bindAll();
    this.layerManager.bindEvents();
    this.toneTintCtrl.bindEvents();
    this._loadDefaultSpecialColors();
    this.render();
  }

  async _loadDefaultSpecialColors() {
    const candidateFiles = [
      'special_colors.csv',
      'SpecialColor.csv',
      'SpecialColors.csv',
      'special_color.csv',
      'data/special_colors.csv',
      'csv/special_colors.csv'
    ];
    const infoLabel = document.getElementById('lbl-csv-info');

    for (const filename of candidateFiles) {
      try {
        const response = await fetch(`./${filename}`, { cache: 'no-cache' });
        if (response.ok) {
          const text = await response.text();
          if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) continue;

          const parsed = parseSpecialColorsCsv(text);
          if (parsed.size > 0) {
            this.specialColors = parsed;
            if (infoLabel) {
              infoLabel.textContent = `特殊色: ${this.specialColors.size}件登録済 (${filename})`;
            }
            this.paletteManager.generateBasePalette();
            MaskGenerator.recomputeBaseSpecialColors(this);
            this.render();
            return;
          }
        }
      } catch (err) {}
    }

    if (infoLabel && this.specialColors.size === 0) {
      infoLabel.textContent = '特殊色: 0件登録済 (ルートに special_colors.csv 未検出 / 手動選択可)';
    }
  }

  markDirty() { this.isDirty = true; }

  resetMaskState() {
    this.maskImage = null;
    this.maskName = 'mask.png';
    this.maskRgb = null;
    this.maskColors = [];
    this.maskTintColors.clear();
    this.maskToneOverrides.clear();

    this.layers.forEach(l => {
      l.targetMaskColor = null;
      l.excludeMaskColor = false;
    });
    this.layerManager.syncActiveUI();
    this.toneTintCtrl.updateMaskCombos();
    this.toneTintCtrl.updateTintTable();

    const info = document.getElementById('lbl-mask-info');
    if (info) info.textContent = 'マスク: 未読込';
  }

  applyBaseImage(img, name, { resetMask = true } = {}) {
    if (resetMask) {
      this.resetMaskState();
    }
    MaskGenerator.analyzeBaseImage(this, img, name);
    if (!this.maskImage) {
      MaskGenerator.generateFromBase(this);
    }
  }

  async loadBaseFromFile(file) {
    if (!file) return;
    const img = await loadImageAsync(URL.createObjectURL(file));
    this.applyBaseImage(img, file.name, { resetMask: true });
    this.isDirty = false;
    this.zoomFit();
  }

  createNewBlankBaseImage(width, height, openPaint = true) {
    const w = Math.max(1, Math.min(2048, parseInt(width, 10) || 64));
    const h = Math.max(1, Math.min(2048, parseInt(height, 10) || 96));

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#E7FFFF';
    ctx.fillRect(0, 0, w, h);

    this.applyBaseImage(c, `new_${w}x${h}.png`, { resetMask: true });
    this.isDirty = false;
    this.zoomFit();
    this.render();

    if (openPaint) {
      this.paintEditor.open('base');
    }
  }

  applyMaskImage(img, name) {
    MaskGenerator.analyzeMaskImage(this, img, name);
    this.toneTintCtrl.updateMaskCombos();
    this.toneTintCtrl.updateTintTable();
  }

  async loadMaskFromFile(file) {
    if (!file) return;
    if (!this.baseImage) {
      alert('先にベース画像を開くか、新規作成してください。');
      return;
    }
    const img = await loadImageAsync(URL.createObjectURL(file));
    this.applyMaskImage(img, file.name);
    this.markDirty();
    this.render();
  }

  refreshLayerList() { this.layerManager.refreshList(); }
  selectLayer(idx) { this.layerManager.select(idx); }
  onToneTargetChanged(sel) { this.toneTintCtrl.onToneTargetChanged(sel); }
  computeFinalImage() { return RenderEngine.compute(this); }

  _drawCheckerboard(x, y, w, h) {
    const step = 8;
    this.ctx.fillStyle = '#2A2A2A';
    this.ctx.fillRect(x, y, w, h);
    this.ctx.fillStyle = '#383838';
    for (let py = y; py < y + h; py += step) {
      const rowEven = Math.floor((py - y) / step) % 2 === 0;
      for (let px = x + (rowEven ? 0 : step); px < x + w; px += step * 2) {
        this.ctx.fillRect(px, py, Math.min(step, x + w - px), Math.min(step, y + h - py));
      }
    }
  }

  render() {
    if (!this.baseW || !this.baseH) {
      this.canvas.width = this.viewport.clientWidth;
      this.canvas.height = this.viewport.clientHeight;
      this.ctx.fillStyle = '#202020';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = '#666';
      this.ctx.font = '14px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('ベースPNGを読み込むか、「🆕 新規作成」/「🏗️ DEFTILEから生成」を押してください', this.canvas.width / 2, this.canvas.height / 2);
      return;
    }

    const vw = Math.round(this.baseW * this.zoomLevel);
    const vh = Math.round(this.baseH * this.zoomLevel);
    this.canvas.width = this.viewport.clientWidth;
    this.canvas.height = this.viewport.clientHeight;
    this.ctx.fillStyle = '#181818';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawCheckerboard(this.panX, this.panY, vw, vh);

    let imgData;
    if (this.isEyedropper && this.maskImage) {
      const off = document.createElement('canvas');
      off.width = this.baseW;
      off.height = this.baseH;
      const oCtx = off.getContext('2d');
      oCtx.drawImage(this.maskImage, 0, 0, this.baseW, this.baseH);
      imgData = oCtx.getImageData(0, 0, this.baseW, this.baseH);
    } else {
      const pixels = this.computeFinalImage();
      if (!pixels) return;
      imgData = new ImageData(pixels, this.baseW, this.baseH);
    }

    const tc = document.createElement('canvas');
    tc.width = this.baseW;
    tc.height = this.baseH;
    tc.getContext('2d').putImageData(imgData, 0, 0);
    this.ctx.imageSmoothingEnabled = this.zoomLevel < 1.0;
    this.ctx.drawImage(tc, this.panX, this.panY, vw, vh);

    if (this.showMainIsoTile) {
      const gc = document.createElement('canvas');
      gc.width = this.baseW;
      gc.height = this.baseH;
      const gCtx = gc.getContext('2d');
      drawSimutransIsoTiles(gCtx, this.baseW, this.baseH, this.mainIsoTileW, this.mainIsoTileH, this.mainIsoColor);
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(gc, this.panX, this.panY, vw, vh);
    }

    if (this.isEyedropper) {
      this.ctx.fillStyle = '#FFFF00';
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.fillText('【マスク画像表示中】適用したい色をクリックまたはタップしてください (Escでキャンセル)', this.panX + 10, this.panY - 12);
    } else if (this.activeIdx >= 0) {
      RenderEngine.drawOverlay(this.ctx, this.layers[this.activeIdx], this.zoomLevel, this.panX, this.panY);
    }
  }

  setZoom(z, center) {
    const newZ = Math.max(0.1, Math.min(32.0, z));
    if (center && this.baseW) {
      const [cx, cy] = center;
      this.panX = cx - ((cx - this.panX) / this.zoomLevel) * newZ;
      this.panY = cy - ((cy - this.panY) / this.zoomLevel) * newZ;
    }
    this.zoomLevel = newZ;
    document.getElementById('lbl-zoom').textContent = `${Math.round(this.zoomLevel * 100)}%`;
    this.render();
  }

  zoomFit() {
    if (!this.baseW || !this.baseH) return;
    const s = Math.min((this.viewport.clientWidth - 100) / this.baseW, (this.viewport.clientHeight - 100) / this.baseH, 4.0);
    this.zoomLevel = Math.max(0.2, s);
    this.panX = (this.viewport.clientWidth - this.baseW * this.zoomLevel) / 2;
    this.panY = (this.viewport.clientHeight - this.baseH * this.zoomLevel) / 2;
    document.getElementById('lbl-zoom').textContent = `${Math.round(this.zoomLevel * 100)}%`;
    this.render();
  }

  toggleEyedropper() {
    this.isEyedropper = !this.isEyedropper;
    document.getElementById('btn-eyedropper').textContent = this.isEyedropper ? '❌ スポイト中止 (プレビューに戻る)' : '🎯 スポイトで選択 (マスク画像を表示)';
    document.getElementById('status-bar').textContent = this.isEyedropper ? '【マスク画像表示中】適用したい色をクリックまたはタップしてください (Escでキャンセル)' : '準備完了 | スポイト: OFF';
    this.render();
  }

  pickColorFromCoords(clientX, clientY) {
    if (!this.maskRgb) return;
    const rect = this.viewport.getBoundingClientRect();
    const ix = Math.floor((clientX - rect.left - this.panX) / this.zoomLevel);
    const iy = Math.floor((clientY - rect.top - this.panY) / this.zoomLevel);
    if (ix >= 0 && ix < this.baseW && iy >= 0 && iy < this.baseH) {
      const idx = (iy * this.baseW + ix) * 3;
      if (this.activeIdx >= 0) {
        this.layers[this.activeIdx].targetMaskColor = [this.maskRgb[idx], this.maskRgb[idx + 1], this.maskRgb[idx + 2]];
        this.layerManager.syncActiveUI();
        this.markDirty();
      }
      this.toggleEyedropper();
    }
  }

  _bindZoomAndGuideEvents() {
    document.getElementById('btn-zoom-in').onclick = () => this.setZoom(this.zoomLevel * 1.25);
    document.getElementById('btn-zoom-out').onclick = () => this.setZoom(this.zoomLevel * 0.8);
    document.getElementById('btn-zoom-reset').onclick = () => this.setZoom(1.0);
    document.getElementById('btn-zoom-fit').onclick = () => this.zoomFit();

    const chkIso = document.getElementById('chk-main-iso');
    const inpIsoW = document.getElementById('inp-main-iso-w');
    const inpIsoH = document.getElementById('inp-main-iso-h');
    const inpIsoColor = document.getElementById('inp-main-iso-color');

    if (chkIso) chkIso.onchange = (e) => { this.showMainIsoTile = e.target.checked; this.render(); };
    if (inpIsoW) {
      inpIsoW.oninput = (e) => {
        const w = Math.max(4, Math.min(512, parseInt(e.target.value, 10) || 64));
        this.mainIsoTileW = w;
        const autoH = Math.max(2, Math.round(w / 2));
        this.mainIsoTileH = autoH;
        if (inpIsoH) inpIsoH.value = autoH;
        this.render();
      };
    }
    if (inpIsoH) inpIsoH.oninput = (e) => { this.mainIsoTileH = Math.max(2, Math.min(512, parseInt(e.target.value, 10) || 32)); this.render(); };
    if (inpIsoColor) inpIsoColor.oninput = (e) => { this.mainIsoColor = e.target.value; this.render(); };
  }
}

window.addEventListener('DOMContentLoaded', () => { new AdvancedMultiplyApp(); });