import { rgbToHex, hexToRgb, parseSpecialColorsCsv, resolveSpecialColorConflicts } from './color-utils.js';
import { applyProtectedBlur } from './transform.js';
import { Layer } from './layer.js';
import { HSVColorPicker } from './color-picker.js';
import { StorageAPI } from './storage-api.js';

// 多角形（4頂点）の内外判定 (Ray-casting)
function pointInPolygon(point, vs) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function imageToPngDataUrl(img) {
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}

function loadImageAsync(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

class AdvancedMultiplyApp {
  constructor() {
    this.storage = new StorageAPI();
    this.colorPicker = new HSVColorPicker();

    this.baseImage = null;
    this.baseName = 'base.png';
    this.baseW = 0; this.baseH = 0;
    this.baseRgb = null; this.baseAlpha = null;
    this.isBgMask = null; this.editableMask = null;

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

    // タッチ・ピンチ操作ステート
    this.touchStartDist = null;
    this.touchStartZoom = 1.0;
    this.touchStartPan = [0, 0];
    this.touchStartCenter = [0, 0];

    this.canvas = document.getElementById('main-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.viewport = document.getElementById('canvas-viewport');

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
          const text = await response.text();
          const parsed = parseSpecialColorsCsv(text);
          if (parsed.size > 0) {
            this.specialColors = parsed;
            if (infoLabel) infoLabel.textContent = `特殊色: ${this.specialColors.size}件登録済 (GitHubデフォルト)`;
            this.render();
            return;
          }
        }
      } catch (err) {}
    }
    if (infoLabel && this.specialColors.size === 0) {
      infoLabel.textContent = '特殊色: 0件登録済 (手動選択可)';
    }
  }

  markDirty() { this.isDirty = true; }

  _applyBaseImage(img, name) {
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

    for (let i = 0; i < total; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
      this.baseRgb[i * 3] = r; this.baseRgb[i * 3 + 1] = g; this.baseRgb[i * 3 + 2] = b;
      this.baseAlpha[i] = a;
      if ((r === 231 && g === 255 && b === 255) || a === 0) this.isBgMask[i] = 1;
      if (r === g && g === b && this.isBgMask[i] === 0) this.editableMask[i] = 1;
    }

    document.getElementById('lbl-base-info').textContent = `ベース: ${this.baseName} (${this.baseW}x${this.baseH})`;
  }

  async loadBaseFromFile(file) {
    const url = URL.createObjectURL(file);
    const img = await loadImageAsync(url);
    this._applyBaseImage(img, file.name);
    this.isDirty = false;
    this.zoomFit();
  }

  _applyMaskImage(img, name) {
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

    this.maskColors = Array.from(colorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([hex, count]) => ({ hex, count }));

    this._updateMaskCombos();
    this._updateTintTable();
    document.getElementById('lbl-mask-info').textContent = `マスク: ${this.maskName}`;
  }

  async loadMaskFromFile(file) {
    const url = URL.createObjectURL(file);
    const img = await loadImageAsync(url);
    this._applyMaskImage(img, file.name);
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
    if (!this.baseRgb) return null;
    const total = this.baseW * this.baseH;
    let multAccum = new Float32Array(total).fill(1.0);

    this.layers.forEach(layer => {
      if (layer.visible && layer.layerType === 'multiply') {
        const mMap = layer.getMultiplierMap(this.baseW, this.baseH, this.maskRgb);
        for (let i = 0; i < total; i++) multAccum[i] *= mMap[i];
      }
    });

    const outRgb = new Float32Array(total * 3);
    const outAlpha = new Float32Array(total);

    for (let i = 0; i < total; i++) {
      outAlpha[i] = this.baseAlpha[i] / 255.0;
      if (this.editableMask[i]) {
        const bg = this.baseRgb[i * 3] / 255.0;
        const mVal = multAccum[i];
        let cfg = this.globalTone;
        if (this.maskRgb) {
          const mHex = rgbToHex(this.maskRgb[i * 3], this.maskRgb[i * 3 + 1], this.maskRgb[i * 3 + 2]);
          const oCfg = this.maskToneOverrides.get(mHex);
          if (oCfg && oCfg.enabled) cfg = oCfg;
        }
        const lMin = cfg.min_dark_pct / 100.0;
        let lMax = cfg.max_bright_pct / 100.0;
        if (lMax <= lMin) lMax = lMin + 0.001;
        const u = Math.min(1.0, Math.max(0.0, (bg - lMin) / (lMax - lMin)));
        const [dr, dg, db] = hexToRgb(cfg.dark_color_hex).map(v => v / 255);
        let tr = ((1.0 - u) * dr + u) * mVal;
        let tg = ((1.0 - u) * dg + u) * mVal;
        let tb = ((1.0 - u) * db + u) * mVal;
        if (this.enableMaskTint && this.maskRgb) {
          const mHex = rgbToHex(this.maskRgb[i * 3], this.maskRgb[i * 3 + 1], this.maskRgb[i * 3 + 2]);
          const tintHex = this.maskTintColors.get(mHex) || mHex;
          const [trCol, tgCol, tbCol] = hexToRgb(tintHex).map(v => v / 255);
          tr *= trCol; tg *= tgCol; tb *= tbCol;
        }
        outRgb[i * 3] = tr; outRgb[i * 3 + 1] = tg; outRgb[i * 3 + 2] = tb;
      } else {
        outRgb[i * 3] = this.baseRgb[i * 3] / 255.0;
        outRgb[i * 3 + 1] = this.baseRgb[i * 3 + 1] / 255.0;
        outRgb[i * 3 + 2] = this.baseRgb[i * 3 + 2] / 255.0;
      }
    }

    for (let i = 0; i < total; i++) {
      if (!this.editableMask[i]) continue;
      const bg = this.baseRgb[i * 3] / 255.0;
      let cfg = this.globalTone;
      if (this.maskRgb) {
        const mHex = rgbToHex(this.maskRgb[i * 3], this.maskRgb[i * 3 + 1], this.maskRgb[i * 3 + 2]);
        const oCfg = this.maskToneOverrides.get(mHex);
        if (oCfg && oCfg.enabled) cfg = oCfg;
      }
      if (cfg.enable_dodge) {
        const lMax = cfg.max_bright_pct / 100.0;
        if (lMax < 1.0 && bg > lMax) {
          const t = (bg - lMax) / (1.0 - lMax + 1e-6);
          const s = Math.min(1.0, Math.max(0.0, t * (cfg.dodge_max_strength / 100.0)));
          const [br, bgCol, bb] = hexToRgb(cfg.dodge_color_hex).map(v => v / 255);
          outRgb[i * 3] = (1.0 - s) * outRgb[i * 3] + s * br;
          outRgb[i * 3 + 1] = (1.0 - s) * outRgb[i * 3 + 1] + s * bgCol;
          outRgb[i * 3 + 2] = (1.0 - s) * outRgb[i * 3 + 2] + s * bb;
        }
      }
    }

    this.layers.forEach(layer => {
      if (layer.visible && layer.layerType === 'structure') {
        const sData = layer.getWarpedStructure(this.baseW, this.baseH, this.maskRgb);
        if (!sData) return;
        for (let i = 0; i < total; i++) {
          const sa = sData[i * 4 + 3];
          if (sa > 0.001) {
            if (this.isBgMask[i]) {
              outRgb[i * 3] = 192 / 255; outRgb[i * 3 + 1] = 192 / 255; outRgb[i * 3 + 2] = 192 / 255;
              outAlpha[i] = 0.0;
            } else {
              outRgb[i * 3] = outRgb[i * 3] * (1.0 - sa) + sData[i * 4] * sa;
              outRgb[i * 3 + 1] = outRgb[i * 3 + 1] * (1.0 - sa) + sData[i * 4 + 1] * sa;
              outRgb[i * 3 + 2] = outRgb[i * 3 + 2] * (1.0 - sa) + sData[i * 4 + 2] * sa;
              outAlpha[i] = Math.min(1.0, outAlpha[i] + sa * (1.0 - outAlpha[i]));
            }
          }
        }
      }
    });

    if (this.enableBlur && this.blurRadius > 0.001) {
      const invalid = new Uint8Array(total);
      for (let i = 0; i < total; i++) {
        if (this.isBgMask[i]) invalid[i] = 1;
        else {
          const hex = rgbToHex(outRgb[i * 3] * 255, outRgb[i * 3 + 1] * 255, outRgb[i * 3 + 2] * 255);
          if (this.specialColors.has(hex)) invalid[i] = 1;
        }
      }
      const blurred = applyProtectedBlur(outRgb, this.baseW, this.baseH, this.blurRadius, invalid);
      for (let i = 0; i < outRgb.length; i++) outRgb[i] = blurred[i];
    }

    const res = new Uint8ClampedArray(total * 4);
    for (let i = 0; i < total; i++) {
      res[i * 4] = Math.round(outRgb[i * 3] * 255);
      res[i * 4 + 1] = Math.round(outRgb[i * 3 + 1] * 255);
      res[i * 4 + 2] = Math.round(outRgb[i * 3 + 2] * 255);
      res[i * 4 + 3] = Math.round(outAlpha[i] * 255);
    }
    return res;
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
    } else {
      this._drawOverlay();
    }
  }

  _drawOverlay() {
    if (this.activeIdx < 0 || this.activeIdx >= this.layers.length) return;
    const layer = this.layers[this.activeIdx];
    const pts = layer.corners.map(([x, y]) => [x * this.zoomLevel + this.panX, y * this.zoomLevel + this.panY]);
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = layer.layerType === 'structure' ? '#FF9900' : (layer.transformMode === 'affine' ? '#00FF66' : '#00E5FF');
    this.ctx.setLineDash([4, 3]);
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) this.ctx.lineTo(pts[i][0], pts[i][1]);
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    const cols = ['#FF3366', '#FFCC00', '#00E5FF', '#00FF66'];
    pts.forEach(([hx, hy], i) => {
      this.ctx.fillStyle = cols[i]; this.ctx.strokeStyle = '#FFFFFF'; this.ctx.lineWidth = 1.5;
      this.ctx.beginPath(); this.ctx.arc(hx, hy, 6, 0, Math.PI * 2); this.ctx.fill(); this.ctx.stroke();
    });
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

  _bindEvents() {
    document.getElementById('btn-load-base').onclick = async () => {
      const f = await this.storage.pickLocalFile('.png');
      if (f) this.loadBaseFromFile(f);
    };
    document.getElementById('btn-load-mask').onclick = async () => {
      const f = await this.storage.pickLocalFile('.png');
      if (f) this.loadMaskFromFile(f);
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
        if (res.name.endsWith('.proj.json') || res.name.endsWith('.json')) this.loadProject(file);
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
          this._refreshLayerList(); this.markDirty(); this.render();
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

    document.getElementById('btn-eyedropper').onclick = () => this._toggleEyedropper();
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

    document.getElementById('combo-tone-target').onchange = (e) => this._onToneTargetChanged(e.target.value);
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
          this.markDirty(); this.render();
        };
        r.readAsText(file);
      }
    };

    // マウス操作
    this.viewport.onwheel = (e) => {
      e.preventDefault();
      this.setZoom(this.zoomLevel * (e.deltaY < 0 ? 1.25 : 0.8), [e.clientX - this.viewport.offsetLeft, e.clientY - this.viewport.offsetTop]);
    };
    window.onkeydown = (e) => {
      if (e.code === 'Space') { this.spacePressed = true; this.viewport.style.cursor = 'grab'; }
      if (e.key === 'Escape' && this.isEyedropper) this._toggleEyedropper();
    };
    window.onkeyup = (e) => {
      if (e.code === 'Space') { this.spacePressed = false; this.viewport.style.cursor = 'default'; }
    };
    this.viewport.onmousedown = (e) => {
      if (this.spacePressed || e.button === 1 || e.button === 2) {
        this.isPanning = true;
        this.panStart = [e.clientX - this.panX, e.clientY - this.panY];
        this.viewport.style.cursor = 'grabbing';
        return;
      }
      if (this.isEyedropper) { this._pickColorFromCoords(e.clientX, e.clientY); return; }
      this._handleInteractionStart(e.clientX, e.clientY, 8);
    };
    window.onmousemove = (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStart[0];
        this.panY = e.clientY - this.panStart[1];
        this.render(); return;
      }
      if (this.dragMode && this.activeIdx >= 0) {
        this._handleInteractionMove(e.clientX, e.clientY);
        return;
      }
      this._updateCursor(e);
    };
    window.onmouseup = () => {
      if (this.isPanning) { this.isPanning = false; this.viewport.style.cursor = this.spacePressed ? 'grab' : 'default'; }
      if (this.dragMode) { this.dragMode = null; this.markDirty(); this.render(); }
    };

    // タッチ操作 (ピンチズーム・パン・変形)
    this.viewport.addEventListener('touchstart', (e) => this._handleTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this._handleTouchMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this._handleTouchEnd(e), { passive: false });
    window.addEventListener('touchcancel', (e) => this._handleTouchEnd(e), { passive: false });

    // ズームボタン
    document.getElementById('btn-zoom-in').onclick = () => this.setZoom(this.zoomLevel * 1.25);
    document.getElementById('btn-zoom-out').onclick = () => this.setZoom(this.zoomLevel * 0.8);
    document.getElementById('btn-zoom-reset').onclick = () => this.setZoom(1.0);
    document.getElementById('btn-zoom-fit').onclick = () => this.zoomFit();

    // プロジェクト保存 / 再開
    document.getElementById('btn-save-proj').onclick = () => this.saveProject(false);
    document.getElementById('btn-save-proj-as').onclick = () => this.saveProject(true);
    document.getElementById('btn-load-proj').onclick = async () => {
      const f = await this.storage.pickLocalFile('.json');
      if (f) this.loadProject(f);
    };
    document.getElementById('btn-save-png').onclick = () => this.exportPng();
  }

  _handleTouchStart(e) {
    if (e.target !== this.canvas && !this.viewport.contains(e.target)) return;
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (this.isEyedropper) { this._pickColorFromCoords(t.clientX, t.clientY); return; }
      this._handleInteractionStart(t.clientX, t.clientY, 16);
    } else if (e.touches.length === 2) {
      this.dragMode = null; this.isPanning = false;
      const t1 = e.touches[0], t2 = e.touches[1];
      this.touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      this.touchStartZoom = this.zoomLevel;
      const rect = this.viewport.getBoundingClientRect();
      this.touchStartCenter = [((t1.clientX + t2.clientX) / 2) - rect.left, ((t1.clientY + t2.clientY) / 2) - rect.top];
      this.touchStartPan = [this.panX, this.panY];
    }
  }

  _handleTouchMove(e) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (this.isPanning) {
        this.panX = t.clientX - this.panStart[0];
        this.panY = t.clientY - this.panStart[1];
        this.render(); return;
      }
      if (this.dragMode && this.activeIdx >= 0) this._handleInteractionMove(t.clientX, t.clientY);
    } else if (e.touches.length === 2 && this.touchStartDist) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      const curDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const newZoom = Math.max(0.1, Math.min(32.0, this.touchStartZoom * (curDist / this.touchStartDist)));
      const rect = this.viewport.getBoundingClientRect();
      const curCenterX = ((t1.clientX + t2.clientX) / 2) - rect.left;
      const curCenterY = ((t1.clientY + t2.clientY) / 2) - rect.top;
      const imgX = (this.touchStartCenter[0] - this.touchStartPan[0]) / this.touchStartZoom;
      const imgY = (this.touchStartCenter[1] - this.touchStartPan[1]) / this.touchStartZoom;
      this.zoomLevel = newZoom;
      this.panX = curCenterX - imgX * newZoom;
      this.panY = curCenterY - imgY * newZoom;
      document.getElementById('lbl-zoom').textContent = `${Math.round(this.zoomLevel * 100)}%`;
      this.render();
    }
  }

  _handleTouchEnd(e) {
    if (e.touches.length === 0) {
      if (this.isPanning) this.isPanning = false;
      if (this.dragMode) { this.dragMode = null; this.markDirty(); this.render(); }
      this.touchStartDist = null;
    } else if (e.touches.length === 1) {
      this.touchStartDist = null; this.dragMode = null; this.isPanning = false;
    }
  }

  _handleInteractionStart(clientX, clientY, hitRadiusPx) {
    const rect = this.viewport.getBoundingClientRect();
    const mx = (clientX - rect.left - this.panX) / this.zoomLevel;
    const my = (clientY - rect.top - this.panY) / this.zoomLevel;

    if (this.activeIdx >= 0 && this.layers[this.activeIdx]) {
      const layer = this.layers[this.activeIdx];
      this.dragStartPos = [mx, my];
      this.dragStartCorners = layer.corners.map(([x, y]) => [x, y]);

      for (let i = 0; i < 4; i++) {
        if (Math.hypot(mx - layer.corners[i][0], my - layer.corners[i][1]) <= hitRadiusPx / this.zoomLevel) {
          this.dragMode = `corner_${i}`; return;
        }
      }
      if (pointInPolygon([mx, my], layer.corners)) {
        this.dragMode = 'move'; return;
      }
    }

    this.isPanning = true;
    this.panStart = [clientX - this.panX, clientY - this.panY];
    this.viewport.style.cursor = 'grabbing';
  }

  _handleInteractionMove(clientX, clientY) {
    const rect = this.viewport.getBoundingClientRect();
    const mx = (clientX - rect.left - this.panX) / this.zoomLevel;
    const my = (clientY - rect.top - this.panY) / this.zoomLevel;
    const dx = mx - this.dragStartPos[0], dy = my - this.dragStartPos[1];
    const layer = this.layers[this.activeIdx];

    if (this.dragMode === 'move') {
      let newCorners = this.dragStartCorners.map(([x, y]) => [x + dx, y + dy]);
      if (this.pixelSnap) newCorners = newCorners.map(([x, y]) => [Math.round(x), Math.round(y)]);
      layer.corners = newCorners;
      this.render(); return;
    }

    const idx = parseInt(this.dragMode.split('_')[1]);
    if (layer.transformMode === 'free') {
      let nx = this.dragStartCorners[idx][0] + dx, ny = this.dragStartCorners[idx][1] + dy;
      if (this.pixelSnap) { nx = Math.round(nx); ny = Math.round(ny); }
      layer.corners[idx] = [nx, ny];
    } else if (layer.transformMode === 'affine') {
      let nx = this.dragStartCorners[idx][0] + dx, ny = this.dragStartCorners[idx][1] + dy;
      if (this.pixelSnap) { nx = Math.round(nx); ny = Math.round(ny); }
      const p = this.dragStartCorners.map(([x, y]) => [x, y]);
      if (idx === 0) { p[0] = [nx, ny]; p[2] = [p[1][0] + p[3][0] - nx, p[1][1] + p[3][1] - ny]; }
      else if (idx === 1) { p[1] = [nx, ny]; p[2] = [nx + p[3][0] - p[0][0], ny + p[3][1] - p[0][1]]; }
      else if (idx === 3) { p[3] = [nx, ny]; p[2] = [p[1][0] + nx - p[0][0], p[1][1] + ny - p[0][1]]; }
      else if (idx === 2) { p[2] = [nx, ny]; p[0] = [p[1][0] + p[3][0] - nx, p[1][1] + p[3][1] - ny]; }
      layer.corners = this.pixelSnap ? p.map(([x, y]) => [Math.round(x), Math.round(y)]) : p;
    } else {
      let curX = this.dragStartCorners[idx][0] + dx, curY = this.dragStartCorners[idx][1] + dy;
      const [oppX, oppY] = this.dragStartCorners[(idx + 2) % 4];
      let xMin = Math.min(oppX, curX), xMax = Math.max(oppX, curX);
      let yMin = Math.min(oppY, curY), yMax = Math.max(oppY, curY);
      if (this.pixelSnap) { xMin = Math.round(xMin); xMax = Math.round(xMax); yMin = Math.round(yMin); yMax = Math.round(yMax); }
      layer.corners = [[xMin, yMin], [xMax, yMin], [xMax, yMax], [xMin, yMax]];
    }
    this.render();
  }

  _updateCursor(e) {
    if (this.spacePressed) { this.viewport.style.cursor = 'grab'; return; }
    if (this.isEyedropper) { this.viewport.style.cursor = 'crosshair'; return; }
    if (this.activeIdx < 0 || !this.layers[this.activeIdx]) { this.viewport.style.cursor = 'default'; return; }

    const rect = this.viewport.getBoundingClientRect();
    const mx = (e.clientX - rect.left - this.panX) / this.zoomLevel;
    const my = (e.clientY - rect.top - this.panY) / this.zoomLevel;
    const layer = this.layers[this.activeIdx];

    for (let i = 0; i < 4; i++) {
      if (Math.hypot(mx - layer.corners[i][0], my - layer.corners[i][1]) <= 8 / this.zoomLevel) {
        this.viewport.style.cursor = 'crosshair'; return;
      }
    }
    if (pointInPolygon([mx, my], layer.corners)) {
      this.viewport.style.cursor = 'move'; return;
    }
    this.viewport.style.cursor = 'default';
  }

  _getActiveTone() {
    const sel = document.getElementById('combo-tone-target').value;
    if (sel === '__ALL__') return this.globalTone;
    if (!this.maskToneOverrides.has(sel)) this.maskToneOverrides.set(sel, { ...this.globalTone, enabled: false });
    return this.maskToneOverrides.get(sel);
  }

  _onToneTargetChanged(sel) {
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

  _toggleEyedropper() {
    this.isEyedropper = !this.isEyedropper;
    document.getElementById('btn-eyedropper').textContent = this.isEyedropper ? '❌ スポイト中止 (プレビューに戻る)' : '🎯 スポイトで選択 (マスク画像を表示)';
    document.getElementById('status-bar').textContent = this.isEyedropper ? '【マスク画像表示中】適用したい色をクリックまたはタップしてください (Escでキャンセル)' : '準備完了 | スポイト: OFF';
    this.render();
  }

  _pickColorFromCoords(clientX, clientY) {
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
      this._toggleEyedropper();
    }
  }

  async _addLayer(layerType) {
    if (!this.baseImage) return alert('先にベース画像を読み込んでください。');
    const file = await this.storage.pickLocalFile('.png');
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = await loadImageAsync(url);
    const l = new Layer({
      name: file.name, imageElement: img,
      canvasW: this.baseW, canvasH: this.baseH, layerType: layerType
    });
    this.layers.push(l);
    this._refreshLayerList();
    this._selectLayer(this.layers.length - 1);
    document.getElementById('accordion-layer').open = true;
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
    this._refreshLayerList();
    this._selectLayer(this.layers.length - 1);
    document.getElementById('accordion-layer').open = true;
    this.markDirty(); this.render();
  }

  _delLayer() {
    if (this.activeIdx < 0) return;
    this.layers.splice(this.activeIdx, 1);
    this._refreshLayerList();
    this._selectLayer(Math.min(this.activeIdx, this.layers.length - 1));
    this.markDirty(); this.render();
  }

  // ★ カスタム div リストボックスの選択処理 ★
  _selectLayer(idx) {
    this.activeIdx = idx;
    const items = document.querySelectorAll('#layer-listbox .layer-list-item');
    items.forEach((item, i) => {
      if (i === idx) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
    this._syncActiveLayerUI();
    if (idx >= 0) document.getElementById('accordion-layer').open = true;
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

  // ★ カスタム div リストボックスの描画 ★
  _refreshLayerList() {
    const lb = document.getElementById('layer-listbox');
    lb.innerHTML = '';
    this.layers.forEach((l, i) => {
      const tag = l.sourceLayer ? '[小物(参照)]' : (l.layerType === 'structure' ? '[小物]' : '[乗算]');
      const item = document.createElement('div');
      item.className = 'layer-list-item' + (i === this.activeIdx ? ' selected' : '');
      item.textContent = `${tag} ${l.name}`;
      item.onclick = () => this._selectLayer(i);
      lb.appendChild(item);
    });
  }

  saveProject(saveAs = false) {
    if (!this.baseImage) return alert('保存するデータがありません。');

    const tintObj = {}, overridesObj = {};
    this.maskTintColors.forEach((v, k) => { tintObj[k] = v; });
    this.maskToneOverrides.forEach((v, k) => { overridesObj[k] = v; });

    const data = {
      version: '14.0',
      base_name: this.baseName,
      mask_name: this.maskName,
      base_image_data: imageToPngDataUrl(this.baseImage),
      mask_image_data: imageToPngDataUrl(this.maskImage),
      global_tone_config: this.globalTone,
      enable_mask_tint: this.enableMaskTint,
      mask_tint_colors: tintObj,
      mask_tone_overrides: overridesObj,
      enable_blur: this.enableBlur,
      blur_radius: this.blurRadius,
      pixel_snap: this.pixelSnap,
      layers: this.layers.map(l => l.toDict(this.layers)),
      active_idx: this.activeIdx
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (this.baseName ? this.baseName.replace(/\.[^/.]+$/, '') : 'project') + '.proj.json';
    a.click();
    this.isDirty = false;
    document.getElementById('status-bar').textContent = 'プロジェクト(画像内包版)を保存しました。';
  }

  async loadProject(file) {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const data = JSON.parse(r.result);

        if (data.global_tone_config) this.globalTone = data.global_tone_config;
        if (data.mask_tint_colors) {
          this.maskTintColors.clear();
          Object.entries(data.mask_tint_colors).forEach(([k, v]) => this.maskTintColors.set(k, v));
        }
        if (data.mask_tone_overrides) {
          this.maskToneOverrides.clear();
          Object.entries(data.mask_tone_overrides).forEach(([k, v]) => this.maskToneOverrides.set(k, v));
        }
        this.enableBlur = data.enable_blur !== undefined ? data.enable_blur : true;
        this.blurRadius = data.blur_radius || 0.0;
        this.pixelSnap = data.pixel_snap !== undefined ? data.pixel_snap : true;
        document.getElementById('chk-enable-blur').checked = this.enableBlur;
        document.getElementById('slider-blur').value = this.blurRadius;
        document.getElementById('lbl-blur-radius').textContent = `${this.blurRadius.toFixed(2)}px`;
        document.getElementById('chk-pixel-snap').checked = this.pixelSnap;
        this._onToneTargetChanged('__ALL__');

        if (data.base_image_data) {
          const baseImg = await loadImageAsync(data.base_image_data);
          if (baseImg) this._applyBaseImage(baseImg, data.base_name || 'base.png');
        }
        if (data.mask_image_data) {
          const maskImg = await loadImageAsync(data.mask_image_data);
          if (maskImg) this._applyMaskImage(maskImg, data.mask_name || 'mask.png');
        }

        const layerDefs = data.layers || [];
        const layerImages = await Promise.all(layerDefs.map(ld => {
          if (ld.image_data) return loadImageAsync(ld.image_data);
          return Promise.resolve(null);
        }));

        this.layers = [];
        for (let i = 0; i < layerDefs.length; i++) {
          const ld = layerDefs[i];
          const img = layerImages[i];
          const layer = new Layer({
            name: ld.name,
            imageElement: img,
            canvasW: this.baseW,
            canvasH: this.baseH,
            corners: ld.corners,
            opacity: ld.opacity,
            visible: ld.visible,
            transformMode: ld.transform_mode,
            tileX: ld.tile_x,
            tileY: ld.tile_y,
            targetMaskColor: ld.target_mask_color,
            layerType: ld.layer_type,
            fillAll: ld.fill_all,
            transparentE7ffff: ld.transparent_e7ffff
          });
          this.layers.push(layer);
        }

        for (let i = 0; i < layerDefs.length; i++) {
          const sIdx = layerDefs[i].source_idx;
          if (sIdx !== null && sIdx !== undefined && sIdx >= 0 && sIdx < this.layers.length) {
            this.layers[i].sourceLayer = this.layers[sIdx];
          }
        }

        this._refreshLayerList();
        const act = data.active_idx !== undefined ? data.active_idx : 0;
        if (this.layers.length > 0) {
          this._selectLayer(Math.min(act, this.layers.length - 1));
        } else {
          this._selectLayer(-1);
        }

        this.isDirty = false;
        this.zoomFit();
        this.render();
        document.getElementById('status-bar').textContent = `プロジェクトを完全復元しました: ${file.name}`;
      } catch (e) {
        alert('プロジェクトの読み込みに失敗しました: ' + e);
      }
    };
    r.readAsText(file);
  }

  exportPng() {
    const pixels = this.computeFinalImage();
    if (!pixels) return alert('保存できる画像がありません。');
    const conflicts = resolveSpecialColorConflicts(pixels, this.baseW, this.baseH, this.specialColors);
    const c = document.createElement('canvas'); c.width = this.baseW; c.height = this.baseH;
    c.getContext('2d').putImageData(new ImageData(pixels, this.baseW, this.baseH), 0, 0);
    c.toBlob(blob => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'export_result.png'; a.click();
      if (conflicts > 0) alert(`画像を保存しました。\n※ SpecialColorと一致した ${conflicts} ピクセルのR成分を補正しました。`);
    }, 'image/png');
  }
}

window.addEventListener('DOMContentLoaded', () => { new AdvancedMultiplyApp(); });
