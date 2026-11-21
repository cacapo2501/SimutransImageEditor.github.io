import {
  rgbToHex, rgbaToHex, parseHexColor, colorHexToCss, rgbToHsv, hsvToRgb
} from './color-utils.js';

const QUICK_PALETTE = [
  '#FFFFFF', '#CCCCCC', '#808080', '#404040', '#000018', '#000000',
  '#FF4444', '#FF9900', '#FFDD00', '#44DD44', '#00CCFF', '#4466FF',
  '#AA44FF', '#FF66CC', '#E7FFFF', '#57656F', '#4D4D4D', '#00000000'
];

export class HSVColorPicker {
  constructor() {
    this.modal = null;
    this.resolveFn = null;
    this.h = 0;
    this.s = 0;
    this.v = 100;
    this.a = 255;
    this.enableAlpha = false;
    this.bound = false;
  }

  _ensureBound() {
    this.modal = document.getElementById('modal-color-picker');
    if (!this.modal || this.bound) return;
    this.bound = true;

    const pal = document.getElementById('picker-palette');
    if (pal) {
      pal.innerHTML = QUICK_PALETTE.map(hex => {
        const isTrans = hex === '#00000000';
        const style = isTrans
          ? 'background:conic-gradient(#777 90deg, #444 90deg 180deg, #777 180deg 270deg, #444 270deg); background-size:8px 8px;'
          : `background:${hex};`;
        const label = isTrans ? '透明' : '';
        return `<button type="button" class="palette-btn" data-hex="${hex}" data-alpha="${isTrans ? '1' : '0'}" style="${style} font-size:8px; color:#fff; text-shadow:0 1px 2px #000;" title="${isTrans ? '#00000000 (完全透明)' : hex}">${label}</button>`;
      }).join('');
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

    const sliderA = document.getElementById('picker-a');
    const numA = document.getElementById('picker-a-val');
    if (sliderA) {
      sliderA.oninput = () => {
        this.a = Math.max(0, Math.min(255, parseInt(sliderA.value, 10) || 0));
        if (numA) numA.value = this.a;
        this._syncFromHsv();
      };
    }
    if (numA) {
      numA.oninput = () => {
        const val = Math.max(0, Math.min(255, parseInt(numA.value, 10) || 0));
        this.a = val;
        if (sliderA) sliderA.value = val;
        this._syncFromHsv();
      };
    }

    const btnEye = document.getElementById('btn-picker-eyedropper');
    if (btnEye) {
      btnEye.onclick = () => this._pickFromScreen();
    }

    document.getElementById('btn-picker-ok').onclick = () => {
      const hex = document.getElementById('picker-hex-label').dataset.hex || document.getElementById('picker-hex-label').textContent;
      this.modal.close();
      if (this.resolveFn) { this.resolveFn(hex); this.resolveFn = null; }
    };

    document.getElementById('btn-picker-cancel').onclick = () => {
      this.modal.close();
      if (this.resolveFn) { this.resolveFn(null); this.resolveFn = null; }
    };
  }

  open(initialHex = '#FFFFFF', { enableAlpha = false } = {}) {
    this._ensureBound();
    if (!this.modal) return Promise.resolve(null);
    this.enableAlpha = Boolean(enableAlpha);

    const alphaRow = document.getElementById('picker-alpha-row');
    if (alphaRow) alphaRow.style.display = this.enableAlpha ? '' : 'none';
    document.querySelectorAll('#picker-palette .palette-btn[data-alpha="1"]').forEach(btn => {
      btn.style.display = this.enableAlpha ? '' : 'none';
    });

    const oldSw = document.getElementById('picker-old-swatch');
    if (oldSw) {
      const css = this.enableAlpha ? colorHexToCss(initialHex) : rgbToHex(...parseHexColor(initialHex).slice(0, 3));
      oldSw.style.setProperty('--swatch-color', css);
    }
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
    const [r, g, b, a] = parseHexColor(hex);
    const [h, s, v] = rgbToHsv(r, g, b);
    this.h = h; this.s = s; this.v = v;
    this.a = this.enableAlpha ? a : 255;
    this._syncFromHsv();
  }

  _syncFromHsv() {
    const [r, g, b] = hsvToRgb(this.h, this.s, this.v);
    const a = this.enableAlpha ? this.a : 255;
    const hex = rgbaToHex(r, g, b, a);
    this._updateDOM(this.h, this.s, this.v, r, g, b, a, hex);
  }

  _syncFromRgb() {
    const r = parseInt(document.getElementById('picker-r').value, 10) || 0;
    const g = parseInt(document.getElementById('picker-g').value, 10) || 0;
    const b = parseInt(document.getElementById('picker-b').value, 10) || 0;
    const a = this.enableAlpha ? (parseInt(document.getElementById('picker-a')?.value, 10) ?? this.a) : 255;
    const [h, s, v] = rgbToHsv(r, g, b);
    this.h = h; this.s = s; this.v = v; this.a = a;
    const hex = rgbaToHex(r, g, b, a);
    this._updateDOM(h, s, v, r, g, b, a, hex);
  }

  _updateDOM(h, s, v, r, g, b, a, hex) {
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

    const sliderA = document.getElementById('picker-a');
    const numA = document.getElementById('picker-a-val');
    const pctA = document.getElementById('picker-a-pct');
    if (sliderA) sliderA.value = a;
    if (numA) numA.value = a;
    if (pctA) pctA.textContent = `${Math.round((a / 255) * 100)}%`;

    document.getElementById('picker-new-swatch').style.setProperty('--swatch-color', colorHexToCss(hex));
    const lblHex = document.getElementById('picker-hex-label');
    lblHex.dataset.hex = hex;
    lblHex.textContent = a < 255 ? `${hex} (${Math.round((a / 255) * 100)}%)` : hex;
  }

  async _pickFromScreen() {
    if (window.EyeDropper && !this.enableAlpha) {
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
          if (this.enableAlpha) {
            const hex = p[3] === 0 ? '#00000000' : rgbaToHex(p[0], p[1], p[2], p[3]);
            this._setFromHex(hex);
          } else if (p[3] > 0) {
            this._setFromHex(rgbToHex(p[0], p[1], p[2]));
          }
        }
      }
      cleanup();
    };

    window.addEventListener('pointerdown', onPick, true);
    window.addEventListener('keydown', onCancel, true);
  }
}
