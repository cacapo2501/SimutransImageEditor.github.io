import { sampleWarpedTexture } from './transform.js';

export class Layer {
  constructor({
    name = '',
    imageElement = null,
    canvasW = 256,
    canvasH = 256,
    corners = null,
    opacity = 1.0,
    visible = true,
    transformMode = 'box',
    tileX = 1.0,
    tileY = 1.0,
    targetMaskColor = null,
    layerType = 'multiply',
    fillAll = false,
    transparentE7ffff = false,
    sourceLayer = null
  }) {
    this.sourceLayer = sourceLayer;
    this._visible = visible;

    if (!sourceLayer) {
      this._name = name;
      this._imageElement = imageElement;
      this._opacity = opacity;
      this._transformMode = transformMode;
      this._tileX = Math.max(0.01, tileX);
      this._tileY = Math.max(0.01, tileY);
      this._targetMaskColor = targetMaskColor ? [...targetMaskColor] : null;
      this._layerType = layerType;
      this._fillAll = fillAll;
      this._transparentE7ffff = transparentE7ffff;
      this._cachedImageData = null;
      if (imageElement) this._prepareImageData();
    } else {
      this._name = null;
      this._imageElement = null;
      this._opacity = opacity;
      this._transformMode = transformMode;
      this._tileX = tileX;
      this._tileY = tileY;
      this._targetMaskColor = targetMaskColor;
      this._layerType = layerType;
      this._fillAll = fillAll;
      this._transparentE7ffff = transparentE7ffff;
    }

    if (corners) {
      this.corners = corners.map(([x, y]) => [x, y]);
    } else {
      this.resetTransform(canvasW, canvasH);
    }
  }

  get name() { return this.sourceLayer ? this.sourceLayer.name : this._name; }
  get imageElement() { return this.sourceLayer ? this.sourceLayer.imageElement : this._imageElement; }
  get opacity() { return this.sourceLayer ? this.sourceLayer.opacity : this._opacity; }
  set opacity(v) { if (this.sourceLayer) this.sourceLayer.opacity = v; else this._opacity = v; }
  get tileX() { return this.sourceLayer ? this.sourceLayer.tileX : this._tileX; }
  set tileX(v) { if (this.sourceLayer) this.sourceLayer.tileX = v; else this._tileX = Math.max(0.01, v); }
  get tileY() { return this.sourceLayer ? this.sourceLayer.tileY : this._tileY; }
  set tileY(v) { if (this.sourceLayer) this.sourceLayer.tileY = v; else this._tileY = Math.max(0.01, v); }
  get targetMaskColor() { return this.sourceLayer ? this.sourceLayer.targetMaskColor : this._targetMaskColor; }
  set targetMaskColor(v) { if (this.sourceLayer) this.sourceLayer.targetMaskColor = v; else this._targetMaskColor = v ? [...v] : null; }
  get transformMode() { return this.sourceLayer ? this.sourceLayer.transformMode : this._transformMode; }
  set transformMode(v) { if (this.sourceLayer) this.sourceLayer.transformMode = v; else this._transformMode = v; }
  get layerType() { return this.sourceLayer ? this.sourceLayer.layerType : this._layerType; }
  set layerType(v) { if (this.sourceLayer) this.sourceLayer.layerType = v; else this._layerType = v; }
  get fillAll() { return this.sourceLayer ? this.sourceLayer.fillAll : this._fillAll; }
  set fillAll(v) { if (this.sourceLayer) this.sourceLayer.fillAll = v; else this._fillAll = v; }
  get transparentE7ffff() { return this.sourceLayer ? this.sourceLayer.transparentE7ffff : this._transparentE7ffff; }
  set transparentE7ffff(v) { if (this.sourceLayer) this.sourceLayer.transparentE7ffff = v; else this._transparentE7ffff = v; }
  get visible() { return this._visible; }
  set visible(v) { this._visible = v; }

  _prepareImageData() {
    const img = this.imageElement;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    this._cachedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  resetTransform(canvasW, canvasH) {
    const ow = this.imageElement ? (this.imageElement.naturalWidth || 64) : 64;
    const oh = this.imageElement ? (this.imageElement.naturalHeight || 64) : 64;
    const initW = Math.min(ow * this.tileX, canvasW * 0.6);
    const initH = initW * ((oh * this.tileY) / Math.max(1e-4, ow * this.tileX));
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    this.corners = [
      [cx - initW / 2, cy - initH / 2],
      [cx + initW / 2, cy - initH / 2],
      [cx + initW / 2, cy + initH / 2],
      [cx - initW / 2, cy + initH / 2]
    ];
  }

  // 小数タイリング画像を生成
  _getTiledImageData() {
    const baseData = this.sourceLayer ? this.sourceLayer._cachedImageData : this._cachedImageData;
    if (!baseData) return null;

    const repX = Math.ceil(this.tileX);
    const repY = Math.ceil(this.tileY);
    const targetW = Math.max(1, Math.round(baseData.width * this.tileX));
    const targetH = Math.max(1, Math.round(baseData.height * this.tileY));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = baseData.width;
    tempCanvas.height = baseData.height;
    tempCanvas.getContext('2d').putImageData(baseData, 0, 0);

    for (let y = 0; y < repY; y++) {
      for (let x = 0; x < repX; x++) {
        ctx.drawImage(tempCanvas, x * baseData.width, y * baseData.height);
      }
    }

    return ctx.getImageData(0, 0, targetW, targetH);
  }

  getMultiplierMap(targetW, targetH, maskRgbData) {
    if (this.layerType !== 'multiply' || !this.visible || this.opacity <= 0) {
      return new Float32Array(targetW * targetH).fill(1.0);
    }

    const tiledData = this._getTiledImageData();
    if (!tiledData) return new Float32Array(targetW * targetH).fill(1.0);

    const sampled = sampleWarpedTexture(tiledData, this.corners, targetW, targetH, this.fillAll, this.transformMode);
    if (!sampled) return new Float32Array(targetW * targetH).fill(1.0);

    const multMap = new Float32Array(targetW * targetH).fill(1.0);
    const tCol = this.targetMaskColor;

    for (let i = 0; i < targetW * targetH; i++) {
      if (tCol && maskRgbData) {
        const mr = maskRgbData[i * 3], mg = maskRgbData[i * 3 + 1], mb = maskRgbData[i * 3 + 2];
        if (mr !== tCol[0] || mg !== tCol[1] || mb !== tCol[2]) continue;
      }

      const r = sampled[i * 4];
      const g = sampled[i * 4 + 1];
      const b = sampled[i * 4 + 2];
      const alpha = sampled[i * 4 + 3] * this.opacity;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      multMap[i] = 1.0 - alpha * (1.0 - gray);
    }

    return multMap;
  }

  getWarpedStructure(targetW, targetH, maskRgbData) {
    if (this.layerType !== 'structure' || !this.visible || this.opacity <= 0) return null;

    const tiledData = this._getTiledImageData();
    if (!tiledData) return null;

    // 24bitカラー画像の #E7FFFF 透過前処理
    if (this.transparentE7ffff) {
      const d = tiledData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === 231 && d[i + 1] === 255 && d[i + 2] === 255) {
          d[i] = 192;
          d[i + 1] = 192;
          d[i + 2] = 192;
          d[i + 3] = 0; // 透過
        }
      }
    }

    const sampled = sampleWarpedTexture(tiledData, this.corners, targetW, targetH, this.fillAll, this.transformMode);
    if (!sampled) return null;

    const tCol = this.targetMaskColor;
    if (tCol && maskRgbData) {
      for (let i = 0; i < targetW * targetH; i++) {
        const mr = maskRgbData[i * 3], mg = maskRgbData[i * 3 + 1], mb = maskRgbData[i * 3 + 2];
        if (mr !== tCol[0] || mg !== tCol[1] || mb !== tCol[2]) {
          sampled[i * 4 + 3] = 0;
        }
      }
    }

    // 不透明度の反映
    for (let i = 0; i < targetW * targetH; i++) {
      sampled[i * 4 + 3] *= this.opacity;
    }

    return sampled;
  }

  toDict(layerList = []) {
    const srcIdx = this.sourceLayer ? layerList.indexOf(this.sourceLayer) : null;
    return {
      name: this.name,
      corners: this.corners.map(([x, y]) => [x, y]),
      opacity: Number(this.opacity),
      visible: Boolean(this.visible),
      transform_mode: this.transformMode,
      tile_x: Number(this.tileX),
      tile_y: Number(this.tileY),
      target_mask_color: this.targetMaskColor ? [...this.targetMaskColor] : null,
      layer_type: this.layerType,
      fill_all: Boolean(this.fillAll),
      transparent_e7ffff: Boolean(this.transparentE7ffff),
      source_idx: srcIdx !== -1 ? srcIdx : null
    };
  }
}