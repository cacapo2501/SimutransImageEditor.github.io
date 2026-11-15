import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from './color-utils.js';

const QUICK_PALETTE = [
  '#FFFFFF', '#CCCCCC', '#808080', '#404040', '#000018', '#000000',
  '#FF4444', '#FF9900', '#FFDD00', '#44DD44', '#00CCFF', '#4466FF',
  '#AA44FF', '#FF66CC', '#E7FFFF', '#57656F', '#4D4D4D', '#8B5A2B'
];

export class HSVColorPicker {
  constructor() {
    this.modal = null;
    this.resolveFn = null;
    this.h = 0;
    this.s = 0;
    this.v = 100;
    this.bound = false;
  }

  _ensureBound() {
    this.modal = document.getElementById('modal-color-picker');
    if (!this.modal || this.bound) return;
    this.bound = true;

    const pal = document.getElementById('picker-palette');
    if (pal) {
      pal.innerHTML = QUICK_PALETTE.map(hex =>
        `<button type="button" class="palette-btn" data-hex="${hex}" style="background:${hex};" title="${hex}"></button>`
      ).join('');
      pal.querySelectorAll('.palette-btn').forEach(btn => {
        btn.onclick = () => this._setFromHex(btn.dataset.hex);
      });
    }

    ['h', 's', 'v'].forEach(axis => {
      const el = document.getElementById(`picker-${axis}`);
      if (el) {
        el.oninput = () => {
          this[axis] = parseInt(el.value, 10) || 0;
          this._syncFromHsv();
        };
      }
    });

    ['r', 'g', 'b'].forEach(ch => {
      const slider = document.getElementById(`picker-${ch}`);
      const num = document.getElementById(`picker-${ch}-val`);
      if (slider) {
        slider.oninput = () => {
          if (num) num.value = slider.value;
          this._syncFromRgb();
        };
      }
      if (num) {
        num.oninput = () => {
          const val = Math.max(0, Math.min(255, parseInt(num.value, 10) || 0));
          if (slider) slider.value = val;
          this._syncFromRgb();
        };
      }
    });

    const btnEye = document.getElementById('btn-picker-eyedropper');
    if (btnEye) {
      btnEye.onclick = () => this._pickFromScreen();
    }

    document.getElementById('btn-picker-ok').onclick = () => {
      const hex = document.getElementById('picker-hex-label').textContent;
      this.modal.close();
      if (this.resolveFn) { this.resolveFn(hex); this.resolveFn = null; }
    };

    document.getElementById('btn-picker-cancel').onclick = () => {
      this.modal.close();
      if (this.resolveFn) { this.resolveFn(null); this.resolveFn = null; }
    };
  }

  open(initialHex = '#FFFFFF') {
    this._ensureBound();
    if (!this.modal) return Promise.resolve(null);

    const oldSw = document.getElementById('picker-old-swatch');
    if (oldSw) oldSw.style.backgroundColor = initialHex;
    this._setFromHex(initialHex);

    return new Promise((resolve) => {
      this.resolveFn = resolve;
      if (typeof this.modal.showModal === 'function') {
        this.modal.showModal();
      } else {
        this.modal.setAttribute('open', '');
      }
    });
  }

  _setFromHex(hex) {
    const [r, g, b] = hexToRgb(hex);
    const [h, s, v] = rgbToHsv(r, g, b);
    this.h = h; this.s = s; this.v = v;
    this._syncFromHsv();
  }

  _syncFromHsv() {
    const [r, g, b] = hsvToRgb(this.h, this.s, this.v);
    const hex = rgbToHex(r, g, b);
    this._updateDOM(this.h, this.s, this.v, r, g, b, hex);
  }

  _syncFromRgb() {
    const r = parseInt(document.getElementById('picker-r').value, 10) || 0;
    const g = parseInt(document.getElementById('picker-g').value, 10) || 0;
    const b = parseInt(document.getElementById('picker-b').value, 10) || 0;
    const [h, s, v] = rgbToHsv(r, g, b);
    this.h = h; this.s = s; this.v = v;
    const hex = rgbToHex(r, g, b);
    this._updateDOM(h, s, v, r, g, b, hex);
  }

  _updateDOM(h, s, v, r, g, b, hex) {
    document.getElementById('picker-h').value = h;
    document.getElementById('picker-h-val').textContent = `${h}°`;
    document.getElementById('picker-s').value = s;
    document.getElementById('picker-s-val').textContent = `${s}%`;
    document.getElementById('picker-v').value = v;
    document.getElementById('picker-v-val').textContent = `${v}%`;

    document.getElementById('picker-r').value = r;
    document.getElementById('picker-r-val').value = r;
    document.getElementById('picker-g').value = g;
    document.getElementById('picker-g-val').value = g;
    document.getElementById('picker-b').value = b;
    document.getElementById('picker-b-val').value = b;

    document.getElementById('picker-new-swatch').style.backgroundColor = hex;
    document.getElementById('picker-hex-label').textContent = hex;
  }

  async _pickFromScreen() {
    if (window.EyeDropper) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          this._setFromHex(result.sRGBHex.toUpperCase());
        }
        return;
      } catch (e) {
        return;
      }
    }

    this.modal.close();
    const prevBodyCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const prevCursors = canvases.map(c => c.style.cursor);
    canvases.forEach(c => { c.style.cursor = 'crosshair'; });

    const cleanup = () => {
      document.body.style.cursor = prevBodyCursor;
      canvases.forEach((c, idx) => { c.style.cursor = prevCursors[idx]; });
      window.removeEventListener('pointerdown', onPick, true);
      window.removeEventListener('keydown', onCancel, true);
      this.modal.showModal();
    };

    const onCancel = (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
      }
    };

    const onPick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target && target.tagName === 'CANVAS') {
        const rect = target.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) * (target.width / Math.max(1, rect.width)));
        const y = Math.floor((e.clientY - rect.top) * (target.height / Math.max(1, rect.height)));
        if (x >= 0 && x < target.width && y >= 0 && y < target.height) {
          const ctx = target.getContext('2d');
          const p = ctx.getImageData(x, y, 1, 1).data;
          if (p[3] > 0) this._setFromHex(rgbToHex(p[0], p[1], p[2]));
        }
      }
      cleanup();
    };

    window.addEventListener('pointerdown', onPick, true);
    window.addEventListener('keydown', onCancel, true);
  }
}
