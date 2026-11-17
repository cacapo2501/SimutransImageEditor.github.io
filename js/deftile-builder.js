import { generateBuildingFromDeftile, getBuildingOutputSize } from './deftile-generator.js';
import { renderDeftileModalUI } from './ui-deftile-modal.js';
import { loadImageAsync } from './project-io.js';

export class DeftileBuilder {
  constructor(app, pickFileFn) {
    this.app = app;
    this.pickFileFn = pickFileFn;
    this.initialized = false;

    this.deftileCanvas = null;
    this.deftileName = 'new_16x16.png';
    this.generatedCanvas = null;

    this.zoom = 2.0;
    this.panX = 20;
    this.panY = 20;
    this.isPanning = false;
    this.panStart = [0, 0];
  }

  _ensureInitialized() {
    if (this.initialized) return;
    renderDeftileModalUI();

    if (!this.deftileCanvas) {
      this._createBlankDeftile(16, 16, false);
    }
    this._bindEvents();
    this.initialized = true;
  }

  open() {
    this._ensureInitialized();
    const modal = document.getElementById('modal-deftile-builder');
    if (!modal) return;

    this.updatePreview();
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }

    requestAnimationFrame(() => {
      this.zoomFit();
    });
  }

  getOptions() {
    return {
      maxFloors: parseInt(document.getElementById('inp-deftile-floors')?.value, 10) || 4,
      pixelHeight: parseInt(document.getElementById('inp-deftile-px-height')?.value, 10) || 8,
      topColor: document.getElementById('inp-deftile-top-col')?.value || '#CCCCCC',
      southColor: document.getElementById('inp-deftile-south-col')?.value || '#B2B2B2',
      eastColor: document.getElementById('inp-deftile-east-col')?.value || '#808080',
      drawSeparator: Boolean(document.getElementById('chk-deftile-sep')?.checked),
      southSepColor: document.getElementById('inp-deftile-south-sep')?.value || '#999999',
      eastSepColor: document.getElementById('inp-deftile-east-sep')?.value || '#666666',
      smooth: Boolean(document.getElementById('chk-deftile-smooth')?.checked),
      layoutMode: document.getElementById('sel-deftile-layout')?.value || '4dir'
    };
  }

  setDeftileCanvas(canvas, name = null) {
    this.deftileCanvas = canvas;
    if (name) this.deftileName = name;
    const lbl = document.getElementById('lbl-deftile-info');
    if (lbl && this.deftileCanvas) {
      lbl.textContent = `DEFTILE: ${this.deftileName} (${this.deftileCanvas.width}×${this.deftileCanvas.height})`;
    }
    this.updatePreview();
  }

  _createBlankDeftile(w, h, openPaint = true) {
    const width = Math.max(1, Math.min(256, parseInt(w, 10) || 16));
    const height = Math.max(1, Math.min(256, parseInt(h, 10) || 16));
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    this.setDeftileCanvas(c, `new_${width}x${height}.png`);
    if (openPaint) {
      this.app.paintEditor.open('deftile');
    }
  }

  updatePreview() {
    if (!this.deftileCanvas) return;
    const opts = this.getOptions();
    this.generatedCanvas = generateBuildingFromDeftile(this.deftileCanvas, opts);

    const { totalW, totalH } = getBuildingOutputSize(
      this.deftileCanvas.width,
      this.deftileCanvas.height,
      opts.maxFloors,
      opts.pixelHeight,
      opts.layoutMode
    );
    const outLbl = document.getElementById('lbl-deftile-out-size');
    if (outLbl) outLbl.textContent = `出力: ${totalW}×${totalH}px`;

    const prevCanvas = document.getElementById('deftile-preview-canvas');
    if (prevCanvas && this.generatedCanvas) {
      prevCanvas.width = this.generatedCanvas.width;
      prevCanvas.height = this.generatedCanvas.height;
      const pCtx = prevCanvas.getContext('2d');
      pCtx.imageSmoothingEnabled = false;
      pCtx.drawImage(this.generatedCanvas, 0, 0);
      this._updatePreviewTransform();
    }
  }

  renderLiveMiniPreview(deftileCanvas) {
    const liveCanvas = document.getElementById('paint-deftile-live-canvas');
    if (!liveCanvas || !deftileCanvas) return;
    const opts = this.getOptions();
    const gen = generateBuildingFromDeftile(deftileCanvas, opts);
    liveCanvas.width = gen.width;
    liveCanvas.height = gen.height;
    const ctx = liveCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(gen, 0, 0);
  }

  _updatePreviewTransform() {
    const prevCanvas = document.getElementById('deftile-preview-canvas');
    if (!prevCanvas) return;
    prevCanvas.style.transformOrigin = '0 0';
    prevCanvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    const lbl = document.getElementById('lbl-deftile-zoom');
    if (lbl) lbl.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  zoomFit() {
    const vp = document.getElementById('deftile-preview-viewport');
    const prevCanvas = document.getElementById('deftile-preview-canvas');
    if (!vp || !prevCanvas || !prevCanvas.width) return;

    const vw = vp.clientWidth || 500;
    const vh = vp.clientHeight || 400;
    const s = Math.max(0.5, Math.min(8, Math.floor(Math.min((vw - 40) / prevCanvas.width, (vh - 40) / prevCanvas.height))));
    this.zoom = Math.max(1, s);
    this.panX = Math.round((vw - prevCanvas.width * this.zoom) / 2);
    this.panY = Math.round((vh - prevCanvas.height * this.zoom) / 2);
    this._updatePreviewTransform();
  }

  _bindEvents() {
    const modal = document.getElementById('modal-deftile-builder');
    document.getElementById('btn-close-deftile').onclick = () => modal.close();
    document.getElementById('btn-deftile-cancel').onclick = () => modal.close();

    document.getElementById('btn-deftile-load').onclick = async () => {
      const f = await this.pickFileFn('.png');
      if (!f) return;
      const img = await loadImageAsync(URL.createObjectURL(f));
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      this.setDeftileCanvas(c, f.name);
      this.zoomFit();
    };

    document.getElementById('btn-deftile-save').onclick = () => {
      if (!this.deftileCanvas) return;
      this.deftileCanvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = this.deftileName.toLowerCase().endsWith('.png') ? this.deftileName : `${this.deftileName}.png`;
        a.click();
      }, 'image/png');
    };

    document.getElementById('btn-deftile-paint').onclick = () => {
      this.app.paintEditor.open('deftile');
    };

    document.querySelectorAll('.btn-deftile-preset').forEach(btn => {
      btn.onclick = () => {
        document.getElementById('inp-deftile-new-w').value = btn.dataset.w;
        document.getElementById('inp-deftile-new-h').value = btn.dataset.h;
      };
    });

    document.getElementById('btn-deftile-new-create').onclick = () => {
      const w = parseInt(document.getElementById('inp-deftile-new-w').value, 10) || 16;
      const h = parseInt(document.getElementById('inp-deftile-new-h').value, 10) || 16;
      this._createBlankDeftile(w, h, true);
    };

    const liveIds = [
      'inp-deftile-floors', 'inp-deftile-px-height',
      'inp-deftile-top-col', 'inp-deftile-south-col', 'inp-deftile-south-sep',
      'inp-deftile-east-col', 'inp-deftile-east-sep',
      'chk-deftile-sep', 'chk-deftile-smooth', 'sel-deftile-layout'
    ];
    liveIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (id === 'inp-deftile-top-col') {
            document.getElementById('lbl-deftile-top-hex').textContent = el.value.toUpperCase();
          }
          this.updatePreview();
        });
        el.addEventListener('change', () => this.updatePreview());
      }
    });

    document.getElementById('btn-deftile-zoom-in').onclick = () => { this.zoom = Math.min(16, this.zoom * 1.25); this._updatePreviewTransform(); };
    document.getElementById('btn-deftile-zoom-out').onclick = () => { this.zoom = Math.max(0.25, this.zoom * 0.8); this._updatePreviewTransform(); };
    document.getElementById('btn-deftile-zoom-fit').onclick = () => this.zoomFit();

    const vp = document.getElementById('deftile-preview-viewport');
    vp.onwheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.25 : 0.8;
      this.zoom = Math.max(0.25, Math.min(16, this.zoom * delta));
      this._updatePreviewTransform();
    };
    vp.onmousedown = (e) => {
      this.isPanning = true;
      this.panStart = [e.clientX - this.panX, e.clientY - this.panY];
    };
    window.addEventListener('mousemove', (e) => {
      if (this.isPanning && modal.open) {
        this.panX = e.clientX - this.panStart[0];
        this.panY = e.clientY - this.panStart[1];
        this._updatePreviewTransform();
      }
    });
    window.addEventListener('mouseup', () => { this.isPanning = false; });

    document.getElementById('btn-deftile-apply-base').onclick = () => {
      if (!this.generatedCanvas) this.updatePreview();
      const baseName = this.deftileName.replace(/\.[^/.]+$/, '') + '_base.png';
      const reset = !document.getElementById('chk-keep-state-on-base-load')?.checked;
      this.app.applyBaseImage(this.generatedCanvas, baseName, { resetMask: reset, resetDat: reset });
      if (reset) {
        this.app.tileCutter?.applyFromDeftile(
          this.deftileCanvas.width,
          this.deftileCanvas.height,
          this.getOptions(),
          this.generatedCanvas.height
        );
      }
      this.app.isDirty = true;
      this.app.zoomFit();
      this.app.render();
      modal.close();
    };
  }
}