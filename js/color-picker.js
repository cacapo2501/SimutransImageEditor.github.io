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
      if (this.isUpdating) return;
      this.isUpdating = true;
      const h = parseInt(this.inpH.value);
      const s = parseInt(this.inpS.value);
      const v = parseInt(this.inpV.value);
      const [r, g, b] = hsvToRgb(h, s, v);

      this.inpR.value = r; this.valR.value = r;
      this.inpG.value = g; this.valG.value = g;
      this.inpB.value = b; this.valB.value = b;

      this.valH.textContent = `${h}°`;
      this.valS.textContent = `${s}%`;
      this.valV.textContent = `${v}%`;

      this.currentColor = rgbToHex(r, g, b);
      this._updateUI();
      this.isUpdating = false;
    };

    const updateFromRGB = () => {
      if (this.isUpdating) return;
      this.isUpdating = true;
      const r = Math.max(0, Math.min(255, parseInt(this.inpR.value) || 0));
      const g = Math.max(0, Math.min(255, parseInt(this.inpG.value) || 0));
      const b = Math.max(0, Math.min(255, parseInt(this.inpB.value) || 0));

      this.valR.value = r; this.inpR.value = r;
      this.valG.value = g; this.inpG.value = g;
      this.valB.value = b; this.inpB.value = b;

      const [h, s, v] = rgbToHsv(r, g, b);
      this.inpH.value = h; this.valH.textContent = `${h}°`;
      this.inpS.value = s; this.valS.textContent = `${s}%`;
      this.inpV.value = v; this.valV.textContent = `${v}%`;

      this.currentColor = rgbToHex(r, g, b);
      this._updateUI();
      this.isUpdating = false;
    };

    // HSV入力イベント
    [this.inpH, this.inpS, this.inpV].forEach(el => el.addEventListener('input', updateFromHSV));

    // RGBスライダーイベント
    [this.inpR, this.inpG, this.inpB].forEach(el => el.addEventListener('input', updateFromRGB));

    // RGB数値入力ボックスイベント
    this.valR.addEventListener('change', (e) => { this.inpR.value = e.target.value; updateFromRGB(); });
    this.valG.addEventListener('change', (e) => { this.inpG.value = e.target.value; updateFromRGB(); });
    this.valB.addEventListener('change', (e) => { this.inpB.value = e.target.value; updateFromRGB(); });

    // スポイトボタン（EyeDropper API）
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

    this.btnOk.onclick = () => {
      this.modal.close();
      if (this.resolvePromise) this.resolvePromise(this.currentColor);
    };

    this.btnCancel.onclick = () => {
      this.modal.close();
      if (this.resolvePromise) this.resolvePromise(null);
    };
  }

  _initPalette() {
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
    this.inpH.value = h; this.valH.textContent = `${h}°`;
    this.inpS.value = s; this.valS.textContent = `${s}%`;
    this.inpV.value = v; this.valV.textContent = `${v}%`;

    this.inpR.value = r; this.valR.value = r;
    this.inpG.value = g; this.valG.value = g;
    this.inpB.value = b; this.valB.value = b;

    this._updateUI();
    this.isUpdating = false;
  }

  _updateUI() {
    this.newSwatch.style.backgroundColor = this.currentColor;
    this.hexLabel.textContent = this.currentColor;
  }

  open(initialHex = '#FFFFFF') {
    this.setColor(initialHex);
    this.oldSwatch.style.backgroundColor = initialHex;
    this.modal.showModal();
    return new Promise(resolve => {
      this.resolvePromise = resolve;
    });
  }
}