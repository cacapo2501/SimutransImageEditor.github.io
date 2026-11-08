import { rgbToHex, hexToRgb, parseSpecialColorsCsv, resolveSpecialColorConflicts } from './color-utils.js';
import { applyProtectedBlur } from './transform.js';
import { Layer } from './layer.js';
import { HSVColorPicker } from './color-picker.js';
import { StorageAPI } from './storage-api.js';

class AdvancedMultiplyApp {
  constructor() {
    this.storage = new StorageAPI();
    this.colorPicker = new HSVColorPicker();

    // 状態管理
    this.baseImage = null;
    this.baseImageData = null;
    this.baseRgb = null;
    this.baseAlpha = null;
    this.baseW = 0;
    this.baseH = 0;
    this.isBgMask = null;
    this.editableMask = null;

    this.maskImage = null;
    this.maskRgb = null;
    this.maskColors = [];
    this.maskTintColors = new Map();
    this.enableMaskTint = true;

    this.specialColors = new Set();
    this.layers = [];
    this.activeIdx = -1;

    // 全体トーン設定
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

    // キャンバス・ビューポート状態
    this.zoomLevel = 1.0;
    this.pad = 60;
    this.panX = 60;
    this.panY = 60;
    this.isPanning = false;
    this.spacePressed = false;
    this.dragMode = null;
    this.isEyedropper = false;

    // 未保存変更ガード
    this.isDirty = false;

    this.canvas = document.getElementById('main-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.viewport = document.getElementById('canvas-viewport');

    this._initDom();
    this._bindEvents();
    this.render();
  }

  _initDom() {
    // タブ切替
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      };
    });
  }

  markDirty() {
    this.isDirty = true;
  }

  // 未保存変更の確認
  checkUnsavedChanges() {
    if (this.baseImage && this.isDirty) {
      return confirm('プロジェクトに変更が加えられています。\n破棄して続行しますか？');
    }
    return true;
  }

  // ベース画像読込
  async loadBaseFromFile(file) {
    if (!this.checkUnsavedChanges()) return;
    const img = await this._loadImageFile(file);
    this.baseImage = img;
    this.baseW = img.naturalWidth;
    this.baseH = img.naturalHeight;

    const off = document.createElement('canvas');
    off.width = this.baseW;
    off.height = this.baseH;
    const ctx = off.getContext('2d');
    ctx.drawImage(img, 0, 0);
    this.baseImageData = ctx.getImageData(0, 0, this.baseW, this.baseH);

    const d = this.baseImageData.data;
    const total = this.baseW * this.baseH;
    this.baseRgb = new Uint8Array(total * 3);
    this.baseAlpha = new Uint8Array(total);
    this.isBgMask = new Uint8Array(total);
    this.editableMask = new Uint8Array(total);

    for (let i = 0; i < total; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
      this.baseRgb[i * 3] = r;
      this.baseRgb[i * 3 + 1] = g;
      this.baseRgb[i * 3 + 2] = b;
      this.baseAlpha[i] = a;

      // 背景色 (#E7FFFF or a=0)
      if ((r === 231 && g === 255 && b === 255) || a === 0) {
        this.isBgMask[i] = 1;
      }

      // グレースケール判定 (編集可能面)
      if (r === g && g === b && this.isBgMask[i] === 0) {
        this.editableMask[i] = 1;
      }
    }

    document.getElementById('lbl-base-info').textContent = `ベース: ${file.name} (${this.baseW}x${this.baseH})`;
    this.isDirty = false;
    this.zoomFit();
  }

  // マスク画像読込
  async loadMaskFromFile(file) {
    const img = await this._loadImageFile(file);
    this.maskImage = img;

    const off = document.createElement('canvas');
    off.width = this.baseW;
    off.height = this.baseH;
    const ctx = off.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, this.baseW, this.baseH);
    const mData = ctx.getImageData(0, 0, this.baseW, this.baseH).data;

    const total = this.baseW * this.baseH;
    this.maskRgb = new Uint8Array(total * 3);
    const colorCount = new Map();

    for (let i = 0; i < total; i++) {
      const r = mData[i * 4], g = mData[i * 4 + 1], b = mData[i * 4 + 2];
      this.maskRgb[i * 3] = r;
      this.maskRgb[i * 3 + 1] = g;
      this.maskRgb[i * 3 + 2] = b;

      const hex = rgbToHex(r, g, b);
      colorCount.set(hex, (colorCount.get(hex) || 0) + 1);
      if (!this.maskTintColors.has(hex)) {
        this.maskTintColors.set(hex, hex);
      }
    }

    this.maskColors = Array.from(colorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([hex, count]) => ({ hex, count, rgb: hexToRgb(hex) }));

    this._updateMaskCombos();
    this._updateTintTable();
    document.getElementById('lbl-mask-info').textContent = `マスク: ${file.name}`;
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
      comboLayer.innerHTML += opt;
      comboTone.innerHTML += opt;
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

  _loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  // 合成計算パイプライン
  computeFinalImage() {
    if (!this.baseRgb) return null;

    const total = this.baseW * this.baseH;
    let multAccum = new Float32Array(total).fill(1.0);

    // 1. 各乗算レイヤーの乗数積算
    this.layers.forEach((layer, idx) => {
      if (layer.visible && layer.layerType === 'multiply') {
        const mMap = layer.getMultiplierMap(this.baseW, this.baseH, this.maskRgb);
        for (let i = 0; i < total; i++) multAccum[i] *= mMap[i];
      }
    });

    const outRgb = new Float32Array(total * 3);
    const outAlpha = new Float32Array(total);

    // 2. ベース画像のトーン変換 & テクスチャ乗算 & マスクTint乗算
    for (let i = 0; i < total; i++) {
      outAlpha[i] = this.baseAlpha[i] / 255.0;

      if (this.editableMask[i]) {
        const bg = this.baseRgb[i * 3] / 255.0;
        const mVal = multAccum[i];

        // 対象面のトーン設定 (個別オーバーライド優先)
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

        let tr = ((1.0 - u) * dr + u * 1.0) * mVal;
        let tg = ((1.0 - u) * dg + u * 1.0) * mVal;
        let tb = ((1.0 - u) * db + u * 1.0) * mVal;

        // マスクカラー乗算 (Tint)
        if (this.enableMaskTint && this.maskRgb) {
          const mHex = rgbToHex(this.maskRgb[i * 3], this.maskRgb[i * 3 + 1], this.maskRgb[i * 3 + 2]);
          const tintHex = this.maskTintColors.get(mHex) || mHex;
          const [trCol, tgCol, tbCol] = hexToRgb(tintHex).map(v => v / 255);
          tr *= trCol;
          tg *= tgCol;
          tb *= tbCol;
        }

        outRgb[i * 3] = tr;
        outRgb[i * 3 + 1] = tg;
        outRgb[i * 3 + 2] = tb;
      } else {
        outRgb[i * 3] = this.baseRgb[i * 3] / 255.0;
        outRgb[i * 3 + 1] = this.baseRgb[i * 3 + 1] / 255.0;
        outRgb[i * 3 + 2] = this.baseRgb[i * 3 + 2] / 255.0;
      }
    }

    // 3. 乗算完了後の結果に対してハイライトNormalブレンドを適用
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
          // 超過明るさ(%) × ブレンド最大強さ(%)
          const t = (bg - lMax) / (1.0 - lMax + 1e-6);
          const maxStr = cfg.dodge_max_strength / 100.0;
          const s = Math.min(1.0, Math.max(0.0, t * maxStr));

          const [br, bgCol, bb] = hexToRgb(cfg.dodge_color_hex).map(v => v / 255);
          outRgb[i * 3] = (1.0 - s) * outRgb[i * 3] + s * br;
          outRgb[i * 3 + 1] = (1.0 - s) * outRgb[i * 3 + 1] + s * bgCol;
          outRgb[i * 3 + 2] = (1.0 - s) * outRgb[i * 3 + 2] + s * bb;
        }
      }
    }

    // 4. ストラクチャー (小物) の上乗せ合成
    this.layers.forEach(layer => {
      if (layer.visible && layer.layerType === 'structure') {
        const sData = layer.getWarpedStructure(this.baseW, this.baseH, this.maskRgb);
        if (!sData) return;

        for (let i = 0; i < total; i++) {
          const sa = sData[i * 4 + 3];
          if (sa > 0.001) {
            if (this.isBgMask[i]) {
              outRgb[i * 3] = 192 / 255;
              outRgb[i * 3 + 1] = 192 / 255;
              outRgb[i * 3 + 2] = 192 / 255;
              outAlpha[i] = 0.0;
            } else {
              const sr = sData[i * 4];
              const sg = sData[i * 4 + 1];
              const sb = sData[i * 4 + 2];
              outRgb[i * 3] = outRgb[i * 3] * (1.0 - sa) + sr * sa;
              outRgb[i * 3 + 1] = outRgb[i * 3 + 1] * (1.0 - sa) + sg * sa;
              outRgb[i * 3 + 2] = outRgb[i * 3 + 2] * (1.0 - sa) + sb * sa;
              outAlpha[i] = Math.min(1.0, outAlpha[i] + sa * (1.0 - outAlpha[i]));
            }
          }
        }
      }
    });

    // 5. SpecialColor完全保護の画像全体ぼかし
    if (this.enableBlur && this.blurRadius > 0.001) {
      const invalidMask = new Uint8Array(total);
      for (let i = 0; i < total; i++) {
        if (this.isBgMask[i]) invalidMask[i] = 1;
        else {
          const hex = rgbToHex(outRgb[i * 3] * 255, outRgb[i * 3 + 1] * 255, outRgb[i * 3 + 2] * 255);
          if (this.specialColors.has(hex)) invalidMask[i] = 1;
        }
      }
      const blurred = applyProtectedBlur(outRgb, this.baseW, this.baseH, this.blurRadius, invalidMask);
      for (let i = 0; i < outRgb.length; i++) outRgb[i] = blurred[i];
    }

    const finalRgba = new Uint8ClampedArray(total * 4);
    for (let i = 0; i < total; i++) {
      finalRgba[i * 4] = Math.round(outRgb[i * 3] * 255);
      finalRgba[i * 4 + 1] = Math.round(outRgb[i * 3 + 1] * 255);
      finalRgba[i * 4 + 2] = Math.round(outRgb[i * 3 + 2] * 255);
      finalRgba[i * 4 + 3] = Math.round(outAlpha[i] * 255);
    }

    return finalRgba;
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
      this.ctx.fillText('ベースPNGを読み込んでください (ドラッグ＆ドロップ対応)', this.canvas.width / 2, this.canvas.height / 2);
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

    // 拡大描画 (ニアレストネイバー)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.baseW;
    tempCanvas.height = this.baseH;
    tempCanvas.getContext('2d').putImageData(imgData, 0, 0);

    this.ctx.imageSmoothingEnabled = this.zoomLevel < 1.0;
    this.ctx.drawImage(tempCanvas, this.panX, this.panY, vw, vh);

    if (this.isEyedropper) {
      this.ctx.fillStyle = '#FFFF00';
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.fillText('【マスク画像表示中】適用したい色をクリックしてください (Escでキャンセル)', this.panX + 10, this.panY - 12);
    } else {
      this._drawOverlay();
    }
  }

  _drawOverlay() {
    if (this.activeIdx < 0 || this.activeIdx >= this.layers.length) return;
    const layer = this.layers[this.activeIdx];
    const pts = layer.corners.map(([x, y]) => [
      x * this.zoomLevel + this.panX,
      y * this.zoomLevel + this.panY
    ]);

    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = layer.layerType === 'structure' ? '#FF9900' : (layer.transformMode === 'affine' ? '#00FF66' : '#00E5FF');
    this.ctx.setLineDash([4, 3]);
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) this.ctx.lineTo(pts[i][0], pts[i][1]);
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    const handleColors = ['#FF3366', '#FFCC00', '#00E5FF', '#00FF66'];
    pts.forEach(([hx, hy], i) => {
      this.ctx.fillStyle = handleColors[i];
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    });
  }

  // ズーム・パン
  setZoom(z, center = null) {
    const newZ = Math.max(0.1, Math.min(32.0, z));
    if (center && this.baseW) {
      const [cx, cy] = center;
      const imgX = (cx - this.panX) / this.zoomLevel;
      const imgY = (cy - this.panY) / this.zoomLevel;
      this.zoomLevel = newZ;
      this.panX = cx - imgX * newZ;
      this.panY = cy - imgY * newZ;
    } else {
      this.zoomLevel = newZ;
    }
    document.getElementById('lbl-zoom').textContent = `${Math.round(this.zoomLevel * 100)}%`;
    this.render();
  }

  zoomFit() {
    if (!this.baseW || !this.baseH) return;
    const cw = this.viewport.clientWidth - 100;
    const ch = this.viewport.clientHeight - 100;
    const s = Math.min(cw / this.baseW, ch / this.baseH, 4.0);
    this.zoomLevel = Math.max(0.2, s);
    this.panX = (this.viewport.clientWidth - this.baseW * this.zoomLevel) / 2;
    this.panY = (this.viewport.clientHeight - this.baseH * this.zoomLevel) / 2;
    document.getElementById('lbl-zoom').textContent = `${Math.round(this.zoomLevel * 100)}%`;
    this.render();
  }

  _bindEvents() {
    // ファイル読込系
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
        if (res.name.endsWith('.proj.json')) {
          this.loadProjectFromBlob(res.blob);
        } else if (res.name.includes('mask') || res.name.includes('paint')) {
          this.loadMaskFromFile(file);
        } else {
          this.loadBaseFromFile(file);
        }
      }
    };

    // レイヤー操作
    document.getElementById('btn-add-multiply').onclick = () => this._addLayerDialog('multiply');
    document.getElementById('btn-add-structure').onclick = () => this._addLayerDialog('structure');
    document.getElementById('btn-copy-layer').onclick = () => this._copyActiveLayer();
    document.getElementById('btn-del-layer').onclick = () => this._removeActiveLayer();
    document.getElementById('layer-listbox').onchange = (e) => this._selectLayer(e.target.selectedIndex);

    // ピクセルスナップ
    document.getElementById('chk-pixel-snap').onchange = (e) => { this.pixelSnap = e.target.checked; };
    document.getElementById('btn-snap-now').onclick = () => {
      if (this.activeIdx >= 0) {
        const l = this.layers[this.activeIdx];
        l.corners = l.corners.map(([x, y]) => [Math.round(x), Math.round(y)]);
        this.markDirty();
        this.render();
      }
    };

    // キャンバス マウス操作 (ズーム/パン/頂点ドラッグ)
    this.viewport.onwheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.25 : 0.8;
      this.setZoom(this.zoomLevel * delta, [e.clientX - this.viewport.offsetLeft, e.clientY - this.viewport.offsetTop]);
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
      if (this.isEyedropper) {
        this._pickColorFromCanvas(e);
        return;
      }
      this._handleCanvasMouseDown(e);
    };

    window.onmousemove = (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStart[0];
        this.panY = e.clientY - this.panStart[1];
        this.render();
        return;
      }
      if (this.dragMode && this.activeIdx >= 0) {
        this._handleCornerDrag(e);
      }
    };

    window.onmouseup = () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewport.style.cursor = this.spacePressed ? 'grab' : 'default';
      }
      if (this.dragMode) {
        this.dragMode = null;
        this.markDirty();
        this.render();
      }
    };

    // 特殊色CSV読込
    document.getElementById('file-csv').onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          this.specialColors = parseSpecialColorsCsv(reader.result);
          document.getElementById('lbl-csv-info').textContent = `特殊色: ${this.specialColors.size}件登録済`;
          this.markDirty();
          this.render();
        };
        reader.readAsText(file);
      }
    };

    // プロジェクト保存 / 再開
    document.getElementById('btn-save-proj').onclick = () => this.saveProject(false);
    document.getElementById('btn-save-proj-as').onclick = () => this.saveProject(true);
    document.getElementById('btn-load-proj').onclick = () => this.loadProjectDialog();

    // PNGエクスポート
    document.getElementById('btn-save-png').onclick = () => this.exportPng();
  }

  async _addLayerDialog(layerType) {
    if (!this.baseImage) return alert('先にベース画像を読み込んでください。');
    const file = await this.storage.pickLocalFile('.png');
    if (!file) return;
    const img = await this._loadImageFile(file);
    const layer = new Layer({
      name: file.name,
      imageElement: img,
      canvasW: this.baseW,
      canvasH: this.baseH,
      layerType: layerType
    });
    this.layers.push(layer);
    this._refreshLayerList();
    this._selectLayer(this.layers.length - 1);
    this.markDirty();
    this.render();
  }

  _copyActiveLayer() {
    if (this.activeIdx < 0) return;
    const src = this.layers[this.activeIdx];
    const master = src.sourceLayer || src;
    const newCorners = src.corners.map(([x, y]) => [x + 10, y + 10]);
    const copy = new Layer({
      name: master.name,
      imageElement: master.imageElement,
      canvasW: this.baseW,
      canvasH: this.baseH,
      corners: newCorners,
      sourceLayer: master,
      fillAll: master.fillAll,
      transparentE7ffff: master.transparentE7ffff
    });
    this.layers.push(copy);
    this._refreshLayerList();
    this._selectLayer(this.layers.length - 1);
    this.markDirty();
    this.render();
  }

  _removeActiveLayer() {
    if (this.activeIdx < 0) return;
    this.layers.splice(this.activeIdx, 1);
    this._refreshLayerList();
    this._selectLayer(Math.min(this.activeIdx, this.layers.length - 1));
    this.markDirty();
    this.render();
  }

  _selectLayer(idx) {
    this.activeIdx = idx;
    const listbox = document.getElementById('layer-listbox');
    listbox.selectedIndex = idx;
    if (idx >= 0 && idx < this.layers.length) {
      const l = this.layers[idx];
      document.querySelector(`input[name="layer-type"][value="${l.layerType}"]`).checked = true;
      document.getElementById('chk-trans-e7ffff').checked = l.transparentE7ffff;
      document.getElementById('chk-fill-all').checked = l.fillAll;
      document.getElementById('slider-opacity').value = l.opacity;
      document.getElementById('lbl-opacity').textContent = `${Math.round(l.opacity * 100)}%`;
      document.getElementById('chk-layer-visible').checked = l.visible;
      document.querySelector(`input[name="transform-mode"][value="${l.transformMode}"]`).checked = true;
      document.getElementById('lbl-tile-x').textContent = l.tileX.toFixed(1);
      document.getElementById('lbl-tile-y').textContent = l.tileY.toFixed(1);
    }
    this.render();
  }

  _refreshLayerList() {
    const listbox = document.getElementById('layer-listbox');
    listbox.innerHTML = '';
    this.layers.forEach((l, i) => {
      const tag = l.sourceLayer ? '[小物(参照)]' : (l.layerType === 'structure' ? '[小物]' : '[乗算]');
      const opt = document.createElement('option');
      opt.textContent = `${tag} ${l.name}`;
      listbox.appendChild(opt);
    });
  }

  // キャンバスドラッグ変形
  _handleCanvasMouseDown(e) {
    if (this.activeIdx < 0) return;
    const rect = this.viewport.getBoundingClientRect();
    const mx = (e.clientX - rect.left - this.panX) / this.zoomLevel;
    const my = (e.clientY - rect.top - this.panY) / this.zoomLevel;

    const layer = this.layers[this.activeIdx];
    this.dragStartPos = [mx, my];
    this.dragStartCorners = layer.corners.map(([x, y]) => [x, y]);

    // 頂点ハンドル判定 (半径 8px)
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = layer.corners[i];
      if (Math.hypot(mx - cx, my - cy) <= 8 / this.zoomLevel) {
        this.dragMode = `corner_${i}`;
        return;
      }
    }
  }

  _handleCornerDrag(e) {
    const rect = this.viewport.getBoundingClientRect();
    const mx = (e.clientX - rect.left - this.panX) / this.zoomLevel;
    const my = (e.clientY - rect.top - this.panY) / this.zoomLevel;

    const dx = mx - this.dragStartPos[0];
    const dy = my - this.dragStartPos[1];
    const layer = this.layers[this.activeIdx];
    const idx = parseInt(this.dragMode.split('_')[1]);

    if (layer.transformMode === 'free') {
      let nx = this.dragStartCorners[idx][0] + dx;
      let ny = this.dragStartCorners[idx][1] + dy;
      if (this.pixelSnap) { nx = Math.round(nx); ny = Math.round(ny); }
      layer.corners[idx] = [nx, ny];
    } else if (layer.transformMode === 'affine') {
      let nx = this.dragStartCorners[idx][0] + dx;
      let ny = this.dragStartCorners[idx][1] + dy;
      if (this.pixelSnap) { nx = Math.round(nx); ny = Math.round(ny); }

      const p = this.dragStartCorners.map(([x, y]) => [x, y]);
      if (idx === 0) { p[0] = [nx, ny]; p[2] = [p[1][0] + p[3][0] - nx, p[1][1] + p[3][1] - ny]; }
      else if (idx === 1) { p[1] = [nx, ny]; p[2] = [nx + p[3][0] - p[0][0], ny + p[3][1] - p[0][1]]; }
      else if (idx === 3) { p[3] = [nx, ny]; p[2] = [p[1][0] + nx - p[0][0], p[1][1] + ny - p[0][1]]; }
      else if (idx === 2) { p[2] = [nx, ny]; p[0] = [p[1][0] + p[3][0] - nx, p[1][1] + p[3][1] - ny]; }

      layer.corners = this.pixelSnap ? p.map(([x, y]) => [Math.round(x), Math.round(y)]) : p;
    } else {
      // 矩形リサイズ (box)
      let curX = this.dragStartCorners[idx][0] + dx;
      let curY = this.dragStartCorners[idx][1] + dy;
      const oppIdx = (idx + 2) % 4;
      const [oppX, oppY] = this.dragStartCorners[oppIdx];

      let xMin = Math.min(oppX, curX), xMax = Math.max(oppX, curX);
      let yMin = Math.min(oppY, curY), yMax = Math.max(oppY, curY);
      if (this.pixelSnap) {
        xMin = Math.round(xMin); xMax = Math.round(xMax);
        yMin = Math.round(yMin); yMax = Math.round(yMax);
      }
      layer.corners = [[xMin, yMin], [xMax, yMin], [xMax, yMax], [xMin, yMax]];
    }

    this.render();
  }

  // スポイト
  _toggleEyedropper() {
    this.isEyedropper = !this.isEyedropper;
    const btn = document.getElementById('btn-eyedropper');
    const status = document.getElementById('status-bar');
    if (this.isEyedropper) {
      btn.textContent = '❌ スポイト中止 (プレビューに戻る)';
      status.textContent = '【マスク画像表示中】適用したい色をクリックしてください (Escでキャンセル)';
    } else {
      btn.textContent = '🎯 スポイトで選択 (マスク画像を表示)';
      status.textContent = '準備完了 | スポイト: OFF';
    }
    this.render();
  }

  _pickColorFromCanvas(e) {
    if (!this.maskRgb) return;
    const rect = this.viewport.getBoundingClientRect();
    const ix = Math.floor((e.clientX - rect.left - this.panX) / this.zoomLevel);
    const iy = Math.floor((e.clientY - rect.top - this.panY) / this.zoomLevel);

    if (ix >= 0 && ix < this.baseW && iy >= 0 && iy < this.baseH) {
      const idx = (iy * this.baseW + ix) * 3;
      const rgb = [this.maskRgb[idx], this.maskRgb[idx + 1], this.maskRgb[idx + 2]];
      if (this.activeIdx >= 0) {
        this.layers[this.activeIdx].targetMaskColor = rgb;
        this.markDirty();
      }
      this._toggleEyedropper();
    }
  }

  // プロジェクトJSON保存
  saveProject(saveAs = false) {
    if (!this.baseImage) return alert('保存するデータがありません。');

    const tintObj = {};
    this.maskTintColors.forEach((v, k) => { tintObj[k] = v; });

    const overridesObj = {};
    this.maskToneOverrides.forEach((v, k) => { overridesObj[k] = v; });

    const data = {
      version: '13.0',
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
    a.download = 'project.proj.json';
    a.click();
    this.isDirty = false;
  }

  // PNGエクスポート
  exportPng() {
    const pixels = this.computeFinalImage();
    if (!pixels) return alert('保存できる画像がありません。');

    // SpecialColor 衝突回避処理
    const conflicts = resolveSpecialColorConflicts(pixels, this.baseW, this.baseH, this.specialColors);

    const canvas = document.createElement('canvas');
    canvas.width = this.baseW;
    canvas.height = this.baseH;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(pixels, this.baseW, this.baseH), 0, 0);

    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'export_result.png';
      a.click();
      if (conflicts > 0) {
        alert(`画像を保存しました。\n※ SpecialColorと一致した ${conflicts} ピクセルについて、R成分を±1補正して色かぶりを回避しました。`);
      }
    }, 'image/png');
  }
}

// アプリケーション起動
window.addEventListener('DOMContentLoaded', () => {
  new AdvancedMultiplyApp();
});