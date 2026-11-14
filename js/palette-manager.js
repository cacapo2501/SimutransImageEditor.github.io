import { rgbToHex, hexToRgb } from './color-utils.js';

export class PaletteManager {
  constructor(app) {
    this.app = app;

    this.basePaletteConfig = {
      brightestHex: '#FEFEFE',
      darkestHex: '#404040',
      steps: 16
    };
    this.basePalette = [];

    // マスク画像パレット：デフォルトは空
    this.maskPalette = [];
  }

  generateBasePalette() {
    const { brightestHex, darkestHex, steps } = this.basePaletteConfig;
    const [bMax] = hexToRgb(brightestHex);
    const [bMin] = hexToRgb(darkestHex);
    const count = Math.max(2, steps);

    const grays = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      let v = Math.round((1 - t) * bMax + t * bMin);

      const currentHex = rgbToHex(v, v, v);
      if (this.app.specialColors && this.app.specialColors.has(currentHex)) {
        v = Math.max(0, v - 1);
      }
      grays.push(rgbToHex(v, v, v));
    }

    this.basePalette = Array.from(new Set(grays));
    return this.basePalette;
  }

  addColorToMaskPalette(hex) {
    if (!hex) return;
    const cleanHex = hex.toUpperCase();
    if (!this.maskPalette.includes(cleanHex)) {
      this.maskPalette.push(cleanHex);
    }
  }

  removeColorFromMaskPalette(hex) {
    const cleanHex = hex.toUpperCase();
    this.maskPalette = this.maskPalette.filter(c => c !== cleanHex);
  }

  async loadImageSafely(source) {
    if (source instanceof File || source instanceof Blob) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(source);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = reject;
        img.src = url;
      });
    }

    const urlStr = String(source).trim();
    if (!urlStr) throw new Error('URLを入力してください。');

    const tryLoad = (srcUrl) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = srcUrl;
      });
    };

    try {
      return await tryLoad(urlStr);
    } catch (e1) {
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlStr)}`;
        return await tryLoad(proxyUrl);
      } catch (e2) {
        throw new Error('外部サイトのセキュリティ制限(CORS)によりURLから直接画像を読み込めませんでした。\nお手数ですが画像を保存し、「ローカル画像を選択」から読み込んでください。');
      }
    }
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
    if (data.base_palette_config) this.basePaletteConfig = { ...data.base_palette_config };
    if (data.base_palette) this.basePalette = [...data.base_palette];
    else this.generateBasePalette();
    if (data.mask_palette) this.maskPalette = [...data.mask_palette];
  }
}
