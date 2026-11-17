// 文字入力編集モーダル制御（リアルタイムプレビュー・サイズ計測・フローティング往復対応）
import { renderTextToTrimmedCanvas } from './paint-text-renderer.js';
import { getCurrentPaletteColors } from './paint-palette-ui.js';

export class PaintTextController {
  constructor(editor) {
    this.editor = editor;
    this.modal = null;
    this.bound = false;
    this.targetPos = [0, 0];
    this.isReediting = false;
    this.lastRendered = null;
    this.config = {
      text: 'SAMPLE',
      fontFamily: 'monospace',
      customFont: '',
      fontSize: '10',
      letterSpacing: '0',
      lineHeight: '1.2',
      bold: false,
      italic: false,
      sharp: true,
      threshold: '64',
      colorHex: '#FFFFFF'
    };
  }

  bindEvents() {
    this.modal = document.getElementById('modal-paint-text');
    if (!this.modal || this.bound) return;
    this.bound = true;

    const syncAndPreview = () => {
      this._readFormToConfig();
      this.updatePreview();
    };

    ['txt-paint-text-content', 'inp-paint-text-font-custom', 'inp-paint-text-size',
     'inp-paint-text-spacing', 'inp-paint-text-lineheight', 'inp-paint-text-threshold'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', syncAndPreview);
    });

    ['sel-paint-text-font', 'chk-paint-text-bold', 'chk-paint-text-italic',
     'chk-paint-text-sharp', 'sel-paint-text-preview-zoom'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        this._syncConditionalVisibility();
        syncAndPreview();
      });
    });

    const colInp = document.getElementById('inp-paint-text-color');
    const hexInp = document.getElementById('inp-paint-text-hex');
    if (colInp) {
      colInp.addEventListener('input', () => {
        const up = colInp.value.toUpperCase();
        if (hexInp) hexInp.value = up;
        this.config.colorHex = up;
        this.updatePreview();
      });
    }
    if (hexInp) {
      hexInp.addEventListener('input', () => {
        const val = hexInp.value.trim().toUpperCase();
        if (/^#[0-9A-F]{6}$/.test(val)) {
          if (colInp) colInp.value = val;
          this.config.colorHex = val;
          this.updatePreview();
        }
      });
    }

    document.getElementById('btn-paint-text-pick-color')?.addEventListener('click', async () => {
      const picked = await this.editor.app.colorPicker.open(this.config.colorHex || '#FFFFFF');
      if (picked) {
        this._setColorValue(picked.toUpperCase());
        this.updatePreview();
      }
    });

    document.getElementById('btn-paint-text-apply')?.addEventListener('click', () => this.applyToCanvas());
    const closeCancel = () => this.modal.close();
    document.getElementById('btn-paint-text-cancel')?.addEventListener('click', closeCancel);
    document.getElementById('btn-paint-text-close-top')?.addEventListener('click', closeCancel);
  }

  openForNew(px, py) {
    this.bindEvents();
    if (!this.modal) return;
    this.isReediting = false;
    this.targetPos = [px, py];
    this.config.colorHex = (this.editor.currentColor || '#FFFFFF').toUpperCase();
    this._openModalCommon();
  }

  reopenFromFloating() {
    const fl = this.editor.clipMgr?.floatingLayer;
    if (!fl || !fl.isText) return;
    this.bindEvents();
    if (!this.modal) return;
    this.isReediting = true;
    this.targetPos = [fl.x, fl.y];
    if (fl.textConfig) {
      this.config = { ...this.config, ...fl.textConfig };
    }
    this._openModalCommon();
  }

  _openModalCommon() {
    this._writeConfigToForm();
    this._renderPaletteSwatches();
    this._syncConditionalVisibility();
    const posLbl = document.getElementById('lbl-paint-text-pos');
    if (posLbl) posLbl.textContent = `配置位置: (${this.targetPos[0]}, ${this.targetPos[1]})`;
    this.updatePreview();
    if (typeof this.modal.showModal === 'function') this.modal.showModal();
    else this.modal.setAttribute('open', '');
    document.getElementById('txt-paint-text-content')?.focus();
  }

  _setColorValue(hex) {
    const up = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : '#FFFFFF';
    this.config.colorHex = up;
    const colInp = document.getElementById('inp-paint-text-color');
    const hexInp = document.getElementById('inp-paint-text-hex');
    if (colInp) colInp.value = up;
    if (hexInp) hexInp.value = up;
  }

  _renderPaletteSwatches() {
    const wrap = document.getElementById('paint-text-palette-swatches');
    if (!wrap) return;
    wrap.innerHTML = '';
    const colors = getCurrentPaletteColors(this.editor);
    colors.forEach((hex) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'text-swatch-btn';
      b.style.backgroundColor = hex;
      b.title = hex;
      b.onclick = () => {
        this._setColorValue(hex);
        this.updatePreview();
      };
      wrap.appendChild(b);
    });
  }

  _syncConditionalVisibility() {
    const fontVal = document.getElementById('sel-paint-text-font')?.value || 'monospace';
    const wrapCustom = document.getElementById('wrap-paint-text-font-custom');
    if (wrapCustom) wrapCustom.style.display = fontVal === '__custom__' ? '' : 'none';

    const isSharp = Boolean(document.getElementById('chk-paint-text-sharp')?.checked);
    const wrapThresh = document.getElementById('wrap-paint-text-threshold');
    if (wrapThresh) wrapThresh.style.display = isSharp ? '' : 'none';
  }

  _writeConfigToForm() {
    const setV = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setC = (id, val) => { const el = document.getElementById(id); if (el) el.checked = Boolean(val); };
    setV('txt-paint-text-content', this.config.text);
    setV('sel-paint-text-font', this.config.fontFamily);
    setV('inp-paint-text-font-custom', this.config.customFont);
    setV('inp-paint-text-size', this.config.fontSize);
    setV('inp-paint-text-spacing', this.config.letterSpacing);
    setV('inp-paint-text-lineheight', this.config.lineHeight);
    setC('chk-paint-text-bold', this.config.bold);
    setC('chk-paint-text-italic', this.config.italic);
    setC('chk-paint-text-sharp', this.config.sharp);
    setV('inp-paint-text-threshold', this.config.threshold);
    this._setColorValue(this.config.colorHex);
  }

  _readFormToConfig() {
    const getV = (id, fb) => document.getElementById(id)?.value ?? fb;
    const getC = (id) => Boolean(document.getElementById(id)?.checked);
    this.config.text = getV('txt-paint-text-content', '');
    this.config.fontFamily = getV('sel-paint-text-font', 'monospace');
    this.config.customFont = getV('inp-paint-text-font-custom', '');
    this.config.fontSize = getV('inp-paint-text-size', '10');
    this.config.letterSpacing = getV('inp-paint-text-spacing', '0');
    this.config.lineHeight = getV('inp-paint-text-lineheight', '1.2');
    this.config.bold = getC('chk-paint-text-bold');
    this.config.italic = getC('chk-paint-text-italic');
    this.config.sharp = getC('chk-paint-text-sharp');
    this.config.threshold = getV('inp-paint-text-threshold', '64');
    const hexRaw = getV('inp-paint-text-hex', this.config.colorHex);
    if (/^#[0-9A-Fa-f]{6}$/.test(hexRaw.trim())) {
      this.config.colorHex = hexRaw.trim().toUpperCase();
    }
  }

  updatePreview() {
    const res = renderTextToTrimmedCanvas(this.config);
    this.lastRendered = res;

    const metricsEl = document.getElementById('lbl-paint-text-metrics');
    if (metricsEl) {
      metricsEl.textContent = `幅: ${res.width} px × 高さ: ${res.height} px`;
    }

    const pCanvas = document.getElementById('paint-text-preview-canvas');
    if (!pCanvas) return;
    const zoom = Math.max(1, parseInt(document.getElementById('sel-paint-text-preview-zoom')?.value, 10) || 4);
    const padPx = 8;
    const dispW = Math.max(120, (res.width + padPx * 2) * zoom);
    const dispH = Math.max(64, (res.height + padPx * 2) * zoom);
    pCanvas.width = dispW;
    pCanvas.height = dispH;
    const ctx = pCanvas.getContext('2d');

    // チェッカーボード背景を描画
    const cell = Math.max(4, zoom * 2);
    for (let y = 0; y < dispH; y += cell) {
      for (let x = 0; x < dispW; x += cell) {
        const odd = ((Math.floor(x / cell) + Math.floor(y / cell)) & 1) === 1;
        ctx.fillStyle = odd ? '#2c2c2c' : '#202020';
        ctx.fillRect(x, y, cell, cell);
      }
    }

    if (!res.isEmpty) {
      const ox = Math.floor((dispW - res.width * zoom) / 2);
      const oy = Math.floor((dispH - res.height * zoom) / 2);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(res.canvas, 0, 0, res.width, res.height, ox, oy, res.width * zoom, res.height * zoom);
      ctx.strokeStyle = '#00FF88';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox - 0.5, oy - 0.5, res.width * zoom + 1, res.height * zoom + 1);
    }
  }

  applyToCanvas() {
    this._readFormToConfig();
    const res = renderTextToTrimmedCanvas(this.config);
    if (res.isEmpty) {
      alert('描画する文字ピクセルがありません。テキストやしきい値を確認してください。');
      return;
    }
    this.editor.clipMgr.placeTextFloatingLayer(
      res.canvas,
      this.targetPos,
      { ...this.config },
      { replaceExisting: this.isReediting }
    );
    this.modal.close();
  }
}
