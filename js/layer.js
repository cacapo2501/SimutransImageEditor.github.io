import { sampleWarpedTexture } from './transform.js';

export class Layer {
  constructor(opts) {
    this.sourceLayer = opts.sourceLayer || null;
    this._visible = opts.visible !== undefined ? opts.visible : true;
    if (!this.sourceLayer) {
      this._name = opts.name || '';
      this._imageElement = opts.imageElement || null;
      this._opacity = opts.opacity !== undefined ? opts.opacity : 1.0;
      this._transformMode = opts.transformMode || 'box';
      this._tileX = Math.max(0.01, opts.tileX || 1.0);
      this._tileY = Math.max(0.01, opts.tileY || 1.0);
      this._targetMaskColor = opts.targetMaskColor ? [...opts.targetMaskColor] : null;
      this._layerType = opts.layerType || 'multiply';
      this._fillAll = opts.fillAll || false;
      this._transparentE7ffff = opts.transparentE7ffff || false;
      this._cachedImageData = null;
      if (this._imageElement) this._prepareImageData();
    } else {
      this._opacity = opts.opacity !== undefined ? opts.opacity : 1.0;
      this._transformMode = opts.transformMode || 'box';
      this._tileX = opts.tileX || 1.0;
      this._tileY = opts.tileY || 1.0;
      this._targetMaskColor = opts.targetMaskColor || null;
      this._layerType = opts.layerType || 'multiply';
      this._fillAll = opts.fillAll || false;
      this._transparentE7ffff = opts.transparentE7ffff || false;
    }
    if (opts.corners) {
      this.corners = opts.corners.map(([x, y]) => [x, y]);
    } else {
      this.resetTransform(opts.canvasW || 256, opts.canvasH || 256);
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
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    this._cachedImageData = ctx.getImageData(0, 0, c.width, c.height);
  }

  resetTransform(canvasW, canvasH) {
    const ow = this.imageElement ? (this.imageElement.naturalWidth || 64) : 64;
    const oh = this.imageElement ? (this.imageElement.naturalHeight || 64) : 64;
    const initW = Math.min(ow * this.tileX, canvasW * 0.6);
    const initH = initW * ((oh * this.tileY) / Math.max(1e-4, ow * this.tileX));
    const cx = canvasW / 2, cy = canvasH / 2;
    this.corners = [
      [cx - initW / 2, cy - initH / 2], [cx + initW / 2, cy - initH / 2],
      [cx + initW / 2, cy + initH / 2], [cx - initW / 2, cy + initH / 2]
    ];
  }

  _getTiledImageData() {
    const base = this.sourceLayer ? this.sourceLayer._cachedImageData : this._cachedImageData;
    if (!base) return null;
    const repX = Math.ceil(this.tileX), repY = Math.ceil(this.tileY);
    const tW = Math.max(1, Math.round(base.width * this.tileX)), tH = Math.max(1, Math.round(base.height * this.tileY));
    const c = document.createElement('canvas'); c.width = tW; c.height = tH;
    const ctx = c.getContext('2d');
    const tc = document.createElement('canvas'); tc.width = base.width; tc.height = base.height;
    tc.getContext('2d').putImageData(base, 0, 0);
    for (let y = 0; y < repY; y++) {
      for (let x = 0; x < repX; x++) ctx.drawImage(tc, x * base.width, y * base.height);
    }
    return ctx.getImageData(0, 0, tW, tH);
  }

  getMultiplierMap(targetW, targetH, maskRgbData) {
    if (this.layerType !== 'multiply' || !this.visible || this.opacity <= 0) return new Float32Array(targetW * targetH).fill(1.0);
    const tiled = this._getTiledImageData();
    if (!tiled) return new Float32Array(targetW * targetH).fill(1.0);
    const sampled = sampleWarpedTexture(tiled, this.corners, targetW, targetH, this.fillAll, this.transformMode);
    if (!sampled) return new Float32Array(targetW * targetH).fill(1.0);
    const out = new Float32Array(targetW * targetH).fill(1.0);
    const tCol = this.targetMaskColor;
    for (let i = 0; i < targetW * targetH; i++) {
      if (tCol && maskRgbData) {
        if (maskRgbData[i * 3] !== tCol[0] || maskRgbData[i * 3 + 1] !== tCol[1] || maskRgbData[i * 3 + 2] !== tCol[2]) continue;
      }
      const alpha = sampled[i * 4 + 3] * this.opacity;
      const gray = 0.299 * sampled[i * 4] + 0.587 * sampled[i * 4 + 1] + 0.114 * sampled[i * 4 + 2];
      out[i] = 1.0 - alpha * (1.0 - gray);
    }
    return out;
  }

  getWarpedStructure(targetW, targetH, maskRgbData) {
    if (this.layerType !== 'structure' || !this.visible || this.opacity <= 0) return null;
    const tiled = this._getTiledImageData();
    if (!tiled) return null;
    if (this.transparentE7ffff) {
      const d = tiled.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === 231 && d[i + 1] === 255 && d[i + 2] === 255) {
          d[i] = 192; d[i + 1] = 192; d[i + 2] = 192; d[i + 3] = 0;
        }
      }
    }
    const sampled = sampleWarpedTexture(tiled, this.corners, targetW, targetH, this.fillAll, this.transformMode);
    if (!sampled) return null;
    const tCol = this.targetMaskColor;
    for (let i = 0; i < targetW * targetH; i++) {
      if (tCol && maskRgbData) {
        if (maskRgbData[i * 3] !== tCol[0] || maskRgbData[i * 3 + 1] !== tCol[1] || maskRgbData[i * 3 + 2] !== tCol[2]) {
          sampled[i * 4 + 3] = 0;
        }
      }
      sampled[i * 4 + 3] *= this.opacity;
    }
    return sampled;
  }

  toDict(layerList) {
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