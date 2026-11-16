// 単一レイヤーのデータ構造と変形計算（乗算テクスチャ / ストラクチャー小物）

export class Layer {
  constructor({
    name,
    imageElement,
    canvasW,
    canvasH,
    layerType = 'multiply',
    corners = null,
    transformMode = 'box',
    opacity = 1.0,
    visible = true,
    fillAll = false,
    transparentE7ffff = false,
    excludeMaskColor = false,
    tileX = 1.0,
    tileY = 1.0,
    targetMaskColor = null,
    targetMaskId = null,
    sourceLayer = null
  }) {
    this.name = name || 'layer.png';
    this.imageElement = imageElement;
    this.layerType = layerType;
    this.transformMode = transformMode;
    this.opacity = opacity;
    this.visible = visible;
    this.fillAll = fillAll;
    this.transparentE7ffff = transparentE7ffff;
    this.excludeMaskColor = excludeMaskColor;
    this.tileX = tileX;
    this.tileY = tileY;
    this.targetMaskColor = targetMaskColor; // [r, g, b] | null
    this.targetMaskId = targetMaskId;       // number (マスクID) | null (全マスク共通)
    this.sourceLayer = sourceLayer;

    const iw = imageElement ? (imageElement.naturalWidth || imageElement.width || canvasW) : canvasW;
    const ih = imageElement ? (imageElement.naturalHeight || imageElement.height || canvasH) : canvasH;
    this.corners = corners || [
      [0, 0],
      [iw, 0],
      [iw, ih],
      [0, ih]
    ];
  }

  // 指定されたマスクIDに対してこのレイヤーが有効かどうか
  isActiveForMask(activeMaskId) {
    if (this.targetMaskId === null || this.targetMaskId === undefined) return true;
    if (activeMaskId === null || activeMaskId === undefined) return false;
    return this.targetMaskId === activeMaskId;
  }

  replaceImage(img, name) {
    this.imageElement = img;
    if (name) this.name = name;
  }

  _matchMaskPixel(maskRgb, idx) {
    if (!this.targetMaskColor) return true;
    if (!maskRgb) return false;
    const [tr, tg, tb] = this.targetMaskColor;
    const isMatch = maskRgb[idx * 3] === tr && maskRgb[idx * 3 + 1] === tg && maskRgb[idx * 3 + 2] === tb;
    return this.excludeMaskColor ? !isMatch : isMatch;
  }

  _getQuadBounds(baseW, baseH) {
    if (this.fillAll) return { minX: 0, minY: 0, maxX: baseW - 1, maxY: baseH - 1 };
    let minX = baseW, minY = baseH, maxX = -1, maxY = -1;
    for (const [cx, cy] of this.corners) {
      if (cx < minX) minX = Math.floor(cx);
      if (cx > maxX) maxX = Math.ceil(cx);
      if (cy < minY) minY = Math.floor(cy);
      if (cy > maxY) maxY = Math.ceil(cy);
    }
    return {
      minX: Math.max(0, minX),
      minY: Math.max(0, minY),
      maxX: Math.min(baseW - 1, maxX),
      maxY: Math.min(baseH - 1, maxY)
    };
  }

  _sampleSource(u, v) {
    if (!this._srcData) {
      const iw = this.imageElement.naturalWidth || this.imageElement.width;
      const ih = this.imageElement.naturalHeight || this.imageElement.height;
      const c = document.createElement('canvas');
      c.width = iw;
      c.height = ih;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.imageElement, 0, 0);
      this._srcW = iw;
      this._srcH = ih;
      this._srcData = ctx.getImageData(0, 0, iw, ih).data;
    }
    const tu = ((u * this.tileX) % 1 + 1) % 1;
    const tv = ((v * this.tileY) % 1 + 1) % 1;
    const sx = Math.min(this._srcW - 1, Math.floor(tu * this._srcW));
    const sy = Math.min(this._srcH - 1, Math.floor(tv * this._srcH));
    const idx = (sy * this._srcW + sx) * 4;
    return [this._srcData[idx], this._srcData[idx + 1], this._srcData[idx + 2], this._srcData[idx + 3]];
  }

  _inverseBilinear(px, py) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = this.corners;
    const ex = x1 - x0, ey = y1 - y0;
    const fx = x3 - x0, fy = y3 - y0;
    const gx = x0 - x1 + x2 - x3, gy = y0 - y1 + y2 - y3;
    const hx = px - x0, hy = py - y0;

    const k2 = gx * fy - gy * ex;
    const k1 = ex * fy - ey * fx + hx * gy - hy * gx;
    const k0 = hx * ey - hy * ex;

    let v;
    if (Math.abs(k2) < 1e-6) {
      if (Math.abs(k1) < 1e-6) return null;
      v = -k0 / k1;
    } else {
      const disc = k1 * k1 - 4 * k2 * k0;
      if (disc < 0) return null;
      const sq = Math.sqrt(disc);
      v = (-k1 - sq) / (2 * k2);
      if (v < -1e-4 || v > 1 + 1e-4) v = (-k1 + sq) / (2 * k2);
    }

    const denomX = ex + gx * v;
    const denomY = ey + gy * v;
    const u = Math.abs(denomX) > Math.abs(denomY)
      ? (hx - fx * v) / (denomX || 1e-6)
      : (hy - fy * v) / (denomY || 1e-6);

    if (!this.fillAll && (u < -1e-4 || u > 1 + 1e-4 || v < -1e-4 || v > 1 + 1e-4)) return null;
    return [u, v];
  }

  getMultiplierMap(baseW, baseH, maskRgb) {
    this._srcData = null;
    const map = new Float32Array(baseW * baseH).fill(1.0);
    if (!this.imageElement) return map;

    const { minX, minY, maxX, maxY } = this._getQuadBounds(baseW, baseH);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = y * baseW + x;
        if (!this._matchMaskPixel(maskRgb, i)) continue;
        const uv = this._inverseBilinear(x + 0.5, y + 0.5);
        if (!uv) continue;
        const [r, g, b, a] = this._sampleSource(uv[0], uv[1]);
        if (a === 0) continue;
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
        const alpha = (a / 255.0) * this.opacity;
        map[i] = 1.0 - alpha * (1.0 - lum);
      }
    }
    return map;
  }

  getWarpedStructure(baseW, baseH, maskRgb) {
    this._srcData = null;
    if (!this.imageElement) return null;
    const out = new Float32Array(baseW * baseH * 4);
    const { minX, minY, maxX, maxY } = this._getQuadBounds(baseW, baseH);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = y * baseW + x;
        if (!this._matchMaskPixel(maskRgb, i)) continue;
        const uv = this._inverseBilinear(x + 0.5, y + 0.5);
        if (!uv) continue;
        const [r, g, b, a] = this._sampleSource(uv[0], uv[1]);
        if (a === 0) continue;
        if (this.transparentE7ffff && r === 231 && g === 255 && b === 255) continue;

        const sa = (a / 255.0) * this.opacity;
        out[i * 4] = r / 255.0;
        out[i * 4 + 1] = g / 255.0;
        out[i * 4 + 2] = b / 255.0;
        out[i * 4 + 3] = sa;
      }
    }
    return out;
  }
}