import { hexToRgb, hsvToRgb } from './color-utils.js';

// 3D表面法線 N=(nx, ny, nz) から4つのグレー基準色に基づく輝度(0..255)を算出
export function computeAircraftShade(nx, ny, nz, shadeColors) {
  const mag = Math.hypot(nx, ny, nz) || 1.0;
  const ux = nx / mag;
  const uy = ny / mag;
  const uz = nz / mag;

  const lumTop = shadeColors.topLum;
  const lumLeft = shadeColors.leftLum;
  const lumRight = shadeColors.rightLum;
  const lumSun = shadeColors.sunLum;

  // 光源ベクトル L: 水平面から60度上がった左斜め前 (-1/√2, 0, +1/√2)
  const elev = (60.0 * Math.PI) / 180.0;
  const s2 = Math.SQRT2;
  const lx = -Math.cos(elev) / s2;
  const ly = Math.sin(elev);
  const lz = Math.cos(elev) / s2;

  // 1. 水平壁面の左右方向補間 (左斜め前: lumLeft, 右斜め前: lumRight)
  const uHoriz = Math.max(0.0, Math.min(1.0, 0.5 - (ux * s2) * 0.5));
  const backFactor = uz >= 0 ? 1.0 : Math.max(0.75, 1.0 + uz * 0.25);
  const wallLum = (lumRight + (lumLeft - lumRight) * uHoriz) * backFactor;

  // 2. 上向き成分 uy による壁面 -> 上水平面 (lumTop) 補間
  let baseLum;
  if (uy >= 0) {
    baseLum = wallLum + (lumTop - wallLum) * uy;
  } else {
    baseLum = wallLum * Math.max(0.5, 1.0 + uy * 0.5);
  }

  // 3. 光源方向 L への一致度 dotL > ly (水平面以上) で lumTop -> lumSun へハイライト補間
  const dotL = ux * lx + uy * ly + uz * lz;
  if (dotL > ly) {
    const tSun = Math.min(1.0, (dotL - ly) / Math.max(1e-6, 1.0 - ly));
    baseLum = baseLum + (lumSun - baseLum) * tSun;
  }

  return Math.max(0, Math.min(255, Math.round(baseLum)));
}

export function buildShadeColorConfig(rawOpts = {}) {
  const getLum = (hex, fallback) => {
    const [r, g, b] = hexToRgb(hex || fallback);
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  };
  return {
    topLum: getLum(rawOpts.topColor, '#CCCCCC'),
    leftLum: getLum(rawOpts.leftWallColor, '#B2B2B2'),
    rightLum: getLum(rawOpts.rightWallColor, '#808080'),
    sunLum: getLum(rawOpts.sunColor, '#FFFFFF')
  };
}

// 部品種別ごとのマスク色割り当て
// 翼＝グレー、胴体・垂直尾翼・エンジン・プロペラ＝彩度20%でそれぞれ異なる色相
export function assignPartMaskColors(groups) {
  let distinctIdx = 0;
  let wingIdx = 0;
  const wingGrays = [
    [128, 128, 128], // #808080
    [144, 144, 144], // #909090
    [112, 112, 112], // #707070
    [160, 160, 160]  // #A0A0A0
  ];

  groups.forEach((grp) => {
    if (grp.partType === 'wing') {
      grp.maskRgb = wingGrays[wingIdx % wingGrays.length];
      wingIdx++;
    } else {
      // 黄金角(137.508度)ずつ色相をずらし、彩度20%・明度95%で別々の色を割り当て
      const hue = Math.round((distinctIdx * 137.508) % 360);
      grp.maskRgb = hsvToRgb(hue, 20, 95);
      distinctIdx++;
    }
  });
}

// 2D凸包計算（投影点群の外周ポリゴン頂点列を返す）
export function computeConvexHull2D(points) {
  const uniq = [];
  const seen = new Set();
  for (const [x, y] of points) {
    const key = `${Math.round(x * 100)},${Math.round(y * 100)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push([x, y]);
    }
  }
  if (uniq.length <= 2) return uniq;

  uniq.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower = [];
  for (const p of uniq) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = uniq.length - 1; i >= 0; i--) {
    const p = uniq[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// 2D三角形スキャンラインラスタライズ（ベース画像とマスク画像を同時に上書き描画）
export function fillTriangle2D(baseData, maskData, outW, outH, p0, p1, p2, grayVal, maskRgb) {
  const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
  const maxX = Math.min(outW - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
  const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
  const maxY = Math.min(outH - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));

  if (maxX < minX || maxY < minY) return;

  const [x0, y0] = p0;
  const [x1, y1] = p1;
  const [x2, y2] = p2;

  const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (Math.abs(denom) < 1e-6) return;
  const invDenom = 1.0 / denom;
  const [mr, mg, mb] = maskRgb;

  for (let py = minY; py <= maxY; py++) {
    const cy = py + 0.5;
    const rowOff = py * outW;
    for (let px = minX; px <= maxX; px++) {
      const cx = px + 0.5;
      const w0 = ((y1 - y2) * (cx - x2) + (x2 - x1) * (cy - y2)) * invDenom;
      const w1 = ((y2 - y0) * (cx - x2) + (x0 - x2) * (cy - y2)) * invDenom;
      const w2 = 1.0 - w0 - w1;

      if (w0 >= -1e-4 && w1 >= -1e-4 && w2 >= -1e-4) {
        const idx = (rowOff + px) * 4;
        baseData[idx] = grayVal;
        baseData[idx + 1] = grayVal;
        baseData[idx + 2] = grayVal;
        baseData[idx + 3] = 255;

        maskData[idx] = mr;
        maskData[idx + 1] = mg;
        maskData[idx + 2] = mb;
        maskData[idx + 3] = 255;
      }
    }
  }
}

export function fillQuad2D(baseData, maskData, outW, outH, q0, q1, q2, q3, grayVal, maskRgb) {
  fillTriangle2D(baseData, maskData, outW, outH, q0, q1, q2, grayVal, maskRgb);
  fillTriangle2D(baseData, maskData, outW, outH, q0, q2, q3, grayVal, maskRgb);
}

// 2D多角形塗りつぶし（扇形三角形分割＋2点線分フォールバック）
export function fillPolygon2D(baseData, maskData, outW, outH, polyPts, grayVal, maskRgb) {
  if (!polyPts || polyPts.length === 0) return;
  const [mr, mg, mb] = maskRgb;

  if (polyPts.length === 1) {
    const px = Math.round(polyPts[0][0]);
    const py = Math.round(polyPts[0][1]);
    if (px >= 0 && px < outW && py >= 0 && py < outH) {
      const idx = (py * outW + px) * 4;
      baseData[idx] = grayVal; baseData[idx + 1] = grayVal; baseData[idx + 2] = grayVal; baseData[idx + 3] = 255;
      maskData[idx] = mr; maskData[idx + 1] = mg; maskData[idx + 2] = mb; maskData[idx + 3] = 255;
    }
    return;
  }

  if (polyPts.length === 2) {
    const [x0, y0] = polyPts[0];
    const [x1, y1] = polyPts[1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = Math.round(x0 + (x1 - x0) * t);
      const py = Math.round(y0 + (y1 - y0) * t);
      if (px >= 0 && px < outW && py >= 0 && py < outH) {
        const idx = (py * outW + px) * 4;
        baseData[idx] = grayVal; baseData[idx + 1] = grayVal; baseData[idx + 2] = grayVal; baseData[idx + 3] = 255;
        maskData[idx] = mr; maskData[idx + 1] = mg; maskData[idx + 2] = mb; maskData[idx + 3] = 255;
      }
    }
    return;
  }

  for (let i = 1; i < polyPts.length - 1; i++) {
    fillTriangle2D(baseData, maskData, outW, outH, polyPts[0], polyPts[i], polyPts[i + 1], grayVal, maskRgb);
  }
}