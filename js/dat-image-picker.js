import { collectImageEntries } from './dat-serializer.js';
import {
  renderDatImagePickerModalUI,
  renderFormatOptionsPanel,
  renderDatPickerItemsList,
  drawDatPickerOverlay
} from './ui-dat-image-picker.js';
import { cloneDatEntry } from './dat-project-state.js';
import { RenderEngine } from './render-engine.js';
import {
  buildPickerSourceCanvas,
  guessInitialTileSize,
  bindPickerViewportEvents
} from './dat-picker-viewport.js';

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
    this.tempItems = [];
    this.tempActiveIdx = 0;
    this.selectedKeyIdx = 0;

    this.isPanning = false;
    this.panMoved = false;
    this.panStart = [0, 0];
  }

  _activeItem() {
    return this.tempItems[this.tempActiveIdx] || this.tempItems[0];
  }

  _ensureInitialized() {
    if (this.initialized) return;
    renderDatImagePickerModalUI();
    this._bindEvents();
    this.initialized = true;
  }

  open() {
    const src = buildPickerSourceCanvas(this.gen.app, this.gen.currentObjType);
    if (!src) {
      alert('先にベース画像を開くか、新規作成してください。');
      return;
    }
    this._ensureInitialized();
    this.srcCanvas = src;

    const [gw, gh] = guessInitialTileSize(src.width, src.height, this.gen.currentObjType, this.gen.app.tileCutter);
    this.tileW = gw;
    this.tileH = gh;
    const inpTw = document.getElementById('inp-dat-picker-tw');
    const inpTh = document.getElementById('inp-dat-picker-th');
    if (inpTw) inpTw.value = String(this.tileW);
    if (inpTh) inpTh.value = String(this.tileH);

    // 複数編成がある場合は全形式を読み込み、単体時は1件として保持する
    if (this.gen.collectionMgr.hasCollection()) {
      this.gen.collectionMgr.saveActiveFromController();
      this.tempItems = this.gen.collectionMgr.items.map(cloneDatEntry);
      this.tempActiveIdx = Math.max(0, Math.min(this.gen.collectionMgr.activeIndex, this.tempItems.length - 1));
    } else {
      this.tempItems = [cloneDatEntry({
        objType: this.gen.currentObjType,
        common: this.gen.common,
        values: this.gen._getObjState(this.gen.currentObjType)
      })];
      this.tempActiveIdx = 0;
    }

    this.tempItems.forEach((it) => {
      it.common.startRow = String(Math.max(0, parseInt(it.common.startRow, 10) || 0));
      it.common.startCol = String(Math.max(0, parseInt(it.common.startCol, 10) || 0));
      it.common.imageFormat = it.common.imageFormat || 'auto';
      if (it.common.imageFormat === 'vehicle_otrp_reverse' || it.common.imageFormat === 'vehicle_otrp_reverse_only') {
        it.values.hasFreightImage = false;
      }
    });
    this.selectedKeyIdx = 0;

    this._syncActiveItemControls();

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

  _syncActiveItemControls() {
    const active = this._activeItem();
    if (!active) return;
    const selFmt = document.getElementById('sel-dat-picker-format');
    if (selFmt) selFmt.value = active.common.imageFormat || 'auto';
    this._renderFormatOptions();
  }

  _renderFormatOptions() {
    const box = document.getElementById('dat-picker-format-options');
    const active = this._activeItem();
    if (!active) return;
    renderFormatOptionsPanel(box, {
      objType: active.objType,
      common: active.common,
      values: active.values,
      onChange: () => this.refreshAll()
    });
  }

  _getEntriesForItem(item) {
    if (!item) return [];
    const coords = item.common.customImageCoords && Object.keys(item.common.customImageCoords).length > 0
      ? item.common.customImageCoords
      : null;
    return collectImageEntries(item.objType, item.values, { ...item.common, customImageCoords: coords });
  }

  _getCurrentEntries() {
    return this._getEntriesForItem(this._activeItem());
  }

  refreshAll() {
    renderDatPickerItemsList(this.tempItems, this.tempActiveIdx, (idx) => {
      this.tempActiveIdx = idx;
      this.selectedKeyIdx = 0;
      this._syncActiveItemControls();
      this.refreshAll();
    });
    this._renderKeyList();
    this._renderCanvas();
    this._updateSelectionLabel();
  }

  _updateSelectionLabel() {
    const lbl = document.getElementById('lbl-dat-picker-selection');
    const active = this._activeItem();
    if (!lbl || !active) return;
    const customCount = active.common.customImageCoords ? Object.keys(active.common.customImageCoords).length : 0;
    const base = `#${this.tempActiveIdx + 1} (${active.common.name || active.objType}) 開始: row=${active.common.startRow}, col=${active.common.startCol}`;
    lbl.textContent = customCount > 0 ? `${base} | 個別割当: ${customCount}件` : base;
  }

  _renderKeyList() {
    const listEl = document.getElementById('dat-picker-key-list');
    const active = this._activeItem();
    if (!listEl || !active) return;
    const entries = this._getCurrentEntries();
    if (this.selectedKeyIdx >= entries.length) this.selectedKeyIdx = 0;

    listEl.innerHTML = '';
    if (entries.length === 0) {
      listEl.innerHTML = '<div class="info-text">このオブジェクト種別には画像キーがありません。</div>';
      return;
    }

    const customCoords = active.common.customImageCoords || {};
    entries.forEach((entry, idx) => {
      const rowEl = document.createElement('div');
      const isSelected = idx === this.selectedKeyIdx;
      const isCustom = Boolean(customCoords[entry.key]);
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

    // 選択中アイテム以外も含め全形式のセル配置を同時表示する
    const otherEntries = [];
    this.tempItems.forEach((item, idx) => {
      if (idx === this.tempActiveIdx) return;
      this._getEntriesForItem(item).forEach(e => otherEntries.push({ ...e, itemIdx: idx }));
    });

    drawDatPickerOverlay(ctx, {
      srcW: this.srcCanvas.width,
      srcH: this.srcCanvas.height,
      tileW: this.tileW,
      tileH: this.tileH,
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      entries: this._getCurrentEntries(),
      otherEntries,
      mode: this.mode,
      selectedKeyIdx: this.selectedKeyIdx
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
    const active = this._activeItem();
    if (!canvas || !this.srcCanvas || !active) return;
    const rect = canvas.getBoundingClientRect();
    const ix = (clientX - rect.left - this.panX) / this.zoom;
    const iy = (clientY - rect.top - this.panY) / this.zoom;
    if (ix < 0 || iy < 0) return;

    const col = Math.floor(ix / this.tileW);
    const row = Math.floor(iy / this.tileH);
    const selFmt = document.getElementById('sel-dat-picker-format');

    if (this.mode === 'origin') {
      active.common.startRow = String(row);
      active.common.startCol = String(col);
    } else if (this.mode === 'freight_row') {
      // FreightImage と OTRP Reverse は同時指定不可のため切替する
      active.values.freightRow = String(row);
      active.values.hasFreightImage = true;
      const fmt = active.common.imageFormat || 'auto';
      if (fmt === 'auto' || fmt.startsWith('vehicle_empty') || fmt.startsWith('vehicle_otrp_reverse')) {
        active.common.imageFormat = 'vehicle_freight';
        if (selFmt) selFmt.value = 'vehicle_freight';
      }
      this._renderFormatOptions();
    } else if (this.mode === 'reverse_row') {
      // OTRP Reverse 指定時は標準 FreightImage を無効化する
      active.values.reverseRowMode = 'custom_row';
      active.values.reverseRow = String(row);
      active.values.hasFreightImage = false;
      if (!String(active.common.imageFormat || '').startsWith('vehicle_otrp_reverse')) {
        active.common.imageFormat = 'vehicle_otrp_reverse';
        if (selFmt) selFmt.value = 'vehicle_otrp_reverse';
      }
      this._renderFormatOptions();
    } else {
      const entries = this._getCurrentEntries();
      const target = entries[this.selectedKeyIdx];
      if (target) {
        if (!active.common.customImageCoords) active.common.customImageCoords = {};
        active.common.customImageCoords[target.key] = { row, col };
        if (this.selectedKeyIdx + 1 < entries.length) this.selectedKeyIdx += 1;
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

    document.getElementById('sel-dat-picker-format')?.addEventListener('change', (e) => {
      const active = this._activeItem();
      if (!active) return;
      const fmt = e.target.value;
      active.common.imageFormat = fmt;
      // FreightImage と OTRP Reverse の排他性を保つ
      if (fmt === 'vehicle_otrp_reverse' || fmt === 'vehicle_otrp_reverse_only' || fmt.startsWith('vehicle_empty')) {
        active.values.hasFreightImage = false;
      } else if (fmt === 'vehicle_freight' || fmt === 'vehicle_freight_typed') {
        active.values.hasFreightImage = true;
      }
      this.selectedKeyIdx = 0;
      this._renderFormatOptions();
      this.refreshAll();
    });

    document.getElementById('btn-dat-picker-seq-rows')?.addEventListener('click', () => {
      const baseRow = Math.max(0, parseInt(this.tempItems[0]?.common?.startRow, 10) || 0);
      this.tempItems.forEach((it, idx) => { it.common.startRow = String(baseRow + idx); });
      this.refreshAll();
    });

    document.getElementById('btn-dat-picker-align-cols')?.addEventListener('click', () => {
      const active = this._activeItem();
      if (!active) return;
      const col = active.common.startCol || '0';
      this.tempItems.forEach((it) => { it.common.startCol = String(col); });
      this.refreshAll();
    });

    document.getElementById('sel-dat-picker-mode')?.addEventListener('change', (e) => {
      this.mode = e.target.value;
      const guides = {
        origin: 'セルをクリックすると EmptyImage / 基本開始位置 (Y, X) を設定します。',
        freight_row: 'セルをクリックするとその行を FreightImage 開始行 (Y) に設定します。',
        reverse_row: 'セルをクリックするとその行を OTRP Reverse 開始行 (Y) に設定します。',
        per_key: '下のキーを選び、セルをクリックすると個別に座標を割り当てます。'
      };
      const guide = document.getElementById('lbl-dat-picker-guide');
      if (guide) guide.textContent = guides[this.mode] || guides.origin;
      this.refreshAll();
    });

    bindPickerViewportEvents(this, modal);

    document.getElementById('btn-dat-picker-reset-custom')?.addEventListener('click', () => {
      const active = this._activeItem();
      if (active) active.common.customImageCoords = null;
      this.refreshAll();
    });

    document.getElementById('btn-dat-picker-apply')?.addEventListener('click', () => {
      this.gen.applyImagePickerResult({
        items: this.tempItems.map(cloneDatEntry),
        activeIndex: this.tempActiveIdx
      });
      close();
    });
  }
}
