// 4点射影変換（ホモグラフィ）行列の計算: (u,v) [0..1]^2 -> (x,y)
function computeHomography(corners) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;

  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-8) {
    return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0, 1];
  }

  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const c = x0;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const f = y0;

  return [a, b, c, d, e, f, g, h, 1];
}

// 3x3 行列の逆行列
function invert3x3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-10) return null;
  const invDet = 1.0 / det;
  return [
    A * invDet, D * invDet, G * invDet,
    B * invDet, E * invDet, H * invDet,
    C * invDet, F * invDet, I * invDet
  ];
}

// テクスチャの変形サンプリング (box / affine / free)
export function sampleWarpedTexture(tiledImageData, corners, targetW, targetH, fillAll = false, transformMode = 'box') {
  const srcW = tiledImageData.width;
  const srcH = tiledImageData.height;
  const srcData = tiledImageData.data;

  const out = new Float32Array(targetW * targetH * 4);
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;

  if (transformMode === 'free') {
    const H = computeHomography(corners);
    const invH = invert3x3(H);
    if (!invH) return out;

    const [ia, ib, ic, id, ie, if_, ig, ih, ii] = invH;

    for (let y = 0; y < targetH; y++) {
      const py = y + 0.5;
      for (let x = 0; x < targetW; x++) {
        const px = x + 0.5;
        const w = ig * px + ih * py + ii;
        if (Math.abs(w) < 1e-8) continue;

        let u = (ia * px + ib * py + ic) / w;
        let v = (id * px + ie * py + if_) / w;

        if (fillAll) {
          u = ((u % 1) + 1) % 1;
          v = ((v % 1) + 1) % 1;
        } else {
          if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        }

        const sx = Math.min(srcW - 1, Math.max(0, Math.floor(u * srcW)));
        const sy = Math.min(srcH - 1, Math.max(0, Math.floor(v * srcH)));
        const sIdx = (sy * srcW + sx) * 4;
        const dIdx = (y * targetW + x) * 4;

        out[dIdx] = srcData[sIdx] / 255.0;
        out[dIdx + 1] = srcData[sIdx + 1] / 255.0;
        out[dIdx + 2] = srcData[sIdx + 2] / 255.0;
        out[dIdx + 3] = srcData[sIdx + 3] / 255.0;
      }
    }
    return out;
  }

  // box または affine (3頂点アフィン逆写像)
  const ux = x1 - x0, uy = y1 - y0;
  const vx = x3 - x0, vy = y3 - y0;
  const det = ux * vy - uy * vx;
  if (Math.abs(det) < 1e-8) return out;
  const invDet = 1.0 / det;

  for (let y = 0; y < targetH; y++) {
    const dy = (y + 0.5) - y0;
    for (let x = 0; x < targetW; x++) {
      const dx = (x + 0.5) - x0;
      let u = (dx * vy - dy * vx) * invDet;
      let v = (ux * dy - uy * dx) * invDet;

      if (fillAll) {
        u = ((u % 1) + 1) % 1;
        v = ((v % 1) + 1) % 1;
      } else {
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      }

      const sx = Math.min(srcW - 1, Math.max(0, Math.floor(u * srcW)));
      const sy = Math.min(srcH - 1, Math.max(0, Math.floor(v * srcH)));
      const sIdx = (sy * srcW + sx) * 4;
      const dIdx = (y * targetW + x) * 4;

      out[dIdx] = srcData[sIdx] / 255.0;
      out[dIdx + 1] = srcData[sIdx + 1] / 255.0;
      out[dIdx + 2] = srcData[sIdx + 2] / 255.0;
      out[dIdx + 3] = srcData[sIdx + 3] / 255.0;
    }
  }
  return out;
}

// SpecialColor・背景色を完全に除外してぼかすガウシアンフィルタ
export function applyProtectedBlur(rgbFloat32, width, height, radius, invalidMask) {
  if (radius <= 0.001) return new Float32Array(rgbFloat32);

  const rCeil = Math.ceil(radius * 2.5);
  const sigma = Math.max(0.1, radius);
  const twoSigmaSq = 2 * sigma * sigma;

  const kernel = [];
  for (let k = -rCeil; k <= rCeil; k++) {
    kernel.push({ offset: k, weight: Math.exp(-(k * k) / twoSigmaSq) });
  }

  const temp = new Float32Array(rgbFloat32.length);
  const out = new Float32Array(rgbFloat32.length);

  // 水平方向パス
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (invalidMask && invalidMask[idx]) {
        temp[idx * 3] = rgbFloat32[idx * 3];
        temp[idx * 3 + 1] = rgbFloat32[idx * 3 + 1];
        temp[idx * 3 + 2] = rgbFloat32[idx * 3 + 2];
        continue;
      }

      let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
      for (const { offset, weight } of kernel) {
        const nx = x + offset;
        if (nx < 0 || nx >= width) continue;
        const nIdx = y * width + nx;
        if (invalidMask && invalidMask[nIdx]) continue;

        rSum += rgbFloat32[nIdx * 3] * weight;
        gSum += rgbFloat32[nIdx * 3 + 1] * weight;
        bSum += rgbFloat32[nIdx * 3 + 2] * weight;
        wSum += weight;
      }

      if (wSum > 0) {
        temp[idx * 3] = rSum / wSum;
        temp[idx * 3 + 1] = gSum / wSum;
        temp[idx * 3 + 2] = bSum / wSum;
      } else {
        temp[idx * 3] = rgbFloat32[idx * 3];
        temp[idx * 3 + 1] = rgbFloat32[idx * 3 + 1];
        temp[idx * 3 + 2] = rgbFloat32[idx * 3 + 2];
      }
    }
  }

  // 垂直方向パス
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (invalidMask && invalidMask[idx]) {
        out[idx * 3] = rgbFloat32[idx * 3];
        out[idx * 3 + 1] = rgbFloat32[idx * 3 + 1];
        out[idx * 3 + 2] = rgbFloat32[idx * 3 + 2];
        continue;
      }

      let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
      for (const { offset, weight } of kernel) {
        const ny = y + offset;
        if (ny < 0 || ny >= height) continue;
        const nIdx = ny * width + x;
        if (invalidMask && invalidMask[nIdx]) continue;

        rSum += temp[nIdx * 3] * weight;
        gSum += temp[nIdx * 3 + 1] * weight;
        bSum += temp[nIdx * 3 + 2] * weight;
        wSum += weight;
      }

      if (wSum > 0) {
        out[idx * 3] = rSum / wSum;
        out[idx * 3 + 1] = gSum / wSum;
        out[idx * 3 + 2] = bSum / wSum;
      } else {
        out[idx * 3] = temp[idx * 3];
        out[idx * 3 + 1] = temp[idx * 3 + 1];
        out[idx * 3 + 2] = temp[idx * 3 + 2];
      }
    }
  }

  return out;
}
