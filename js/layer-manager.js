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
    document.getElementById('btn-copy-layer').onclick = () => this.copyLayer();
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

    document.getElementById('chk-pixel-snap').onchange = (e) => {
      this.app.pixelSnap = e.target.checked;
    };

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
      this.syncActiveUI();
      this.app.markDirty();
      this.app.render();
    };
  }

  refreshList() {
    const lb = document.getElementById('layer-listbox');
    if (!lb) return;
    lb.innerHTML = '';
    this.app.layers.forEach((l, i) => {
      const tag = l.sourceLayer ? '[小物(参照)]' : (l.layerType === 'structure' ? '[小物]' : '[乗算]');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'layer-list-item' + (i === this.app.activeIdx ? ' selected' : '');
      btn.textContent = `${tag} ${l.name}`;

      const handleSelect = (e) => { e.preventDefault(); this.select(i); };
      btn.addEventListener('pointerdown', handleSelect);
      btn.addEventListener('click', handleSelect);
      lb.appendChild(btn);
    });
  }

  select(idx) {
    this.app.activeIdx = idx;
    const items = document.querySelectorAll('#layer-listbox .layer-list-item');
    items.forEach((item, i) => {
      if (i === idx) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });

    this.syncActiveUI();
    if (idx >= 0) {
      const acc = document.getElementById('accordion-layer');
      if (acc && !acc.open) acc.open = true;
    }
    this.app.render();
  }

  syncActiveUI() {
    const idx = this.app.activeIdx;
    if (idx < 0 || idx >= this.app.layers.length) return;
    const l = this.app.layers[idx];

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
      layerType: layerType
    });
    this.app.layers.push(l);
    this.refreshList();
    this.select(this.app.layers.length - 1);
    this.app.markDirty();
    this.app.render();
  }

  copyLayer() {
    const idx = this.app.activeIdx;
    if (idx < 0) return;
    const src = this.app.layers[idx];
    const master = src.sourceLayer || src;
    const copy = new Layer({
      name: master.name,
      imageElement: master.imageElement,
      canvasW: this.app.baseW,
      canvasH: this.app.baseH,
      corners: src.corners.map(([x, y]) => [x + 10, y + 10]),
      sourceLayer: master,
      fillAll: master.fillAll,
      transparentE7ffff: master.transparentE7ffff
    });
    this.app.layers.push(copy);
    this.refreshList();
    this.select(this.app.layers.length - 1);
    this.app.markDirty();
    this.app.render();
  }

  delLayer() {
    const idx = this.app.activeIdx;
    if (idx < 0) return;
    this.app.layers.splice(idx, 1);
    this.refreshList();
    this.select(Math.min(idx, this.app.layers.length - 1));
    this.app.markDirty();
    this.app.render();
  }

  moveLayer(delta) {
    const idx = this.app.activeIdx;
    if (idx < 0) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= this.app.layers.length) return;
    const temp = this.app.layers[idx];
    this.app.layers[idx] = this.app.layers[targetIdx];
    this.app.layers[targetIdx] = temp;
    this.refreshList();
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
