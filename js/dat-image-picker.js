import { collectImageEntries } from './dat-serializer.js';
import { renderDatImagePickerModalUI } from './ui-dat-image-picker.js';
import { RenderEngine } from './render-engine.js';

export class DatImagePicker {
  constructor(datGenerator) {
    this.gen = datGenerator;
    this.initialized = false;
    this.srcCanvas = null;
    this.tileW = 64;
    this.tileH = 64;
    this.zoom = 1.0;
    this.panX = 16;
    this.panY = 16;
    this.mode = 'origin';
    this.tempStartRow = 0;
    this.tempStartCol = 0;
    this.tempCustomCoords = {};
    this.selectedKeyIdx = 0;

    this.isPanning = false;
    this.panMoved = false;
    this.panStart = [0, 0];
  }

  _ensureInitialized() {
    if (this.initialized) return;
    renderDatImagePickerModalUI();
    this._bindEvents();
    this.initialized = true;
  }

  _buildSourceCanvas() {
    const app = this.gen.app;
    if (!app || !app.baseImage || !app.baseW || !app.baseH) return null;

    const c = document.createElement('canvas');
    c.width = app.baseW;
    c.height = app.baseH;
    const ctx = c.getContext('2d');

    const pixels = app.computeFinalImage();
    if (pixels) {
      ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), app.baseW, app.baseH), 0, 0);
    } else {
      ctx.drawImage(app.baseImage, 0, 0, app.baseW, app.baseH);
    }
    return c;
  }

  _guessInitialTileSize(w, h) {
    if (w === 768 && h % 96 === 0) return [96, 96];
    if (w >= 1024 && w % 128 === 0 && h % 128 === 0) return [128, 128];
    if (w % 64 === 0 && h % 64 === 0) return [64, 64];
    if (this.gen.currentObjType === 'building' && w % 4 === 0 && w >= 64) {
      const unit = Math.round(w / 4);
      if (unit >= 16 && unit <= 512) return [unit, unit];
    }
    return [64, 64];
  }

  open() {
    const src = this._buildSourceCanvas();
    if (!src) {
      alert('先にベース画像を開くか、新規作成してください。');
      return;
    }
    this._ensureInitialized();
    this.srcCanvas = src;

    const [gw, gh] = this._guessInitialTileSize(src.width, src.height);
    this.tileW = gw;
    this.tileH = gh;
    const inpTw = document.getElementById('inp-dat-picker-tw');
    const inpTh = document.getElementById('inp-dat-picker-th');
    if (inpTw) inpTw.value = String(this.tileW);
    if (inpTh) inpTh.value = String(this.tileH);

    this.tempStartRow = Math.max(0, parseInt(this.gen.common.startRow, 10) || 0);
    this.tempStartCol = Math.max(0, parseInt(this.gen.common.startCol, 10) || 0);
    this.tempCustomCoords = this.gen.common.customImageCoords
      ? JSON.parse(JSON.stringify(this.gen.common.customImageCoords))
      : {};
    this.selectedKeyIdx = 0;

    const sizeLbl = document.getElementById('lbl-dat-picker-img-size');
    if (sizeLbl) {
      sizeLbl.textContent = `編集中画像: ${src.width}×${src.height}px (${this.gen.app.baseName})`;
    }

    const modal = document.getElementById('modal-dat-image-picker');
    if (!modal) return;
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');

    requestAnimationFrame(() => {
      this.zoomFit();
      this.refreshAll();
    });
  }

  _getCurrentEntries() {
    const objType = this.gen.currentObjType;
    const values = this.gen._getObjState(objType);
    return collectImageEntries(objType, values, {
      startRow: this.tempStartRow,
      startCol: this.tempStartCol,
      customImageCoords: Object.keys(this.tempCustomCoords).length > 0 ? this.tempCustomCoords : null
    });
  }

  refreshAll() {
    this._renderKeyList();
    this._renderCanvas();
    this._updateSelectionLabel();
  }

  _updateSelectionLabel() {
    const lbl = document.getElementById('lbl-dat-picker-selection');
    if (!lbl) return;
    const customCount = Object.keys(this.tempCustomCoords).length;
    lbl.textContent = customCount > 0
      ? `開始位置: row=${this.tempStartRow}, col=${this.tempStartCol} | 個別割当: ${customCount}件`
      : `開始位置: row=${this.tempStartRow}, col=${this.tempStartCol}`;
  }

  _renderKeyList() {
    const listEl = document.getElementById('dat-picker-key-list');
    if (!listEl) return;
    const entries = this._getCurrentEntries();
    if (this.selectedKeyIdx >= entries.length) this.selectedKeyIdx = 0;

    listEl.innerHTML = '';
    if (entries.length === 0) {
      listEl.innerHTML = '<div class="info-text">このオブジェクト種別には画像キーがありません。</div>';
      return;
    }

    entries.forEach((entry, idx) => {
      const rowEl = document.createElement('div');
      const isSelected = idx === this.selectedKeyIdx;
      const isCustom = Boolean(this.tempCustomCoords[entry.key]);
      rowEl.className = 'dat-picker-key-item' + (isSelected ? ' active' : '') + (isCustom ? ' custom' : '');
      rowEl.innerHTML = `<span class="k-name">${entry.key}</span><span class="k-coord">.${entry.row}.${entry.col}${isCustom ? ' ★' : ''}</span>`;
      rowEl.onclick = () => {
        this.selectedKeyIdx = idx;
        this.refreshAll();
      };
      listEl.appendChild(rowEl);
    });
  }

  _renderCanvas() {
    const canvas = document.getElementById('dat-picker-canvas');
    const vp = document.getElementById('dat-picker-viewport');
    if (!canvas || !vp || !this.srcCanvas) return;

    const vw = vp.clientWidth || 600;
    const vh = vp.clientHeight || 420;
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, vw, vh);

    const drawW = Math.round(this.srcCanvas.width * this.zoom);
    const drawH = Math.round(this.srcCanvas.height * this.zoom);
    RenderEngine.drawCheckerboard(ctx, this.panX, this.panY, drawW, drawH);

    ctx.imageSmoothingEnabled = this.zoom < 1.0;
    ctx.drawImage(this.srcCanvas, this.panX, this.panY, drawW, drawH);

    const cols = Math.max(1, Math.ceil(this.srcCanvas.width / this.tileW));
    const rows = Math.max(1, Math.ceil(this.srcCanvas.height / this.tileH));

    // グリッド線と (row, col) ラベル
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let r = 0; r <= rows; r++) {
      const y = Math.round(this.panY + r * this.tileH * this.zoom) + 0.5;
      ctx.beginPath();
      ctx.moveTo(this.panX, y);
      ctx.lineTo(this.panX + cols * this.tileW * this.zoom, y);
      ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      const x = Math.round(this.panX + c * this.tileW * this.zoom) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, this.panY);
      ctx.lineTo(x, this.panY + rows * this.tileH * this.zoom);
      ctx.stroke();
    }

    if (this.tileW * this.zoom >= 26 && this.tileH * this.zoom >= 16) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillText(`${r}.${c}`, this.panX + c * this.tileW * this.zoom + 3, this.panY + r * this.tileH * this.zoom + 2);
        }
      }
    }

    // 割当セルハイライト
    const entries = this._getCurrentEntries();
    entries.forEach((entry, idx) => {
      const rx = this.panX + entry.col * this.tileW * this.zoom;
      const ry = this.panY + entry.row * this.tileH * this.zoom;
      const rw = this.tileW * this.zoom;
      const rh = this.tileH * this.zoom;
      const isFocused = this.mode === 'per_key' && idx === this.selectedKeyIdx;

      ctx.fillStyle = isFocused ? 'rgba(255, 210, 0, 0.28)' : 'rgba(0, 229, 255, 0.16)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = isFocused ? '#FFD200' : '#00E5FF';
      ctx.lineWidth = isFocused ? 2.5 : 1.5;
      ctx.strokeRect(rx + 1, ry + 1, Math.max(1, rw - 2), Math.max(1, rh - 2));
    });

    const zLbl = document.getElementById('lbl-dat-picker-zoom');
    if (zLbl) zLbl.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  zoomFit() {
    const vp = document.getElementById('dat-picker-viewport');
    if (!vp || !this.srcCanvas) return;
    const vw = vp.clientWidth || 600;
    const vh = vp.clientHeight || 420;
    const s = Math.min((vw - 40) / this.srcCanvas.width, (vh - 40) / this.srcCanvas.height, 4.0);
    this.zoom = Math.max(0.25, s);
    this.panX = Math.round((vw - this.srcCanvas.width * this.zoom) / 2);
    this.panY = Math.round((vh - this.srcCanvas.height * this.zoom) / 2);
    this._renderCanvas();
  }

  _handleCanvasClick(clientX, clientY) {
    const canvas = document.getElementById('dat-picker-canvas');
    if (!canvas || !this.srcCanvas) return;
    const rect = canvas.getBoundingClientRect();
    const ix = (clientX - rect.left - this.panX) / this.zoom;
    const iy = (clientY - rect.top - this.panY) / this.zoom;
    if (ix < 0 || iy < 0) return;

    const col = Math.floor(ix / this.tileW);
    const row = Math.floor(iy / this.tileH);

    if (this.mode === 'origin') {
      this.tempStartRow = row;
      this.tempStartCol = col;
    } else {
      const entries = this._getCurrentEntries();
      const target = entries[this.selectedKeyIdx];
      if (target) {
        this.tempCustomCoords[target.key] = { row, col };
        if (this.selectedKeyIdx + 1 < entries.length) {
          this.selectedKeyIdx += 1;
        }
      }
    }
    this.refreshAll();
  }

  _bindEvents() {
    const modal = document.getElementById('modal-dat-image-picker');
    const close = () => modal?.close();
    document.getElementById('btn-dat-picker-close-top')?.addEventListener('click', close);
    document.getElementById('btn-dat-picker-cancel')?.addEventListener('click', close);

    document.querySelectorAll('.btn-dat-picker-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        this.tileW = parseInt(btn.dataset.w, 10) || 64;
        this.tileH = parseInt(btn.dataset.h, 10) || 64;
        document.getElementById('inp-dat-picker-tw').value = String(this.tileW);
        document.getElementById('inp-dat-picker-th').value = String(this.tileH);
        this.refreshAll();
      });
    });

    document.getElementById('inp-dat-picker-tw')?.addEventListener('input', (e) => {
      this.tileW = Math.max(8, Math.min(1024, parseInt(e.target.value, 10) || 64));
      this._renderCanvas();
    });
    document.getElementById('inp-dat-picker-th')?.addEventListener('input', (e) => {
      this.tileH = Math.max(8, Math.min(1024, parseInt(e.target.value, 10) || 64));
      this._renderCanvas();
    });

    document.getElementById('sel-dat-picker-mode')?.addEventListener('change', (e) => {
      this.mode = e.target.value;
      const guide = document.getElementById('lbl-dat-picker-guide');
      if (guide) {
        guide.textContent = this.mode === 'origin'
          ? 'キャンバス上のセルをクリックすると、そのセルを開始位置 (startRow, startCol) に設定します。'
          : '左側でキーを選び、キャンバス上のセルをクリックすると個別に座標を割り当てます。';
      }
      this.refreshAll();
    });

    document.getElementById('btn-dat-picker-z-in')?.addEventListener('click', () => {
      this.zoom = Math.min(16, this.zoom * 1.25);
      this._renderCanvas();
    });
    document.getElementById('btn-dat-picker-z-out')?.addEventListener('click', () => {
      this.zoom = Math.max(0.2, this.zoom * 0.8);
      this._renderCanvas();
    });
    document.getElementById('btn-dat-picker-z-fit')?.addEventListener('click', () => this.zoomFit());

    const canvas = document.getElementById('dat-picker-canvas');
    if (canvas) {
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        const nextZ = Math.max(0.2, Math.min(16, this.zoom * factor));
        this.panX = cx - ((cx - this.panX) / this.zoom) * nextZ;
        this.panY = cy - ((cy - this.panY) / this.zoom) * nextZ;
        this.zoom = nextZ;
        this._renderCanvas();
      }, { passive: false });

      canvas.addEventListener('mousedown', (e) => {
        this.isPanning = true;
        this.panMoved = false;
        this.panStart = [e.clientX - this.panX, e.clientY - this.panY];
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    window.addEventListener('mousemove', (e) => {
      if (!this.isPanning || !modal?.open) return;
      const nx = e.clientX - this.panStart[0];
      const ny = e.clientY - this.panStart[1];
      if (Math.hypot(nx - this.panX, ny - this.panY) > 4) this.panMoved = true;
      if (e.buttons !== 1 || this.panMoved) {
        this.panX = nx;
        this.panY = ny;
        this._renderCanvas();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.isPanning) return;
      const wasClick = e.button === 0 && !this.panMoved && modal?.open;
      this.isPanning = false;
      if (wasClick && e.target === canvas) {
        this._handleCanvasClick(e.clientX, e.clientY);
      }
    });

    document.getElementById('btn-dat-picker-reset-custom')?.addEventListener('click', () => {
      this.tempCustomCoords = {};
      this.refreshAll();
    });

    document.getElementById('btn-dat-picker-apply')?.addEventListener('click', () => {
      this.gen.applyImagePickerResult({
        startRow: String(this.tempStartRow),
        startCol: String(this.tempStartCol),
        customImageCoords: Object.keys(this.tempCustomCoords).length > 0 ? { ...this.tempCustomCoords } : null
      });
      close();
    });
  }
}
