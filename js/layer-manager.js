import { rgbToHex, hexToRgb } from './color-utils.js';
import { Layer } from './layer.js';
import { loadImageAsync } from './project-io.js';

export class LayerManager {
  constructor(app, pickFileFn) {
    this.app = app;
    this.pickFileFn = pickFileFn;
  }

  bindEvents() {
    document.getElementById('btn-add-multiply').onclick = () => this.addLayer('multiply');
    document.getElementById('btn-add-structure').onclick = () => this.addLayer('structure');
    document.getElementById('btn-copy-layer').onclick = () => this.openCopyLayerDialog();
    document.getElementById('btn-del-layer').onclick = () => this.delLayer();
    document.getElementById('btn-layer-up').onclick = () => this.moveLayer(-1);
    document.getElementById('btn-layer-down').onclick = () => this.moveLayer(1);
    document.getElementById('btn-layer-replace').onclick = () => this.replaceLayerImage();

    document.querySelectorAll('input[name="layer-type"]').forEach(r => {
      r.onchange = (e) => {
        if (this.app.activeIdx >= 0) {
          this.app.layers[this.app.activeIdx].layerType = e.target.value;
          this.refreshList();
          this.app.markDirty();
          this.app.render();
        }
      };
    });

    document.getElementById('chk-trans-e7ffff').onchange = (e) => {
      if (this.app.activeIdx >= 0) {
        this.app.layers[this.app.activeIdx].transparentE7ffff = e.target.checked;
        this.app.markDirty();
        this.app.render();
      }
    };

    const selTargetMask = document.getElementById('sel-layer-target-mask');
    if (selTargetMask) {
      selTargetMask.onchange = (e) => {
        if (this.app.activeIdx < 0) return;
        const raw = e.target.value;
        const nextMaskId = raw === '' ? null : parseInt(raw, 10);
        this.app.layers[this.app.activeIdx].targetMaskId = Number.isNaN(nextMaskId) ? null : nextMaskId;
        this.app.markDirty();
        this.onMaskCollectionChanged();
        this.app.render();
      };
    }

    document.getElementById('chk-exclude-mask').onchange = (e) => {
      if (this.app.activeIdx >= 0) {
        this.app.layers[this.app.activeIdx].excludeMaskColor = e.target.checked;
        this.syncActiveUI();
        this.app.markDirty();
        this.app.render();
      }
    };

    document.getElementById('chk-fill-all').onchange = (e) => {
      if (this.app.activeIdx >= 0) {
        this.app.layers[this.app.activeIdx].fillAll = e.target.checked;
        this.app.markDirty();
        this.app.render();
      }
    };

    document.getElementById('select-transform-mode').onchange = (e) => {
      if (this.app.activeIdx >= 0) {
        this.app.layers[this.app.activeIdx].transformMode = e.target.value;
        this.app.markDirty();
        this.app.render();
      }
    };

    document.getElementById('slider-opacity').oninput = (e) => {
      if (this.app.activeIdx >= 0) {
        this.app.layers[this.app.activeIdx].opacity = parseFloat(e.target.value);
        document.getElementById('lbl-opacity').textContent = `${Math.round(e.target.value * 100)}%`;
        this.app.markDirty();
        this.app.render();
      }
    };

    document.getElementById('chk-layer-visible').onchange = (e) => {
      if (this.app.activeIdx >= 0) {
        this.app.layers[this.app.activeIdx].visible = e.target.checked;
        this.app.markDirty();
        this.app.render();
      }
    };

    document.querySelectorAll('.btn-step').forEach(btn => {
      btn.onclick = () => {
        if (this.app.activeIdx < 0) return;
        const l = this.app.layers[this.app.activeIdx];
        const d = parseFloat(btn.dataset.delta);
        if (btn.dataset.axis === 'x') l.tileX = Math.max(0.01, Math.round((l.tileX + d) * 100) / 100);
        else l.tileY = Math.max(0.01, Math.round((l.tileY + d) * 100) / 100);
        document.getElementById('lbl-tile-x').textContent = l.tileX.toFixed(1);
        document.getElementById('lbl-tile-y').textContent = l.tileY.toFixed(1);
        this.app.markDirty();
        this.app.render();
      };
    });

    document.getElementById('chk-pixel-snap').onchange = (e) => { this.app.pixelSnap = e.target.checked; };

    document.getElementById('btn-snap-now').onclick = () => {
      if (this.app.activeIdx >= 0) {
        this.app.layers[this.app.activeIdx].corners = this.app.layers[this.app.activeIdx].corners.map(
          ([x, y]) => [Math.round(x), Math.round(y)]
        );
        this.app.markDirty();
        this.app.render();
      }
    };

    document.getElementById('btn-eyedropper').onclick = () => this.app.toggleEyedropper();

    document.getElementById('mask-color-combo').onchange = (e) => {
      if (this.app.activeIdx < 0) return;
      this.app.layers[this.app.activeIdx].targetMaskColor = e.target.value ? hexToRgb(e.target.value) : null;
      this.syncActiveUI();
      this.app.markDirty();
      this.app.render();
    };

    document.getElementById('btn-clear-mask').onclick = () => {
      if (this.app.activeIdx < 0) return;
      this.app.layers[this.app.activeIdx].targetMaskColor = null;
      this.app.layers[this.app.activeIdx].excludeMaskColor = false;
      this.syncActiveUI();
      this.app.markDirty();
      this.app.render();
    };
  }

  getActiveMaskId() {
    return this.app.maskMgr?.getActive()?.id ?? null;
  }

  getVisibleLayerIndices() {
    const activeMaskId = this.getActiveMaskId();
    const indices = [];
    this.app.layers.forEach((l, i) => {
      if (l.isActiveForMask(activeMaskId)) indices.push(i);
    });
    return indices;
  }

  onMaskCollectionChanged() {
    this._updateTargetMaskDropdownOptions();
    const visibleIndices = this.getVisibleLayerIndices();

    if (this.app.activeIdx >= 0 && !visibleIndices.includes(this.app.activeIdx)) {
      this.app.activeIdx = visibleIndices.length > 0 ? visibleIndices[0] : -1;
    } else if (this.app.activeIdx < 0 && visibleIndices.length > 0) {
      this.app.activeIdx = visibleIndices[0];
    }

    this.refreshList();
    this.syncActiveUI();
  }

  _updateTargetMaskDropdownOptions() {
    const sel = document.getElementById('sel-layer-target-mask');
    if (!sel) return;

    const masks = this.app.maskMgr?.items || [];
    const opts = ['<option value="">すべてのマスク画像に適用 (共通)</option>'];
    masks.forEach((m, idx) => {
      opts.push(`<option value="${m.id}">[${idx + 1}] ${m.name} のみに適用</option>`);
    });
    sel.innerHTML = opts.join('');

    const curLayer = this.app.activeIdx >= 0 ? this.app.layers[this.app.activeIdx] : null;
    sel.value = curLayer && curLayer.targetMaskId !== null ? String(curLayer.targetMaskId) : '';
  }

  refreshList() {
    const lb = document.getElementById('layer-listbox');
    if (!lb) return;
    lb.innerHTML = '';

    const activeMaskId = this.getActiveMaskId();
    const masks = this.app.maskMgr?.items || [];

    this.app.layers.forEach((l, i) => {
      if (!l.isActiveForMask(activeMaskId)) return;

      const tag = l.sourceLayer ? '[小物(参照)]' : (l.layerType === 'structure' ? '[小物]' : '[乗算]');
      const scopeTag = l.targetMaskId !== null ? '[マスク専用] ' : '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'layer-list-item' + (i === this.app.activeIdx ? ' selected' : '');
      btn.textContent = `${tag} ${scopeTag}${l.name}`;

      if (l.targetMaskId !== null) {
        const mObj = masks.find(m => m.id === l.targetMaskId);
        btn.title = mObj ? `対象マスク: ${mObj.name}` : '特定マスク専用';
      }

      const handleSelect = (e) => { e.preventDefault(); this.select(i); };
      btn.addEventListener('pointerdown', handleSelect);
      btn.addEventListener('click', handleSelect);
      lb.appendChild(btn);
    });
  }

  select(idx) {
    this.app.activeIdx = idx;
    this.refreshList();
    this.syncActiveUI();
    if (idx >= 0) {
      const acc = document.getElementById('accordion-layer');
      if (acc && !acc.open) acc.open = true;
    }
    this.app.render();
  }

  syncActiveUI() {
    this._updateTargetMaskDropdownOptions();
    const idx = this.app.activeIdx;
    if (idx < 0 || idx >= this.app.layers.length) return;
    const l = this.app.layers[idx];

    document.querySelector(`input[name="layer-type"][value="${l.layerType}"]`).checked = true;
    document.getElementById('chk-trans-e7ffff').checked = l.transparentE7ffff;
    document.getElementById('chk-exclude-mask').checked = l.excludeMaskColor;
    document.getElementById('chk-fill-all').checked = l.fillAll;
    document.getElementById('slider-opacity').value = l.opacity;
    document.getElementById('lbl-opacity').textContent = `${Math.round(l.opacity * 100)}%`;
    document.getElementById('chk-layer-visible').checked = l.visible;
    document.getElementById('select-transform-mode').value = l.transformMode;
    document.getElementById('lbl-tile-x').textContent = l.tileX.toFixed(1);
    document.getElementById('lbl-tile-y').textContent = l.tileY.toFixed(1);

    const selTargetMask = document.getElementById('sel-layer-target-mask');
    if (selTargetMask) {
      selTargetMask.value = l.targetMaskId !== null ? String(l.targetMaskId) : '';
    }

    if (l.targetMaskColor) {
      const hex = rgbToHex(...l.targetMaskColor);
      document.getElementById('layer-mask-swatch').style.backgroundColor = hex;
      document.getElementById('lbl-layer-mask').textContent = l.excludeMaskColor
        ? `適用先: ${hex} 以外 (この色を除外)`
        : `適用先: ${hex} (この色のみに適用)`;
      if (this.app.toneTintCtrl) this.app.toneTintCtrl.setLayerMaskValue(hex);
    } else {
      document.getElementById('layer-mask-swatch').style.backgroundColor = '#FFFFFF';
      document.getElementById('lbl-layer-mask').textContent = '適用先: 全体 (マスクなし)';
      if (this.app.toneTintCtrl) this.app.toneTintCtrl.setLayerMaskValue('');
    }
  }

  async addLayer(layerType) {
    if (!this.app.baseImage) return alert('先にベース画像を読み込んでください。');
    const file = await this.pickFileFn('.png');
    if (!file) return;
    const img = await loadImageAsync(URL.createObjectURL(file));
    const l = new Layer({
      name: file.name,
      imageElement: img,
      canvasW: this.app.baseW,
      canvasH: this.app.baseH,
      layerType: layerType,
      targetMaskId: null
    });
    this.app.layers.push(l);
    this.select(this.app.layers.length - 1);
    this.app.markDirty();
    this.app.render();
  }

  openCopyLayerDialog() {
    const idx = this.app.activeIdx;
    if (idx < 0 || idx >= this.app.layers.length) return;

    const masks = this.app.maskMgr?.items || [];
    const modal = document.getElementById('modal-copy-layer');
    const sel = document.getElementById('sel-copy-target-mask');

    if (!modal || !sel || masks.length === 0) {
      this._executeCopyLayer(null, false);
      return;
    }

    const activeMaskId = this.getActiveMaskId();
    const opts = ['<option value="">すべてのマスク画像に適用 (共通)</option>'];
    masks.forEach((m, i) => {
      const selected = m.id === activeMaskId ? ' selected' : '';
      opts.push(`<option value="${m.id}"${selected}>[${i + 1}] ${m.name} のみに適用</option>`);
    });
    sel.innerHTML = opts.join('');

    document.getElementById('btn-copy-layer-ok').onclick = () => {
      const raw = sel.value;
      const targetMaskId = raw === '' ? null : parseInt(raw, 10);
      const switchMask = Boolean(document.getElementById('chk-copy-switch-mask')?.checked);
      modal.close();
      this._executeCopyLayer(Number.isNaN(targetMaskId) ? null : targetMaskId, switchMask);
    };

    document.getElementById('btn-copy-layer-cancel').onclick = () => modal.close();
    modal.showModal();
  }

  _executeCopyLayer(targetMaskId, switchToTargetMask) {
    const idx = this.app.activeIdx;
    if (idx < 0 || idx >= this.app.layers.length) return;
    const src = this.app.layers[idx];
    const master = src.sourceLayer || src;

    const copy = new Layer({
      name: master.name,
      imageElement: master.imageElement,
      canvasW: this.app.baseW,
      canvasH: this.app.baseH,
      layerType: src.layerType,
      corners: src.corners.map(([x, y]) => [x + 10, y + 10]),
      transformMode: src.transformMode,
      opacity: src.opacity,
      visible: src.visible,
      fillAll: src.fillAll,
      transparentE7ffff: src.transparentE7ffff,
      excludeMaskColor: src.excludeMaskColor,
      tileX: src.tileX,
      tileY: src.tileY,
      targetMaskColor: src.targetMaskColor ? [...src.targetMaskColor] : null,
      targetMaskId: targetMaskId,
      sourceLayer: master
    });

    this.app.layers.push(copy);
    const newIdx = this.app.layers.length - 1;

    if (switchToTargetMask && targetMaskId !== null && this.app.maskMgr) {
      const mIdx = this.app.maskMgr.items.findIndex(m => m.id === targetMaskId);
      if (mIdx >= 0 && mIdx !== this.app.maskMgr.activeIndex) {
        this.app.maskMgr.selectMask(mIdx);
      }
    }

    this.onMaskCollectionChanged();
    if (this.getVisibleLayerIndices().includes(newIdx)) {
      this.select(newIdx);
    }
    this.app.markDirty();
    this.app.render();
  }

  delLayer() {
    const idx = this.app.activeIdx;
    if (idx < 0) return;
    this.app.layers.splice(idx, 1);
    const visible = this.getVisibleLayerIndices();
    this.app.activeIdx = visible.length > 0 ? visible[0] : -1;
    this.refreshList();
    this.syncActiveUI();
    this.app.markDirty();
    this.app.render();
  }

  moveLayer(delta) {
    const idx = this.app.activeIdx;
    if (idx < 0) return;
    const visible = this.getVisibleLayerIndices();
    const pos = visible.indexOf(idx);
    if (pos < 0) return;

    const targetPos = pos + delta;
    if (targetPos < 0 || targetPos >= visible.length) return;
    const targetIdx = visible[targetPos];

    const temp = this.app.layers[idx];
    this.app.layers[idx] = this.app.layers[targetIdx];
    this.app.layers[targetIdx] = temp;
    this.select(targetIdx);
    this.app.markDirty();
    this.app.render();
  }

  async replaceLayerImage() {
    const idx = this.app.activeIdx;
    if (idx < 0) return;
    const file = await this.pickFileFn('.png');
    if (!file) return;
    const img = await loadImageAsync(URL.createObjectURL(file));
    this.app.layers[idx].replaceImage(img, file.name);
    this.refreshList();
    this.app.markDirty();
    this.app.render();
  }
}