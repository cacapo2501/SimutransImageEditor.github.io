import { rgbToHex, hexToRgb, rgbToHsv, hsvToRgb } from './color-utils.js';

export class HSVColorPicker {
  constructor() {
    this.modal = document.getElementById('modal-color-picker');
    this.oldSwatch = document.getElementById('picker-old-swatch');
    this.newSwatch = document.getElementById('picker-new-swatch');
    this.hexLabel = document.getElementById('picker-hex-label');

    // HSVスライダー
    this.inpH = document.getElementById('picker-h');
    this.inpS = document.getElementById('picker-s');
    this.inpV = document.getElementById('picker-v');
    this.valH = document.getElementById('picker-h-val');
    this.valS = document.getElementById('picker-s-val');
    this.valV = document.getElementById('picker-v-val');

    // RGBスライダー & 数値入力
    this.inpR = document.getElementById('picker-r');
    this.inpG = document.getElementById('picker-g');
    this.inpB = document.getElementById('picker-b');
    this.valR = document.getElementById('picker-r-val');
    this.valG = document.getElementById('picker-g-val');
    this.valB = document.getElementById('picker-b-val');

    this.paletteContainer = document.getElementById('picker-palette');
    this.btnOk = document.getElementById('btn-picker-ok');
    this.btnCancel = document.getElementById('btn-picker-cancel');
    this.btnEyeDropper = document.getElementById('btn-picker-eyedropper');

    this.resolvePromise = null;
    this.currentColor = '#FFFFFF';
    this.isUpdating = false;

    this._bindEvents();
    this._initPalette();
  }

  _bindEvents() {
    const updateFromHSV = () => {
      if (this.isUpdating || !this.inpH) return;
      this.isUpdating = true;
      const h = parseInt(this.inpH.value);
      const s = parseInt(this.inpS.value);
      const v = parseInt(this.inpV.value);
      const [r, g, b] = hsvToRgb(h, s, v);

      if (this.inpR) { this.inpR.value = r; this.valR.value = r; }
      if (this.inpG) { this.inpG.value = g; this.valG.value = g; }
      if (this.inpB) { this.inpB.value = b; this.valB.value = b; }

      if (this.valH) this.valH.textContent = `${h}°`;
      if (this.valS) this.valS.textContent = `${s}%`;
      if (this.valV) this.valV.textContent = `${v}%`;

      this.currentColor = rgbToHex(r, g, b);
      this._updateUI();
      this.isUpdating = false;
    };

    const updateFromRGB = () => {
      if (this.isUpdating || !this.inpR) return;
      this.isUpdating = true;
      const r = Math.max(0, Math.min(255, parseInt(this.inpR.value) || 0));
      const g = Math.max(0, Math.min(255, parseInt(this.inpG.value) || 0));
      const b = Math.max(0, Math.min(255, parseInt(this.inpB.value) || 0));

      if (this.valR) this.valR.value = r;
      if (this.valG) this.valG.value = g;
      if (this.valB) this.valB.value = b;

      const [h, s, v] = rgbToHsv(r, g, b);
      if (this.inpH) { this.inpH.value = h; this.valH.textContent = `${h}°`; }
      if (this.inpS) { this.inpS.value = s; this.valS.textContent = `${s}%`; }
      if (this.inpV) { this.inpV.value = v; this.valV.textContent = `${v}%`; }

      this.currentColor = rgbToHex(r, g, b);
      this._updateUI();
      this.isUpdating = false;
    };

    // HSV入力イベント（null安全）
    [this.inpH, this.inpS, this.inpV].forEach(el => {
      if (el) el.addEventListener('input', updateFromHSV);
    });

    // RGBスライダーイベント（null安全）
    [this.inpR, this.inpG, this.inpB].forEach(el => {
      if (el) el.addEventListener('input', updateFromRGB);
    });

    // RGB数値入力ボックスイベント（null安全）
    if (this.valR) this.valR.addEventListener('change', (e) => { if (this.inpR) this.inpR.value = e.target.value; updateFromRGB(); });
    if (this.valG) this.valG.addEventListener('change', (e) => { if (this.inpG) this.inpG.value = e.target.value; updateFromRGB(); });
    if (this.valB) this.valB.addEventListener('change', (e) => { if (this.inpB) this.inpB.value = e.target.value; updateFromRGB(); });

    // スポイトボタン
    if (this.btnEyeDropper) {
      if (window.EyeDropper) {
        this.btnEyeDropper.onclick = async () => {
          try {
            const eyeDropper = new window.EyeDropper();
            const result = await eyeDropper.open();
            if (result && result.sRGBHex) {
              this.setColor(result.sRGBHex);
            }
          } catch (e) {}
        };
      } else {
        this.btnEyeDropper.style.display = 'none';
      }
    }

    if (this.btnOk) {
      this.btnOk.onclick = () => {
        if (this.modal) this.modal.close();
        if (this.resolvePromise) this.resolvePromise(this.currentColor);
      };
    }

    if (this.btnCancel) {
      this.btnCancel.onclick = () => {
        if (this.modal) this.modal.close();
        if (this.resolvePromise) this.resolvePromise(null);
      };
    }
  }

  _initPalette() {
    if (!this.paletteContainer) return;
    const defaultColors = [
      '#FFFFFF', '#C0C0C0', '#808080', '#000000',
      '#FF0000', '#800000', '#FFFF00', '#808000',
      '#00FF00', '#008000', '#00FFFF', '#008080',
      '#0000FF', '#000080', '#FF00FF', '#800080'
    ];
    this.paletteContainer.innerHTML = '';
    defaultColors.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.style.backgroundColor = c;
      btn.onclick = () => this.setColor(c);
      this.paletteContainer.appendChild(btn);
    });
  }

  setColor(hex) {
    this.currentColor = hex.toUpperCase();
    const [r, g, b] = hexToRgb(this.currentColor);
    const [h, s, v] = rgbToHsv(r, g, b);

    this.isUpdating = true;
    if (this.inpH) { this.inpH.value = h; this.valH.textContent = `${h}°`; }
    if (this.inpS) { this.inpS.value = s; this.valS.textContent = `${s}%`; }
    if (this.inpV) { this.inpV.value = v; this.valV.textContent = `${v}%`; }

    if (this.inpR) { this.inpR.value = r; this.valR.value = r; }
    if (this.inpG) { this.inpG.value = g; this.valG.value = g; }
    if (this.inpB) { this.inpB.value = b; this.valB.value = b; }

    this._updateUI();
    this.isUpdating = false;
  }

  _updateUI() {
    if (this.newSwatch) this.newSwatch.style.backgroundColor = this.currentColor;
    if (this.hexLabel) this.hexLabel.textContent = this.currentColor;
  }

  open(initialHex = '#FFFFFF') {
    this.setColor(initialHex);
    if (this.oldSwatch) this.oldSwatch.style.backgroundColor = initialHex;
    if (this.modal) this.modal.showModal();
    return new Promise(resolve => {
      this.resolvePromise = resolve;
    });
  }
}
