/**
 * 4頂点透視投影 (Homography) 行列を計算 (3x3 行列)
 * src: [[x0,y0], [x1,y1], [x2,y2], [x3,y3]]
 * dst: [[u0,v0], [u1,v1], [u2,v2], [u3,v3]]
 */
export function getPerspectiveTransform(src, dst) {
  const a = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i];
    const [dx, dy] = dst[i];
    a.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    a.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  // ガウスの消去法で解く
  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > Math.abs(a[maxRow][i])) maxRow = k;
    }
    [a[i], a[maxRow]] = [a[maxRow], a[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    for (let k = i + 1; k < n; k++) {
      const c = -a[k][i] / a[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) a[k][j] = 0;
        else a[k][j] += c * a[i][j];
      }
      b[k] += c * b[i];
    }
  }

  const h = new Array(9);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += a[i][j] * h[j];
    h[i] = (b[i] - sum) / a[i][i];
  }
  h[8] = 1;
  return h;
}

// 3x3 行列の逆行列を計算
export function invertMatrix3x3(m) {
  const [a, b, c, d, e, f, g, h, k] = m;
  const A = e * k - f * h;
  const B = -(d * k - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;

  const invDet = 1.0 / det;
  return [
    A * invDet, (c * h - b * k) * invDet, (b * f - c * e) * invDet,
    B * invDet, (a * k - c * g) * invDet, (c * d - a * f) * invDet,
    C * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet
  ];
}

/**
 * 逆透視マッピングによるテクスチャサンプリング (BORDER_WRAP対応)
 */
export function sampleWarpedTexture(srcImageData, corners, targetW, targetH, fillAll, transformMode) {
  const srcW = srcImageData.width;
  const srcH = srcImageData.height;
  const srcPts = [[0, 0], [srcW, 0], [srcW, srcH], [0, srcH]];
  const dstPts = corners;

  // キャンバス座標 (x, y) からテクスチャ座標 (u, v) へ逆変換
  const H = getPerspectiveTransform(srcPts, dstPts);
  const invH = invertMatrix3x3(H);
  if (!invH) return null;

  const outData = new Float32Array(targetW * targetH * 4);
  const useWrap = fillAll && (transformMode === 'box' || transformMode === 'affine');
  const srcPixels = srcImageData.data;

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const idx = (y * targetW + x) * 4;

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

      // ニアレストネイバー (ドット絵の整合性を担保)
      const su = Math.floor(u);
      const sv = Math.floor(v);
      const sIdx = (sv * srcW + su) * 4;

      outData[idx] = srcPixels[sIdx] / 255.0;
      outData[idx + 1] = srcPixels[sIdx + 1] / 255.0;
      outData[idx + 2] = srcPixels[sIdx + 2] / 255.0;
      outData[idx + 3] = srcPixels[sIdx + 3] / 255.0;
    }
  }

  return outData;
}

/**
 * SpecialColor完全保護の正規化畳み込みぼかし (Normalized Convolution)
 */
export function applyProtectedBlur(pixelsF32, width, height, blurRadius, invalidMask) {
  if (blurRadius <= 0.001) return pixelsF32;

  const sigma = blurRadius;
  const kRadius = Math.max(1, Math.ceil(sigma * 3));
  const kSize = kRadius * 2 + 1;

  // ガウシアンカーネル (1D)
  const kernel = new Float32Array(kSize);
  let kSum = 0;
  for (let i = -kRadius; i <= kRadius; i++) {
    const val = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + kRadius] = val;
    kSum += val;
  }
  for (let i = 0; i < kSize; i++) kernel[i] /= kSum;

  const totalPixels = width * height;
  const tempImg = new Float32Array(totalPixels * 3);
  const tempW = new Float32Array(totalPixels);
  const outImg = new Float32Array(totalPixels * 3);
  const outW = new Float32Array(totalPixels);

  // 水平畳み込み
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let r = 0, g = 0, b = 0, w = 0;

      for (let k = -kRadius; k <= kRadius; k++) {
        const nx = Math.min(width - 1, Math.max(0, x + k));
        const nIdx = y * width + nx;
        if (!invalidMask[nIdx]) {
          const kw = kernel[k + kRadius];
          r += pixelsF32[nIdx * 3] * kw;
          g += pixelsF32[nIdx * 3 + 1] * kw;
          b += pixelsF32[nIdx * 3 + 2] * kw;
          w += kw;
        }
      }
      tempImg[idx * 3] = r;
      tempImg[idx * 3 + 1] = g;
      tempImg[idx * 3 + 2] = b;
      tempW[idx] = w;
    }
  }

  // 垂直畳み込み
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let r = 0, g = 0, b = 0, w = 0;

      for (let k = -kRadius; k <= kRadius; k++) {
        const ny = Math.min(height - 1, Math.max(0, y + k));
        const nIdx = ny * width + x;
        const kw = kernel[k + kRadius];
        r += tempImg[nIdx * 3] * kw;
        g += tempImg[nIdx * 3 + 1] * kw;
        b += tempImg[nIdx * 3 + 2] * kw;
        w += tempW[nIdx] * kw;
      }
      outImg[idx * 3] = r;
      outImg[idx * 3 + 1] = g;
      outImg[idx * 3 + 2] = b;
      outW[idx] = w;
    }
  }

  // 正規化とSpecialColorの100%復元
  const result = new Float32Array(pixelsF32.length);
  for (let i = 0; i < totalPixels; i++) {
    if (invalidMask[i] || outW[i] < 1e-5) {
      result[i * 3] = pixelsF32[i * 3];
      result[i * 3 + 1] = pixelsF32[i * 3 + 1];
      result[i * 3 + 2] = pixelsF32[i * 3 + 2];
    } else {
      result[i * 3] = Math.min(1.0, Math.max(0, outImg[i * 3] / outW[i]));
      result[i * 3 + 1] = Math.min(1.0, Math.max(0, outImg[i * 3 + 1] / outW[i]));
      result[i * 3 + 2] = Math.min(1.0, Math.max(0, outImg[i * 3 + 2] / outW[i]));
    }
  }

  return result;
}