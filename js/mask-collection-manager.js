import { MaskGenerator } from './mask-generator.js';
import { cloneCanvasFromSource } from './paint-resize.js';
import { Layer } from './layer.js';

export class MaskCollectionManager {
  constructor(app) {
    this.app = app;
    this.items = [];
    this.activeIndex = -1;
    this._nextId = 1;
  }

  bindEvents() {
    const selMask = document.getElementById('sel-active-mask');
    if (selMask) {
      selMask.onchange = (e) => {
        const idx = parseInt(e.target.value, 10);
        if (!Number.isNaN(idx)) this.selectMask(idx);
      };
    }

    const inpName = document.getElementById('inp-mask-name');
    if (inpName) {
      inpName.oninput = (e) => {
        const cur = this.getActive();
        if (!cur) return;
        cur.name = e.target.value;
        this.app.maskName = cur.name;
        this._refreshSelectOptionsOnly();
        this._updateInfoLabel();
        if (this.app.layerManager) this.app.layerManager._updateTargetMaskDropdownOptions();
        this.app.markDirty();
      };
    }

    document.getElementById('btn-mask-add-file')?.addEventListener('click', async () => {
      if (!this.app.baseImage) {
        alert('先にベース画像を開くか、新規作成してください。');
        return;
      }
      const f = await this.app.imageIOCtrl.pickFileFn('.png');
      if (f) await this.app.loadMaskFromFile(f, { addAsNew: true });
    });

    document.getElementById('btn-mask-add-from-base')?.addEventListener('click', () => this.addNewFromBase());
    document.getElementById('btn-mask-duplicate')?.addEventListener('click', () => this.duplicateActiveMask());
    document.getElementById('btn-mask-delete')?.addEventListener('click', () => this.deleteActiveMask());
  }

  getActive() {
    if (this.activeIndex < 0 || this.activeIndex >= this.items.length) return null;
    return this.items[this.activeIndex];
  }

  clearAll() {
    this.items = [];
    this.activeIndex = -1;
    this._syncAppFromActive();
    this.refreshUI();
    if (this.app.layerManager) this.app.layerManager.onMaskCollectionChanged();
  }

  saveActiveStateFromApp() {
    const cur = this.getActive();
    if (!cur) return;
    cur.name = this.app.maskName;
    cur.image = this.app.maskImage;
    cur.rgb = this.app.maskRgb;
    cur.colors = [...this.app.maskColors];
    cur.tintColors = new Map(this.app.maskTintColors);
    cur.toneOverrides = new Map(
      Array.from(this.app.maskToneOverrides.entries()).map(([k, v]) => [k, { ...v }])
    );
  }

  _syncAppFromActive() {
    const cur = this.getActive();
    const app = this.app;
    if (!cur) {
      app.maskImage = null;
      app.maskName = 'mask.png';
      app.maskRgb = null;
      app.maskColors = [];
      app.maskTintColors = new Map();
      app.maskToneOverrides = new Map();
      return;
    }

    app.maskImage = cur.image;
    app.maskName = cur.name;
    app.maskRgb = cur.rgb;
    app.maskColors = [...cur.colors];
    app.maskTintColors = new Map(cur.tintColors);
    app.maskToneOverrides = new Map(
      Array.from(cur.toneOverrides.entries()).map(([k, v]) => [k, { ...v }])
    );
  }

  registerAnalyzedMask(img, name, { addAsNew = false } = {}) {
    this.saveActiveStateFromApp();

    if (addAsNew || this.items.length === 0) {
      const entry = {
        id: this._nextId++,
        name: name || `mask_${this.items.length + 1}.png`,
        image: img,
        rgb: null,
        colors: [],
        tintColors: new Map(),
        toneOverrides: new Map()
      };
      this.items.push(entry);
      this.activeIndex = this.items.length - 1;
    } else {
      const cur = this.getActive();
      cur.name = name || cur.name;
      cur.image = img;
    }

    MaskGenerator.analyzeMaskImage(this.app, img, name);
    this.saveActiveStateFromApp();
    this.refreshUI();
    if (this.app.layerManager) this.app.layerManager.onMaskCollectionChanged();
  }

  selectMask(idx) {
    if (idx < 0 || idx >= this.items.length) return;
    if (idx === this.activeIndex) return;

    this.saveActiveStateFromApp();
    this.activeIndex = idx;
    this._syncAppFromActive();

    if (this.app.toneTintCtrl) {
      this.app.toneTintCtrl.updateMaskCombos();
      this.app.toneTintCtrl.updateTintTable();
      this.app.toneTintCtrl.onToneTargetChanged('__ALL__');
    }
    this.refreshUI();
    if (this.app.layerManager) this.app.layerManager.onMaskCollectionChanged();
    this.app.render();
  }

  addNewFromBase() {
    const app = this.app;
    if (!app.baseImage) {
      alert('先にベース画像を開くか、新規作成してください。');
      return;
    }
    this.saveActiveStateFromApp();

    const basePrefix = app.baseName.replace(/\.png$/i, '');
    const newName = `${basePrefix}_paint_${this.items.length + 1}.png`;
    const entry = {
      id: this._nextId++,
      name: newName,
      image: null,
      rgb: null,
      colors: [],
      tintColors: new Map(),
      toneOverrides: new Map()
    };
    this.items.push(entry);
    this.activeIndex = this.items.length - 1;
    this._syncAppFromActive();

    MaskGenerator.generateFromBase(app);
    this.saveActiveStateFromApp();

    if (app.toneTintCtrl) {
      app.toneTintCtrl.updateMaskCombos();
      app.toneTintCtrl.updateTintTable();
    }
    this.refreshUI();
    if (app.layerManager) app.layerManager.onMaskCollectionChanged();
    app.markDirty();
    app.render();
  }

  duplicateActiveMask() {
    const cur = this.getActive();
    if (!cur || !cur.image) {
      alert('複製するマスク画像がありません。');
      return;
    }
    this.saveActiveStateFromApp();

    const oldMaskId = cur.id;
    const newMaskId = this._nextId++;
    const clonedCanvas = cloneCanvasFromSource(cur.image);
    const copyName = cur.name.replace(/(\.png)?$/i, '_copy$1');
    const copyEntry = {
      id: newMaskId,
      name: copyName,
      image: clonedCanvas,
      rgb: cur.rgb ? new Uint8Array(cur.rgb) : null,
      colors: cur.colors.map(c => ({ ...c })),
      tintColors: new Map(cur.tintColors),
      toneOverrides: new Map(
        Array.from(cur.toneOverrides.entries()).map(([k, v]) => [k, { ...v }])
      )
    };

    // 複製元マスク専用レイヤーがあれば新しいマスク専用として自動複製
    const dedicatedLayers = this.app.layers.filter(l => l.targetMaskId === oldMaskId);
    dedicatedLayers.forEach(src => {
      const master = src.sourceLayer || src;
      this.app.layers.push(new Layer({
        name: src.name,
        imageElement: master.imageElement,
        canvasW: this.app.baseW,
        canvasH: this.app.baseH,
        layerType: src.layerType,
        corners: src.corners.map(([x, y]) => [x, y]),
        transformMode: src.transformMode,
        opacity: src.opacity,
        visible: src.visible,
        fillAll: src.fillAll,
        transparentE7ffff: src.transparentE7ffff,
        excludeMaskColor: src.excludeMaskColor,
        tileX: src.tileX,
        tileY: src.tileY,
        targetMaskColor: src.targetMaskColor ? [...src.targetMaskColor] : null,
        targetMaskId: newMaskId,
        sourceLayer: master
      }));
    });

    this.items.splice(this.activeIndex + 1, 0, copyEntry);
    this.activeIndex = this.activeIndex + 1;
    this._syncAppFromActive();

    if (this.app.toneTintCtrl) {
      this.app.toneTintCtrl.updateMaskCombos();
      this.app.toneTintCtrl.updateTintTable();
    }
    this.refreshUI();
    if (this.app.layerManager) this.app.layerManager.onMaskCollectionChanged();
    this.app.markDirty();
    this.app.render();
  }

  deleteActiveMask() {
    if (this.items.length === 0) return;
    const cur = this.getActive();
    const deletedId = cur.id;

    if (this.items.length === 1) {
      if (!confirm('最後のマスク画像を削除して未設定状態に戻しますか？')) return;
      this.app.layers = this.app.layers.filter(l => l.targetMaskId !== deletedId);
      this.clearAll();
      if (this.app.toneTintCtrl) {
        this.app.toneTintCtrl.updateMaskCombos();
        this.app.toneTintCtrl.updateTintTable();
      }
      this.app.markDirty();
      this.app.render();
      return;
    }

    if (!confirm(`マスク画像「${cur.name}」を削除しますか？（このマスク専用のレイヤーも削除されます）`)) return;

    this.app.layers = this.app.layers.filter(l => l.targetMaskId !== deletedId);
    this.items.splice(this.activeIndex, 1);
    this.activeIndex = Math.min(this.activeIndex, this.items.length - 1);
    this._syncAppFromActive();

    if (this.app.toneTintCtrl) {
      this.app.toneTintCtrl.updateMaskCombos();
      this.app.toneTintCtrl.updateTintTable();
    }
    this.refreshUI();
    if (this.app.layerManager) this.app.layerManager.onMaskCollectionChanged();
    this.app.markDirty();
    this.app.render();
  }

  _refreshSelectOptionsOnly() {
    const sel = document.getElementById('sel-active-mask');
    if (!sel) return;
    if (this.items.length === 0) {
      sel.innerHTML = '<option value="-1">(マスク未登録)</option>';
      return;
    }
    sel.innerHTML = this.items.map((item, idx) => {
      const selected = idx === this.activeIndex ? ' selected' : '';
      return `<option value="${idx}"${selected}>[${idx + 1}/${this.items.length}] ${item.name}</option>`;
    }).join('');
  }

  _updateInfoLabel() {
    const info = document.getElementById('lbl-mask-info');
    if (!info) return;
    const cur = this.getActive();
    if (!cur) {
      info.textContent = 'マスク: 未読込 (0件)';
    } else {
      info.textContent = `マスク (${this.activeIndex + 1}/${this.items.length}): ${cur.name} (${cur.colors.length}色)`;
    }
  }

  refreshUI() {
    this._refreshSelectOptionsOnly();
    this._updateInfoLabel();

    const inpName = document.getElementById('inp-mask-name');
    const cur = this.getActive();
    if (inpName) {
      inpName.value = cur ? cur.name : '';
      inpName.disabled = !cur;
    }
  }
}