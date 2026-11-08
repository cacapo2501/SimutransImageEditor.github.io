import { rgbToHex, hexToRgb, parseSpecialColorsCsv, hsvToHex } from './color-utils.js';
import { Layer } from './layer.js';
import { HSVColorPicker } from './color-picker.js';
import { StorageAPI } from './storage-api.js';
import { RenderEngine } from './render-engine.js';
import { CanvasController } from './canvas-controller.js';
import { ProjectIO, loadImageAsync } from './project-io.js';
import { PaletteManager } from './palette-manager.js';
import { PaintEditor } from './paint-editor.js';

class AdvancedMultiplyApp {
  constructor() {
    this.storage = new StorageAPI();
    this.colorPicker = new HSVColorPicker();
    this.paletteManager = new PaletteManager(this);

    this.baseImage = null;
    this.baseName = 'base.png';
    this.baseW = 0; this.baseH = 0;
    this.baseRgb = null; this.baseAlpha = null;
    this.isBgMask = null;
    this.editableMask = null;
    this.isBaseSpecialColor = null; // ベース画像本来のSpecialColorピクセル

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
      dodge_color_hex: '#FFFFFF',
      dodge_max_strength: 100.0,
      enable_dodge: true
    };
    this.maskToneOverrides = new Map();

    this.enableBlur = true;
    this.blurRadius = 0.0;
    this.pixelSnap = true;

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

    this._bindEvents();
    this._loadDefaultSpecialColors();
    this.render();
  }

  async _loadDefaultSpecialColors() {
    const candidateFiles = ['SpecialColor.csv', 'special_colors.csv', 'SpecialColors.csv'];
    const infoLabel = document.getElementById('lbl-csv-info');
    for (const filename of candidateFiles) {
      try {
        const response = await fetch(`./${filename}`);
        if (response.ok) {
          const parsed = parseSpecialColorsCsv(await response.text());
          if (parsed.size > 0) {
            this.specialColors = parsed;
            if (infoLabel) infoLabel.textContent = `特殊色: ${this.specialColors.size}件登録済 (GitHubデフォルト)`;
            this._recomputeBaseSpecialColors();
            this.render();
            return;
          }
        }
      } catch (err) {}
    }
    if (infoLabel && this.specialColors.size === 0) infoLabel.textContent = '特殊色: 0件登録済 (手動選択可)';
  }

  // SpecialColor読み込み時にベース画像の特殊色ピクセルを再特定
  _recomputeBaseSpecialColors() {
    if (!this.baseRgb || !this.specialColors || this.specialColors.size === 0) return;
    const total = this.baseW * this.baseH;
    this.isBaseSpecialColor = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      // 背景色 (#E7FFFF または透過) は通常のSpecialColor保護から分離
      if (this.isBgMask && this.isBgMask[i]) continue;

      const r = this.baseRgb[i * 3], g = this.baseRgb[i * 3 + 1], b = this.baseRgb[i * 3 + 2];
      const hex = rgbToHex(r, g, b);
      if (this.specialColors.has(hex)) {
        this.isBaseSpecialColor[i] = 1;
        this.editableMask[i] = 0;
      }
    }
  }

  markDirty() { this.isDirty = true; }

  autoGenerateMaskFromBase() {
    if (!this.baseImage || !this.baseRgb) return;

    let minGray = 255, maxGray = 0, grayFound = false;
    for (let i = 0; i < this.baseW * this.baseH; i++) {
      if (this.isBgMask[i] || (this.isBaseSpecialColor && this.isBaseSpecialColor[i])) continue;
      const r = this.baseRgb[i * 3], g = this.baseRgb[i * 3 + 1], b = this.baseRgb[i * 3 + 2];
      if (r === g && g === b) {
        grayFound = true;
        if (r < minGray) minGray = r;
        if (r > maxGray) maxGray = r;
      }
    }
    if (!grayFound) { minGray = 0; maxGray = 255; }

    const mCanvas = document.createElement('canvas');
    mCanvas.width = this.baseW; mCanvas.height = this.baseH;
    const mCtx = mCanvas.getContext('2d');
    const mImgData = mCtx.createImageData(this.baseW, this.baseH);
    const mData = mImgData.data;

    for (let i = 0; i < this.baseW * this.baseH; i++) {
      const idx = i * 4;
      const r = this.baseRgb[i * 3], g = this.baseRgb[i * 3 + 1], b = this.baseRgb[i * 3 + 2];
      const a = this.baseAlpha[i];
      const hex = rgbToHex(r, g, b);

      if (this.isBgMask[i] || a === 0) {
        mData[idx] = 231; mData[idx + 1] = 255; mData[idx + 2] = 255; mData[idx + 3] = a;
      } else if (this.isBaseSpecialColor && this.isBaseSpecialColor[i]) {
        mData[idx] = r; mData[idx + 1] = g; mData[idx + 2] = b; mData[idx + 3] = 255;
      } else if (r === g && g === b) {
        const t = maxGray > minGray ? (r - minGray) / (maxGray - minGray) : 0.5;
        const h = Math.round(240 * (1.0 - t));
        const [mr, mg, mb] = hexToRgb(hsvToHex(h, 25, 100));
        mData[idx] = mr; mData[idx + 1] = mg; mData[idx + 2] = mb; mData[idx + 3] = 255;
      } else {
        mData[idx] = 128; mData[idx + 1] = 0; mData[idx + 2] = 0; mData[idx + 3] = 255;
      }
    }

    mCtx.putImageData(mImgData, 0, 0);
    const maskImg = new Image();
    maskImg.onload = () => {
      this.applyMaskImage(maskImg, 'auto_generated_mask.png');
      this.markDirty();
      this.render();
    };
    maskImg.src = mCanvas.toDataURL('image/png');
  }

  // ★ ベース画像の適用と SpecialColor ピクセルの特定 ★
  applyBaseImage(img, name) {
    this.baseImage = img;
    this.baseName = name || 'base.png';
    this.baseW = img.naturalWidth || img.width;
    this.baseH = img.naturalHeight || img.height;

    const off = document.createElement('canvas');
    off.width = this.baseW; off.height = this.baseH;
    const ctx = off.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const d = ctx.getImageData(0, 0, this.baseW, this.baseH).data;
    const total = this.baseW * this.baseH;
    this.baseRgb = new Uint8Array(total * 3);
    this.baseAlpha = new Uint8Array(total);
    this.isBgMask = new Uint8Array(total);
    this.editableMask = new Uint8Array(total);
    this.isBaseSpecialColor = new Uint8Array(total);

    for (let i = 0; i < total; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
      this.baseRgb[i * 3] = r; this.baseRgb[i * 3 + 1] = g; this.baseRgb[i * 3 + 2] = b;
      this.baseAlpha[i] = a;

      // 背景色 (#E7FFFF または 完全透過)
      if ((r === 231 && g === 255 && b === 255) || a === 0) {
        this.isBgMask[i] = 1;
      } else {
        const hex = rgbToHex(r, g, b);
        if (this.specialColors && this.specialColors.has(hex)) {
          this.isBaseSpecialColor[i] = 1;
        } else if (r === g && g === b) {
          this.editableMask[i] = 1;
        }
      }
    }

    document.getElementById('lbl-base-info').textContent = `ベース: ${this.baseName} (${this.baseW}x${this.baseH})`;

    if (!this.maskImage) {
      this.autoGenerateMaskFromBase();
    }
  }

  async loadBaseFromFile(file) {
    const img = await loadImageAsync(URL.createObjectURL(file));
    this.applyBaseImage(img, file.name);
    this.isDirty = false;
    this.zoomFit();
  }

  applyMaskImage(img, name) {
    this.maskImage = img;
    this.maskName = name || 'mask.png';

    const off = document.createElement('canvas');
    off.width = this.baseW; off.height = this.baseH;
    const ctx = off.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, this.baseW, this.baseH);

    const d = ctx.getImageData(0, 0, this.baseW, this.baseH).data;
    const total = this.baseW * this.baseH;
    this.maskRgb = new Uint8Array(total * 3);
    const colorCount = new Map();

    for (let i = 0; i < total; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      this.maskRgb[i * 3] = r; this.maskRgb[i * 3 + 1] = g; this.maskRgb[i * 3 + 2] = b;
      const hex = rgbToHex(r, g, b);
      colorCount.set(hex, (colorCount.get(hex) || 0) + 1);
      if (!this.maskTintColors.has(hex)) this.maskTintColors.set(hex, hex);
    }

    this.maskColors = Array.from(colorCount.entries()).sort((a, b) => b[1] - a[1]).map(([hex, count]) => ({ hex, count }));
    this._updateMaskCombos();
    this._updateTintTable();
    document.getElementById('lbl-mask-info').textContent = `マスク: ${this.maskName}`;
  }

  async loadMaskFromFile(file) {
    const img = await loadImageAsync(URL.createObjectURL(file));
    this.applyMaskImage(img, file.name);
    this.markDirty();
    this.render();
  }

  _updateMaskCombos() {
    const comboLayer = document.getElementById('mask-color-combo');
    const comboTone = document.getElementById('combo-tone-target');
    comboLayer.innerHTML = '<option value="">(全体 / マスクなし)</option>';
    comboTone.innerHTML = '<option value="__ALL__">全体 (デフォルト)</option>';
    this.maskColors.forEach(({ hex, count }) => {
      const opt = `<option value="${hex}">${hex} (${count}px)</option>`;
      comboLayer.innerHTML += opt; comboTone.innerHTML += opt;
    });
  }

  _updateTintTable() {
    const tbody = document.querySelector('#tint-table tbody');
    tbody.innerHTML = '';
    this.maskColors.forEach(({ hex }) => {
      const tintHex = this.maskTintColors.get(hex) || hex;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><span class="color-swatch" style="background:${hex}"></span> ${hex}</td>
                      <td><span class="color-swatch" style="background:${tintHex}"></span> ${tintHex}</td>`;
      tr.onclick = () => {
        document.querySelectorAll('#tint-table tr').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
        document.getElementById('sel-tint-swatch').style.backgroundColor = tintHex;
        document.getElementById('lbl-sel-tint-info').textContent = `${hex} -> ${tintHex}`;
        this.selectedMaskTint = hex;
      };
      tbody.appendChild(tr);
    });
  }

  computeFinalImage() {
    return RenderEngine.compute(this);
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
      this.ctx.fillText('ベースPNGを読み込んでください', this.canvas.width / 2, this.canvas.height / 2);
      return;
    }

    const vw = Math.round(this.baseW * this.zoomLevel);
    const vh = Math.round(this.baseH * this.zoomLevel);
    this.canvas.width = this.viewport.clientWidth;
    this.canvas.height = this.viewport.clientHeight;
    this.ctx.fillStyle = '#181818';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    let imgData;
    if (this.isEyedropper && this.maskImage) {
      const off = document.createElement('canvas'); off.width = this.baseW; off.height = this.baseH;
      const oCtx = off.getContext('2d'); oCtx.drawImage(this.maskImage, 0, 0, this.baseW, this.baseH);
      imgData = oCtx.getImageData(0, 0, this.baseW, this.baseH);
    } else {
      const pixels = this.computeFinalImage();
      if (!pixels) return;
      imgData = new ImageData(pixels, this.baseW, this.baseH);
    }

    const tc = document.createElement('canvas'); tc.width = this.baseW; tc.height = this.baseH;
    tc.getContext('2d').putImageData(imgData, 0, 0);
    this.ctx.imageSmoothingEnabled = this.zoomLevel < 1.0;
    this.ctx.drawImage(tc, this.panX, this.panY, vw, vh);

    if (this.isEyedropper) {
      this.ctx.fillStyle = '#FFFF00'; this.ctx.font = 'bold 12px sans-serif';
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

  refreshLayerList() {
    const lb = document.getElementById('layer-listbox');
    if (!lb) return;
    lb.innerHTML = '';
    this.layers.forEach((l, i) => {
      const tag = l.sourceLayer ? '[小物(参照)]' : (l.layerType === 'structure' ? '[小物]' : '[乗算]');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'layer-list-item' + (i === this.activeIdx ? ' selected' : '');
      btn.textContent = `${tag} ${l.name}`;

      const handleSelect = (e) => { e.preventDefault(); this.selectLayer(i); };
      btn.addEventListener('pointerdown', handleSelect);
      btn.addEventListener('click', handleSelect);
      lb.appendChild(btn);
    });
  }

  selectLayer(idx) {
    this.activeIdx = idx;
    const items = document.querySelectorAll('#layer-listbox .layer-list-item');
    items.forEach((item, i) => {
      if (i === idx) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });

    this._syncActiveLayerUI();
    if (idx >= 0) {
      const acc = document.getElementById('accordion-layer');
      if (acc && !acc.open) acc.open = true;
    }
    this.render();
  }

  _syncActiveLayerUI() {
    if (this.activeIdx < 0 || this.activeIdx >= this.layers.length) return;
    const l = this.layers[this.activeIdx];
    document.querySelector(`input[name="layer-type"][value="${l.layerType}"]`).checked = true;
    document.getElementById('chk-trans-e7ffff').checked = l.transparentE7ffff;
    document.getElementById('chk-fill-all').checked = l.fillAll;
    document.getElementById('slider-opacity').value = l.opacity;
    document.getElementById('lbl-opacity').textContent = `${Math.round(l.opacity * 100)}%`;
    document.getElementById('chk-layer-visible').checked = l.visible;
    document.getElementById('select-transform-mode').value = l.transformMode;
    document.getElementById('lbl-tile-x').textContent = l.tileX.toFixed(1);
    document.getElementById('lbl-tile-y').textContent = l.tileY.toFixed(1);
    if (l.targetMaskColor) {
      const hex = rgbToHex(...l.targetMaskColor);
      document.getElementById('layer-mask-swatch').style.backgroundColor = hex;
      document.getElementById('lbl-layer-mask').textContent = `適用先: ${hex}`;
      document.getElementById('mask-color-combo').value = hex;
    } else {
      document.getElementById('layer-mask-swatch').style.backgroundColor = '#FFFFFF';
      document.getElementById('lbl-layer-mask').textContent = '適用先: 全体 (マスクなし)';
      document.getElementById('mask-color-combo').value = '';
    }
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
        this._syncActiveLayerUI(); this.markDirty();
      }
      this.toggleEyedropper();
    }
  }

  _bindEvents() {
    document.getElementById('btn-load-base').onclick = async () => {
      const f = await this.storage.pickLocalFile('.png');
      if (f) this.loadBaseFromFile(f);
    };
    document.getElementById('btn-load-mask').onclick = async () => {
      const f = await this.storage.pickLocalFile('.png');
      if (f) this.loadMaskFromFile(f);
    };

    document.getElementById('btn-paint-base').onclick = () => this.paintEditor.open('base');
    document.getElementById('btn-paint-mask').onclick = () => {
      if (!this.maskImage && this.baseImage) {
        this.autoGenerateMaskFromBase();
      }
      this.paintEditor.open('mask');
    };

    document.getElementById('btn-load-folder').onclick = async () => {
      const files = await this.storage.pickLocalDirectory();
      if (files.length > 0) {
        const base = files.find(f => f.name.includes('def') || f.name.includes('base')) || files[0];
        const mask = files.find(f => f.name.includes('paint') || f.name.includes('mask'));
        await this.loadBaseFromFile(base);
        if (mask) await this.loadMaskFromFile(mask);
      }
    };
    document.getElementById('btn-google-drive').onclick = async () => {
      const apiKey = document.getElementById('gdrive-api-key').value.trim();
      const clientId = document.getElementById('gdrive-client-id').value.trim();
      const res = await this.storage.openGoogleDrivePicker(apiKey, clientId);
      if (res) {
        const file = new File([res.blob], res.name, { type: res.blob.type });
        if (res.name.endsWith('.proj.json') || res.name.endsWith('.json')) ProjectIO.load(this, file);
        else if (res.name.includes('mask') || res.name.includes('paint')) this.loadMaskFromFile(file);
        else this.loadBaseFromFile(file);
      }
    };

    document.getElementById('btn-add-multiply').onclick = () => this._addLayer('multiply');
    document.getElementById('btn-add-structure').onclick = () => this._addLayer('structure');
    document.getElementById('btn-copy-layer').onclick = () => this._copyLayer();
    document.getElementById('btn-del-layer').onclick = () => this._delLayer();

    document.querySelectorAll('input[name="layer-type"]').forEach(r => {
      r.onchange = (e) => {
        if (this.activeIdx >= 0) {
          this.layers[this.activeIdx].layerType = e.target.value;
          this.refreshLayerList(); this.markDirty(); this.render();
        }
      };
    });
    document.getElementById('chk-trans-e7ffff').onchange = (e) => {
      if (this.activeIdx >= 0) { this.layers[this.activeIdx].transparentE7ffff = e.target.checked; this.markDirty(); this.render(); }
    };
    document.getElementById('chk-fill-all').onchange = (e) => {
      if (this.activeIdx >= 0) { this.layers[this.activeIdx].fillAll = e.target.checked; this.markDirty(); this.render(); }
    };
    document.getElementById('select-transform-mode').onchange = (e) => {
      if (this.activeIdx >= 0) {
        this.layers[this.activeIdx].transformMode = e.target.value;
        this.markDirty(); this.render();
      }
    };
    document.getElementById('slider-opacity').oninput = (e) => {
      if (this.activeIdx >= 0) {
        this.layers[this.activeIdx].opacity = parseFloat(e.target.value);
        document.getElementById('lbl-opacity').textContent = `${Math.round(e.target.value * 100)}%`;
        this.markDirty(); this.render();
      }
    };
    document.getElementById('chk-layer-visible').onchange = (e) => {
      if (this.activeIdx >= 0) { this.layers[this.activeIdx].visible = e.target.checked; this.markDirty(); this.render(); }
    };

    document.querySelectorAll('.btn-step').forEach(btn => {
      btn.onclick = () => {
        if (this.activeIdx < 0) return;
        const l = this.layers[this.activeIdx];
        const d = parseFloat(btn.dataset.delta);
        if (btn.dataset.axis === 'x') l.tileX = Math.max(0.01, Math.round((l.tileX + d) * 100) / 100);
        else l.tileY = Math.max(0.01, Math.round((l.tileY + d) * 100) / 100);
        document.getElementById('lbl-tile-x').textContent = l.tileX.toFixed(1);
        document.getElementById('lbl-tile-y').textContent = l.tileY.toFixed(1);
        this.markDirty(); this.render();
      };
    });

    document.getElementById('chk-enable-blur').onchange = (e) => { this.enableBlur = e.target.checked; this.markDirty(); this.render(); };
    document.getElementById('slider-blur').oninput = (e) => {
      this.blurRadius = parseFloat(e.target.value);
      document.getElementById('lbl-blur-radius').textContent = `${this.blurRadius.toFixed(2)}px`;
      this.markDirty(); this.render();
    };
    document.querySelectorAll('.btn-blur-step').forEach(btn => {
      btn.onclick = () => {
        this.blurRadius = Math.max(0, Math.min(10, Math.round((this.blurRadius + parseFloat(btn.dataset.delta)) * 100) / 100));
        document.getElementById('slider-blur').value = this.blurRadius;
        document.getElementById('lbl-blur-radius').textContent = `${this.blurRadius.toFixed(2)}px`;
        this.markDirty(); this.render();
      };
    });

    document.getElementById('chk-pixel-snap').onchange = (e) => { this.pixelSnap = e.target.checked; };
    document.getElementById('btn-snap-now').onclick = () => {
      if (this.activeIdx >= 0) {
        this.layers[this.activeIdx].corners = this.layers[this.activeIdx].corners.map(([x, y]) => [Math.round(x), Math.round(y)]);
        this.markDirty(); this.render();
      }
    };

    document.getElementById('btn-eyedropper').onclick = () => this.toggleEyedropper();
    document.getElementById('mask-color-combo').onchange = (e) => {
      if (this.activeIdx < 0) return;
      this.layers[this.activeIdx].targetMaskColor = e.target.value ? hexToRgb(e.target.value) : null;
      this._syncActiveLayerUI(); this.markDirty(); this.render();
    };
    document.getElementById('btn-clear-mask').onclick = () => {
      if (this.activeIdx < 0) return;
      this.layers[this.activeIdx].targetMaskColor = null;
      this._syncActiveLayerUI(); this.markDirty(); this.render();
    };

    document.getElementById('combo-tone-target').onchange = (e) => this.onToneTargetChanged(e.target.value);
    document.getElementById('chk-tone-override').onchange = (e) => {
      const sel = document.getElementById('combo-tone-target').value;
      if (sel !== '__ALL__') {
        if (!this.maskToneOverrides.has(sel)) this.maskToneOverrides.set(sel, { ...this.globalTone, enabled: false });
        this.maskToneOverrides.get(sel).enabled = e.target.checked;
        this.markDirty(); this.render();
      }
    };

    document.getElementById('slider-min-dark').oninput = (e) => {
      this._getActiveTone().min_dark_pct = parseFloat(e.target.value);
      document.getElementById('lbl-min-dark').textContent = `${parseFloat(e.target.value).toFixed(1)}%`;
      this.markDirty(); this.render();
    };
    document.getElementById('slider-max-bright').oninput = (e) => {
      this._getActiveTone().max_bright_pct = parseFloat(e.target.value);
      document.getElementById('lbl-max-bright').textContent = `${parseFloat(e.target.value).toFixed(1)}%`;
      this.markDirty(); this.render();
    };
    document.getElementById('chk-enable-dodge').onchange = (e) => {
      this._getActiveTone().enable_dodge = e.target.checked;
      this.markDirty(); this.render();
    };
    document.getElementById('slider-dodge-strength').oninput = (e) => {
      this._getActiveTone().dodge_max_strength = parseFloat(e.target.value);
      document.getElementById('lbl-dodge-strength').textContent = `${parseFloat(e.target.value).toFixed(1)}%`;
      this.markDirty(); this.render();
    };

    document.getElementById('btn-pick-dark').onclick = async () => {
      const cfg = this._getActiveTone();
      const col = await this.colorPicker.open(cfg.dark_color_hex);
      if (col) {
        cfg.dark_color_hex = col;
        document.getElementById('dark-color-swatch').style.backgroundColor = col;
        document.getElementById('lbl-dark-color').textContent = col;
        this.markDirty(); this.render();
      }
    };
    document.getElementById('btn-reset-dark').onclick = () => {
      const cfg = this._getActiveTone();
      cfg.dark_color_hex = '#000018';
      document.getElementById('dark-color-swatch').style.backgroundColor = '#000018';
      document.getElementById('lbl-dark-color').textContent = '#000018';
      this.markDirty(); this.render();
    };
    document.getElementById('btn-pick-dodge').onclick = async () => {
      const cfg = this._getActiveTone();
      const col = await this.colorPicker.open(cfg.dodge_color_hex);
      if (col) {
        cfg.dodge_color_hex = col;
        document.getElementById('dodge-color-swatch').style.backgroundColor = col;
        this.markDirty(); this.render();
      }
    };
    document.getElementById('btn-pick-tint').onclick = async () => {
      if (!this.selectedMaskTint) return alert('マスク色を一覧から選択してください。');
      const cur = this.maskTintColors.get(this.selectedMaskTint) || this.selectedMaskTint;
      const col = await this.colorPicker.open(cur);
      if (col) {
        this.maskTintColors.set(this.selectedMaskTint, col);
        this._updateTintTable(); this.markDirty(); this.render();
      }
    };
    document.getElementById('btn-reset-tint').onclick = () => {
      if (!this.selectedMaskTint) return;
      this.maskTintColors.set(this.selectedMaskTint, this.selectedMaskTint);
      this._updateTintTable(); this.markDirty(); this.render();
    };
    document.getElementById('btn-reset-all-tints').onclick = () => {
      this.maskColors.forEach(({ hex }) => this.maskTintColors.set(hex, hex));
      this._updateTintTable(); this.markDirty(); this.render();
    };

    document.getElementById('file-csv').onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const r = new FileReader();
        r.onload = () => {
          this.specialColors = parseSpecialColorsCsv(r.result);
          document.getElementById('lbl-csv-info').textContent = `特殊色: ${this.specialColors.size}件登録済 (手動選択)`;
          this._recomputeBaseSpecialColors();
          this.markDirty(); this.render();
        };
        r.readAsText(file);
      }
    };

    document.getElementById('btn-zoom-in').onclick = () => this.setZoom(this.zoomLevel * 1.25);
    document.getElementById('btn-zoom-out').onclick = () => this.setZoom(this.zoomLevel * 0.8);
    document.getElementById('btn-zoom-reset').onclick = () => this.setZoom(1.0);
    document.getElementById('btn-zoom-fit').onclick = () => this.zoomFit();

    document.getElementById('btn-save-proj').onclick = () => ProjectIO.save(this);
    document.getElementById('btn-save-proj-as').onclick = () => ProjectIO.save(this);
    document.getElementById('btn-load-proj').onclick = async () => {
      const f = await this.storage.pickLocalFile('.json');
      if (f) ProjectIO.load(this, f);
    };
    document.getElementById('btn-save-png').onclick = () => ProjectIO.exportPng(this);
  }

  async _addLayer(layerType) {
    if (!this.baseImage) return alert('先にベース画像を読み込んでください。');
    const file = await this.storage.pickLocalFile('.png');
    if (!file) return;
    const img = await loadImageAsync(URL.createObjectURL(file));
    const l = new Layer({
      name: file.name, imageElement: img,
      canvasW: this.baseW, canvasH: this.baseH, layerType: layerType
    });
    this.layers.push(l);
    this.refreshLayerList();
    this.selectLayer(this.layers.length - 1);
    this.markDirty(); this.render();
  }

  _copyLayer() {
    if (this.activeIdx < 0) return;
    const src = this.layers[this.activeIdx];
    const master = src.sourceLayer || src;
    const copy = new Layer({
      name: master.name, imageElement: master.imageElement,
      canvasW: this.baseW, canvasH: this.baseH,
      corners: src.corners.map(([x, y]) => [x + 10, y + 10]),
      sourceLayer: master, fillAll: master.fillAll, transparentE7ffff: master.transparentE7ffff
    });
    this.layers.push(copy);
    this.refreshLayerList();
    this.selectLayer(this.layers.length - 1);
    this.markDirty(); this.render();
  }

  _delLayer() {
    if (this.activeIdx < 0) return;
    this.layers.splice(this.activeIdx, 1);
    this.refreshLayerList();
    this.selectLayer(Math.min(this.activeIdx, this.layers.length - 1));
    this.markDirty(); this.render();
  }

  _getActiveTone() {
    const sel = document.getElementById('combo-tone-target').value;
    if (sel === '__ALL__') return this.globalTone;
    if (!this.maskToneOverrides.has(sel)) this.maskToneOverrides.set(sel, { ...this.globalTone, enabled: false });
    return this.maskToneOverrides.get(sel);
  }

  onToneTargetChanged(sel) {
    const chk = document.getElementById('chk-tone-override');
    if (sel === '__ALL__') {
      chk.disabled = true; chk.checked = false;
      this._loadToneToUI(this.globalTone);
    } else {
      chk.disabled = false;
      const cfg = this.maskToneOverrides.get(sel) || { ...this.globalTone, enabled: false };
      chk.checked = cfg.enabled;
      this._loadToneToUI(cfg);
    }
  }

  _loadToneToUI(cfg) {
    document.getElementById('dark-color-swatch').style.backgroundColor = cfg.dark_color_hex;
    document.getElementById('lbl-dark-color').textContent = cfg.dark_color_hex;
    document.getElementById('slider-min-dark').value = cfg.min_dark_pct;
    document.getElementById('lbl-min-dark').textContent = `${cfg.min_dark_pct.toFixed(1)}%`;
    document.getElementById('slider-max-bright').value = cfg.max_bright_pct;
    document.getElementById('lbl-max-bright').textContent = `${cfg.max_bright_pct.toFixed(1)}%`;
    document.getElementById('chk-enable-dodge').checked = cfg.enable_dodge;
    document.getElementById('dodge-color-swatch').style.backgroundColor = cfg.dodge_color_hex;
    document.getElementById('slider-dodge-strength').value = cfg.dodge_max_strength;
    document.getElementById('lbl-dodge-strength').textContent = `${cfg.dodge_max_strength.toFixed(1)}%`;
  }
}

window.addEventListener('DOMContentLoaded', () => { new AdvancedMultiplyApp(); });