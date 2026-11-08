import { rgbToHex, hexToRgb } from './color-utils.js';

export class PaletteManager {
  constructor(app) {
    this.app = app;

    // ベース画像パレット設定 (デフォルト: #FEFEFE 〜 #404040, 16段階)
    this.basePaletteConfig = {
      brightestHex: '#FEFEFE',
      darkestHex: '#404040',
      steps: 16
    };
    this.basePalette = [];

    // マスク画像パレット
    this.maskPalette = [
      '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
      '#FFFF00', '#00FFFF', '#FF00FF', '#C0C0C0', '#808080'
    ];
  }

  // ベース画像用グレースケールパレット生成
  generateBasePalette() {
    const { brightestHex, darkestHex, steps } = this.basePaletteConfig;
    const [bMax] = hexToRgb(brightestHex);
    const [bMin] = hexToRgb(darkestHex);
    const count = Math.max(2, steps);

    const grays = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      let v = Math.round((1 - t) * bMax + t * bMin);

      // SpecialColorと一致した場合は R, G, B ともに -1
      const currentHex = rgbToHex(v, v, v);
      if (this.app.specialColors && this.app.specialColors.has(currentHex)) {
        v = Math.max(0, v - 1);
      }
      grays.push(rgbToHex(v, v, v));
    }

    this.basePalette = Array.from(new Set(grays));
    return this.basePalette;
  }

  // マスクパレットに任意色を追加
  addColorToMaskPalette(hex) {
    if (!hex) return;
    const cleanHex = hex.toUpperCase();
    if (!this.maskPalette.includes(cleanHex)) {
      this.maskPalette.push(cleanHex);
    }
  }

  // マスクパレットから色を削除
  removeColorFromMaskPalette(hex) {
    const cleanHex = hex.toUpperCase();
    this.maskPalette = this.maskPalette.filter(c => c !== cleanHex);
  }

  // CORS例外を完全に防止する画像非同期ロード
  async loadImageSafely(source) {
    // 1. ローカルファイルの場合
    if (source instanceof File || source instanceof Blob) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(source);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = reject;
        img.src = url;
      });
    }

    // 2. Web URLの場合 (直接ロード 試行 -> CORSプロキシ 試行)
    const urlStr = String(source).trim();
    if (!urlStr) throw new Error('URLが空です。');

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
      // 直接取得がCORSで失敗した場合、パブリックプロキシ経由で再試行
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlStr)}`;
        return await tryLoad(proxyUrl);
      } catch (e2) {
        throw new Error('外部サイトのセキュリティ制限(CORS)によりURLから直接画像を読み込めませんでした。\nお手数ですが画像を右クリック保存し、「ローカル画像を選択」から読み込んでください。');
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