import { rgbToHex } from './color-utils.js';
import { PaintColorReplaceController } from './paint-color-replace.js';

export class PaintDialogs {
  constructor(editor) {
    this.editor = editor;
    this.colorReplace = new PaintColorReplaceController(editor);

    this.samplerModal = document.getElementById('modal-image-sampler');
    this.samplerCanvas = document.getElementById('sampler-canvas');
    this.samplerCtx = this.samplerCanvas.getContext('2d', { willReadFrequently: true });
    this.samplerViewport = document.getElementById('sampler-viewport');
    this.samplerPickedColors = new Set();
    this.samplerLoadedImg = null;
    this.samplerZoom = 1.0;
    this.samplerPanX = 0;
    this.samplerPanY = 0;
    this.samplerIsPanning = false;
    this.samplerPanStart = [0, 0];
    this.samplerMouseDownPos = [0, 0];

    this.keybindings = {
      pencil: 'KeyB',
      line: 'KeyL',
      rectFill: 'KeyR',
      bucket: 'KeyG',
      picker: 'KeyI',
      rectSelect: 'KeyM',
      polySelect: 'KeyP',
      wand: 'KeyW',
      colorSelect: 'KeyC',
      text: 'KeyT'
    };

    this._loadKeybindings();
    this._bindSamplerEvents();
  }

  _loadKeybindings() {
    const saved = localStorage.getItem('paint_keybindings');
    if (saved) {
      try { Object.assign(this.keybindings, JSON.parse(saved)); } catch (e) {}
    }
  }

  saveKeybindings() {
    localStorage.setItem('paint_keybindings', JSON.stringify(this.keybindings));
  }

  openColorReplaceDialog() {
    this.colorReplace.openDialog();
  }

  openSamplerModal() {
    this.samplerPickedColors.clear();
    this._renderSamplerPickedUI();
    this.samplerModal.showModal();

    if (!this.samplerLoadedImg && this.editor.app.baseImage) {
      this._drawSamplerImage(this.editor.app.baseImage);
    } else if (this.samplerLoadedImg) {
      this._fitSamplerImage();
    }
  }

  _drawSamplerImage(img) {
    this.samplerLoadedImg = img;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    this.samplerCanvas.width = w;
    this.samplerCanvas.height = h;

    this.samplerCtx.imageSmoothingEnabled = false;
    this.samplerCtx.drawImage(img, 0, 0, w, h);
    this._fitSamplerImage();
  }

  _fitSamplerImage() {
    if (!this.samplerLoadedImg) return;
    const vw = this.samplerViewport.clientWidth || 800;
    const vh = this.samplerViewport.clientHeight || 500;
    const w = this.samplerCanvas.width;
    const h = this.samplerCanvas.height;

    const fit = Math.max(0.5, Math.min(16, Math.min((vw - 40) / w, (vh - 40) / h)));
    this.samplerZoom = fit;
    this.samplerPanX = Math.round((vw - w * fit) / 2);
    this.samplerPanY = Math.round((vh - h * fit) / 2);
    this._updateSamplerTransform();
  }

  _updateSamplerTransform() {
    this.samplerCanvas.style.transformOrigin = '0 0';
    this.samplerCanvas.style.transform = `translate(${this.samplerPanX}px, ${this.samplerPanY}px) scale(${this.samplerZoom})`;
    document.getElementById('sampler-lbl-zoom').textContent = `${Math.round(this.samplerZoom * 100)}%`;
  }

  _bindSamplerEvents() {
    this.samplerViewport.addEventListener('contextmenu', (e) => e.preventDefault());
    if (this.samplerCanvas) {
      this.samplerCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    this.samplerViewport.style.cursor = 'crosshair';

    document.getElementById('btn-close-sampler').onclick = () => this.samplerModal.close();

    document.getElementById('btn-sampler-zoom-in').onclick = () => {
      this.samplerZoom = Math.min(32, this.samplerZoom * 1.25);
      this._updateSamplerTransform();
    };
    document.getElementById('btn-sampler-zoom-out').onclick = () => {
      this.samplerZoom = Math.max(0.2, this.samplerZoom * 0.8);
      this._updateSamplerTransform();
    };
    document.getElementById('btn-sampler-zoom-reset').onclick = () => {
      this.samplerZoom = 1.0;
      this._updateSamplerTransform();
    };
    document.getElementById('btn-sampler-zoom-fit').onclick = () => this._fitSamplerImage();

    this.samplerViewport.onwheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.25 : 0.8;
      const newZoom = Math.max(0.2, Math.min(32, this.samplerZoom * delta));
      const rect = this.samplerViewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const ix = (cx - this.samplerPanX) / this.samplerZoom;
      const iy = (cy - this.samplerPanY) / this.samplerZoom;
      this.samplerZoom = newZoom;
      this.samplerPanX = Math.round(cx - ix * newZoom);
      this.samplerPanY = Math.round(cy - iy * newZoom);
      this._updateSamplerTransform();
    };

    this.samplerViewport.onmousedown = (e) => {
      this.samplerIsPanning = true;
      this.samplerMouseDownPos = [e.clientX, e.clientY];
      this.samplerPanStart = [e.clientX - this.samplerPanX, e.clientY - this.samplerPanY];
    };

    window.addEventListener('mousemove', (e) => {
      if (this.samplerIsPanning && this.samplerModal.open) {
        this.samplerPanX = e.clientX - this.samplerPanStart[0];
        this.samplerPanY = e.clientY - this.samplerPanStart[1];
        this._updateSamplerTransform();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.samplerIsPanning || !this.samplerModal.open) return;
      this.samplerIsPanning = false;

      const dist = Math.hypot(e.clientX - this.samplerMouseDownPos[0], e.clientY - this.samplerMouseDownPos[1]);
      if (dist < 5 && this.samplerLoadedImg) {
        const rect = this.samplerViewport.getBoundingClientRect();
        const px = Math.floor((e.clientX - rect.left - this.samplerPanX) / this.samplerZoom);
        const py = Math.floor((e.clientY - rect.top - this.samplerPanY) / this.samplerZoom);

        if (px >= 0 && px < this.samplerCanvas.width && py >= 0 && py < this.samplerCanvas.height) {
          const p = this.samplerCtx.getImageData(px, py, 1, 1).data;
          if (p[3] > 0) {
            const hex = rgbToHex(p[0], p[1], p[2]);
            this.samplerPickedColors.add(hex);
            this._renderSamplerPickedUI();
          }
        }
      }
    });

    document.getElementById('btn-sampler-load-url').onclick = async () => {
      const url = document.getElementById('inp-sampler-url').value.trim();
      if (!url) return alert('画像のURLを入力してください。');
      try {
        const img = await this.editor.app.paletteManager.loadImageSafely(url);
        this._drawSamplerImage(img);
      } catch (err) {
        alert(err.message || '画像の読み込みに失敗しました。');
      }
    };

    document.getElementById('btn-sampler-local-file').onclick = () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = async () => {
        if (inp.files[0]) {
          try {
            const img = await this.editor.app.paletteManager.loadImageSafely(inp.files[0]);
            this._drawSamplerImage(img);
          } catch (err) {
            alert(err.message || '画像の読み込みに失敗しました。');
          }
        }
      };
      inp.click();
    };

    document.getElementById('btn-sampler-clear').onclick = () => {
      this.samplerPickedColors.clear();
      this._renderSamplerPickedUI();
    };

    document.getElementById('btn-sampler-apply').onclick = () => {
      if (this.samplerPickedColors.size === 0) {
        return alert('画像上をクリックして色を1つ以上採取してください。');
      }
      this.samplerPickedColors.forEach(hex => {
        this.editor.app.paletteManager.addColorToMaskPalette(hex);
      });
      this.editor._renderPaletteUI();
      this.samplerModal.close();
    };
  }

  _renderSamplerPickedUI() {
    const container = document.getElementById('sampler-picked-swatches');
    container.innerHTML = '';
    this.samplerPickedColors.forEach(hex => {
      const b = document.createElement('span');
      b.className = 'color-swatch';
      b.style.backgroundColor = hex;
      b.title = `${hex} (クリックで解除)`;
      b.style.cursor = 'pointer';
      b.onclick = () => {
        this.samplerPickedColors.delete(hex);
        this._renderSamplerPickedUI();
      };
      container.appendChild(b);
    });
  }

  openKeybindingDialog() {
    const d = document.getElementById('modal-keybindings');
    this._renderKeybindingTable();

    const btnExport = document.getElementById('btn-export-keybindings');
    if (btnExport) {
      btnExport.onclick = () => this.exportKeybindingsToFile();
    }

    const btnImport = document.getElementById('btn-import-keybindings');
    if (btnImport) {
      btnImport.onclick = () => this.importKeybindingsFromFile();
    }

    d.showModal();
    document.getElementById('btn-close-keybindings').onclick = () => d.close();
  }

  _renderKeybindingTable() {
    const tbody = document.querySelector('#table-keybindings tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const labels = {
      pencil: 'ドットブラシ',
      line: '直線 (連続)',
      rectFill: '矩形塗りつぶし',
      bucket: '塗りつぶし',
      picker: 'スポイト (色取得)',
      rectSelect: '矩形選択',
      polySelect: '多角形選択',
      wand: '自動選択 (Magic Wand)',
      colorSelect: '同色選択',
      text: 'テキスト挿入'
    };

    for (const [tool, code] of Object.entries(this.keybindings)) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${labels[tool] || tool}</td><td><button class="btn-bind" data-tool="${tool}">${code}</button></td>`;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('.btn-bind').forEach(btn => {
      btn.onclick = () => {
        btn.textContent = 'キー入力待ち...';
        const onKey = (e) => {
          e.preventDefault();
          this.keybindings[btn.dataset.tool] = e.code;
          btn.textContent = e.code;
          this.saveKeybindings();
          window.removeEventListener('keydown', onKey);
        };
        window.addEventListener('keydown', onKey, { once: true });
      };
    });
  }

  exportKeybindingsToFile() {
    const payload = {
      type: 'simutrans_paint_keybindings',
      version: '1.0',
      keybindings: { ...this.keybindings }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'paint_keybindings.json';
    a.click();
  }

  importKeybindingsFromFile() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const src = parsed.keybindings || parsed;
          if (!src || typeof src !== 'object') {
            alert('無効なキー設定ファイルです。');
            return;
          }
          let updated = 0;
          for (const key of Object.keys(this.keybindings)) {
            if (typeof src[key] === 'string' && src[key].length > 0) {
              this.keybindings[key] = src[key];
              updated++;
            }
          }
          if (updated === 0) {
            alert('適用可能なキー設定項目が見つかりませんでした。');
            return;
          }
          this.saveKeybindings();
          this._renderKeybindingTable();
          alert(`キーボード設定を読み込みました（${updated} 項目更新）。`);
        } catch (err) {
          alert('キー設定JSONの読み込みに失敗しました: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    inp.click();
  }
}
