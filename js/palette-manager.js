import { hexToRgb, rgbToHex, hexToInt } from './color-utils.js';

export class PaletteManager {
  constructor(app) {
    this.app = app;
    this.basePaletteConfig = {
      brightestHex: '#FEFEFE',
      darkestHex: '#404040',
      steps: 16
    };
    this.basePalette = [];
    this.maskPalette = [];
    this._loadMaskPalette();
    this.generateBasePalette();
  }

  _loadMaskPalette() {
    try {
      const saved = localStorage.getItem('simutrans_mask_palette');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          this.maskPalette = arr.filter(c => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c)).map(c => c.toUpperCase());
        }
      }
    } catch (e) {}
  }

  _saveMaskPalette() {
    try {
      localStorage.setItem('simutrans_mask_palette', JSON.stringify(this.maskPalette));
    } catch (e) {}
  }

  generateBasePalette() {
    const [rMax, gMax, bMax] = hexToRgb(this.basePaletteConfig.brightestHex || '#FEFEFE');
    const [rMin, gMin, bMin] = hexToRgb(this.basePaletteConfig.darkestHex || '#404040');
    const steps = Math.max(2, Math.min(64, parseInt(this.basePaletteConfig.steps, 10) || 16));

    const specialInts = new Set([0xE7FFFF]);
    if (this.app && this.app.specialColors) {
      this.app.specialColors.forEach(hex => specialInts.add(hexToInt(hex)));
    }

    const result = [];
    const seen = new Set();

    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 0 : i / (steps - 1);
      let r = Math.round(rMax + (rMin - rMax) * t);
      let g = Math.round(gMax + (gMin - gMax) * t);
      let b = Math.round(bMax + (bMin - bMax) * t);

      let rgbInt = (r << 16) | (g << 8) | b;
      let guard = 0;
      while (specialInts.has(rgbInt) && guard < 10) {
        r = r > 0 ? r - 1 : r + 1;
        rgbInt = (r << 16) | (g << 8) | b;
        guard++;
      }

      const hex = rgbToHex(r, g, b);
      if (!seen.has(hex)) {
        seen.add(hex);
        result.push(hex);
      }
    }

    this.basePalette = result;
    return this.basePalette;
  }

  addColorToBasePalette(hex) {
    const clean = hex.toUpperCase();
    if (!this.basePalette.includes(clean)) {
      this.basePalette.push(clean);
      return true;
    }
    return false;
  }

  removeColorFromBasePalette(hex) {
    const clean = hex.toUpperCase();
    this.basePalette = this.basePalette.filter(c => c !== clean);
  }

  addColorToMaskPalette(hex) {
    const clean = hex.toUpperCase();
    if (!this.maskPalette.includes(clean)) {
      this.maskPalette.push(clean);
      this._saveMaskPalette();
      return true;
    }
    return false;
  }

  removeColorFromMaskPalette(hex) {
    const clean = hex.toUpperCase();
    this.maskPalette = this.maskPalette.filter(c => c !== clean);
    this._saveMaskPalette();
  }

  updatePaletteColorAt(targetType, index, newHex) {
    const clean = newHex.toUpperCase();
    if (targetType === 'mask') {
      if (index >= 0 && index < this.maskPalette.length) {
        this.maskPalette[index] = clean;
        this._saveMaskPalette();
      }
    } else {
      if (index >= 0 && index < this.basePalette.length) {
        this.basePalette[index] = clean;
      }
    }
  }

  replacePalette(targetType, colors) {
    const unique = [];
    const seen = new Set();
    colors.forEach(c => {
      const clean = c.toUpperCase();
      if (/^#[0-9A-F]{6}$/.test(clean) && !seen.has(clean)) {
        seen.add(clean);
        unique.push(clean);
      }
    });

    if (targetType === 'mask') {
      this.maskPalette = unique;
      this._saveMaskPalette();
    } else {
      this.basePalette = unique;
    }
  }

  appendPalette(targetType, colors) {
    const target = targetType === 'mask' ? this.maskPalette : this.basePalette;
    const seen = new Set(target.map(c => c.toUpperCase()));
    colors.forEach(c => {
      const clean = c.toUpperCase();
      if (/^#[0-9A-F]{6}$/.test(clean) && !seen.has(clean)) {
        seen.add(clean);
        target.push(clean);
      }
    });
    if (targetType === 'mask') {
      this._saveMaskPalette();
    }
  }

  loadImageSafely(fileOrUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));

      if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
        img.src = URL.createObjectURL(fileOrUrl);
      } else if (typeof fileOrUrl === 'string') {
        img.src = fileOrUrl;
      } else {
        reject(new Error('無効な画像ソースです。'));
      }
    });
  }

  toDict() {
    return {
      base_palette_config: { ...this.basePaletteConfig },
      base_palette: [...this.basePalette],
      mask_palette: [...this.maskPalette]
    };
  }

  fromDict(data) {
    if (!data) return;
    if (data.base_palette_config) {
      Object.assign(this.basePaletteConfig, data.base_palette_config);
    }
    if (Array.isArray(data.base_palette) && data.base_palette.length > 0) {
      this.basePalette = [...data.base_palette];
    } else {
      this.generateBasePalette();
    }
    if (Array.isArray(data.mask_palette)) {
      this.maskPalette = [...data.mask_palette];
      this._saveMaskPalette();
    }
  }
}
