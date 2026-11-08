import { hexToHsv, hsvToHex } from './color-utils.js';

export class HSVColorPicker {
  constructor() {
    this.modal = document.getElementById('modal-color-picker');
    this.oldSwatch = document.getElementById('picker-old-swatch');
    this.newSwatch = document.getElementById('picker-new-swatch');
    this.hexLabel = document.getElementById('picker-hex-label');

    this.sliderH = document.getElementById('picker-h');
    this.sliderS = document.getElementById('picker-s');
    this.sliderV = document.getElementById('picker-v');

    this.valH = document.getElementById('picker-h-val');
    this.valS = document.getElementById('picker-s-val');
    this.valV = document.getElementById('picker-v-val');

    this.paletteContainer = document.getElementById('picker-palette');
    this.btnOk = document.getElementById('btn-picker-ok');
    this.btnCancel = document.getElementById('btn-picker-cancel');

    this.currentHex = '#FFFFFF';
    this.resolvePromise = null;

    this._initPalette();
    this._bindEvents();
  }

  _initPalette() {
    const colors = [
      '#FFFFFF', '#C0C0C0', '#808080', '#000000',
      '#FF3333', '#FFAA00', '#FFFF33', '#33CC33',
      '#00E5FF', '#3366FF', '#9933FF', '#FF3399'
    ];
    this.paletteContainer.innerHTML = '';
    colors.forEach(hex => {
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.style.backgroundColor = hex;
      btn.onclick = () => this._setHex(hex);
      this.paletteContainer.appendChild(btn);
    });
  }

  _bindEvents() {
    const update = () => {
      const h = parseInt(this.sliderH.value);
      const s = parseInt(this.sliderS.value);
      const v = parseInt(this.sliderV.value);
      this.valH.textContent = `${h}°`;
      this.valS.textContent = `${s}%`;
      this.valV.textContent = `${v}%`;
      this.currentHex = hsvToHex(h, s, v);
      this.newSwatch.style.backgroundColor = this.currentHex;
      this.hexLabel.textContent = this.currentHex;
    };

    this.sliderH.oninput = update;
    this.sliderS.oninput = update;
    this.sliderV.oninput = update;

    this.btnOk.onclick = () => {
      this.modal.close();
      if (this.resolvePromise) this.resolvePromise(this.currentHex);
    };

    this.btnCancel.onclick = () => {
      this.modal.close();
      if (this.resolvePromise) this.resolvePromise(null);
    };
  }

  _setHex(hex) {
    const { h, s, v } = hexToHsv(hex);
    this.sliderH.value = h;
    this.sliderS.value = s;
    this.sliderV.value = v;
    this.valH.textContent = `${h}°`;
    this.valS.textContent = `${s}%`;
    this.valV.textContent = `${v}%`;
    this.currentHex = hex.toUpperCase();
    this.newSwatch.style.backgroundColor = this.currentHex;
    this.hexLabel.textContent = this.currentHex;
  }

  open(initialHex = '#FFFFFF') {
    this.oldSwatch.style.backgroundColor = initialHex;
    this._setHex(initialHex);
    this.modal.showModal();
    return new Promise(resolve => {
      this.resolvePromise = resolve;
    });
  }
}