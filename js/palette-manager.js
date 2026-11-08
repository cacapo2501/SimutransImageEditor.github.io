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

    // マスク画像パレット (初期色＋抽出色)
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

    // 重複除外して登録
    this.basePalette = Array.from(new Set(grays));
    return this.basePalette;
  }

  // Web画像 / ローカル画像からカラーパレットを抽出・スポイト取得
  async extractColorsFromImage(fileOrUrl, maxColors = 32) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          const s = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * s);
          h = Math.round(h * s);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const data = ctx.getImageData(0, 0, w, h).data;
        const colorCount = new Map();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue; // 透明ピクセル除外
          const hex = rgbToHex(data[i], data[i + 1], data[i + 2]);
          colorCount.set(hex, (colorCount.get(hex) || 0) + 1);
        }

        // 出現頻度順に上位を取得
        const sorted = Array.from(colorCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, maxColors)
          .map(entry => entry[0]);

        // マスクパレットにマージ
        sorted.forEach(c => {
          if (!this.maskPalette.includes(c)) this.maskPalette.push(c);
        });
        resolve(this.maskPalette);
      };
      img.onerror = reject;

      if (typeof fileOrUrl === 'string') {
        img.src = fileOrUrl;
      } else {
        img.src = URL.createObjectURL(fileOrUrl);
      }
    });
  }

  // プロジェクト保存用のシリアライズ
  toDict() {
    return {
      base_palette_config: { ...this.basePaletteConfig },
      base_palette: [...this.basePalette],
      mask_palette: [...this.maskPalette]
    };
  }

  // プロジェクト読込時の復元
  fromDict(data) {
    if (!data) return;
    if (data.base_palette_config) this.basePaletteConfig = { ...data.base_palette_config };
    if (data.base_palette) this.basePalette = [...data.base_palette];
    else this.generateBasePalette();
    if (data.mask_palette) this.maskPalette = [...data.mask_palette];
  }
}