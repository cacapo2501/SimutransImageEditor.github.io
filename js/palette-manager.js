import { hexToRgb, rgbToHex, rgbaToHex, hexToInt, normalizeColorHex, parseHexColor } from './color-utils.js';

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
    this.generateBasePalette({ keepAlphaColors: false });
  }

  _loadMaskPalette() {
    try {
      const saved = localStorage.getItem('simutrans_mask_palette');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          this.maskPalette = arr.map(c => normalizeColorHex(c)).filter(Boolean);
        }
      }
    } catch (e) {}
  }

  _saveMaskPalette() {
    try {
      localStorage.setItem('simutrans_mask_palette', JSON.stringify(this.maskPalette));
    } catch (e) {}
  }

  generateBasePalette({ keepAlphaColors = true } = {}) {
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

    // 既存の32bitアルファ付き色を維持（ベース画像が32bitの場合の利便性維持）
    if (keepAlphaColors && Array.isArray(this.basePalette)) {
      this.basePalette.forEach((c) => {
        const norm = normalizeColorHex(c);
        if (norm && parseHexColor(norm)[3] < 255 && !seen.has(norm)) {
          seen.add(norm);
          result.push(norm);
        }
      });
    }

    this.basePalette = result;
    return this.basePalette;
  }

  addColorToBasePalette(hex) {
    const clean = normalizeColorHex(hex);
    if (!clean) return false;
    if (!this.basePalette.includes(clean)) {
      this.basePalette.push(clean);
      return true;
    }
    return false;
  }

  removeColorFromBasePalette(hex) {
    const clean = normalizeColorHex(hex) || String(hex || '').toUpperCase();
    this.basePalette = this.basePalette.filter(c => c !== clean);
  }

  addColorToMaskPalette(hex) {
    const clean = normalizeColorHex(hex);
    if (!clean) return false;
    if (!this.maskPalette.includes(clean)) {
      this.maskPalette.push(clean);
      this._saveMaskPalette();
      return true;
    }
    return false;
  }

  removeColorFromMaskPalette(hex) {
    const clean = normalizeColorHex(hex) || String(hex || '').toUpperCase();
    this.maskPalette = this.maskPalette.filter(c => c !== clean);
    this._saveMaskPalette();
  }

  updatePaletteColorAt(targetType, index, newHex) {
    const clean = normalizeColorHex(newHex);
    if (!clean) return;
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
      const clean = normalizeColorHex(c);
      if (clean && !seen.has(clean)) {
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
    const seen = new Set(target.map(c => normalizeColorHex(c) || c.toUpperCase()));
    colors.forEach(c => {
      const clean = normalizeColorHex(c);
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        target.push(clean);
      }
    });
    if (targetType === 'mask') {
      this._saveMaskPalette();
    }
  }

  // 32bit画像内の透明・半透明アルファ色をスキャンして自動的にパレットへ追加する（最大maxColors色まで）
  autoRegisterAlphaColors(targetType, rgbaData, { maxColors = 32 } = {}) {
    if (!rgbaData || (targetType !== 'base' && targetType !== 'mask')) {
      return { hasAlpha: false, addedCount: 0 };
    }
    let hasTransparent = false;
    const semiCounts = new Map();
    for (let i = 0; i < rgbaData.length; i += 4) {
      const a = rgbaData[i + 3];
      if (a === 255) continue;
      if (a === 0) {
        hasTransparent = true;
        continue;
      }
      const key = (((rgbaData[i] << 24) | (rgbaData[i + 1] << 16) | (rgbaData[i + 2] << 8) | a) >>> 0);
      semiCounts.set(key, (semiCounts.get(key) || 0) + 1);
    }

    const hasAlpha = hasTransparent || semiCounts.size > 0;
    if (!hasAlpha) return { hasAlpha: false, addedCount: 0 };

    const addFn = targetType === 'mask'
      ? (hex) => this.addColorToMaskPalette(hex)
      : (hex) => this.addColorToBasePalette(hex);

    let addedCount = 0;
    // 32bit画像編集では完全透明(#00000000)を必ずパレットに追加してすぐ描けるようにする
    if (addFn('#00000000')) addedCount++;

    if (semiCounts.size > 0) {
      const sorted = Array.from(semiCounts.entries()).sort((a, b) => b[1] - a[1]);
      const limit = Math.min(maxColors, sorted.length);
      for (let i = 0; i < limit; i++) {
        const key = sorted[i][0];
        const r = (key >>> 24) & 255;
        const g = (key >>> 16) & 255;
        const b = (key >>> 8) & 255;
        const a = key & 255;
        if (addFn(rgbaToHex(r, g, b, a))) addedCount++;
      }
    }
    return { hasAlpha: true, addedCount };
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
