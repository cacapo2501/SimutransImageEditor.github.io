export function getPerspectiveTransform(src, dst) {
  const a = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i], [dx, dy] = dst[i];
    a.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]); b.push(dx);
    a.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]); b.push(dy);
  }
  for (let i = 0; i < 8; i++) {
    let maxRow = i;
    for (let k = i + 1; k < 8; k++) if (Math.abs(a[k][i]) > Math.abs(a[maxRow][i])) maxRow = k;
    [a[i], a[maxRow]] = [a[maxRow], a[i]]; [b[i], b[maxRow]] = [b[maxRow], b[i]];
    for (let k = i + 1; k < 8; k++) {
      const c = -a[k][i] / a[i][i];
      for (let j = i; j < 8; j++) a[k][j] = i === j ? 0 : a[k][j] + c * a[i][j];
      b[k] += c * b[i];
    }
  }
  const h = new Array(9);
  for (let i = 7; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < 8; j++) sum += a[i][j] * h[j];
    h[i] = (b[i] - sum) / a[i][i];
  }
  h[8] = 1;
  return h;
}

export function invertMatrix3x3(m) {
  const [a, b, c, d, e, f, g, h, k] = m;
  const A = e * k - f * h, B = -(d * k - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1.0 / det;
  return [
    A * inv, (c * h - b * k) * inv, (b * f - c * e) * inv,
    B * inv, (a * k - c * g) * inv, (c * d - a * f) * inv,
    C * inv, (b * g - a * h) * inv, (a * e - b * d) * inv
  ];
}

export function sampleWarpedTexture(srcImageData, corners, targetW, targetH, fillAll, transformMode) {
  const srcW = srcImageData.width, srcH = srcImageData.height;
  const H = getPerspectiveTransform([[0, 0], [srcW, 0], [srcW, srcH], [0, srcH]], corners);
  const invH = invertMatrix3x3(H);
  if (!invH) return null;
  const out = new Float32Array(targetW * targetH * 4);
  const useWrap = fillAll && (transformMode === 'box' || transformMode === 'affine');
  const src = srcImageData.data;

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const denom = invH[6] * x + invH[7] * y + invH[8];
      if (Math.abs(denom) < 1e-7) continue;
      let u = (invH[0] * x + invH[1] * y + invH[2]) / denom;
      let v = (invH[3] * x + invH[4] * y + invH[5]) / denom;

      if (useWrap) {
        u = ((u % srcW) + srcW) % srcW;
        v = ((v % srcH) + srcH) % srcH;
      } else {
        if (u < 0 || u >= srcW || v < 0 || v >= srcH) continue;
      }

      const sIdx = (Math.floor(v) * srcW + Math.floor(u)) * 4;
      const idx = (y * targetW + x) * 4;
      out[idx] = src[sIdx] / 255.0;
      out[idx + 1] = src[sIdx + 1] / 255.0;
      out[idx + 2] = src[sIdx + 2] / 255.0;
      out[idx + 3] = src[sIdx + 3] / 255.0;
    }
  }
  return out;
}

export function applyProtectedBlur(pixelsF32, width, height, blurRadius, invalidMask) {
  if (blurRadius <= 0.001) return pixelsF32;
  const sigma = blurRadius;
  const kRadius = Math.max(1, Math.ceil(sigma * 3));
  const kSize = kRadius * 2 + 1;
  const kernel = new Float32Array(kSize);
  let kSum = 0;
  for (let i = -kRadius; i <= kRadius; i++) {
    const val = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + kRadius] = val;
    kSum += val;
  }
  for (let i = 0; i < kSize; i++) kernel[i] /= kSum;

  const total = width * height;
  const tempImg = new Float32Array(total * 3), tempW = new Float32Array(total);
  const outImg = new Float32Array(total * 3), outW = new Float32Array(total);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let r = 0, g = 0, b = 0, w = 0;
      for (let k = -kRadius; k <= kRadius; k++) {
        const nx = Math.min(width - 1, Math.max(0, x + k));
        const nIdx = y * width + nx;
        if (!invalidMask[nIdx]) {
          const kw = kernel[k + kRadius];
          r += pixelsF32[nIdx * 3] * kw; g += pixelsF32[nIdx * 3 + 1] * kw; b += pixelsF32[nIdx * 3 + 2] * kw;
          w += kw;
        }
      }
      tempImg[idx * 3] = r; tempImg[idx * 3 + 1] = g; tempImg[idx * 3 + 2] = b; tempW[idx] = w;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let r = 0, g = 0, b = 0, w = 0;
      for (let k = -kRadius; k <= kRadius; k++) {
        const ny = Math.min(height - 1, Math.max(0, y + k));
        const nIdx = ny * width + x;
        const kw = kernel[k + kRadius];
        r += tempImg[nIdx * 3] * kw; g += tempImg[nIdx * 3 + 1] * kw; b += tempImg[nIdx * 3 + 2] * kw;
        w += tempW[nIdx] * kw;
      }
      outImg[idx * 3] = r; outImg[idx * 3 + 1] = g; outImg[idx * 3 + 2] = b; outW[idx] = w;
    }
  }
  const res = new Float32Array(pixelsF32.length);
  for (let i = 0; i < total; i++) {
    if (invalidMask[i] || outW[i] < 1e-5) {
      res[i * 3] = pixelsF32[i * 3]; res[i * 3 + 1] = pixelsF32[i * 3 + 1]; res[i * 3 + 2] = pixelsF32[i * 3 + 2];
    } else {
      res[i * 3] = Math.min(1.0, Math.max(0, outImg[i * 3] / outW[i]));
      res[i * 3 + 1] = Math.min(1.0, Math.max(0, outImg[i * 3 + 1] / outW[i]));
      res[i * 3 + 2] = Math.min(1.0, Math.max(0, outImg[i * 3 + 2] / outW[i]));
    }
  }
  return res;
}