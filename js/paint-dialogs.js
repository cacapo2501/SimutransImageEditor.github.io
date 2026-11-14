import { hexToRgb, rgbToHex } from './color-utils.js';

export class PaintDialogs {
  constructor(editor) {
    this.editor = editor;

    // 画像スポイトモーダル要素
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

    // 色置換モーダル要素
    this.replaceModal = document.getElementById('modal-color-replace');
    this.replaceRules = [];

    // キーバインド設定
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
    this._bindReplaceEvents();
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

  // --- 1. 画像スポイトモーダル ---
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
      b.title = `${hex} (クリックで削除)`;
      b.style.cursor = 'pointer';
      b.onclick = () => {
        this.samplerPickedColors.delete(hex);
        this._renderSamplerPickedUI();
      };
      container.appendChild(b);
    });
  }

  // --- 2. 色置換・複数色置換モーダル ---
  openColorReplaceDialog() {
    this.replaceRules = [{ from: this.editor.currentColor, to: '#FFFFFF' }];
    this._renderReplaceRulesUI();
    this.replaceModal.showModal();
  }

  _renderReplaceRulesUI() {
    const container = document.getElementById('replace-rules-container');
    container.innerHTML = '';

    this.replaceRules.forEach((rule, idx) => {
      const row = document.createElement('div');
      row.className = 'replace-rule-row';
      row.innerHTML = `
        <span>元:</span>
        <button class="btn-color-pick btn-from">
          <span class="color-swatch" style="background:${rule.from};"></span>
          <span>${rule.from}</span>
        </button>
        <span class="arrow">➔</span>
        <span>先:</span>
        <button class="btn-color-pick btn-to">
          <span class="color-swatch" style="background:${rule.to};"></span>
          <span>${rule.to}</span>
        </button>
        <button class="btn-del-rule" style="margin-left:auto; color:#ff6b6b;">✕</button>
      `;

      row.querySelector('.btn-from').onclick = async () => {
        const picked = await this.editor.app.colorPicker.open(rule.from);
        if (picked) { rule.from = picked; this._renderReplaceRulesUI(); }
      };

      row.querySelector('.btn-to').onclick = async () => {
        const picked = await this.editor.app.colorPicker.open(rule.to);
        if (picked) { rule.to = picked; this._renderReplaceRulesUI(); }
      };

      row.querySelector('.btn-del-rule').onclick = () => {
        if (this.replaceRules.length > 1) {
          this.replaceRules.splice(idx, 1);
          this._renderReplaceRulesUI();
        }
      };

      container.appendChild(row);
    });
  }

  _bindReplaceEvents() {
    document.getElementById('btn-close-replace').onclick = () => this.replaceModal.close();
    document.getElementById('btn-cancel-replace').onclick = () => this.replaceModal.close();

    document.getElementById('btn-add-replace-rule').onclick = () => {
      this.replaceRules.push({ from: '#000000', to: '#FFFFFF' });
      this._renderReplaceRulesUI();
    };

    document.getElementById('btn-execute-replace').onclick = () => this._executeColorReplace();
  }

  _executeColorReplace() {
    if (this.replaceRules.length === 0) return;

    const ed = this.editor;
    const selectionOnly = document.getElementById('chk-replace-selection-only').checked;
    const mask = selectionOnly ? ed.selectionMask : null;

    const preparedRules = this.replaceRules.map(r => ({
      fromRgb: hexToRgb(r.from),
      toRgb: hexToRgb(r.to)
    }));

    ed._pushHistory();
    const imgData = ed.ctx.getImageData(0, 0, ed.width, ed.height);
    const d = imgData.data;
    let replacedCount = 0;

    for (let y = 0; y < ed.height; y++) {
      for (let x = 0; x < ed.width; x++) {
        const pIdx = y * ed.width + x;
        if (mask && !mask[pIdx]) continue;

        const idx = pIdx * 4;
        if (d[idx + 3] === 0) continue;

        const r = d[idx], g = d[idx + 1], b = d[idx + 2];

        for (const rule of preparedRules) {
          if (r === rule.fromRgb[0] && g === rule.fromRgb[1] && b === rule.fromRgb[2]) {
            d[idx] = rule.toRgb[0];
            d[idx + 1] = rule.toRgb[1];
            d[idx + 2] = rule.toRgb[2];
            replacedCount++;
            break;
          }
        }
      }
    }

    ed.ctx.putImageData(imgData, 0, 0);
    ed._drawOverlay();
    this.replaceModal.close();
    alert(`色置換が完了しました。（${replacedCount} ピクセルを置換）`);
  }

  // --- 3. キーバインド設定ダイアログ ---
  openKeybindingDialog() {
    const d = document.getElementById('modal-keybindings');
    const tbody = document.querySelector('#table-keybindings tbody');
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

    d.showModal();
    document.getElementById('btn-close-keybindings').onclick = () => d.close();
  }
}
